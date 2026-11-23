// Fully synthesized ICU soundscape (Web Audio API, no audio files).
//
//   ambient  room hum + ventilator hiss every ~4 s + faint hallway murmur
//   monitor  pulse beep that follows HR (pitch follows SpO2, like a real oximeter)
//   VF       urgent triple alarm tone, repeating
//   asystole continuous flatline tone
//   ROSC     1 s of total silence, one strong heartbeat, then beeps resume
//   chime    soft private-message chime for whispers
//
// Read-only: it only listens to `patient` state that the game already receives.
// Starts on the "Take the code" click so browsers allow audio.
import type { PatientState, Rhythm } from '../../model/contract'

const STORE_KEY = 'cbsn.audio'

type Listener = () => void

class Soundscape {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null // volume + mute
  private scene: GainNode | null = null // everything except chimes; used for the ROSC silence
  private noise: AudioBuffer | null = null
  private nodes: AudioScheduledSourceNode[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private intervals: ReturnType<typeof setInterval>[] = []
  private flatline: OscillatorNode | null = null
  private running = false

  private rhythm: Rhythm | null = null
  private hr = 0
  private spo2 = 95
  private beatsSilencedUntil = 0
  private pulseListeners = new Set<Listener>()

  volume = 0.7
  muted = false

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
      if (saved && typeof saved.volume === 'number') this.volume = Math.min(1, Math.max(0, saved.volume))
      if (saved && typeof saved.muted === 'boolean') this.muted = saved.muted
    } catch { /* storage unavailable: keep defaults */ }
  }

  // ---------- settings ----------
  setVolume(v: number) { this.volume = Math.min(1, Math.max(0, v)); this.applyMaster(); this.persist() }
  setMuted(m: boolean) { this.muted = m; this.applyMaster(); this.persist() }
  private persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ volume: this.volume, muted: this.muted })) } catch { /* ignore */ }
  }
  private applyMaster() {
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05)
  }

  /** Fires once per alarm cycle during VF/asystole (even when muted) so visuals can pulse in time. */
  onAlarmPulse(cb: Listener) { this.pulseListeners.add(cb); return () => { this.pulseListeners.delete(cb) } }

  // ---------- lifecycle ----------
  start() {
    if (this.running) return
    try {
      this.ctx ??= new AudioContext()
    } catch { return } // no Web Audio: game still works silently
    const ctx = this.ctx
    if (ctx.state === 'suspended') void ctx.resume()
    this.running = true

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    this.master.connect(ctx.destination)
    this.scene = ctx.createGain()
    this.scene.connect(this.master)

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

    this.startAmbient()
    this.beatLoop()
    this.alarmLoop()
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.timers.forEach(clearTimeout)
    this.intervals.forEach(clearInterval)
    this.timers = []
    this.intervals = []
    this.nodes.forEach((n) => { try { n.stop() } catch { /* already stopped */ } })
    this.nodes = []
    this.flatline = null
    this.master?.disconnect()
    this.master = this.scene = null
    this.rhythm = null
  }

  /** Feed every `patient` tick in. */
  update(p: PatientState | null) {
    if (!p || !this.running) return
    const prev = this.rhythm
    this.rhythm = p.rhythm
    this.hr = p.hr
    this.spo2 = p.spo2

    if (p.rhythm === 'asystole' && prev !== 'asystole') this.startFlatline()
    if (p.rhythm !== 'asystole' && prev === 'asystole') this.stopFlatline()
    if (p.rhythm === 'ROSC' && (prev === 'VF' || prev === 'asystole')) this.roscMoment()
  }

  chime() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    ;[1318.5, 1760].forEach((f, i) => this.tone(f, t + i * 0.09, 0.32, 0.03, 'sine', this.master!, 0.01))
  }

  // ---------- building blocks ----------
  private tone(freq: number, at: number, dur: number, vol: number, type: OscillatorType, dest: AudioNode, attack = 0.005) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(vol, at + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g).connect(dest)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    this.nodes.push(src)
    return src
  }

  private every(ms: number, fn: () => void) { fn(); this.intervals.push(setInterval(fn, ms)) }
  private after(ms: number, fn: () => void) { this.timers.push(setTimeout(() => { if (this.running) fn() }, ms)) }

  // ---------- ambient ----------
  private startAmbient() {
    const ctx = this.ctx!
    const scene = this.scene!

    // electrical room hum
    const humLp = ctx.createBiquadFilter()
    humLp.type = 'lowpass'
    humLp.frequency.value = 220
    humLp.connect(scene)
    ;[[60, 0.018], [120, 0.007], [180, 0.002]].forEach(([f, v]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.value = v
      o.connect(g).connect(humLp)
      o.start()
      this.nodes.push(o)
    })

    // ventilator: breathy hiss in, longer out, every ~4 s
    const hiss = this.noiseSource()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.8
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.002
    hiss.connect(bp).connect(hissGain).connect(scene)
    hiss.start()
    this.every(4000, () => {
      const t = ctx.currentTime
      hissGain.gain.cancelScheduledValues(t)
      hissGain.gain.setValueAtTime(0.002, t)
      hissGain.gain.linearRampToValueAtTime(0.03, t + 1.1)
      hissGain.gain.linearRampToValueAtTime(0.022, t + 1.5)
      hissGain.gain.exponentialRampToValueAtTime(0.002, t + 3.3)
    })

    // distant hallway murmur: very quiet, low and drifting
    const murmur = this.noiseSource()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 600
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 380
    band.Q.value = 1.2
    const mg = ctx.createGain()
    mg.gain.value = 0.008
    murmur.connect(lp).connect(band).connect(mg).connect(scene)
    murmur.start()
    this.every(1700, () => {
      mg.gain.setTargetAtTime(0.004 + Math.random() * 0.012, ctx.currentTime, 0.6)
      band.frequency.setTargetAtTime(300 + Math.random() * 220, ctx.currentTime, 0.8)
    })
  }

  // ---------- monitor ----------
  private beatLoop = () => {
    if (!this.running) return
    const beating = (this.rhythm === 'pre_arrest' || this.rhythm === 'ROSC') && this.hr > 0
    let next = 250
    if (beating && performance.now() > this.beatsSilencedUntil) {
      // higher sats = higher pitch, like a real pulse oximeter
      const pitch = 560 + Math.max(0, Math.min(25, this.spo2 - 75)) * 14
      this.tone(pitch, this.ctx!.currentTime, 0.09, 0.05, 'triangle', this.scene!)
      next = 60000 / Math.max(30, this.hr)
    }
    this.after(next, this.beatLoop)
  }

  private alarmLoop = () => {
    if (!this.running) return
    const r = this.rhythm
    if (r === 'VF' || r === 'asystole') {
      this.pulseListeners.forEach((l) => l())
      if (r === 'VF') {
        // high-priority pattern: three fast pulses
        const t = this.ctx!.currentTime
        for (let i = 0; i < 3; i++) this.tone(988, t + i * 0.17, 0.12, 0.06, 'square', this.scene!)
      }
    } else if (r && this.spo2 < 85) {
      // medium-priority: two slower tones for low SpO2 (fires on every other cycle)
      if (Math.floor(performance.now() / 1250) % 2 === 0) {
        const t = this.ctx!.currentTime
        this.tone(740, t, 0.18, 0.035, 'triangle', this.scene!)
        this.tone(740, t + 0.28, 0.18, 0.035, 'triangle', this.scene!)
      }
    }
    this.after(1250, this.alarmLoop)
  }

  private startFlatline() {
    const ctx = this.ctx!
    if (this.flatline) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 988
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.05)
    o.connect(g).connect(this.scene!)
    o.start()
    this.flatline = o
    this.nodes.push(o)
  }

  private stopFlatline() {
    try { this.flatline?.stop() } catch { /* ignore */ }
    this.flatline = null
  }

  /** Total silence for 1 s, then one strong heartbeat, then normal beeps. */
  private roscMoment() {
    const ctx = this.ctx!
    const scene = this.scene!
    const t = ctx.currentTime
    this.beatsSilencedUntil = performance.now() + 2200
    scene.gain.cancelScheduledValues(t)
    scene.gain.setTargetAtTime(0, t, 0.02)
    this.after(1000, () => {
      const now = ctx.currentTime
      scene.gain.setValueAtTime(1, now)
      this.heartbeat(now)
    })
  }

  private heartbeat(at: number) {
    const ctx = this.ctx!
    const thump = (start: number, f0: number, f1: number, vol: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.setValueAtTime(f0, start)
      o.frequency.exponentialRampToValueAtTime(f1, start + 0.14)
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(vol, start + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.24)
      o.connect(g).connect(this.scene!)
      o.start(start)
      o.stop(start + 0.3)
    }
    thump(at, 78, 38, 0.55) // lub
    thump(at + 0.3, 66, 34, 0.38) // dub
  }
}

export const soundscape = new Soundscape()

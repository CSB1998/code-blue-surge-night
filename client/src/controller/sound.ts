// Monitor alarm beep via Web Audio (no audio files needed).
let ctx: AudioContext | null = null

/** Call from a click handler so the browser allows audio. */
export function unlockAudio() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

export function beep(freq = 960, ms = 140, volume = 0.08) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + ms / 1000 + 0.02)
}

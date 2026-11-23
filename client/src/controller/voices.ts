// Agent voices with the browser's built-in speechSynthesis.
// Lines are queued so they never overlap. When muted (or unsupported) we still
// "play" each line silently for a realistic duration so speech bubbles still work.

import type { Speaker } from '../model/characters'

export type { Speaker }
export interface Line { id: number; name: Speaker; text: string }

const PROFILE: Record<Speaker, { gender: 'f' | 'm' | 'any'; rate: number; pitch: number; slot: number }> = {
  Kim: { gender: 'f', rate: 1.15, pitch: 1.05, slot: 0 },
  Raj: { gender: 'm', rate: 0.95, pitch: 0.9, slot: 0 },
  Okafor: { gender: 'm', rate: 1.0, pitch: 0.7, slot: 1 },
  Reyes: { gender: 'any', rate: 0.9, pitch: 1.0, slot: 1 },
}

const FEMALE = /female|zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|aria|jenny|libby|sonia|google us english/i
const MALE = /\bmale|david|mark|daniel|alex|fred|george|guy|ryan|thomas|james|google uk english male/i

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

function pickVoice(name: Speaker): SpeechSynthesisVoice | undefined {
  if (!synth) return undefined
  const english = synth.getVoices().filter((v) => v.lang.startsWith('en'))
  const { gender, slot } = PROFILE[name]
  const female = english.filter((v) => FEMALE.test(v.name) && !/\bmale/i.test(v.name.replace(/female/i, '')))
  const male = english.filter((v) => MALE.test(v.name) && !/female/i.test(v.name))
  const pool = gender === 'f' ? female : gender === 'm' ? male : [...female.slice(1), ...male, ...female]
  return pool[slot] ?? pool[0] ?? english[0]
}

type Listener = (line: Line | null) => void

class VoiceQueue {
  private queue: Line[] = []
  private playing = false
  private nextId = 1
  private listeners = new Set<Listener>()
  private fallbackTimer?: ReturnType<typeof setTimeout>
  muted = false

  constructor() {
    // Chrome loads voices asynchronously.
    synth?.addEventListener?.('voiceschanged', () => synth.getVoices())
  }

  onActive(cb: Listener) {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  say(name: Speaker, text: string) {
    this.queue.push({ id: this.nextId++, name, text })
    if (!this.playing) this.playNext()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (m) synth?.cancel()
  }

  clear() {
    this.queue = []
    synth?.cancel()
    clearTimeout(this.fallbackTimer)
    this.playing = false
    this.emit(null)
  }

  private emit(line: Line | null) { this.listeners.forEach((l) => l(line)) }

  private playNext() {
    const line = this.queue.shift()
    if (!line) { this.playing = false; this.emit(null); return }
    this.playing = true
    this.emit(line)
    const done = () => { clearTimeout(this.fallbackTimer); this.fallbackTimer = setTimeout(() => this.playNext(), 250) }

    if (this.muted || !synth) {
      // silent playback: ~280 ms per word, min 1.8 s
      this.fallbackTimer = setTimeout(done, Math.max(1800, line.text.split(' ').length * 280))
      return
    }
    const u = new SpeechSynthesisUtterance(line.text)
    const p = PROFILE[line.name]
    u.voice = pickVoice(line.name) ?? null
    u.rate = p.rate
    u.pitch = p.pitch
    u.onend = done
    u.onerror = done
    // safety net in case the browser never fires onend
    this.fallbackTimer = setTimeout(done, 4000 + line.text.length * 90)
    synth.speak(u)
  }
}

export const voices = new VoiceQueue()

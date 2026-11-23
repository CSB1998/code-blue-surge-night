import { useEffect, useState, type FormEvent } from 'react'
import type { Caption } from '../state/useCodeRun'
import { colorOf } from '../data/characters'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'

/** Hold-to-talk mic (button or spacebar), typed fallback, and live captions. */
export function BottomBar({ captions, onOrder, disabled }: { captions: Caption[]; onOrder: (t: string) => void; disabled?: boolean }) {
  const mic = useSpeechRecognition(onOrder)
  const [typed, setTyped] = useState('')

  // Spacebar = hold to talk (unless typing in a text field)
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isField(e.target) || disabled) return
      e.preventDefault()
      mic.start()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target)) return
      e.preventDefault()
      mic.stop()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [mic.start, mic.stop, disabled])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!typed.trim()) return
    onOrder(typed)
    setTyped('')
  }

  const recent = captions.slice(-3)

  return (
    <section aria-label="Give orders" className="flex h-full items-center gap-6 rounded-xl border border-line bg-panel px-6">
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={!mic.supported || disabled}
          onPointerDown={(e) => { e.preventDefault(); mic.start() }}
          onPointerUp={mic.stop}
          onPointerLeave={() => mic.listening && mic.stop()}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) mic.start() }}
          onKeyUp={(e) => { if (e.key === 'Enter') mic.stop() }}
          aria-pressed={mic.listening}
          aria-label={mic.listening ? 'Listening. Release to send order' : 'Hold to talk'}
          className={`grid h-[104px] w-[104px] place-items-center rounded-full border-4 text-[40px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
            mic.listening ? 'anim-mic border-alarm bg-alarm text-white' : 'border-[#3a4a66] bg-panel-2 hover:border-spo2'
          }`}
        >
          <span aria-hidden="true">🎙</span>
        </button>
        <span className="text-[12px] font-semibold text-muted">{mic.listening ? 'LISTENING…' : 'HOLD · SPACE'}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className={`min-h-[34px] truncate text-[24px] font-medium ${mic.listening ? 'text-ink' : 'text-muted'}`} aria-live="polite">
          {mic.interim ? <>"{mic.interim}"</> : mic.error ?? (mic.supported ? 'Hold the mic and give an order, e.g. "Kim, start compressions."' : 'Voice needs Chrome. Type your orders below.')}
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="order" className="sr-only">Type an order</label>
          <input
            id="order"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={disabled}
            placeholder='Type an order: "Raj, epi 1 milligram"'
            autoComplete="off"
            className="h-12 flex-1 rounded-lg border border-line bg-bg px-4 text-[17px] text-ink placeholder:text-[#7d8ba1] focus:border-spo2 focus:outline-none"
          />
          <button type="submit" disabled={disabled} className="h-12 rounded-lg bg-spo2 px-6 text-[16px] font-bold text-black hover:brightness-110 disabled:opacity-40">
            Send
          </button>
        </form>
      </div>

      {/* Captions for every spoken line (also read by screen readers) */}
      <div className="w-[560px] self-stretch overflow-hidden py-3" aria-live="polite" aria-label="Captions">
        <ul className="flex h-full flex-col justify-end gap-1">
          {recent.map((c) => (
            <li key={c.id} className="anim-fade-in truncate text-[16px] leading-snug" title={c.text}>
              <span className="font-bold" style={{ color: c.name === 'You' ? '#3FD5FF' : colorOf(c.name) }}>{c.name}:</span>{' '}
              <span className="text-ink/90">{c.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

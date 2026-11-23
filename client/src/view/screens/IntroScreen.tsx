import { useEffect, useRef, useState } from 'react'
import { voices } from '../../controller/voices'
import { portrait } from '../../model/characters'
import titleImg from '../../assets/title.jpg'
import roomImg from '../../assets/room.jpg'

const TITLE = '2:47 AM. City General. Every bed is full.'
const HANDOFF = 'Doctor, Maria Lopez, 58, viral pneumonia, sats dropping fast. Last vent in the unit is free, but Bed 4 is circling too.'
const TYPE_MS = 4000 // typewriter duration

/** Cinematic cold open. Any key or click skips. Calls onDone once. */
export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'title' | 'room'>('title')
  const [typed, setTyped] = useState(0)
  const doneRef = useRef(false)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    voices.clear()
    onDone()
  }

  // typewriter, then crossfade to the room
  useEffect(() => {
    const step = TYPE_MS / TITLE.length
    const id = setInterval(() => setTyped((n) => Math.min(TITLE.length, n + 1)), step)
    const toRoom = setTimeout(() => setPhase('room'), TYPE_MS + 900)
    return () => { clearInterval(id); clearTimeout(toRoom) }
  }, [])

  // Kim's handoff, then hand control to the game when she finishes (max 16 s)
  useEffect(() => {
    if (phase !== 'room') return
    let started = false
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const off = voices.onActive((line) => {
      if (line?.name === 'Kim') started = true
      else if (!line && started) endTimer = setTimeout(finish, 700)
    })
    const sayTimer = setTimeout(() => voices.say('Kim', HANDOFF), 700)
    const maxTimer = setTimeout(finish, 16000)
    return () => { off(); clearTimeout(sayTimer); clearTimeout(maxTimer); clearTimeout(endTimer) }
  }, [phase])

  // any key skips
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="absolute inset-0 cursor-pointer overflow-hidden bg-black" onClick={finish} role="presentation">
      {/* title card */}
      <img
        src={titleImg}
        alt=""
        className="anim-fade-in-slow absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
        style={{ opacity: phase === 'title' ? 0.85 : 0 }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      <div
        className="absolute inset-x-0 bottom-[16%] text-center transition-opacity duration-700"
        style={{ opacity: phase === 'title' ? 1 : 0 }}
        aria-live="polite"
      >
        <p className="font-mono text-[18px] font-bold tracking-[0.4em] text-alarm">CODE BLUE: SURGE NIGHT</p>
        <p className="mt-4 font-mono text-[52px] font-semibold text-ink" aria-label={TITLE}>
          <span aria-hidden="true">{TITLE.slice(0, typed)}</span>
          <span aria-hidden="true" className="anim-caret ml-1 inline-block h-[46px] w-[4px] translate-y-1 bg-ink" />
        </p>
      </div>

      {/* the room, with Kim walking in */}
      <img
        src={roomImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 [filter:brightness(0.55)]"
        style={{ opacity: phase === 'room' ? 1 : 0 }}
      />
      {phase === 'room' && (
        <div className="absolute bottom-[12%] left-[10%] flex items-end gap-6">
          <figure className="anim-slide-from-left m-0 w-[300px] overflow-hidden rounded-2xl border-2 border-kim shadow-[0_0_48px_rgb(255_138_101/0.45)]">
            <img src={portrait('Kim', 'stressed')} alt="Nurse Kim, ICU nurse, looking stressed" className="block aspect-[4/5] w-full object-cover" />
            <figcaption className="bg-panel px-4 py-2 text-[18px] font-semibold text-kim">Nurse Kim · ICU nurse</figcaption>
          </figure>
          <div className="anim-pop-in mb-24 max-w-[720px] rounded-2xl border-2 border-kim bg-panel/95 px-7 py-5 shadow-2xl [animation-delay:500ms]" aria-live="polite">
            <p className="mb-1 text-[14px] font-bold uppercase tracking-wider text-kim">Kim</p>
            <p className="text-[30px] leading-snug">{HANDOFF}</p>
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); finish() }}
        className="absolute bottom-8 right-10 rounded-lg border border-line bg-panel/80 px-4 py-2 text-[16px] text-muted hover:text-ink"
      >
        Skip intro <kbd className="ml-1 rounded border border-line px-1.5 font-mono text-[13px]">any key</kbd>
      </button>
    </div>
  )
}

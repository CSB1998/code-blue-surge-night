import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CodeRun } from '../../controller/useCodeRun'
import { portrait } from '../../model/characters'
import { CharacterCard } from './CharacterCard'
import { TrustMeter } from '../game/TrustMeter'
import type { AgentName } from '../../model/contract'
import { alarmReason } from './Monitor'
import { voices } from '../../controller/voices'
import { soundscape } from '../audio/soundscape'
import roomImg from '../../assets/room.jpg'

// 2.5D "camera" over a flat painted room:
//  - layers at different depths move different amounts (parallax)
//  - the camera pushes in ~5% during cardiac arrest and eases out on ROSC
//  - a new alarm gives a small camera shake and a red vignette pulse
// prefers-reduced-motion turns off drift, zoom and shake (see index.css).

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** One depth layer. depth 0 = far wall, 1 = card plane, >1 = closer to the viewer. */
function Layer({ depth, style, className = '', children }: { depth: number; style?: CSSProperties; className?: string; children: ReactNode }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ transform: `translate3d(calc(var(--cx) * ${depth} * 1px), calc(var(--cy) * ${depth} * 1px), 0)`, ...style }}
    >
      {children}
    </div>
  )
}

export function RoomScene({ run, trust }: { run: CodeRun; trust: Record<AgentName, number> }) {
  const { emotions, lastAction, speaking, patient, reyes } = run
  const say = (n: string) => (speaking?.name === n ? speaking.text : undefined)
  const arrest = patient?.rhythm === 'VF' || patient?.rhythm === 'asystole'

  // ---- camera drift + mouse parallax (writes CSS vars, no React re-renders)
  const roomRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = roomRef.current
    if (!el || reducedMotion()) return
    let mx = 0, my = 0, raf = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2
      my = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    const tick = (now: number) => {
      const t = now / 1000
      // slow idle sway so the scene breathes on a projector with no mouse
      const cx = Math.sin(t * 0.21) * 7 + mx * -9
      const cy = Math.sin(t * 0.17 + 1) * 3 + my * -5
      el.style.setProperty('--cx', cx.toFixed(2))
      el.style.setProperty('--cy', cy.toFixed(2))
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove) }
  }, [])

  // ---- shake + red pulse whenever a NEW alarm starts
  const alarm = alarmReason(patient)
  const lastAlarm = useRef<string | null>(null)
  const [alarmHit, setAlarmHit] = useState(0)
  useEffect(() => {
    if (alarm && alarm !== lastAlarm.current) setAlarmHit((n) => n + 1)
    lastAlarm.current = alarm
  }, [alarm])

  // ---- Reyes' note pops open for 9 s when a new one arrives; the icon can reopen it.
  const [noteOpen, setNoteOpen] = useState(false)
  useEffect(() => {
    if (!reyes) return
    setNoteOpen(true)
    const id = setTimeout(() => setNoteOpen(false), 9000)
    return () => clearTimeout(id)
  }, [reyes?.id])

  // ---- red vignette pulses in time with the monitor alarm (VF / asystole)
  const [pulse, setPulse] = useState(0)
  useEffect(() => soundscape.onAlarmPulse(() => setPulse((n) => n + 1)), [])

  // ---- chaos: teammates talking over each other gives a tiny jolt
  const [chaosHit, setChaosHit] = useState(0)
  useEffect(() => voices.onChaos(() => setChaosHit((n) => n + 1)), [])

  const rosc = patient?.rhythm === 'ROSC'

  // speaking card rises above the others so its bubble is never hidden
  const z = (n: string, base: number) => (speaking?.name === n ? 40 : base)
  // everyone who isn't talking dims to 80% while someone talks
  const dim = (n: string) => (speaking && speaking.name !== n ? 0.8 : 1)

  return (
    <section
      ref={roomRef}
      aria-label="ICU room"
      className="relative h-full overflow-hidden rounded-xl border border-line bg-black"
      style={{ '--cx': 0, '--cy': 0 } as CSSProperties}
    >
      {/* shake wrapper (re-mounted per alarm so the animation replays) */}
      <div key={alarmHit} className={`absolute inset-0 ${alarmHit ? 'anim-cam-shake' : ''}`}>
      <div key={`c${chaosHit}`} className={`absolute inset-0 ${chaosHit ? 'anim-cam-shake-sm' : ''}`}>
        {/* camera: push-in during arrest */}
        <div className="cam-zoom absolute inset-0" style={{ transform: `scale(${arrest ? 1.05 : 1})` }}>
          {/* far: the room, dimmed so cards and monitor stand out */}
          <Layer depth={0.35} className="-inset-[4%]">
            <img
              src={roomImg}
              alt="ICU room at night. Maria Lopez lies in the bed with an oxygen mask, monitor and ventilator beside her."
              className="h-full w-full object-cover [object-position:62%_50%] transition-[filter] duration-[1200ms]"
              style={{ filter: arrest ? 'brightness(0.47) saturate(0.85)' : 'brightness(0.62) saturate(0.9)' }}
              draggable={false}
            />
          </Layer>

          {/* Maria status tag over the bed */}
          <Layer depth={0.45} style={{ left: '56%', top: '35%' }}>
            {arrest && (
              <span className="block -translate-x-1/2 rounded-md bg-alarm px-3 py-1 text-[14px] font-bold whitespace-nowrap text-[#1a0005] shadow-lg">
                <span aria-hidden="true">⚠ </span>NO PULSE
              </span>
            )}
            {patient?.rhythm === 'ROSC' && (
              <span className="anim-pop-in block -translate-x-1/2 rounded-md bg-ecg px-3 py-1 text-[14px] font-bold whitespace-nowrap text-black shadow-lg">
                ✓ PULSE BACK
              </span>
            )}
          </Layer>

          {/* Dr. Reyes in the doorway (back wall, left) */}
          <Layer depth={0.5} style={{ left: '2.5%', top: '8%', zIndex: noteOpen ? 45 : 5 }} className="w-[150px]">
            <div className="relative overflow-hidden rounded-t-lg border-4 border-b-0 border-[#32405a] shadow-2xl">
              <img src={portrait('Reyes')} alt="Dr. Reyes, the attending, watching from the doorway" className="block aspect-[4/5] w-full object-cover" />
            </div>
            <p className="mt-1 rounded bg-black/60 px-1 text-center text-[13px] font-semibold text-reyes">Dr. Reyes · Attending</p>
            <button
              key={reyes?.id}
              onClick={() => setNoteOpen((o) => !o)}
              disabled={!reyes}
              aria-label={reyes ? "Open Dr. Reyes's note" : 'Dr. Reyes has no notes yet'}
              aria-expanded={noteOpen}
              className={`absolute -right-5 top-6 grid h-12 w-12 place-items-center rounded-full border-2 border-bp bg-panel text-[22px] disabled:opacity-40 ${reyes ? 'anim-note' : ''}`}
            >
              📝
            </button>
            {speaking?.name === 'Reyes' && !noteOpen && (
              <div key={speaking.id} className="anim-pop-in absolute left-full top-2 ml-8 w-[260px] rounded-xl border-2 border-reyes bg-panel px-4 py-3 text-[17px] leading-snug shadow-2xl">
                <span className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-reyes">Reyes</span>
                {speaking.text}
              </div>
            )}
            {noteOpen && reyes && (
              <div role="note" className="anim-pop-in absolute left-0 top-full mt-10 w-[330px] rounded-xl border-2 border-reyes bg-panel p-4 shadow-2xl">
                <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-reyes">Dr. Reyes, from the doorway</p>
                <p className="text-[18px] leading-snug">"{reyes.hint}"</p>
                <p className="mt-2 border-t border-line pt-2 text-[13px] italic text-muted">On her clipboard: {reyes.note}</p>
              </div>
            )}
          </Layer>

          {/* the team at three depths */}
          <Layer depth={0.75} style={{ left: '62%', top: '20%', zIndex: z('Okafor', 10) }}>
            <div className="origin-bottom scale-[0.86] transition-[filter] duration-300" style={{ filter: `brightness(${0.9 * dim('Okafor')})` }}>
              <CharacterCard name="Okafor" emotion={emotions.Okafor} action={lastAction.Okafor} speakingText={say('Okafor')} bubbleSide="left" />
              <TrustMeter value={trust.Okafor} color="#C084FC" />
            </div>
          </Layer>
          <Layer depth={1.1} style={{ left: '78%', top: '50%', zIndex: z('Raj', 20) }}>
            <div className="origin-bottom scale-[0.96] transition-[filter] duration-300" style={{ filter: `brightness(${dim('Raj')})` }}>
              <CharacterCard name="Raj" emotion={emotions.Raj} action={lastAction.Raj} speakingText={say('Raj')} bubbleSide="topLeft" />
              <TrustMeter value={trust.Raj} color="#7C9CFF" />
            </div>
          </Layer>
          <Layer depth={1.45} style={{ left: '38%', top: '55%', zIndex: z('Kim', 30) }}>
            <div className="origin-bottom scale-[1.08] transition-[filter] duration-300" style={{ filter: `brightness(${dim('Kim')})` }}>
              <CharacterCard name="Kim" emotion={emotions.Kim} action={lastAction.Kim} speakingText={say('Kim')} cpr={!!patient?.cpr_running} bubbleSide="left" />
              <TrustMeter value={trust.Kim} color="#FF8A65" />
            </div>
          </Layer>
        </div>
      </div>
      </div>

      {/* lens: soft dark vignette always, red pulse on each new alarm */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55)_100%)]" />
      {/* arrest: steady red edge, fades out over 2 s on ROSC */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(255_40_60/0.5)_100%)] transition-opacity duration-[2000ms]"
        style={{ opacity: arrest ? 0.38 : 0 }}
        aria-hidden="true"
      />
      {arrest && pulse > 0 && (
        <div key={`p${pulse}`} className="anim-alarm-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgb(255_40_60/0.45)_100%)]" aria-hidden="true" />
      )}
      {/* ROSC: warm light fades in over 2 s */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_40%,rgb(255_190_120/0.28),transparent_70%)] mix-blend-screen transition-opacity duration-[2000ms]"
        style={{ opacity: rosc ? 1 : 0 }}
        aria-hidden="true"
      />
      {alarmHit > 0 && (
        <div
          key={`v${alarmHit}`}
          className="anim-vignette pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(255_59_78/0.55)_100%)]"
          aria-hidden="true"
        />
      )}
    </section>
  )
}

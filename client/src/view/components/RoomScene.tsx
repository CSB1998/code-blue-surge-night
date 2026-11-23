import { useEffect, useState } from 'react'
import type { CodeRun } from '../../controller/useCodeRun'
import { portrait } from '../../model/characters'
import { CharacterCard } from './CharacterCard'
import roomImg from '../../assets/room.png'
import mariaImg from '../../assets/maria.png'

export function RoomScene({ run }: { run: CodeRun }) {
  const { emotions, lastAction, speaking, patient, reyes } = run
  const say = (n: string) => (speaking?.name === n ? speaking.text : undefined)

  // Reyes' note pops open for 9 s when a new one arrives; the icon can reopen it.
  const [noteOpen, setNoteOpen] = useState(false)
  useEffect(() => {
    if (!reyes) return
    setNoteOpen(true)
    const id = setTimeout(() => setNoteOpen(false), 9000)
    return () => clearTimeout(id)
  }, [reyes?.id])

  return (
    <section aria-label="ICU room" className="relative h-full overflow-hidden rounded-xl border border-line">
      <img src={roomImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f17]/30 via-transparent to-[#0b0f17]/70" />

      {/* Maria in the bed */}
      <div className="absolute bottom-[40px] left-[22%] w-[52%]">
        <img src={mariaImg} alt="Maria Lopez, 58, in the ICU bed" className="w-full" />
        {(patient?.rhythm === 'VF' || patient?.rhythm === 'asystole') && (
          <span className="absolute left-1/2 top-[12%] -translate-x-1/2 rounded-md bg-alarm px-3 py-1 text-[14px] font-bold text-[#1a0005]">
            <span aria-hidden="true">⚠ </span>NO PULSE
          </span>
        )}
        {patient?.rhythm === 'ROSC' && (
          <span className="anim-pop-in absolute left-1/2 top-[12%] -translate-x-1/2 rounded-md bg-ecg px-3 py-1 text-[14px] font-bold text-black">
            ✓ PULSE BACK
          </span>
        )}
      </div>

      {/* The team. Positions are % of the room so they scale. */}
      <div className="absolute left-[4%] top-[22%]">
        <CharacterCard name="Okafor" emotion={emotions.Okafor} action={lastAction.Okafor} speakingText={say('Okafor')} bubbleSide="right" />
      </div>
      <div className="absolute left-[52%] top-[16%]">
        <CharacterCard name="Kim" emotion={emotions.Kim} action={lastAction.Kim} speakingText={say('Kim')} cpr={!!patient?.cpr_running} bubbleSide="left" />
      </div>
      <div className="absolute bottom-[5%] left-[3%]">
        <CharacterCard name="Raj" emotion={emotions.Raj} action={lastAction.Raj} speakingText={say('Raj')} bubbleSide="right" />
      </div>

      {/* Dr. Reyes watching from the doorway */}
      <div className="absolute right-[1.5%] top-[14%] w-[150px]">
        <div className="relative h-[400px] overflow-hidden rounded-t-lg border-4 border-b-0 border-[#32405a] bg-[#05070b]">
          <img
            src={portrait('Reyes', 'focused')}
            alt="Dr. Reyes, the attending, watching from the doorway"
            className="absolute bottom-0 left-1/2 w-[140%] max-w-none -translate-x-1/2 [filter:brightness(0.18)_contrast(1.4)]"
          />
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#9CA3AF]/10 to-transparent" />
        </div>
        <button
          key={reyes?.id}
          onClick={() => setNoteOpen((o) => !o)}
          disabled={!reyes}
          aria-label={reyes ? 'Open Dr. Reyes\'s note' : 'Dr. Reyes has no notes yet'}
          aria-expanded={noteOpen}
          className={`absolute -left-5 top-6 grid h-12 w-12 place-items-center rounded-full border-2 border-bp bg-panel text-[22px] disabled:opacity-40 ${reyes ? 'anim-note' : ''}`}
        >
          📝
        </button>
        <p className="mt-1 text-center text-[13px] font-semibold text-reyes">Dr. Reyes · Attending</p>

        {noteOpen && reyes && (
          <div role="note" className="anim-pop-in absolute right-0 top-[440px] z-30 w-[330px] rounded-xl border-2 border-reyes bg-panel p-4 shadow-2xl">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-reyes">Dr. Reyes, from the doorway</p>
            <p className="text-[18px] leading-snug">"{reyes.hint}"</p>
            <p className="mt-2 border-t border-line pt-2 text-[13px] italic text-muted">On her clipboard: {reyes.note}</p>
          </div>
        )}
      </div>
    </section>
  )
}

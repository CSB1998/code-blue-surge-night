import { useEffect } from 'react'
import type { CodeRun } from '../state/useCodeRun'
import { MOCK } from '../lib/transport'
import { beep } from '../lib/sound'
import { Monitor, alarmReason } from '../components/Monitor'
import { RoomScene } from '../components/RoomScene'
import { DecisionLog, WhisperPanel } from '../components/Panels'
import { BottomBar } from '../components/BottomBar'
import { VentModal } from '../components/VentModal'

const OUTCOME_TEXT = { survived: 'Maria survived', complications: 'Maria survived, with complications', died: 'Maria died' }

export function CodeScreen({ run }: { run: CodeRun }) {
  const alarm = alarmReason(run.patient)

  // Alarm beep every 1.2 s while an alarm is active
  useEffect(() => {
    if (!alarm || run.muted || run.ended) return
    beep()
    const id = setInterval(() => beep(), 1200)
    return () => clearInterval(id)
  }, [alarm, run.muted, run.ended])

  const okaforLine = run.log.find((r) => r.name === 'Okafor' && /vent/i.test(r.spoken))?.spoken

  return (
    <div className="grid h-full grid-rows-[56px_1fr_150px] gap-3 p-3">
      {/* Header */}
      <header className="flex items-center gap-4 rounded-xl border border-line bg-panel px-5">
        <h1 className="text-[20px] font-extrabold tracking-[0.12em]">
          <span className="text-alarm">CODE BLUE</span>: SURGE NIGHT
        </h1>
        <span className="text-[15px] text-muted">City General ICU · every bed full · respiratory virus surge</span>
        {MOCK && <span className="rounded bg-bp/15 px-2 py-0.5 text-[12px] font-bold text-bp ring-1 ring-bp/50">MOCK MODE</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => run.setMuted(!run.muted)}
            aria-pressed={run.muted}
            className="rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-spo2"
          >
            <span aria-hidden="true">{run.muted ? '🔇' : '🔊'} </span>{run.muted ? 'Sound off' : 'Sound on'}
          </button>
          <button onClick={run.endRun} disabled={!!run.ended} className="rounded-lg border border-alarm/70 px-3 py-1.5 text-[14px] text-alarm hover:bg-alarm/10 disabled:opacity-40">
            End code
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="grid min-h-0 grid-cols-[380px_1fr_520px] gap-3">
        <DecisionLog log={run.log} />
        <RoomScene run={run} />
        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
          <Monitor p={run.patient} />
          <WhisperPanel whispers={run.whispers} />
        </div>
      </div>

      <BottomBar captions={run.captions} onOrder={run.sendOrder} disabled={!!run.ended} />

      {run.vent && !run.ended && <VentModal decision={run.vent} okaforLine={okaforLine} onChoose={run.chooseVent} />}

      {run.ended && (
        <div className="anim-fade-in absolute inset-0 z-50 grid place-items-center bg-black/75" role="alertdialog" aria-labelledby="ended-title">
          <div className="text-center">
            <p className="text-[16px] font-bold tracking-[0.3em] text-muted">CODE OVER</p>
            <h2 id="ended-title" className={`mt-2 text-[64px] font-extrabold ${run.ended.maria_outcome === 'died' ? 'text-alarm' : 'text-ecg'}`}>
              {OUTCOME_TEXT[run.ended.maria_outcome]}
            </h2>
            <p className="mt-2 text-[22px] text-muted">Bed 4: {run.ended.bed4_outcome}</p>
            <p className="mt-8 text-[18px] text-reyes">Dr. Reyes steps in from the doorway… preparing your debrief.</p>
          </div>
        </div>
      )}
    </div>
  )
}

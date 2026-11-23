import { useEffect, useRef, useState } from 'react'
import type { CodeRun } from '../../controller/useCodeRun'
import { MOCK } from '../../controller/transport'
import { voices } from '../../controller/voices'
import { soundscape } from '../audio/soundscape'
import { toggleFullscreen } from '../fullscreen'
import { Monitor } from '../components/Monitor'
import { RoomScene } from '../components/RoomScene'
import { DecisionLog, WhisperPanel } from '../components/Panels'
import { BottomBar } from '../components/BottomBar'
import { VentModal } from '../components/VentModal'

const OUTCOME_TEXT = { survived: 'Maria survived', complications: 'Maria survived, with complications', died: 'Maria died' }

export function CodeScreen({ run }: { run: CodeRun }) {
  // ---- soundscape: read-only on patient ticks; stops when the code ends
  useEffect(() => { soundscape.update(run.patient) }, [run.patient])
  useEffect(() => { if (run.ended) soundscape.stop() }, [run.ended])

  // soft chime for each new whisper
  const seenWhispers = useRef(0)
  useEffect(() => {
    if (run.whispers.length > seenWhispers.current) soundscape.chime()
    seenWhispers.current = run.whispers.length
  }, [run.whispers.length])

  // chaos: during V-fib, lines arriving close together talk over each other
  useEffect(() => {
    voices.chaos = run.patient?.rhythm === 'VF'
    return () => { voices.chaos = false }
  }, [run.patient?.rhythm])

  // ---- volume + mute (remembered); mute also silences the voices
  const [volume, setVolume] = useState(soundscape.volume)
  useEffect(() => {
    voices.volume = soundscape.volume
    if (soundscape.muted !== run.muted) run.setMuted(soundscape.muted)
  }, [])
  const toggleMute = () => { const m = !run.muted; run.setMuted(m); soundscape.setMuted(m) }
  const changeVolume = (v: number) => { setVolume(v); soundscape.setVolume(v); voices.volume = v }

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
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <span aria-hidden="true">{run.muted || volume === 0 ? '🔇' : '🔊'}</span>
            <span className="sr-only">Master volume</span>
            <input
              type="range" min={0} max={100} value={Math.round(volume * 100)}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
              disabled={run.muted}
              className="w-28 accent-[#3FD5FF] disabled:opacity-40"
              aria-valuetext={`${Math.round(volume * 100)} percent`}
            />
          </label>
          <button onClick={toggleMute} aria-pressed={run.muted} className="rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-spo2">
            {run.muted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={toggleFullscreen} className="rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-spo2" title="Fullscreen (F)">
            <span aria-hidden="true">⛶ </span>Fullscreen <kbd className="ml-1 rounded border border-line px-1 font-mono text-[11px] text-muted">F</kbd>
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

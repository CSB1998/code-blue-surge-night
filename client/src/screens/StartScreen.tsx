import { useState } from 'react'
import { CHARACTERS, portrait } from '../data/characters'
import { speechSupported } from '../lib/useSpeechRecognition'
import { MOCK } from '../lib/transport'
import roomImg from '../assets/room.png'

type MicState = 'unknown' | 'checking' | 'ok' | 'blocked'

export function StartScreen({ onStart }: { onStart: () => void }) {
  const [mic, setMic] = useState<MicState>('unknown')

  const checkMic = async () => {
    setMic('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMic('ok')
    } catch {
      setMic('blocked')
    }
  }

  const micText = {
    unknown: 'Not checked yet',
    checking: 'Checking…',
    ok: '✓ Microphone ready',
    blocked: '⚠ Microphone blocked. You can still type orders.',
  }[mic]

  return (
    <main className="relative h-full overflow-hidden">
      <img src={roomImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />

      <div className="relative flex h-full flex-col justify-center px-[140px]">
        <p className="font-mono text-[18px] font-bold tracking-[0.3em] text-alarm">
          <span aria-hidden="true">● </span>CODE BLUE · ICU BED 7
        </p>
        <h1 className="mt-3 text-[112px] font-black leading-[0.95] tracking-tight">
          CODE BLUE:<br />SURGE NIGHT
        </h1>
        <p className="mt-6 text-[34px] font-medium text-ink/90">2:47 AM. City General. Every bed is full.</p>

        <p className="mt-8 max-w-[880px] text-[21px] leading-relaxed text-muted">
          You're the doctor leading this cardiac arrest. Maria Lopez, 58, is crashing in Bed 7. A respiratory virus has filled the ICU,
          there is <span className="text-ink">one ventilator left</span> and the <span className="text-ink">amiodarone is running out</span>.
          Give your orders out loud. Your team will act, push back, and talk about you when they think you can't hear.
        </p>

        <ul className="mt-8 flex gap-4" aria-label="Your team tonight">
          {Object.values(CHARACTERS).map((c) => (
            <li key={c.id} className="flex w-[200px] items-center gap-3 rounded-xl border bg-panel/80 p-2 pr-3" style={{ borderColor: c.color }}>
              <img src={portrait(c.name)} alt="" className="h-[60px] w-[48px] rounded-md object-cover" />
              <div>
                <p className="text-[16px] font-bold" style={{ color: c.color }}>{c.fullName}</p>
                <p className="text-[13px] text-muted">{c.role}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex items-center gap-6">
          <button
            onClick={onStart}
            className="rounded-xl bg-alarm px-12 py-5 text-[28px] font-extrabold tracking-wide text-white shadow-[0_0_40px_rgb(255_59_78/0.45)] transition-transform duration-150 hover:scale-[1.03]"
          >
            Take the code
          </button>
          <div className="flex flex-col gap-1">
            <button onClick={checkMic} className="w-fit rounded-lg border border-line bg-panel px-4 py-2 text-[16px] hover:border-spo2">
              <span aria-hidden="true">🎙 </span>Check microphone
            </button>
            <span role="status" className={`text-[15px] ${mic === 'blocked' ? 'text-bp' : mic === 'ok' ? 'text-ecg' : 'text-muted'}`}>
              {speechSupported ? micText : '⚠ Voice orders need Google Chrome. You can still type orders.'}
            </span>
          </div>
        </div>

        <p className="mt-6 text-[15px] text-muted">
          Hold <kbd className="rounded border border-line bg-panel px-1.5 font-mono">Space</kbd> or the mic button to talk. Release to send.
        </p>
      </div>

      <footer className="absolute bottom-6 left-[140px] right-[140px] flex justify-between text-[14px] text-muted">
        <span>Training game. Simplified medicine. Not medical advice.</span>
        {MOCK && <span className="text-bp">Mock mode: running on fake data</span>}
      </footer>
    </main>
  )
}

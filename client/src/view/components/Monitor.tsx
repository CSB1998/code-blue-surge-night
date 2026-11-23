import type { PatientState, Rhythm } from '../../model/contract'
import { mmss } from '../../model/format'
import { EcgCanvas } from './EcgCanvas'

const RHYTHM_LABEL: Record<Rhythm, string> = {
  pre_arrest: 'SINUS TACH',
  VF: 'V-FIB',
  asystole: 'ASYSTOLE',
  ROSC: 'SINUS · ROSC',
}

export function alarmReason(p: PatientState | null): string | null {
  if (!p) return null
  if (p.rhythm === 'VF') return 'V-FIB · NO PULSE'
  if (p.rhythm === 'asystole') return 'ASYSTOLE · NO PULSE'
  if (p.spo2 < 85) return `LOW SpO2 ${p.spo2}%`
  return null
}

/** 2:47 AM plus elapsed code time. */
function clock(t: number) {
  const total = 2 * 3600 + 47 * 60 + t
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `0${h}:${String(m).padStart(2, '0')} AM`
}

export function Monitor({ p }: { p: PatientState | null }) {
  const alarm = alarmReason(p)
  const rhythm = p?.rhythm ?? 'pre_arrest'
  const noPulse = rhythm === 'VF' || rhythm === 'asystole'

  return (
    <section
      aria-label="Patient monitor"
      className={`relative rounded-xl border border-line bg-[#070a10] p-4 transition-shadow ${alarm ? 'anim-alarm' : ''}`}
    >
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[0.18em] text-muted">PATIENT MONITOR</h2>
          <p className="text-[15px] font-medium">Maria Lopez, 58 · Bed 7</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[13px] text-muted">{clock(p?.t_s ?? 0)}</div>
          <div className="text-[30px] font-bold leading-none tabular-nums" aria-label={`Code timer ${mmss(p?.t_s ?? 0)}`}>
            {mmss(p?.t_s ?? 0)}
          </div>
        </div>
      </header>

      {/* Alarm banner: icon + text, never color alone */}
      <div role="status" aria-live="assertive" className="h-9">
        {alarm && (
          <div className="flex h-9 items-center gap-2 rounded-md bg-alarm px-3 font-mono text-[17px] font-bold text-[#1a0005]">
            <span aria-hidden="true">⚠</span> ALARM: {alarm}
          </div>
        )}
      </div>

      <div className="relative mt-2">
        <EcgCanvas rhythm={rhythm} hr={p?.hr ?? 118} cpr={!!p?.cpr_running} width={488} height={150} />
        <span className="absolute left-2 top-1 font-mono text-[12px] text-ecg">II</span>
        <span className="absolute right-2 top-1 font-mono text-[14px] font-bold text-ecg">
          {RHYTHM_LABEL[rhythm]}{p?.cpr_running ? ' · CPR' : ''}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
        <Vital label="HR" unit="bpm" color="text-ecg" value={noPulse || !p ? '---' : String(p.hr)} />
        <Vital label="SpO₂" unit="%" color="text-spo2" value={p ? String(p.spo2) : '--'} warn={!!p && p.spo2 < 85} />
        <Vital label="NIBP" unit="mmHg" color="text-bp" value={p?.bp ?? '--/--'} small />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="CPR" value={p?.cpr_running ? 'RUNNING' : 'OFF'} tone={p?.cpr_running ? 'ok' : 'idle'} />
        <Chip label="Shocks" value={String(p?.shocks ?? 0)} />
        <Chip label="Epi" value={String(p?.epi_count ?? 0)} />
        <Chip
          label="Amiodarone"
          value={`${p?.amio_left ?? 3} left`}
          tone={(p?.amio_left ?? 3) <= 1 ? 'bad' : (p?.amio_left ?? 3) === 2 ? 'warn' : 'idle'}
          icon={(p?.amio_left ?? 3) <= 1 ? '⚠' : '💊'}
        />
        <Chip
          label="Last vent"
          value={p?.vent_assigned === 'maria' ? 'MARIA' : p?.vent_assigned === 'bed4' ? 'BED 4' : 'AVAILABLE'}
          tone={p?.vent_assigned === 'none' || !p ? 'warn' : 'idle'}
          icon="🫁"
        />
      </div>
    </section>
  )
}

function Vital({ label, unit, value, color, warn, small }: { label: string; unit: string; value: string; color: string; warn?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${warn ? 'border-alarm bg-alarm/10' : 'border-line bg-panel'}`}>
      <div className="flex items-baseline justify-between">
        <span className={`text-[13px] font-semibold ${color}`}>{label}</span>
        <span className="text-[11px] text-muted">{warn ? '⚠ LOW' : unit}</span>
      </div>
      <div className={`${small ? 'text-[34px]' : 'text-[52px]'} font-bold leading-[1.1] tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function Chip({ label, value, tone = 'idle', icon }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'idle'; icon?: string }) {
  const styles = {
    ok: 'border-ecg/60 text-ecg',
    warn: 'border-bp/60 text-bp',
    bad: 'border-alarm text-alarm bg-alarm/10',
    idle: 'border-line text-ink',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${styles}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="text-muted">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </span>
  )
}

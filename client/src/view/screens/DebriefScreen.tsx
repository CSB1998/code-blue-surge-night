import type { ReactNode } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Debrief, RunEnded, Skills } from '../../model/contract'
import { portrait } from '../../model/characters'
import { mmss } from '../../model/format'

const SKILL_LABELS: Record<keyof Skills, string> = {
  clarity: 'Clarity',
  speed: 'Speed',
  closed_loop: 'Closed-loop communication',
  team_leadership: 'Team leadership',
  resource_decision: 'Resource decision',
}
const SKILL_COLORS: Record<keyof Skills, string> = {
  clarity: '#3FD5FF', speed: '#39FF88', closed_loop: '#FFD23F', team_leadership: '#FF8A65', resource_decision: '#C084FC',
}
const OUTCOME = {
  survived: { text: 'Maria survived', color: 'text-ecg' },
  complications: { text: 'Maria survived, with complications', color: 'text-bp' },
  died: { text: 'Maria died', color: 'text-alarm' },
}

/** Clarity bands never rely on color alone: each has a label too. */
const band = (c: number) =>
  c >= 75 ? { label: 'Clear', color: '#39FF88' } : c >= 50 ? { label: 'Okay', color: '#FFD23F' } : { label: 'Unclear', color: '#FF3B4E' }

const tooltipStyle = { background: '#121826', border: '1px solid #1F2A3C', borderRadius: 8, color: '#E6EDF7' }
const axis = { stroke: '#9AA8BD', fontSize: 13 }

export function DebriefScreen({ debrief: d, ended, onRestart }: { debrief: Debrief; ended: RunEnded | null; onRestart: () => void }) {
  const outcome = OUTCOME[ended?.maria_outcome ?? 'complications']
  const lastT = Math.max(1, ...d.charts.vitals.map((v) => v.t_s), ...d.charts.orders.map((o) => o.t_s))

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] px-10 py-10">
        {/* Headline */}
        <header className="flex items-center gap-10 rounded-2xl border border-line bg-panel p-8">
          <ScoreRing score={d.score} />
          <div className="flex-1">
            <p className="text-[14px] font-bold tracking-[0.3em] text-muted">DEBRIEF WITH DR. REYES</p>
            <h1 className={`mt-1 text-[52px] font-extrabold leading-tight ${outcome.color}`}>{outcome.text}</h1>
            {ended && <p className="text-[18px] text-muted">Bed 4: {ended.bed4_outcome}</p>}
            <div className="mt-4 flex items-start gap-3">
              <img src={portrait('Reyes', 'focused')} alt="" className="h-[64px] w-[52px] rounded-md object-cover" />
              <p className="text-[24px] italic leading-snug">"{d.verdict}"</p>
            </div>
          </div>
          <button onClick={onRestart} className="self-start rounded-xl bg-alarm px-8 py-4 text-[20px] font-extrabold text-white hover:brightness-110">
            Run another code
          </button>
        </header>

        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* Skills */}
          <Card title="Your skills" bruin className="col-span-5">
            <ul className="space-y-4">
              {(Object.keys(SKILL_LABELS) as (keyof Skills)[]).map((k) => (
                <li key={k}>
                  <div className="flex justify-between text-[16px]">
                    <span>{SKILL_LABELS[k]}</span>
                    <span className="font-mono font-bold">{d.skills[k]}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-bg" role="meter" aria-valuenow={d.skills[k]} aria-valuemin={0} aria-valuemax={100} aria-label={SKILL_LABELS[k]}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${d.skills[k]}%`, background: SKILL_COLORS[k] }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Vitals chart */}
          <Card title="Maria's vitals" bruin className="col-span-7">
            <div className="h-[280px]" role="img" aria-label="Line chart of Maria's SpO2 and heart rate over the code">
              <ResponsiveContainer>
                <LineChart data={d.charts.vitals} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#1F2A3C" />
                  <XAxis dataKey="t_s" tickFormatter={mmss} {...axis} />
                  <YAxis domain={[0, 140]} {...axis} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `Time ${mmss(Number(t))}`} />
                  <Legend />
                  <Line type="monotone" dataKey="spo2" name="SpO₂ %" stroke="#3FD5FF" strokeWidth={2.5} dot={false} />
                  <Line type="stepAfter" dataKey="hr" name="Heart rate" stroke="#39FF88" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Orders timeline */}
          <Card title="Your orders, and how clear they were" bruin className="col-span-12">
            {d.charts.orders.length === 0 ? (
              <p className="text-muted">You didn't give a single order.</p>
            ) : (
              <>
                <div className="relative mx-4 mb-4 mt-2 h-10" aria-hidden="true">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-line" />
                  {d.charts.orders.map((o, i) => (
                    <span
                      key={i}
                      className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-panel"
                      style={{ left: `${(o.t_s / lastT) * 100}%`, background: band(o.clarity).color }}
                      title={o.transcript}
                    />
                  ))}
                </div>
                <ol className="grid grid-cols-2 gap-2">
                  {d.charts.orders.map((o, i) => {
                    const b = band(o.clarity)
                    return (
                      <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3 py-2">
                        <span className="font-mono text-[14px] text-muted">{mmss(o.t_s)}</span>
                        <span className="min-w-0 flex-1 truncate text-[16px]">"{o.transcript}"</span>
                        <span className="rounded-full px-2 py-0.5 font-mono text-[13px] font-bold text-black" style={{ background: b.color }}>
                          {b.label} {o.clarity}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
          </Card>

          {/* Best and worst */}
          <MomentCard className="col-span-6" kind="best" m={d.best_moment} />
          <MomentCard className="col-span-6" kind="worst" m={d.worst_moment} />

          {d.bruin_insights && d.bruin_insights.length > 0 && (
            <Card title="How the team behaved" bruin className="col-span-12">
              <ul className="space-y-2">
                {d.bruin_insights.map((line) => (
                  <li key={line} className="text-[17px]">{line}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Behind your back */}
          <Card title="What your team said behind your back" className="col-span-7">
            <ul className="space-y-2">
              {d.team_said_behind_your_back.map((s, i) => (
                <li key={i} className="rounded-lg border border-line bg-[#0e1420] px-4 py-2 text-[16px] italic">
                  <span aria-hidden="true">🔒 </span>{s}
                </li>
              ))}
            </ul>
          </Card>

          <div className="col-span-5 flex flex-col gap-6">
            <Card title="The ventilator call">
              <p className="text-[18px] leading-relaxed"><span aria-hidden="true">🫁 </span>{d.ventilator_call}</p>
            </Card>
            <Card title="Next time" className="border-spo2/60">
              <p className="text-[20px] font-medium leading-relaxed text-spo2"><span aria-hidden="true">→ </span>{d.next_time}</p>
            </Card>
          </div>

          {/* Skill history */}
          <Card title="Skill history across runs" bruin className="col-span-12">
            <div className="h-[300px]" role="img" aria-label="Line chart of your five skills across all runs">
              <ResponsiveContainer>
                <LineChart data={d.charts.skill_history} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#1F2A3C" />
                  <XAxis dataKey="run" tickFormatter={(r) => `Run ${r}`} {...axis} />
                  <YAxis domain={[0, 100]} {...axis} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(r) => `Run ${r}`} />
                  <Legend />
                  {(Object.keys(SKILL_LABELS) as (keyof Skills)[]).map((k) => (
                    <Line key={k} type="monotone" dataKey={k} name={SKILL_LABELS[k]} stroke={SKILL_COLORS[k]} strokeWidth={2.5} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-between text-[14px] text-muted">
          <span>Training game. Simplified medicine. Not medical advice.</span>
          <button onClick={onRestart} className="rounded-xl bg-alarm px-8 py-4 text-[20px] font-extrabold text-white hover:brightness-110">
            Run another code
          </button>
        </div>
      </div>
    </main>
  )
}

function Card({ title, children, className = '', bruin }: { title: string; children: ReactNode; className?: string; bruin?: boolean }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-6 ${className}`} aria-label={title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold tracking-[0.16em] text-muted uppercase">{title}</h2>
        {bruin && <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">Powered by Bruin</span>}
      </div>
      {children}
    </section>
  )
}

function MomentCard({ kind, m, className }: { kind: 'best' | 'worst'; m: Debrief['best_moment']; className?: string }) {
  const best = kind === 'best'
  return (
    <section className={`rounded-2xl border-2 bg-panel p-6 ${best ? 'border-ecg/60' : 'border-alarm/60'} ${className}`} aria-label={`${kind} moment`}>
      <p className={`text-[14px] font-bold tracking-[0.16em] ${best ? 'text-ecg' : 'text-alarm'}`}>
        <span aria-hidden="true">{best ? '★ ' : '✕ '}</span>{best ? 'BEST MOMENT' : 'WORST MOMENT'} · <span className="font-mono">{m.time}</span>
      </p>
      <blockquote className="mt-3 text-[28px] font-semibold leading-snug">"{m.quote}"</blockquote>
      <p className="mt-2 text-[17px] text-muted">{m.why}</p>
    </section>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 70
  const c = 2 * Math.PI * r
  const color = score >= 75 ? '#39FF88' : score >= 50 ? '#FFD23F' : '#FF3B4E'
  return (
    <div className="relative h-[180px] w-[180px] flex-none" role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#1F2A3C" strokeWidth="14" />
        <circle
          cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-[56px] font-bold leading-none">{score}</div>
          <div className="text-[13px] tracking-widest text-muted">SCORE</div>
        </div>
      </div>
    </div>
  )
}

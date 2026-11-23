import type { AgentReply, Whisper } from '../../model/contract'
import { colorOf } from '../../model/characters'
import { mmss } from '../../model/format'

/** Left panel: every agent action with time, agent, action and reason. */
export function DecisionLog({ log }: { log: (AgentReply & { id: number })[] }) {
  return (
    <section aria-label="Decision log" className="flex h-full min-h-0 flex-col rounded-xl border border-line bg-panel">
      <h2 className="border-b border-line px-4 py-3 text-[13px] font-semibold tracking-[0.18em] text-muted">DECISION LOG</h2>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {log.length === 0 && <li className="px-1 text-[15px] text-muted">Nothing yet. The team is waiting on you.</li>}
        {log.map((r) => (
          <li
            key={r.id}
            className="anim-slide-in rounded-lg border border-line bg-panel-2 py-2 pl-3 pr-3"
            style={{ borderLeft: `4px solid ${colorOf(r.name)}` }}
          >
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-mono text-muted">{mmss(r.t_s)}</span>
              <span className="font-bold" style={{ color: colorOf(r.name) }}>{r.name}</span>
              {r.autonomous && (
                <span className="ml-auto rounded bg-bp px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-black">
                  <span aria-hidden="true">⚡ </span>ACTED ON THEIR OWN
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[16px] font-semibold leading-snug">{r.action}</p>
            <p className="truncate text-[13px] text-muted" title={r.reason}>{r.reason}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Right panel: private messages between agents. */
export function WhisperPanel({ whispers }: { whispers: (Whisper & { id: number })[] }) {
  return (
    <section aria-label="Team chatter you weren't meant to hear" className="flex h-full min-h-0 flex-col rounded-xl border border-line bg-panel">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] font-semibold tracking-[0.14em] text-muted">
        <span aria-hidden="true">🔒</span> TEAM CHATTER YOU WEREN'T MEANT TO HEAR
      </h2>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {whispers.length === 0 && <li className="px-1 text-[15px] text-muted">Quiet. For now.</li>}
        {whispers.map((w) => (
          <li key={w.id} className="anim-slide-in rounded-lg border border-line bg-[#0e1420] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="font-bold" style={{ color: colorOf(w.from) }}>{w.from}</span>
              <span className="text-muted" aria-label="to">→</span>
              <span className="font-bold" style={{ color: colorOf(w.to) }}>{w.to}</span>
              <span className="ml-auto font-mono text-muted">{mmss(w.t_s)}</span>
            </div>
            <p className="mt-0.5 text-[15px] italic leading-snug text-ink/95">"{w.text}"</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

import type { Entry } from './scores'

/** Top 10 list. The newest run is highlighted (color + "NEW" text, not color alone). */
export function Leaderboard({ board, highlightId, className = '' }: { board: Entry[]; highlightId?: string; className?: string }) {
  return (
    <section aria-label="Leaderboard, top 10" className={`rounded-2xl border border-line bg-panel/90 p-5 ${className}`}>
      <h2 className="mb-3 flex items-center justify-between text-[14px] font-semibold tracking-[0.18em] text-muted">
        <span><span aria-hidden="true">🏆 </span>LEADERBOARD</span>
        <span className="text-[11px] tracking-normal">this device</span>
      </h2>
      {board.length === 0 ? (
        <p className="text-[15px] text-muted">No codes run yet. Be the first.</p>
      ) : (
        <ol className="space-y-1">
          {board.map((e, i) => {
            const isNew = e.id === highlightId
            return (
              <li
                key={e.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 font-mono text-[16px] ${isNew ? 'bg-bp/15 ring-2 ring-bp' : i % 2 ? 'bg-transparent' : 'bg-panel-2/60'}`}
              >
                <span className="w-6 text-right text-muted">{i + 1}</span>
                <span className="w-12 font-bold tracking-widest">{e.initials}</span>
                <span className="flex-1 truncate font-sans text-[13px] text-muted">{e.rank}</span>
                {isNew && <span className="rounded bg-bp px-1.5 text-[11px] font-bold text-black">NEW</span>}
                <span className="w-14 text-right font-bold tabular-nums">{e.score}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

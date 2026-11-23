import type { GameScore } from './useGameScore'

/** Running score (top left) with floating +/- pop-ups. Pop-ups also go to a polite live region. */
export function ScoreHud({ game }: { game: GameScore }) {
  const last = game.pops[game.pops.length - 1]
  return (
    <div className="relative flex items-baseline gap-2 rounded-lg border border-bp/50 bg-bp/10 px-3 py-1">
      <span className="text-[11px] font-bold tracking-[0.2em] text-bp">SCORE</span>
      <span className="font-mono text-[24px] font-bold tabular-nums text-ink">{game.score}</span>
      <span className="sr-only" aria-live="polite">{last ? `${last.delta > 0 ? 'plus' : 'minus'} ${Math.abs(last.delta)}: ${last.label}` : ''}</span>
      <div className="pointer-events-none absolute left-2 top-full z-50 mt-2 flex flex-col gap-1" aria-hidden="true">
        {game.pops.map((p) => (
          <span
            key={p.id}
            className={`anim-score-pop whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[18px] font-bold shadow-lg ${p.delta > 0 ? 'bg-ecg text-black' : 'bg-alarm text-[#1a0005]'}`}
          >
            {p.delta > 0 ? '▲ +' : '▼ '}{p.delta} <span className="font-sans text-[14px]">{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

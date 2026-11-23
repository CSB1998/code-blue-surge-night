import type { RunEnded } from '../../model/contract'
import type { GameStats } from './useGameScore'
import { rankFor, total, type Bonus, type Entry } from './scores'
import { Leaderboard } from './Leaderboard'

interface Badge { id: string; icon: string; name: string; how: string; earned: boolean }

export function achievements(stats: GameStats, ended: RunEnded | null, vent: string | undefined): Badge[] {
  const mariaLived = !!ended && ended.maria_outcome !== 'died'
  return [
    { id: 'first', icon: '⚡', name: 'First Responder', how: 'Ordered CPR within 10 s of V-fib', earned: stats.firstResponder },
    { id: 'overruled', icon: '✋', name: 'Overruled', how: 'A teammate refused one of your orders', earned: stats.refusals > 0 },
    { id: 'nurse', icon: '🩺', name: 'Nurse Did Your Job', how: 'Kim acted without your order', earned: stats.kimAutonomous },
    { id: 'amio', icon: '💊', name: 'Out of Amio', how: 'Used the last amiodarone on the unit', earned: stats.amioOut },
    { id: 'two', icon: '🫁', name: 'Two Lives', how: 'Maria lived and Bed 4 got the ventilator', earned: mariaLived && vent === 'bed4' },
    { id: 'cool', icon: '🧊', name: 'Cool Under Pressure', how: 'Got a pulse back with no refusals and no silences', earned: stats.rosc && stats.refusals === 0 && stats.silencePenalties === 0 },
  ]
}

/** Arcade layer of the debrief: final score + rank, badges, leaderboard. */
export function GameDebrief({ score, bonuses, stats, ended, vent, board, highlightId }: {
  score: number; bonuses: Bonus[]; stats: GameStats; ended: RunEnded | null; vent?: string; board: Entry[]; highlightId?: string
}) {
  const final = total(score, bonuses)
  const badges = achievements(stats, ended, vent)
  const earned = badges.filter((b) => b.earned).length
  return (
    <div className="mt-6 grid grid-cols-12 gap-6">
      <section aria-label="Rank" className="col-span-3 flex flex-col items-center justify-center rounded-2xl border-2 border-bp/60 bg-panel p-6 text-center">
        <p className="text-[13px] font-bold tracking-[0.25em] text-muted">GAME SCORE</p>
        <p className="font-mono text-[64px] font-bold leading-none tabular-nums text-bp">{final}</p>
        <dl className="mt-3 w-full space-y-1 border-t border-line pt-3 text-[14px]">
          <div className="flex justify-between"><dt className="text-muted">Live score</dt><dd className="font-mono tabular-nums">{score}</dd></div>
          {bonuses.map((b) => (
            <div key={b.label} className="flex justify-between"><dt className="text-muted">{b.label}</dt><dd className="font-mono font-bold tabular-nums text-ecg">+{b.points}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] font-bold tracking-[0.25em] text-muted">RANK</p>
        <p className="text-[30px] font-extrabold leading-tight">{rankFor(final)}</p>
        <p className="mt-2 text-[12px] text-muted">Intern · Resident 300 · Fellow 500 · Attending 700 · Chief 900</p>
      </section>

      <section aria-label="Achievements" className="col-span-5 rounded-2xl border border-line bg-panel p-6">
        <h2 className="mb-4 flex justify-between text-[14px] font-semibold tracking-[0.16em] text-muted">
          <span>ACHIEVEMENTS</span><span className="tracking-normal">{earned} of {badges.length}</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <li
              key={b.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${b.earned ? 'border-bp/70 bg-bp/10' : 'border-line bg-bg/40 opacity-60'}`}
            >
              <span className={`text-[28px] leading-none ${b.earned ? '' : 'grayscale'}`} aria-hidden="true">{b.icon}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight">{b.name}</p>
                <p className="text-[12px] leading-snug text-muted">{b.how}</p>
                <p className={`mt-1 text-[11px] font-bold tracking-wider ${b.earned ? 'text-bp' : 'text-muted'}`}>{b.earned ? '✓ EARNED' : 'LOCKED'}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Leaderboard board={board} highlightId={highlightId} className="col-span-4" />
    </div>
  )
}

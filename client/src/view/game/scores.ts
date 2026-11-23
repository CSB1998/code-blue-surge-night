// Local leaderboard (top 10, this browser only) and rank titles.
const KEY = 'cbsn.leaderboard'
const INITIALS_KEY = 'cbsn.initials'

export interface Entry { id: string; initials: string; score: number; rank: string; at: number }

export function rankFor(score: number): string {
  if (score >= 900) return 'Chief of Medicine'
  if (score >= 700) return 'Attending'
  if (score >= 500) return 'Fellow'
  if (score >= 300) return 'Resident'
  return 'Intern'
}

export function loadBoard(): Entry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

/** Adds a run and returns the new top 10. */
export function saveScore(initials: string, score: number): { board: Entry[]; id: string } {
  const entry: Entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, initials: cleanInitials(initials) || '???', score, rank: rankFor(score), at: Date.now() }
  const board = [...loadBoard(), entry].sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 10)
  try { localStorage.setItem(KEY, JSON.stringify(board)) } catch { /* storage full or blocked */ }
  return { board, id: entry.id }
}

export const cleanInitials = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)

export function loadInitials(): string {
  try { return cleanInitials(localStorage.getItem(INITIALS_KEY) ?? '') } catch { return '' }
}
export function saveInitials(s: string) {
  try { localStorage.setItem(INITIALS_KEY, cleanInitials(s)) } catch { /* ignore */ }
}

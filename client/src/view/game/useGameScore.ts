// Live arcade score, derived ONLY from events the game already receives
// (agent_reply log, orders, patient ticks). Nothing here talks to the server.
//
//   +50  CPR ordered within 10 s of V-fib       +40  shock delivered in V-fib
//   +100 ROSC                                    +20  order with a read-back ("confirm") that the team carried out
//   -30  a teammate refused an order             -20  a teammate acted on their own ("Kim did your job")
//   -10  every 10 s of silence during V-fib
import { useEffect, useRef, useState } from 'react'
import type { CodeRun } from '../../controller/useCodeRun'
import type { AgentName } from '../../model/contract'

export interface Pop { id: number; delta: number; label: string }

export interface GameStats {
  firstResponder: boolean
  refusals: number
  kimAutonomous: boolean
  amioOut: boolean
  rosc: boolean
  silencePenalties: number
}

const READ_BACK = /\b(confirm|repeat( it)? back|read back|tell me when|let me know|call it out)\b/i
const REFUSAL = /\b(refused|withheld|could not)\b/i
const TEAM: AgentName[] = ['Kim', 'Raj', 'Okafor']

const freshStats = (): GameStats => ({ firstResponder: false, refusals: 0, kimAutonomous: false, amioOut: false, rosc: false, silencePenalties: 0 })
const freshTrust = (): Record<AgentName, number> => ({ Kim: 70, Raj: 70, Okafor: 70 })

let popId = 1

export function useGameScore(run: CodeRun) {
  const [score, setScore] = useState(0)
  const [pops, setPops] = useState<Pop[]>([])
  const [stats, setStats] = useState<GameStats>(freshStats)
  const [trust, setTrust] = useState(freshTrust)

  const seenLog = useRef(0)
  const seenOrders = useRef(0)
  const vfStart = useRef<number | null>(null)
  const prev = useRef<{ rhythm?: string; shocks: number }>({ shocks: 0 })
  const lastOrderT = useRef(-1)
  const lastSilenceT = useRef(-1)
  const pendingReadBack = useRef<number | null>(null)

  const award = (delta: number, label: string) => {
    setScore((s) => s + delta)
    const pop = { id: popId++, delta, label }
    setPops((p) => [...p.slice(-4), pop])
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 1800)
  }
  const nudgeTrust = (name: string, d: number) => {
    if (!TEAM.includes(name as AgentName)) return
    setTrust((t) => ({ ...t, [name]: Math.max(0, Math.min(100, t[name as AgentName] + d)) }))
  }

  // reset at the start of every run
  useEffect(() => {
    if (run.patient === null && run.log.length === 0) {
      setScore(0); setPops([]); setStats(freshStats()); setTrust(freshTrust())
      seenLog.current = 0; seenOrders.current = 0; vfStart.current = null
      prev.current = { shocks: 0 }; lastOrderT.current = -1; lastSilenceT.current = -1; pendingReadBack.current = null
    }
  }, [run.patient, run.log.length])

  // orders: remember read-back requests and reset the silence clock
  useEffect(() => {
    const fresh = run.orders.slice(seenOrders.current)
    seenOrders.current = run.orders.length
    for (const o of fresh) {
      lastOrderT.current = o.t_s
      if (READ_BACK.test(o.transcript)) pendingReadBack.current = o.t_s
    }
  }, [run.orders])

  // team replies (log is newest-first)
  useEffect(() => {
    const fresh = run.log.slice(0, run.log.length - seenLog.current).reverse()
    seenLog.current = run.log.length
    for (const r of fresh) {
      const refusal = REFUSAL.test(r.action)
      const callout = /^called\b/i.test(r.action) || /^replying/i.test(r.reason)
      if (refusal) {
        award(-30, `${r.name} refused`)
        setStats((s) => ({ ...s, refusals: s.refusals + 1 }))
        nudgeTrust(r.name, -10)
      } else if (r.autonomous && !callout && r.name !== 'Reyes') {
        award(-20, `${r.name} did your job`)
        if (r.name === 'Kim') setStats((s) => ({ ...s, kimAutonomous: true }))
        nudgeTrust(r.name, -8)
      } else if (/clarification/i.test(r.action)) {
        nudgeTrust(r.name, -5)
      } else if (!r.autonomous) {
        nudgeTrust(r.name, +5)
        if (pendingReadBack.current !== null && r.t_s - pendingReadBack.current <= 6) {
          award(+20, 'Closed loop')
          pendingReadBack.current = null
        }
      }
      if (/started chest compressions/i.test(r.action) && !r.autonomous && vfStart.current !== null && r.t_s - vfStart.current <= 10) {
        award(+50, 'Fast CPR')
        setStats((s) => ({ ...s, firstResponder: true }))
      }
    }
  }, [run.log])

  // patient ticks: V-fib onset, shocks, ROSC, silence, amio stock
  useEffect(() => {
    const p = run.patient
    if (!p) return
    if (p.rhythm === 'VF' && prev.current.rhythm !== 'VF') vfStart.current = p.t_s
    if (p.shocks > prev.current.shocks && (p.rhythm === 'VF' || prev.current.rhythm === 'VF')) award(+40, 'Shock in V-fib')
    if (p.rhythm === 'ROSC' && prev.current.rhythm !== 'ROSC') {
      award(+100, 'ROSC!')
      setStats((s) => ({ ...s, rosc: true }))
    }
    if (p.rhythm === 'VF' && vfStart.current !== null) {
      const since = Math.max(vfStart.current, lastOrderT.current, lastSilenceT.current)
      if (p.t_s - since >= 10) {
        lastSilenceT.current = p.t_s
        award(-10, 'Silence')
        setStats((s) => ({ ...s, silencePenalties: s.silencePenalties + 1 }))
      }
    }
    if (p.amio_left === 0) setStats((s) => (s.amioOut ? s : { ...s, amioOut: true }))
    prev.current = { rhythm: p.rhythm, shocks: p.shocks }
  }, [run.patient])

  return { score, pops, stats, trust }
}

export type GameScore = ReturnType<typeof useGameScore>

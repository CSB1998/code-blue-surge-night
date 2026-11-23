// The whole game state in one hook. Screens only read from here and call its actions.
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentName, AgentReply, Debrief, Emotion, PatientState, ReyesNote, RunEnded, VentDecision, Whisper,
} from '../types/contract'
import { createTransport, type Transport } from '../lib/transport'
import { voices, type Line } from '../lib/voices'

export type Phase = 'start' | 'code' | 'debrief'

export interface Caption { id: number; name: string; text: string; t_s: number }

let captionId = 1

export function useCodeRun() {
  const [phase, setPhase] = useState<Phase>('start')
  const [patient, setPatient] = useState<PatientState | null>(null)
  const [log, setLog] = useState<(AgentReply & { id: number })[]>([])
  const [whispers, setWhispers] = useState<(Whisper & { id: number })[]>([])
  const [reyes, setReyes] = useState<(ReyesNote & { id: number }) | null>(null)
  const [vent, setVent] = useState<VentDecision | null>(null)
  const [ended, setEnded] = useState<RunEnded | null>(null)
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [orders, setOrders] = useState<{ t_s: number; transcript: string }[]>([])
  const [emotions, setEmotions] = useState<Record<AgentName, Emotion>>({ Kim: 'focused', Raj: 'focused', Okafor: 'focused' })
  const [lastAction, setLastAction] = useState<Partial<Record<AgentName, { action: string; at: number }>>>({})
  const [speaking, setSpeaking] = useState<Line | null>(null)
  const [muted, setMutedState] = useState(false)

  const transport = useRef<Transport | null>(null)
  const tRef = useRef(0)

  useEffect(() => voices.onActive(setSpeaking), [])

  const addCaption = (name: string, text: string, t_s: number) =>
    setCaptions((c) => [...c.slice(-19), { id: captionId++, name, text, t_s }])

  const start = useCallback(() => {
    transport.current?.close()
    voices.clear()
    setPatient(null); setLog([]); setWhispers([]); setReyes(null); setVent(null)
    setEnded(null); setDebrief(null); setCaptions([]); setOrders([])
    setEmotions({ Kim: 'focused', Raj: 'focused', Okafor: 'focused' }); setLastAction({})
    tRef.current = 0

    const tp = createTransport()
    transport.current = tp
    tp.on('patient', (p) => {
      tRef.current = p.t_s
      setPatient(p)
      if (p.vent_assigned !== 'none') setVent(null)
    })
    tp.on('agent_reply', (r) => {
      setLog((l) => [{ ...r, id: captionId++ }, ...l])
      setEmotions((e) => ({ ...e, [r.name]: r.emotion }))
      setLastAction((a) => ({ ...a, [r.name]: { action: r.action, at: Date.now() } }))
      addCaption(r.name, r.spoken, r.t_s)
      voices.say(r.name, r.spoken)
    })
    tp.on('whisper', (w) => setWhispers((ws) => [{ ...w, id: captionId++ }, ...ws]))
    tp.on('reyes_note', (n) => {
      setReyes({ ...n, id: captionId++ })
      addCaption('Reyes', n.hint, n.t_s)
      voices.say('Reyes', n.hint)
    })
    tp.on('vent_decision', (v) => setVent(v))
    tp.on('run_ended', (e) => { setEnded(e); setVent(null) })
    tp.on('debrief', (d) => {
      setDebrief(d)
      setTimeout(() => { voices.clear(); setPhase('debrief') }, 2600)
    })
    tp.emit('start_run', {})
    setPhase('code')
  }, [])

  const sendOrder = useCallback((transcript: string) => {
    const text = transcript.trim()
    if (!text || !transport.current) return
    const t_s = tRef.current
    setOrders((o) => [...o, { t_s, transcript: text }])
    addCaption('You', text, t_s)
    transport.current.emit('order', { t_s, transcript: text })
  }, [])

  const chooseVent = useCallback((choice: 'maria' | 'bed4') => {
    transport.current?.emit('vent_choice', { choice })
    setVent(null)
  }, [])

  const endRun = useCallback(() => transport.current?.emit('end_run', {}), [])

  const setMuted = useCallback((m: boolean) => { voices.setMuted(m); setMutedState(m) }, [])

  useEffect(() => () => transport.current?.close(), [])

  return {
    phase, patient, log, whispers, reyes, vent, ended, debrief, captions, orders,
    emotions, lastAction, speaking, muted,
    start, sendOrder, chooseVent, endRun, setMuted,
  }
}

export type CodeRun = ReturnType<typeof useCodeRun>

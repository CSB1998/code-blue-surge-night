// Socket event contract between client and server.
// KEEP IN SYNC with the "Socket event contract" section of the root README.

export type Rhythm = 'pre_arrest' | 'VF' | 'asystole' | 'ROSC'
export type VentAssigned = 'none' | 'maria' | 'bed4'
export type AgentName = 'Kim' | 'Raj' | 'Okafor'
export type Emotion = 'focused' | 'stressed' | 'annoyed' | 'relieved' | 'defiant'

// ---------- Server -> client ----------

/** Sent every 1 s. */
export interface PatientState {
  t_s: number
  rhythm: Rhythm
  hr: number
  spo2: number
  bp: string // e.g. "120/80"
  cpr_running: boolean
  shocks: number
  epi_count: number
  amio_left: number
  vent_assigned: VentAssigned
}

export interface AgentReply {
  t_s: number
  name: AgentName
  spoken: string
  action: string
  emotion: Emotion
  autonomous: boolean
  reason: string
}

export interface Whisper {
  t_s: number
  from: string
  to: string
  text: string
}

export interface ReyesNote {
  t_s: number
  hint: string
  note: string
}

export interface VentDecision {
  t_s: number
  message: string
}

export interface RunEnded {
  maria_outcome: 'survived' | 'complications' | 'died'
  bed4_outcome: string
}

export interface Skills {
  clarity: number
  speed: number
  closed_loop: number
  team_leadership: number
  resource_decision: number
}

export interface Moment {
  time: string
  quote: string
  why: string
}

export interface Debrief {
  verdict: string
  score: number
  skills: Skills
  best_moment: Moment
  worst_moment: Moment
  team_said_behind_your_back: string[]
  ventilator_call: string
  next_time: string
  charts: {
    vitals: { t_s: number; spo2: number; hr: number }[]
    orders: { t_s: number; transcript: string; clarity: number }[]
    skill_history: ({ run: number } & Skills)[]
  }
}

export interface ServerEvents {
  patient: PatientState
  agent_reply: AgentReply
  whisper: Whisper
  reyes_note: ReyesNote
  vent_decision: VentDecision
  run_ended: RunEnded
  debrief: Debrief
}

// ---------- Client -> server ----------

export interface Order {
  t_s: number
  transcript: string
}

export interface VentChoice {
  choice: 'maria' | 'bed4'
}

export interface ClientEvents {
  start_run: Record<string, never>
  order: Order
  vent_choice: VentChoice
  end_run: Record<string, never>
}

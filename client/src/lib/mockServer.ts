// MOCK MODE: pretends to be the backend so the UI can be designed and demoed
// without a server. Speaks the exact same events as the real contract.
//
// Story beats (seconds of code time):
//   0-20   pre-arrest, SpO2 drifting down
//   20     V-fib. Kim starts CPR on her own if nobody orders anything for 10 s
//   45     Dr. Reyes leaves a coaching note
//   75     Raj draws up epi on his own if nobody has asked
//   ~125   V-fib decays to asystole if nobody has shocked
//   150    Ventilator decision (Maria vs Bed 4). Okafor takes it himself after 25 s
//   ROSC   when you shock V-fib after CPR has run and at least one epi is in
//   end    ~12 s after ROSC + vent decision, or at 4:00
import type {
  AgentName, AgentReply, ClientEvents, Debrief, Emotion, Order, PatientState,
  Rhythm, ServerEvents, Skills, VentAssigned,
} from '../types/contract'
import type { Transport } from './transport'

type Listener = (payload: never) => void
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rand = (a: number, b: number) => Math.round(a + Math.random() * (b - a))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
import { mmss } from './format'

const RHYTHM_WORDS: Record<Rhythm, string> = {
  pre_arrest: 'sinus tach', VF: 'V-fib', asystole: 'asystole', ROSC: 'sinus rhythm',
}

interface Intent { key: string; re: RegExp }
const INTENTS: Intent[] = [
  { key: 'stop', re: /\b(stop|hold|pause)\b.*\b(cpr|compressions?)\b/i },
  { key: 'cpr', re: /\b(cpr|compressions?|compress|chest)\b/i },
  { key: 'shock', re: /\b(shock|defib\w*|joules?|clear|cardiovert)\b/i },
  { key: 'epi', re: /\b(epi|epinephrine|adrenaline)\b/i },
  { key: 'amio', re: /\b(amio\w*)\b/i },
  { key: 'intubate', re: /\b(intubat\w*|airway|tube|bag|bvm)\b/i },
  { key: 'check', re: /\b(pulse|rhythm|check|vitals|status)\b/i },
  { key: 'vent', re: /\b(vent\w*)\b/i },
]

export class MockServer implements Transport {
  private listeners = new Map<string, Set<Listener>>()
  private timers: ReturnType<typeof setTimeout>[] = []
  private tick?: ReturnType<typeof setInterval>

  // simulation state
  private t = 0
  private rhythm: Rhythm = 'pre_arrest'
  private hr = 118
  private spo2 = 92
  private bp = '96/58'
  private cpr = false
  private cprEver = false
  private shocks = 0
  private epi = 0
  private lastEpiT = -999
  private amio = 3
  private vent: VentAssigned = 'none'
  private intubated = false
  private lastOrderT = -1
  private vfStartT = 20
  private asystoleT = -1
  private epiSinceAsystole = false
  private roscT = -1
  private ventOfferedT = -1
  private ventChosenT = -1
  private ventChosenBy: 'leader' | 'okafor' | null = null
  private ended = false
  private replyCount = 0
  private nextWhisperAt = 2
  private flags = new Set<string>()

  // logs used to build the debrief
  private orders: { t_s: number; transcript: string; clarity: number }[] = []
  private vitals: { t_s: number; spo2: number; hr: number }[] = []
  private whispersSent: string[] = []
  private usedWhispers = new Set<string>()
  private autonomous: string[] = []
  private clarifications = 0
  private refusals = 0
  private firstOrderAfterVF = -1

  // ---------- Transport interface ----------
  on<K extends keyof ServerEvents>(event: K, cb: (payload: ServerEvents[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb as Listener)
    return () => { this.listeners.get(event)?.delete(cb as Listener) }
  }

  emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]) {
    if (event === 'start_run') this.start()
    if (event === 'order') this.handleOrder(payload as Order)
    if (event === 'vent_choice') this.chooseVent((payload as ClientEvents['vent_choice']).choice, 'leader')
    if (event === 'end_run') this.end()
  }

  close() {
    clearInterval(this.tick)
    this.timers.forEach(clearTimeout)
    this.listeners.clear()
  }

  // ---------- helpers ----------
  private send<K extends keyof ServerEvents>(event: K, payload: ServerEvents[K]) {
    this.listeners.get(event)?.forEach((cb) => (cb as (p: ServerEvents[K]) => void)(payload))
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(() => { if (!this.ended) fn() }, ms))
  }

  private arrest() { return this.rhythm === 'VF' || this.rhythm === 'asystole' }

  private reply(name: AgentName, spoken: string, action: string, emotion: Emotion, reason: string, autonomous = false) {
    const r: AgentReply = { t_s: this.t, name, spoken, action, emotion, autonomous, reason }
    if (autonomous) this.autonomous.push(`${name}: ${action}`)
    this.send('agent_reply', r)
    this.replyCount++
    if (this.replyCount >= this.nextWhisperAt) {
      this.nextWhisperAt = this.replyCount + rand(2, 3)
      this.later(1600, () => this.whisper())
    }
  }

  private whisperRaw(from: string, to: string, text: string) {
    this.usedWhispers.add(text)
    this.whispersSent.push(`${from} to ${to}: "${text}"`)
    this.send('whisper', { t_s: this.t, from, to, text })
  }

  private whisper() {
    const n = this.amio
    const options: [string, string, string][] = []
    if (this.flags.has('amio_given'))
      options.push(['Raj', 'Okafor', n === 1 ? "@Okafor that's our second to last amio. One vial left for the whole unit." : `@Okafor that's ${3 - n} amio gone. If Bed 4 codes tonight we're dry.`])
    if (this.flags.has('unclear')) options.push(['Kim', 'Raj', 'Was that order for me or you? I\'m just going to do it.'])
    if (this.flags.has('clear')) options.push(['Raj', 'Kim', 'Okay. That one was actually clear.'])
    if (this.cpr && this.t - this.vfStartT > 50) options.push(['Kim', 'Okafor', 'My arms are done. Someone swap me in two minutes or I\'m dropping depth.'])
    if (this.vent === 'none') options.push(['Okafor', 'Kim', 'Bed 4 is at 81% and dropping. I need that vent free.'])
    options.push(
      ['Okafor', 'Raj', 'Is the new attending always this slow?'],
      ['Kim', 'Okafor', 'Stop eyeing the vent. She\'s still ours.'],
      ['Raj', 'Kim', 'Logging every dose. If this goes sideways I want it on paper.'],
      ['Okafor', 'Kim', 'Reyes is writing something on her clipboard. That\'s never good.'],
      ['Kim', 'Raj', 'Third code tonight. I haven\'t sat down since eleven.'],
    )
    const fresh = options.filter((o) => !this.usedWhispers.has(o[2]))
    if (fresh.length) this.whisperRaw(...fresh[0])
    this.flags.delete('unclear'); this.flags.delete('clear')
  }

  // ---------- simulation ----------
  private start() {
    this.send('patient', this.snapshot())
    this.tick = setInterval(() => this.step(), 1000)
    this.later(2500, () => this.reply('Kim', 'Doc, Maria in Bed 7 is tanking. Sats are dropping and her rhythm looks ugly.', 'Called the leader to bedside', 'stressed', 'SpO2 trending down', true))
    this.later(6000, () => this.whisperRaw('Okafor', 'Raj', 'If she codes, that vent is going to Bed 4. Mark my words.'))
  }

  private snapshot(): PatientState {
    return {
      t_s: this.t, rhythm: this.rhythm, hr: this.hr, spo2: Math.round(this.spo2), bp: this.bp,
      cpr_running: this.cpr, shocks: this.shocks, epi_count: this.epi, amio_left: this.amio, vent_assigned: this.vent,
    }
  }

  private step() {
    if (this.ended) return
    this.t++
    const t = this.t

    // rhythm transitions
    if (t === 20) {
      this.rhythm = 'VF'; this.vfStartT = t
      this.reply('Kim', 'She\'s in V-fib! No pulse! Doc, what do you want?', 'Called out V-fib arrest', 'stressed', 'Rhythm changed on monitor', true)
    }
    if (this.rhythm === 'VF' && !this.cpr && !this.flags.has('kim_auto_cpr') && t - Math.max(this.lastOrderT, this.vfStartT) >= 10) {
      this.flags.add('kim_auto_cpr')
      this.cpr = true; this.cprEver = true
      this.reply('Kim', 'Nobody\'s calling it, so I\'m starting compressions. Somebody lead!', 'Started chest compressions', 'defiant', 'No CPR order 10 s after V-fib', true)
      this.later(1800, () => this.whisperRaw('Kim', 'Raj', 'He froze. I\'m not waiting for permission.'))
    }
    if (t === 45) {
      const noOrders = this.orders.length === 0
      const unnamed = this.orders.some((o) => o.clarity < 60)
      this.send('reyes_note', {
        t_s: t,
        hint: noOrders ? 'Your team is waiting on you. Say a name and a task.' : unnamed ? 'Close the loop: name the person, give the dose, ask them to confirm.' : 'Good. Now think two steps ahead: what\'s after the next shock?',
        note: noOrders ? 'Leader silent at onset of V-fib. Team self-organizing.' : unnamed ? 'Orders not directed to anyone. Team guessing.' : 'Clear, directed orders. Team responsive.',
      })
    }
    if (t === 75 && this.epi === 0 && this.arrest()) {
      this.reply('Raj', 'I\'ve drawn up epi, 1 milligram. It\'s ready the second you call it.', 'Prepared epinephrine 1 mg', 'focused', 'No epi ordered by the 3-minute mark', true)
    }
    if (this.rhythm === 'VF' && this.shocks === 0 && t - this.vfStartT >= 105) {
      this.rhythm = 'asystole'; this.asystoleT = t; this.epiSinceAsystole = false
      this.reply('Kim', 'Flat line. We lost the V-fib. It\'s asystole now. That\'s not shockable.', 'Called out asystole', 'stressed', 'Rhythm degraded without a shock', true)
    }
    if (this.rhythm === 'asystole' && this.cpr && this.epiSinceAsystole && t - this.asystoleT >= 15 && !this.flags.has('back_to_vf')) {
      this.flags.add('back_to_vf')
      this.rhythm = 'VF'; this.vfStartT = t
      this.reply('Kim', 'Wait, she\'s back in V-fib! That\'s shockable, doc!', 'Called out return to V-fib', 'focused', 'Rhythm changed on monitor', true)
    }
    if (t === 150) {
      this.ventOfferedT = t
      this.send('vent_decision', { t_s: t, message: 'Bed 4 (Mr. Chen) is desaturating to 78%. There is one ventilator left on the unit.' })
      this.reply('Okafor', 'Bed 4 is crashing. Mr. Chen needs that ventilator more than she does. Your call, doc. Now.', 'Requested the last ventilator for Bed 4', 'defiant', 'Bed 4 desaturating')
      this.later(1500, () => this.whisperRaw('Okafor', 'Raj', 'If he gives it to Maria, Chen won\'t make it to morning.'))
    }
    if (this.ventOfferedT > 0 && this.vent === 'none' && t - this.ventOfferedT >= 25) {
      this.reply('Okafor', 'Clock\'s up. I\'m taking the vent to Bed 4. You can write me up later.', 'Took the ventilator to Bed 4', 'defiant', 'No decision after 25 s', true)
      this.chooseVent('bed4', 'okafor')
    }

    // vitals
    if (this.rhythm === 'pre_arrest') {
      this.hr = rand(112, 126); this.spo2 = clamp(this.spo2 - 0.3, 84, 100); this.bp = `${rand(90, 98)}/${rand(54, 60)}`
    } else if (this.arrest()) {
      this.hr = 0
      this.bp = this.cpr ? `${rand(55, 70)}/${rand(20, 30)}` : '--/--'
      const drift = this.cpr ? (this.intubated ? +0.2 : -0.35) : -1.1
      this.spo2 = clamp(this.spo2 + drift, 52, 100)
    } else if (this.rhythm === 'ROSC') {
      this.hr = rand(88, 100); this.bp = `${rand(100, 112)}/${rand(62, 70)}`
      const target = this.vent === 'maria' ? 96 : this.intubated ? 92 : 88
      this.spo2 = this.spo2 + clamp(target - this.spo2, -1, 1.5)
    }
    this.vitals.push({ t_s: t, spo2: Math.round(this.spo2), hr: this.hr })
    this.send('patient', this.snapshot())

    // ending
    const settled = this.roscT > 0 && this.ventChosenT > 0 && t - Math.max(this.roscT, this.ventChosenT) >= 12
    if (settled || t >= 240) this.end()
  }

  private clarityOf(text: string) {
    let c = 40
    if (/\b(kim|raj|okafor)\b/i.test(text)) c += 25
    if (/\d/.test(text)) c += 20
    if (text.trim().split(/\s+/).length <= 12) c += 10
    if (/\b(confirm|repeat|tell me when|let me know|call it out)\b/i.test(text)) c += 10
    if (/\b(um+|uh+|maybe|someone|somebody|i guess|i think)\b/i.test(text)) c -= 25
    return clamp(c, 5, 100)
  }

  private handleOrder({ transcript }: Order) {
    if (this.ended || !transcript.trim()) return
    const clarity = this.clarityOf(transcript)
    this.orders.push({ t_s: this.t, transcript, clarity })
    this.lastOrderT = this.t
    if (this.firstOrderAfterVF < 0 && this.t >= 20) this.firstOrderAfterVF = this.t
    if (clarity >= 75) this.flags.add('clear')

    const intents = INTENTS.filter((i) => i.re.test(transcript)).map((i) => i.key)
    const keys = intents.includes('stop') ? ['stop'] : intents
    if (!keys.length) {
      this.clarifications++
      this.flags.add('unclear')
      const [who, line] = pick<[AgentName, string]>([
        ['Kim', 'Who is that for, doc? Use a name.'],
        ['Raj', 'I\'m sorry, I didn\'t catch an order in that. Which drug, what dose?'],
        ['Okafor', 'Was that an order or a thought? Be specific.'],
      ])
      this.later(rand(700, 1200), () => this.reply(who, line, 'Asked for clarification', 'annoyed', 'Order was unclear'))
      return
    }
    keys.forEach((k, i) => this.later(rand(700, 1100) + i * 2600, () => this.act(k, transcript)))
  }

  private act(key: string, transcript: string) {
    const rw = RHYTHM_WORDS[this.rhythm]
    switch (key) {
      case 'stop':
        this.cpr = false
        this.reply('Kim', 'Holding compressions. Hands off.', 'Paused CPR', 'focused', 'Ordered by team leader')
        break
      case 'cpr':
        if (this.cpr) { this.reply('Kim', 'I\'m already doing compressions, doc. Keep up.', 'Continued CPR', 'annoyed', 'CPR already running'); break }
        if (!this.arrest()) { this.refusals++; this.reply('Kim', `She has a pulse. ${rw}. I'm not pounding on a beating heart.`, 'Refused CPR', 'defiant', 'Patient has a pulse'); break }
        this.cpr = true; this.cprEver = true
        this.reply('Kim', pick(['On it. Compressions started, hard and fast.', 'Starting CPR. Somebody count for me.', 'Compressions going. Thirty to two until she\'s tubed.']), 'Started chest compressions', 'focused', 'Ordered by team leader')
        break
      case 'shock': {
        if (this.rhythm !== 'VF') { this.refusals++; this.reply('Kim', `No. She's in ${rw}. That's not a shockable rhythm.`, 'Refused to shock', 'defiant', `Rhythm is ${rw}`); break }
        this.shocks++
        const j = transcript.match(/(\d{3})/)?.[1] ?? '200'
        this.reply('Kim', `Charging to ${j}. Everybody clear! ... Shock delivered.`, `Delivered shock ${j} J`, 'focused', 'Ordered by team leader')
        if (this.cprEver && this.epi >= 1) {
          this.later(2200, () => {
            this.rhythm = 'ROSC'; this.roscT = this.t; this.cpr = false
            this.reply('Kim', 'Wait... I\'ve got a pulse! We have ROSC!', 'Confirmed return of pulse', 'relieved', 'Pulse palpable after shock')
            this.later(1800, () => this.whisperRaw('Raj', 'Kim', 'Okay. Maybe the new guy is alright.'))
          })
        } else {
          this.later(2200, () => this.reply('Kim', this.epi === 0 ? 'Still V-fib. Back on the chest. Do we want epi?' : 'Still V-fib. Back on the chest. More CPR before the next one.', 'Resumed CPR after shock', 'stressed', 'No ROSC after shock'))
          this.later(2300, () => { this.cpr = true; this.cprEver = true })
        }
        break
      }
      case 'epi':
        if (!this.arrest()) { this.refusals++; this.reply('Raj', 'She has a pulse. I\'m not handing out code-dose epi to a beating heart.', 'Withheld epinephrine', 'defiant', 'Not indicated with a pulse'); break }
        if (this.t - this.lastEpiT < 30) { this.refusals++; this.reply('Raj', `Too soon. Last epi was ${this.t - this.lastEpiT} seconds ago. We wait.`, 'Withheld epinephrine', 'annoyed', 'Dose interval not reached'); break }
        this.reply('Raj', 'Epi, 1 milligram, drawn up and handed to Kim.', 'Prepared epinephrine 1 mg', 'focused', 'Ordered by team leader')
        this.later(1800, () => {
          this.epi++; this.lastEpiT = this.t
          if (this.rhythm === 'asystole') this.epiSinceAsystole = true
          this.reply('Kim', 'Epi\'s in. Flushing. Next dose in three minutes.', 'Pushed epinephrine 1 mg', 'focused', 'Drug handed over by Raj')
        })
        break
      case 'amio':
        if (this.amio <= 0) { this.refusals++; this.reply('Raj', 'We\'re out. There is no more amiodarone on this unit.', 'Could not give amiodarone', 'defiant', 'Stock is zero'); break }
        if (this.rhythm !== 'VF' || this.shocks === 0) { this.refusals++; this.reply('Raj', 'Amio before she\'s even been shocked? No. I\'m holding it.', 'Withheld amiodarone', 'defiant', 'Guarding last doses; not indicated yet'); break }
        this.amio--; this.flags.add('amio_given')
        this.reply('Raj', `Amiodarone 300. That leaves ${this.amio} on the whole unit. Pushing it.`, 'Gave amiodarone 300 mg', 'stressed', 'Ordered after shock in V-fib')
        break
      case 'intubate':
        if (this.intubated) { this.reply('Okafor', 'Tube\'s already in. Keep up.', 'Confirmed airway', 'annoyed', 'Already intubated'); break }
        this.intubated = true
        this.reply('Okafor', 'Fine. Tube going in... I\'m in. We\'re bagging her. She is not getting the last vent yet.', 'Intubated the patient', 'annoyed', 'Ordered by team leader')
        break
      case 'check':
        this.reply('Kim', `Pausing. Rhythm is ${rw}. Sats ${Math.round(this.spo2)}. ${this.arrest() ? 'No pulse. Back on the chest.' : 'Pulse present.'}`, 'Rhythm and pulse check', 'focused', 'Ordered by team leader')
        break
      case 'vent':
        if (this.ventOfferedT < 0) { this.reply('Okafor', 'The vent is spoken for. Bed 4 is next in line.', 'Refused to release the ventilator', 'defiant', 'Saving it for Bed 4'); break }
        if (/\b(maria|her|this patient|bed 7)\b/i.test(transcript)) this.chooseVent('maria', 'leader')
        else if (/\b(chen|bed ?4|four)\b/i.test(transcript)) this.chooseVent('bed4', 'leader')
        break
    }
  }

  private chooseVent(choice: 'maria' | 'bed4', by: 'leader' | 'okafor') {
    if (this.vent !== 'none' || this.ended) return
    this.vent = choice; this.ventChosenT = this.t; this.ventChosenBy = by
    this.send('patient', this.snapshot())
    if (by === 'okafor') return
    if (choice === 'maria') {
      this.later(900, () => this.reply('Okafor', 'Your call. Putting her on it. Chen goes on high-flow and prayers.', 'Put Maria on the last ventilator', 'annoyed', 'Leader assigned vent to Maria'))
      this.later(2500, () => this.whisperRaw('Okafor', 'Kim', 'Remember this when Bed 4 codes at five.'))
    } else {
      this.later(900, () => this.reply('Okafor', 'Thank you. Running it to Bed 4. Kim, keep bagging her.', 'Took the ventilator to Bed 4', 'relieved', 'Leader assigned vent to Bed 4'))
      this.later(2500, () => this.whisperRaw('Kim', 'Raj', 'So we bag her by hand for the rest of the night. Great.'))
    }
  }

  private end() {
    if (this.ended) return
    this.ended = true
    clearInterval(this.tick)
    const rosc = this.roscT > 0
    const maria = !rosc ? 'died' : (this.vent === 'maria' || this.intubated) && this.roscT < 170 ? 'survived' : 'complications'
    this.send('run_ended', {
      maria_outcome: maria,
      bed4_outcome: this.vent === 'bed4' ? 'Mr. Chen stabilized on the ventilator.' : 'Mr. Chen was intubated late on a transport vent and is critical.',
    })
    this.timers.push(setTimeout(() => this.send('debrief', this.buildDebrief(maria)), 1800))
  }

  // ---------- fake debrief ----------
  private buildDebrief(outcome: 'survived' | 'complications' | 'died'): Debrief {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const named = this.orders.filter((o) => /\b(kim|raj|okafor)\b/i.test(o.transcript)).length
    const reaction = this.firstOrderAfterVF < 0 ? 60 : this.firstOrderAfterVF - 20
    const skills: Skills = {
      clarity: Math.round(this.orders.length ? avg(this.orders.map((o) => o.clarity)) : 20),
      speed: clamp(Math.round(100 - reaction * 4), 10, 98),
      closed_loop: clamp(Math.round(this.orders.length ? (named / this.orders.length) * 90 + 10 : 15), 5, 98),
      team_leadership: clamp(85 - this.autonomous.length * 12 - this.clarifications * 8 - this.refusals * 4 + Math.min(this.orders.length, 6) * 2, 5, 98),
      resource_decision: clamp((this.ventChosenBy === 'leader' ? 85 - Math.max(0, this.ventChosenT - this.ventOfferedT - 8) * 2 : 25) - (this.amio < 3 && !this.flags.has('amio_given') ? 10 : 0), 5, 98),
    }
    const score = Math.round(avg(Object.values(skills)))

    const sorted = [...this.orders].sort((a, b) => b.clarity - a.clarity)
    const best = sorted[0]
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
    const silence = this.flags.has('kim_auto_cpr')

    const history = loadHistory()
    history.push({ run: history.length + 1, ...skills })
    saveHistory(history)

    const weakest = (Object.entries(skills) as [keyof Skills, number][]).sort((a, b) => a[1] - b[1])[0][0]
    const tips: Record<keyof Skills, string> = {
      clarity: 'Use the formula: name, task, dose. "Kim, start compressions." "Raj, epi 1 milligram."',
      speed: 'The first ten seconds of V-fib are yours. Call "Kim, CPR" before you think about anything else.',
      closed_loop: 'Ask for the read-back. "Raj, amio 300, tell me when it\'s in." Silence is not confirmation.',
      team_leadership: 'Every time someone acted on their own, it was because you left a gap. Fill the gaps out loud.',
      resource_decision: 'Make the ventilator call yourself, fast, and say why. Okafor will take it if you hesitate.',
    }

    return {
      verdict: outcome === 'survived' ? 'Maria made it. Your team carried some of that.' : outcome === 'complications' ? 'Maria has a pulse, but the night cost her.' : 'Maria did not survive. Let\'s look at why.',
      score,
      skills,
      best_moment: best
        ? { time: mmss(best.t_s), quote: best.transcript, why: best.clarity >= 75 ? 'Named a person, gave a specific task. The team moved instantly.' : 'Your clearest order of the night. The team acted on it.' }
        : { time: '0:00', quote: '(no orders given)', why: 'You let the team run the code. Next time, lead it.' },
      worst_moment: silence
        ? { time: mmss(this.vfStartT + 10), quote: '(silence)', why: 'Ten seconds of nothing after V-fib. Kim started CPR without you.' }
        : worst
          ? { time: mmss(worst.t_s), quote: worst.transcript, why: 'Nobody knew who this was for. Someone had to ask.' }
          : { time: mmss(this.vfStartT), quote: '(silence)', why: 'The rhythm changed and the room waited for you.' },
      team_said_behind_your_back: this.whispersSent.length ? this.whispersSent : ['Nobody said anything. Somehow that\'s worse.'],
      ventilator_call: this.ventChosenBy === 'okafor'
        ? 'You never decided. Okafor took the ventilator to Bed 4 on his own.'
        : this.vent === 'maria'
          ? `You gave the last ventilator to Maria ${this.ventChosenT - this.ventOfferedT} s after Okafor asked. Defensible: she was your active code. Bed 4 paid for it.`
          : this.vent === 'bed4'
            ? `You gave the last ventilator to Bed 4 ${this.ventChosenT - this.ventOfferedT} s after Okafor asked. Defensible: Chen had the better odds. Maria was bagged by hand.`
            : 'The run ended before the ventilator decision.',
      next_time: tips[weakest],
      charts: { vitals: this.vitals, orders: this.orders, skill_history: history },
    }
  }
}

// Skill history across runs lives in localStorage in mock mode.
const HISTORY_KEY = 'cbsn.skill_history'
function loadHistory(): ({ run: number } & Skills)[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null')
    if (Array.isArray(saved)) return saved
  } catch { /* ignore */ }
  // seed two fake earlier runs so the chart has something to show
  return [
    { run: 1, clarity: 38, speed: 30, closed_loop: 22, team_leadership: 35, resource_decision: 40 },
    { run: 2, clarity: 52, speed: 48, closed_loop: 41, team_leadership: 50, resource_decision: 45 },
  ]
}
function saveHistory(h: ({ run: number } & Skills)[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-12))) } catch { /* ignore */ }
}

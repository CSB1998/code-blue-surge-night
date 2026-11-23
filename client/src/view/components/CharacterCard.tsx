import { useEffect, useState } from 'react'
import type { AgentName, Emotion } from '../../model/contract'
import { CHARACTERS, portrait } from '../../model/characters'

interface Props {
  name: AgentName
  emotion: Emotion
  action?: { action: string; at: number }
  speakingText?: string
  cpr?: boolean
  bubbleSide?: 'top' | 'right' | 'left'
}

/** Which little animation an action should trigger. */
function animFor(action: string): 'syringe' | 'intubate' | 'shock' | null {
  const a = action.toLowerCase()
  if (/intubat|airway|tube/.test(a)) return 'intubate'
  if (/epinephrine|amiodarone|pushed|prepared|gave/.test(a)) return 'syringe'
  if (/shock/.test(a)) return 'shock'
  return null
}

export function CharacterCard({ name, emotion, action, speakingText, cpr, bubbleSide = 'top' }: Props) {
  const c = CHARACTERS[name]
  const [recent, setRecent] = useState(false)

  // action animations play for ~3 s after each new action
  useEffect(() => {
    if (!action) return
    setRecent(true)
    const id = setTimeout(() => setRecent(false), 3000)
    return () => clearTimeout(id)
  }, [action?.at])

  const anim = recent && action ? animFor(action.action) : null
  const speaking = !!speakingText
  const imgAnim = cpr ? 'anim-cpr' : anim === 'intubate' ? 'anim-intubate' : ''
  const cardAnim = recent && emotion === 'defiant' ? 'anim-shake' : ''

  const bubblePos = {
    top: 'bottom-full left-1/2 mb-3 -translate-x-1/2',
    right: 'left-full top-4 ml-3',
    left: 'right-full top-4 mr-3',
  }[bubbleSide]

  return (
    <figure className="relative m-0 w-[180px]" aria-label={`${c.fullName}, ${c.role}, looks ${emotion}`}>
      {speaking && (
        <div
          key={speakingText}
          className={`anim-pop-in absolute z-20 w-[300px] rounded-xl border-2 bg-panel px-4 py-3 text-[17px] leading-snug shadow-2xl ${bubblePos}`}
          style={{ borderColor: c.color }}
        >
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wider" style={{ color: c.color }}>{c.name}</span>
          {speakingText}
        </div>
      )}

      <div
        key={cardAnim ? action?.at : 'still'}
        className={`relative overflow-hidden rounded-xl border-2 bg-panel transition-shadow duration-200 ${cardAnim}`}
        style={{
          borderColor: c.color,
          boxShadow: speaking ? `0 0 0 3px ${c.color}55, 0 0 36px ${c.color}AA` : '0 10px 30px rgb(0 0 0 / 0.5)',
        }}
      >
        <img src={portrait(name, emotion)} alt="" className={`block aspect-[4/5] w-full object-cover ${imgAnim}`} draggable={false} />

        {anim === 'syringe' && (
          <span key={action?.at} className="anim-syringe absolute bottom-14 left-1/2 text-[34px]" aria-hidden="true">💉</span>
        )}
        {anim === 'shock' && (
          <span key={action?.at} className="anim-pop-in absolute right-2 top-2 text-[34px]" aria-hidden="true">⚡</span>
        )}
        {cpr && (
          <span className="absolute left-2 top-2 rounded-full bg-ecg px-2 py-0.5 text-[12px] font-bold text-black">CPR</span>
        )}
      </div>

      <figcaption className="mt-2 flex items-center justify-between rounded-lg bg-panel/90 px-3 py-1.5 text-[14px]">
        <span className="font-semibold" style={{ color: c.color }}>{c.fullName}</span>
        <span className="text-muted">{emotion}</span>
      </figcaption>
      {recent && action && (
        <p className="anim-fade-in mt-1 truncate text-center text-[13px] text-ink/90" title={action.action}>▸ {action.action}</p>
      )}
    </figure>
  )
}

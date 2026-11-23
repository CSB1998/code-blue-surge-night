import { useEffect, useRef } from 'react'
import type { VentDecision } from '../types/contract'
import { portrait } from '../data/characters'

export function VentModal({ decision, okaforLine, onChoose }: { decision: VentDecision; okaforLine?: string; onChoose: (c: 'maria' | 'bed4') => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])

  return (
    <div className="anim-fade-in absolute inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="vent-title" className="anim-pop-in w-[920px] rounded-2xl border-2 border-bp bg-panel p-8 shadow-2xl">
        <p className="text-[14px] font-bold tracking-[0.2em] text-bp"><span aria-hidden="true">⚠ </span>RESOURCE DECISION</p>
        <h2 id="vent-title" className="mt-1 text-[40px] font-extrabold leading-tight">One ventilator. Two patients.</h2>
        <p className="mt-2 text-[19px] text-muted">{decision.message}</p>

        <div className="mt-5 flex items-start gap-4 rounded-xl border border-okafor/60 bg-panel-2 p-4">
          <img src={portrait('Okafor', 'defiant')} alt="" className="h-[88px] w-[70px] rounded-lg object-cover" />
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-okafor">Dr. Okafor</p>
            <p className="text-[21px] leading-snug">"{okaforLine ?? 'Bed 4 needs that ventilator. Decide.'}"</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button ref={first} onClick={() => onChoose('maria')} className="rounded-xl border-2 border-spo2 bg-spo2/10 p-5 text-left hover:bg-spo2/20">
            <span className="block text-[26px] font-extrabold text-spo2">Keep it for Maria</span>
            <span className="mt-1 block text-[16px] text-muted">Your active code, Bed 7. Bed 4 goes on high-flow oxygen.</span>
          </button>
          <button onClick={() => onChoose('bed4')} className="rounded-xl border-2 border-okafor bg-okafor/10 p-5 text-left hover:bg-okafor/20">
            <span className="block text-[26px] font-extrabold text-okafor">Give it to Bed 4</span>
            <span className="mt-1 block text-[16px] text-muted">Mr. Chen, desaturating. Maria gets bagged by hand.</span>
          </button>
        </div>
        <p className="mt-4 text-center text-[14px] text-muted">If you don't decide, someone else will.</p>
      </div>
    </div>
  )
}

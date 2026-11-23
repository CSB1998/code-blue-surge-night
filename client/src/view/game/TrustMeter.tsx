/** Small trust bar under a character card. Shows the number too, so it never relies on color. */
export function TrustMeter({ value, color }: { value: number; color: string }) {
  const label = value >= 75 ? 'trusts you' : value >= 50 ? 'unsure' : 'doubts you'
  return (
    <div className="mt-1.5 w-[180px] rounded-md bg-black/60 px-2 py-1" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`Trust ${value} of 100, ${label}`}>
      <div className="flex justify-between text-[11px] font-semibold">
        <span className="tracking-wider text-muted">TRUST</span>
        <span className="text-ink/90">{label} · {value}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#1f2a3c]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value}%`, background: value < 50 ? '#FF3B4E' : color }} />
      </div>
    </div>
  )
}

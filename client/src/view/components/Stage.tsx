import { useEffect, useState, type ReactNode } from 'react'

// Designs are built at a fixed 1920x1080 and scaled to fit the window,
// so the layout looks identical on a laptop and on a projector.
export const STAGE_W = 1920
export const STAGE_H = 1080

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    // overflow: clip (not hidden) so the browser can never scroll the stage when focusing an input
    <div className="relative h-full w-full bg-bg" style={{ overflow: 'clip' }}>
      <div
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
        className="absolute left-1/2 top-1/2 origin-center"
      >
        {children}
      </div>
    </div>
  )
}

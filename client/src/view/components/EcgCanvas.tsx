import { useEffect, useRef } from 'react'
import type { Rhythm } from '../../model/contract'

// Sweep-style ECG like a real bedside monitor: the trace draws left to right
// and erases a small gap ahead of itself.
interface Props { rhythm: Rhythm; hr: number; cpr: boolean; width: number; height: number }

const SPEED = 190 // px per second
const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s))

export function EcgCanvas({ rhythm, hr, cpr, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ rhythm, hr, cpr })
  live.current = { rhythm, hr, cpr }

  useEffect(() => {
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#05080d'
    ctx.fillRect(0, 0, width, height)

    let x = 0
    let t = 0
    let beatT = 0 // seconds since last beat
    let lastY = height / 2
    let last = performance.now()
    let raf = 0

    const sample = (dt: number) => {
      const { rhythm, hr, cpr } = live.current
      t += dt
      beatT += dt
      let v = 0
      if (rhythm === 'pre_arrest' || rhythm === 'ROSC') {
        const period = 60 / Math.max(40, hr || (rhythm === 'ROSC' ? 92 : 118))
        if (beatT > period) beatT -= period
        const b = beatT
        v = 0.12 * g(b, 0.06, 0.022) - 0.12 * g(b, 0.13, 0.01) + 1 * g(b, 0.155, 0.011) - 0.28 * g(b, 0.18, 0.012) + 0.24 * g(b, 0.32, 0.04)
      } else if (rhythm === 'VF') {
        const amp = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.27 * t)
        v = amp * (0.34 * Math.sin(2 * Math.PI * 4.6 * t + 0.9 * Math.sin(2 * Math.PI * 0.5 * t)) + 0.2 * Math.sin(2 * Math.PI * 6.7 * t + 1.3)) + (Math.random() - 0.5) * 0.06
      } else {
        v = (Math.random() - 0.5) * 0.025 + 0.02 * Math.sin(2 * Math.PI * 0.3 * t)
      }
      if (cpr && (rhythm === 'VF' || rhythm === 'asystole')) v += 0.55 * Math.max(0, Math.sin(2 * Math.PI * 1.8 * t)) ** 3
      return height * 0.58 - v * height * 0.42
    }

    const frame = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000)
      last = now
      const px = elapsed * SPEED
      const steps = Math.max(1, Math.round(px))
      ctx.lineWidth = 2.2
      ctx.strokeStyle = '#39FF88'
      ctx.shadowColor = '#39FF88'
      ctx.shadowBlur = 6
      for (let i = 0; i < steps; i++) {
        const nx = x + px / steps
        const ny = sample(elapsed / steps)
        // erase gap ahead of the pen
        ctx.shadowBlur = 0
        ctx.fillStyle = '#05080d'
        ctx.fillRect(nx + 1, 0, 16, height)
        ctx.shadowBlur = 6
        if (nx < width) {
          ctx.beginPath()
          ctx.moveTo(x, lastY)
          ctx.lineTo(nx, ny)
          ctx.stroke()
        }
        x = nx
        lastY = ny
        if (x >= width) { x = 0; ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, 18, height) }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return <canvas ref={ref} style={{ width, height }} className="block rounded-md" aria-hidden="true" />
}

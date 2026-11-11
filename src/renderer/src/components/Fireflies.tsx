import { useEffect, useRef } from 'react'

interface Fly {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
  speed: number
  hue: number
}

const COUNT = 46
const SPRITE_SIZE = 64

/** Sprite pré-renderizado do brilho (desenhar gradiente por frame custa caro). */
function makeSprite(hue: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SPRITE_SIZE
  const g = c.getContext('2d')
  if (!g) return c
  const half = SPRITE_SIZE / 2
  const grad = g.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, `hsla(${hue}, 100%, 92%, 1)`)
  grad.addColorStop(0.18, `hsla(${hue}, 100%, 70%, 0.85)`)
  grad.addColorStop(0.45, `hsla(${hue}, 100%, 58%, 0.22)`)
  grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  return c
}

/** Vagalumes vagando ao fundo. Com "reduzir movimento", ficam parados e acesos de leve. */
export function Fireflies() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = new Map<number, HTMLCanvasElement>()
    const sprite = (hue: number): HTMLCanvasElement => {
      let s = sprites.get(hue)
      if (!s) sprites.set(hue, (s = makeSprite(hue)))
      return s
    }
    let w = 0
    let h = 0
    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const flies: Fly[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: h * 0.25 + Math.random() * h * 0.75,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.2,
      r: 10 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.9,
      hue: Math.random() < 0.82 ? 46 : 78
    }))

    let raf = 0
    let last = performance.now()
    const draw = (now: number): void => {
      const dt = Math.min(50, now - last) / 16.67
      last = now
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        if (!reduced) {
          f.phase += 0.012 * f.speed * dt
          // Vagueia com um leve puxão aleatório, como inseto de verdade.
          f.vx += (Math.random() - 0.5) * 0.02 * dt
          f.vy += (Math.random() - 0.5) * 0.02 * dt
          f.vx *= 0.985
          f.vy *= 0.985
          f.x += f.vx * dt
          f.y += f.vy * dt - 0.03 * dt
          if (f.x < -40) f.x = w + 40
          if (f.x > w + 40) f.x = -40
          if (f.y < -40) f.y = h + 40
          if (f.y > h + 40) f.y = -40
        }
        // Pisca: pulso suave com períodos apagados.
        const pulse = reduced ? 0.35 : Math.max(0, Math.sin(f.phase * 2.2)) ** 3
        const alpha = 0.08 + pulse * 0.9
        const size = f.r * (0.7 + pulse * 0.6)
        ctx.globalAlpha = alpha
        ctx.drawImage(sprite(f.hue), f.x - size, f.y - size, size * 2, size * 2)
      }
      ctx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const onVisibility = (): void => {
      cancelAnimationFrame(raf)
      if (!document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    const onResize = (): void => {
      resize()
      if (reduced) raf = requestAnimationFrame(draw)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className="sky" aria-hidden="true">
      <div className="sky__horizon" />
      <canvas ref={ref} className="sky__flies" />
    </div>
  )
}

import { scoreTone } from '../lib/format'

const R = 26
const C = 2 * Math.PI * R

/** Anel da nota de match. Sem nota: anel tracejado apagado. */
export function ScoreRing({ score, size = 64 }: { score: number | null; size?: number }) {
  const tone = scoreTone(score)
  const offset = score === null ? C : C * (1 - score / 100)
  return (
    <div className={`ring ring--${tone}`} style={{ width: size, height: size }} role="img" aria-label={score === null ? 'Sem nota' : `Nota ${score} de 100`}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle className="ring__track" cx="32" cy="32" r={R} />
        <circle
          className="ring__value"
          cx="32"
          cy="32"
          r={R}
          strokeDasharray={C}
          style={{ ['--ring-offset' as string]: offset, ['--ring-full' as string]: C }}
        />
      </svg>
      <span className="ring__label">{score === null ? '—' : score}</span>
    </div>
  )
}

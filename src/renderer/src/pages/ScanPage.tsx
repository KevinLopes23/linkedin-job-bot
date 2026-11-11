import { useEffect, useRef } from 'react'
import type { ScanRecord, ScanStage, ScanStatus } from '../../../shared/types'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { dateTime, timeAgo, timeUntil } from '../lib/format'

const STAGES: ReadonlyArray<{ id: ScanStage; label: string }> = [
  { id: 'buscando', label: 'Buscando' },
  { id: 'filtrando', label: 'Filtrando' },
  { id: 'conferindo', label: 'Conferindo vagas' },
  { id: 'analisando', label: 'Analisando com IA' }
]

const duration = (r: ScanRecord): string => {
  const s = Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
}

export function ScanPage({ scan, history }: { scan: ScanStatus | null; history: readonly ScanRecord[] }) {
  const logRef = useRef<HTMLOListElement>(null)
  const running = scan?.running ?? false
  const stageIndex = scan?.stage ? STAGES.findIndex((s) => s.id === scan.stage) : -1
  const pct = scan?.progress && scan.progress.total > 0 ? Math.round((scan.progress.done / scan.progress.total) * 100) : 0

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scan?.log.length])

  return (
    <div className="page">
      <header className="page__head">
        <h1>Varredura</h1>
        <p className="muted">
          {running
            ? `Começou ${scan?.startedAt ? timeAgo(scan.startedAt) : ''}`
            : scan?.nextRunAt
              ? `Próxima automática ${timeUntil(scan.nextRunAt)}`
              : 'Varredura automática desligada em Configurações'}
        </p>
      </header>

      <section className={`scan-hero${running ? ' is-running' : ''}`}>
        <div className="scan-hero__main">
          <button
            type="button"
            className={`orb${running ? ' is-running' : ''}`}
            onClick={() => void (running ? window.vagalume.scan.stop() : window.vagalume.scan.start())}
            aria-label={running ? 'Parar varredura' : 'Varrer agora'}
          >
            <span className="orb__core">
              <Icon name={running ? 'stop' : 'play'} size={26} />
            </span>
          </button>
          <div>
            <h2 className="scan-hero__title">{running ? 'Varrendo o LinkedIn' : 'Varrer agora'}</h2>
            <p className="scan-hero__msg" aria-live="polite">
              {scan?.message ?? '—'}
            </p>
          </div>
        </div>
        <ol className="stepper">
          {STAGES.map((s, i) => {
            const state = !running ? 'idle' : i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'todo'
            return (
              <li key={s.id} className={`step step--${state}`}>
                <span className="step__dot">{state === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
                <span className="step__label">{s.label}</span>
                {state === 'active' && scan?.progress && (
                  <span className="step__count">
                    {Math.min(scan.progress.done + 1, scan.progress.total)}/{scan.progress.total}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <div className="progress" aria-hidden={!running}>
          <div className="progress__bar" style={{ width: running ? `${Math.max(4, pct)}%` : '0%' }} />
        </div>
      </section>

      <div className="scan-grid">
        <section className="panel">
          <h2 className="panel__title">Registro ao vivo</h2>
          {scan && scan.log.length > 0 ? (
            <ol className="log" ref={logRef}>
              {scan.log.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className={`log__item log__item--${entry.level}`}>
                  <time>{new Date(entry.at).toLocaleTimeString('pt-BR')}</time>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">O passo a passo da varredura aparece aqui.</p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">Histórico</h2>
          {history.length === 0 ? (
            <EmptyState title="Nenhuma varredura ainda" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Cards</th>
                  <th>No perfil</th>
                  <th>Novas</th>
                  <th>IA</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.startedAt} className={r.error ? 'is-error' : ''} title={r.error ?? undefined}>
                    <td>{dateTime(r.startedAt)}</td>
                    <td>{r.cards}</td>
                    <td>{r.candidates}</td>
                    <td className="num-lit">{r.added}</td>
                    <td>{r.analyzed}</td>
                    <td>{r.error ? 'erro' : duration(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

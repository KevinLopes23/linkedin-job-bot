import { useEffect, useState } from 'react'
import { JOB_STATUSES, type Job } from '../../../shared/types'
import { dateTime, errorMessage, glow, STATUS_LABEL } from '../lib/format'
import { Icon } from './Icon'
import { ScoreRing } from './ScoreRing'

/** Painel lateral com a análise da IA, coluna, anotações e histórico da vaga. */
export function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const [notes, setNotes] = useState(job.notes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(job.notes)
    setError(null)
  }, [job.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const match = job.match
  return (
    <aside className="detail" style={{ ['--glow' as string]: glow(match?.score) }} aria-label={`Detalhes da vaga ${job.title}`}>
      <header className="detail__head">
        <ScoreRing score={match?.score ?? null} size={84} />
        <div className="detail__title">
          <h2>{job.title}</h2>
          <p>
            {job.company} · {job.model} · {job.location}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar detalhes">
          <Icon name="close" />
        </button>
      </header>

      <div className="detail__actions">
        <button type="button" className="btn btn--lume" onClick={() => void window.vagalume.app.openExternal(job.link)}>
          <Icon name="external" size={16} />
          Abrir no LinkedIn
        </button>
        <label className="select">
          <span className="sr-only">Coluna</span>
          <select value={job.status} onChange={(e) => void run(() => window.vagalume.jobs.move(job.id, e.target.value as Job['status']))}>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="detail__section">
        <div className="detail__section-head">
          <h3>Análise da IA</h3>
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void run(() => window.vagalume.jobs.analyze(job.id))}>
            <Icon name="spark" size={15} />
            {busy ? 'Analisando…' : match ? 'Reanalisar' : 'Analisar'}
          </button>
        </div>
        {match ? (
          <>
            <p className="detail__summary">{match.summary}</p>
            <div className="detail__cols">
              <div>
                <h4 className="tag-head tag-head--good">Pontos fortes</h4>
                <ul className="bullets bullets--good">
                  {match.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="tag-head tag-head--gap">Lacunas</h4>
                <ul className="bullets bullets--gap">
                  {match.gaps.length === 0 ? <li>Nenhuma lacuna relevante.</li> : match.gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">
            Ainda sem nota. Salve seu currículo e a chave do Gemini em Configurações; as vagas novas passam a chegar com nota de 0 a
            100.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>

      <section className="detail__section">
        <h3>Anotações</h3>
        <textarea
          className="input textarea"
          rows={4}
          value={notes}
          placeholder="Recrutador, salário, link do teste, próxima etapa…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== job.notes && void run(() => window.vagalume.jobs.setNotes(job.id, notes))}
        />
      </section>

      {job.description && (
        <section className="detail__section">
          <h3>Descrição</h3>
          <p className="detail__desc">{job.description}</p>
        </section>
      )}

      <section className="detail__section">
        <h3>Linha do tempo</h3>
        <ol className="timeline">
          {[...job.history].reverse().map((h) => (
            <li key={`${h.status}-${h.at}`}>
              <span className={`dot dot--${h.status}`} />
              {STATUS_LABEL[h.status]} <time>{dateTime(h.at)}</time>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}

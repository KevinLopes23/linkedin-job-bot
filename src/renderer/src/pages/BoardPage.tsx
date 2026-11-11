import { useState, type CSSProperties, type DragEvent } from 'react'
import { JOB_STATUSES, type Job, type JobStatus } from '../../../shared/types'
import { Icon } from '../components/Icon'
import { JobDetail } from '../components/JobDetail'
import { dateTime, errorMessage, glow, scoreTone, STATUS_LABEL } from '../lib/format'

const HINT: Record<JobStatus, string> = {
  nova: 'Chegaram na varredura',
  salva: 'Quero aplicar',
  aplicada: 'Currículo enviado',
  entrevista: 'Em processo',
  descartada: 'Não vou seguir'
}

/** Kanban de candidaturas: arrastar muda a coluna e grava a data da mudança. */
export function BoardPage({ jobs, setJobs }: { jobs: readonly Job[]; setJobs: (jobs: readonly Job[]) => void }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<JobStatus | null>(null)
  const [justMoved, setJustMoved] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const move = async (id: string, status: JobStatus): Promise<void> => {
    const job = jobs.find((j) => j.id === id)
    if (!job || job.status === status) return
    // Otimista: o card já muda de coluna e volta se der erro.
    const previous = jobs
    setJobs(jobs.map((j) => (j.id === id ? { ...j, status } : j)))
    setJustMoved(id)
    try {
      setJobs(await window.vagalume.jobs.move(id, status))
      setError(null)
    } catch (e) {
      setJobs(previous)
      setError(errorMessage(e))
    }
  }

  const onDrop = (status: JobStatus) => (e: DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setOver(null)
    setDragId(null)
    if (id) void move(id, status)
  }

  const open = jobs.find((j) => j.id === openId) ?? null

  return (
    <div className={`page page--board${open ? ' has-detail' : ''}`}>
      <header className="page__head">
        <h1>Candidaturas</h1>
        <p className="muted">Arraste os cards entre as colunas. Clique para ver a análise e anotar.</p>
      </header>
      {error && <p className="form-error">{error}</p>}
      <div className="board">
        {JOB_STATUSES.map((status) => {
          const items = jobs.filter((j) => j.status === status)
          return (
            <section
              key={status}
              className={`column column--${status}${over === status ? ' is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (over !== status) setOver(status)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
              }}
              onDrop={onDrop(status)}
              aria-label={`${STATUS_LABEL[status]}: ${items.length} vaga(s)`}
            >
              <header className="column__head">
                <span className={`dot dot--${status}`} />
                <h2>{STATUS_LABEL[status]}</h2>
                <span className="column__count">{items.length}</span>
              </header>
              <p className="column__hint">{HINT[status]}</p>
              <div className="column__list">
                {items.map((job) => {
                  const last = job.history[job.history.length - 1]
                  return (
                    <article
                      key={job.id}
                      className={`kcard kcard--${scoreTone(job.match?.score)}${dragId === job.id ? ' is-dragging' : ''}${justMoved === job.id ? ' is-landed' : ''}`}
                      style={{ ['--glow' as string]: glow(job.match?.score) } as CSSProperties}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', job.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(job.id)
                      }}
                      onDragEnd={() => setDragId(null)}
                      onAnimationEnd={() => setJustMoved(null)}
                    >
                      <button type="button" className="kcard__open" onClick={() => setOpenId(job.id)}>
                        <span className="kcard__title">{job.title}</span>
                        <span className="kcard__company">{job.company}</span>
                        <span className="kcard__foot">
                          {job.notes && <Icon name="note" size={13} />}
                          {last && <time>{dateTime(last.at)}</time>}
                          <span className="kcard__score" aria-label={job.match ? `Nota ${job.match.score}` : 'Sem nota'}>
                            {job.match ? job.match.score : '—'}
                          </span>
                        </span>
                      </button>
                      <label className="sr-only">
                        Mover para
                        <select value={job.status} onChange={(e) => void move(job.id, e.target.value as JobStatus)}>
                          {JOB_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  )
                })}
                {items.length === 0 && <p className="column__empty">Solte um card aqui</p>}
              </div>
            </section>
          )
        })}
      </div>
      {open && <JobDetail key={open.id} job={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

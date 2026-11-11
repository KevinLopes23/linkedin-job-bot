import { useMemo, useState } from 'react'
import type { Job, WorkModel } from '../../../shared/types'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { JobCard } from '../components/JobCard'
import { JobDetail } from '../components/JobDetail'

type Sort = 'nota' | 'recentes'
type ModelFilter = 'todos' | WorkModel

const MODELS: ModelFilter[] = ['todos', 'Remoto', 'Híbrido', 'Presencial']

export function JobsPage({ jobs }: { jobs: readonly Job[] }) {
  const [query, setQuery] = useState('')
  const [model, setModel] = useState<ModelFilter>('todos')
  const [sort, setSort] = useState<Sort>('nota')
  const [hideDiscarded, setHideDiscarded] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => (hideDiscarded ? j.status !== 'descartada' : true))
      .filter((j) => (model === 'todos' ? true : j.model === model))
      .filter((j) => (q ? `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q) : true))
      .sort((a, b) =>
        sort === 'nota'
          ? (b.match?.score ?? -1) - (a.match?.score ?? -1) || b.foundAt.localeCompare(a.foundAt)
          : b.foundAt.localeCompare(a.foundAt)
      )
  }, [jobs, query, model, sort, hideDiscarded])

  const open = jobs.find((j) => j.id === openId) ?? null

  return (
    <div className={`page${open ? ' has-detail' : ''}`}>
      <header className="page__head">
        <h1>Vagas</h1>
        <p className="muted">
          {visible.length} de {jobs.length} vaga(s)
        </p>
      </header>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar por cargo, empresa ou cidade" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Modelo de trabalho">
          {MODELS.map((m) => (
            <button key={m} type="button" className={model === m ? 'is-on' : ''} aria-pressed={model === m} onClick={() => setModel(m)}>
              {m === 'todos' ? 'Todos' : m}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Ordenar">
          <button type="button" className={sort === 'nota' ? 'is-on' : ''} aria-pressed={sort === 'nota'} onClick={() => setSort('nota')}>
            Maior nota
          </button>
          <button type="button" className={sort === 'recentes' ? 'is-on' : ''} aria-pressed={sort === 'recentes'} onClick={() => setSort('recentes')}>
            Mais recentes
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={hideDiscarded} onChange={(e) => setHideDiscarded(e.target.checked)} />
          Esconder descartadas
        </label>
      </div>
      {visible.length === 0 ? (
        <EmptyState title={jobs.length === 0 ? 'Nenhuma vaga guardada ainda' : 'Nada com esse filtro'}>
          {jobs.length === 0 ? 'Rode uma varredura na aba Varredura para encher o pote.' : 'Tente limpar a busca ou trocar o modelo de trabalho.'}
        </EmptyState>
      ) : (
        <div className="job-list">
          {visible.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} selected={job.id === openId} onOpen={(j) => setOpenId(j.id)} />
          ))}
        </div>
      )}
      {open && <JobDetail job={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

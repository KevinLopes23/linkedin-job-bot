import { useState } from 'react'
import type { PageId } from '../../../shared/ipc'
import type { Job, ScanStatus } from '../../../shared/types'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { JobCard } from '../components/JobCard'
import { JobDetail } from '../components/JobDetail'
import { greeting, isToday, timeAgo, timeUntil } from '../lib/format'

export function HomePage({ jobs, scan, onNavigate }: { jobs: readonly Job[]; scan: ScanStatus | null; onNavigate: (p: PageId) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const today = jobs.filter((j) => isToday(j.foundAt))
  const lit = today.filter((j) => (j.match?.score ?? 0) >= 75).length
  const applied = jobs.filter((j) => j.status === 'aplicada').length
  const interviews = jobs.filter((j) => j.status === 'entrevista').length
  const brightest = [...jobs]
    .filter((j) => j.status !== 'descartada')
    .sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1) || b.foundAt.localeCompare(a.foundAt))
    .slice(0, 6)
  const open = jobs.find((j) => j.id === openId) ?? null

  const headline =
    today.length === 0
      ? 'Nenhuma vaga nova hoje, por enquanto.'
      : lit > 0
        ? `${lit} ${lit === 1 ? 'vaga acendeu' : 'vagas acenderam'} hoje.`
        : `${today.length} ${today.length === 1 ? 'vaga nova' : 'vagas novas'} hoje.`

  return (
    <div className={`page page--home${open ? ' has-detail' : ''}`}>
      <section className="hero">
        <h1 className="hero__title">
          {greeting()}.
          <br />
          <span className="hero__lit">{headline}</span>
        </h1>
        <p className="hero__line">
          <span>
            <b>{today.length}</b> hoje
          </span>
          <span>
            <b>{jobs.length}</b> no total
          </span>
          <span>
            <b>{applied}</b> aplicadas
          </span>
          <span>
            <b>{interviews}</b> em entrevista
          </span>
        </p>
        <div className="hero__actions">
          <button type="button" className="btn btn--lume" disabled={scan?.running} onClick={() => void window.vagalume.scan.start().then(() => onNavigate('varredura'))}>
            <Icon name="play" size={16} />
            {scan?.running ? 'Varrendo…' : 'Varrer agora'}
          </button>
          <span className="muted">
            {scan?.running
              ? scan.message
              : scan?.nextRunAt
                ? `Próxima varredura ${timeUntil(scan.nextRunAt)}`
                : scan?.finishedAt
                  ? `Última varredura ${timeAgo(scan.finishedAt)}`
                  : 'Varredura automática desligada'}
          </span>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>As que mais brilham</h2>
          {jobs.length > 0 && (
            <button type="button" className="link-btn" onClick={() => onNavigate('vagas')}>
              Ver todas as vagas
            </button>
          )}
        </div>
        {brightest.length === 0 ? (
          <EmptyState title="O pote ainda está vazio">
            Rode a primeira varredura: o Vagalume busca no LinkedIn, tira as promovidas e o que foge do seu perfil, e guarda o resto aqui.
          </EmptyState>
        ) : (
          <div className="job-grid">
            {brightest.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} selected={job.id === openId} onOpen={(j) => setOpenId(j.id)} />
            ))}
          </div>
        )}
      </section>
      {open && <JobDetail job={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

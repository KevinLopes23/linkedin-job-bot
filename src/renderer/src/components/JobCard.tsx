import type { CSSProperties } from 'react'
import type { Job } from '../../../shared/types'
import { glow, modelLabel, scoreTone, STATUS_LABEL, timeAgo } from '../lib/format'
import { Icon } from './Icon'
import { ScoreRing } from './ScoreRing'

/** Card de vaga: quanto maior a nota, mais ela brilha. */
export function JobCard({ job, onOpen, selected = false, index = 0 }: { job: Job; onOpen: (job: Job) => void; selected?: boolean; index?: number }) {
  const score = job.match?.score ?? null
  const style = { ['--glow' as string]: glow(score), ['--i' as string]: Math.min(index, 12) } as CSSProperties
  return (
    <button
      type="button"
      className={`job job--${scoreTone(score)}${selected ? ' is-selected' : ''}`}
      style={style}
      onClick={() => onOpen(job)}
    >
      <ScoreRing score={score} size={56} />
      <span className="job__body">
        <span className="job__title">{job.title}</span>
        <span className="job__company">{job.company}</span>
        <span className="job__meta">
          <span className="chip">
            <Icon name="pin" size={13} />
            {modelLabel(job.model)} · {job.location}
          </span>
          {job.applicants !== null && (
            <span className="chip">
              <Icon name="users" size={13} />
              {job.applicants}
            </span>
          )}
          {job.status !== 'nova' && <span className={`chip chip--status chip--${job.status}`}>{STATUS_LABEL[job.status]}</span>}
        </span>
        {job.match && <span className="job__summary">{job.match.summary}</span>}
      </span>
      <span className="job__when">{timeAgo(job.foundAt)}</span>
    </button>
  )
}

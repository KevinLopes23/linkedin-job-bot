import type { ReactNode } from 'react'

/** Pote de vidro com vagalumes (ilustração dos estados vazios). */
function JarArt() {
  return (
    <svg className="empty__art" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <radialGradient id="jar-glow" cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor="#ffd45e" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd45e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="96" r="62" fill="url(#jar-glow)" />
      <rect x="56" y="26" width="48" height="12" rx="4" fill="#2a3566" />
      <path
        d="M60 38h40v8c10 6 18 18 18 34v42c0 8-6 14-14 14H56c-8 0-14-6-14-14V80c0-16 8-28 18-34z"
        fill="rgba(140,160,230,0.08)"
        stroke="#3a4a85"
        strokeWidth="2"
      />
      <path d="M52 70c-2 10-2 34 0 50" stroke="rgba(220,230,255,0.25)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle className="empty__fly empty__fly--1" cx="72" cy="100" r="4" fill="#ffe27a" />
      <circle className="empty__fly empty__fly--2" cx="92" cy="86" r="3" fill="#ffe27a" />
      <circle className="empty__fly empty__fly--3" cx="86" cy="118" r="3.5" fill="#d7f27a" />
    </svg>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <JarArt />
      <h3 className="empty__title">{title}</h3>
      {children && <p className="empty__text">{children}</p>}
      {action}
    </div>
  )
}

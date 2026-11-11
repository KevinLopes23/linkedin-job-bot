import { useEffect, useState, type ReactElement } from 'react'
import type { PageId } from '../../shared/ipc'
import { Fireflies } from './components/Fireflies'
import { Icon, type IconName } from './components/Icon'
import { LoadError } from './components/LoadError'
import { Logo } from './components/Logo'
import { useJobs, useScanHistory, useScanStatus, useSettings, type Live } from './hooks/useData'
import { BoardPage } from './pages/BoardPage'
import { HomePage } from './pages/HomePage'
import { JobsPage } from './pages/JobsPage'
import { ScanPage } from './pages/ScanPage'
import { SettingsPage } from './pages/SettingsPage'

const NAV: ReadonlyArray<{ id: PageId; label: string; icon: IconName }> = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'vagas', label: 'Vagas', icon: 'jobs' },
  { id: 'candidaturas', label: 'Candidaturas', icon: 'board' },
  { id: 'varredura', label: 'Varredura', icon: 'radar' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings' }
]

const isPageId = (value: string): value is PageId => NAV.some((n) => n.id === value)

export function App() {
  const [page, setPage] = useState<PageId>('inicio')
  const [version, setVersion] = useState('')
  const jobs = useJobs()
  const scan = useScanStatus()
  const history = useScanHistory()
  const settings = useSettings()

  useEffect(() => {
    window.vagalume.app.version().then(setVersion, () => setVersion(''))
    return window.vagalume.app.onNavigate((target) => {
      if (isPageId(target)) setPage(target)
    })
  }, [])

  const list = jobs.data ?? []
  const newCount = list.filter((j) => j.status === 'nova').length

  // Dados de que cada tela depende: se a carga falhou, a tela mostra o erro em vez de "vazio".
  const sources: Record<PageId, ReadonlyArray<Pick<Live<unknown>, 'error' | 'retry'>>> = {
    inicio: [jobs, scan],
    vagas: [jobs],
    candidaturas: [jobs],
    varredura: [scan, history],
    configuracoes: [settings]
  }
  const failed = sources[page].filter((s) => s.error !== null)

  const content = ((): ReactElement => {
    if (failed.length > 0) {
      return <LoadError message={failed.map((s) => s.error).join(' ')} onRetry={() => failed.forEach((s) => s.retry())} />
    }
    switch (page) {
      case 'inicio':
        return <HomePage jobs={list} scan={scan.data} onNavigate={setPage} />
      case 'vagas':
        return <JobsPage jobs={list} />
      case 'candidaturas':
        return <BoardPage jobs={list} setJobs={jobs.setData} />
      case 'varredura':
        return <ScanPage scan={scan.data} history={history.data ?? []} />
      case 'configuracoes':
        return settings.data ? <SettingsPage initial={settings.data} onSaved={settings.setData} /> : <div className="page" />
    }
  })()

  return (
    <div className="shell">
      <Fireflies />
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <Logo size={40} />
          <span className="brand__name">Vagalume</span>
        </div>
        <ul className="nav">
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`nav__item${page === item.id ? ' is-active' : ''}`}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.id === 'vagas' && newCount > 0 && <span className="nav__badge">{newCount}</span>}
                {item.id === 'varredura' && scan.data?.running && <span className="nav__pulse" aria-label="varrendo" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="sidebar__foot">Acende as vagas que valem a pena{version && ` · v${version}`}</p>
      </nav>
      <main className="content">
        <div key={page} className="page-enter">
          {content}
        </div>
      </main>
    </div>
  )
}

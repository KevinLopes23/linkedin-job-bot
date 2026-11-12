import { useEffect, useState, type ReactNode } from 'react'
import type { LinkedInSessionView, Settings, SettingsView } from '../../../shared/types'
import { Icon } from '../components/Icon'
import { errorMessage, sessionLabel } from '../lib/format'

interface Form {
  aiEngine: Settings['aiEngine']
  claudeModel: string
  keywords: string
  searchRemote: boolean
  cities: string
  hoursWindow: string
  maxApplicants: string
  onlyPortuguese: boolean
  skipPromoted: boolean
  maxPerCompany: string
  titleTerms: string
  excludeTerms: string
  delaySeconds: string
  autoScan: boolean
  intervalMinutes: string
  notifyMinScore: string
  maxAiPerScan: string
  geminiModel: string
  resumeText: string
}

const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean)

const toForm = (s: Settings): Form => ({
  aiEngine: s.aiEngine,
  claudeModel: s.claudeModel,
  keywords: s.keywords.join('\n'),
  searchRemote: s.searchRemote,
  cities: s.cities.join('\n'),
  hoursWindow: String(s.hoursWindow),
  maxApplicants: String(s.maxApplicants),
  onlyPortuguese: s.onlyPortuguese,
  skipPromoted: s.skipPromoted,
  maxPerCompany: String(s.maxPerCompany),
  titleTerms: s.titleTerms.join('\n'),
  excludeTerms: s.excludeTerms.join('\n'),
  delaySeconds: String(s.delayMs / 1000),
  autoScan: s.autoScan,
  intervalMinutes: String(s.intervalMinutes),
  notifyMinScore: String(s.notifyMinScore),
  maxAiPerScan: String(s.maxAiPerScan),
  geminiModel: s.geminiModel,
  resumeText: s.resumeText
})

const toSettings = (f: Form): Settings => ({
  aiEngine: f.aiEngine,
  claudeModel: f.claudeModel,
  keywords: lines(f.keywords),
  searchRemote: f.searchRemote,
  cities: lines(f.cities),
  hoursWindow: Number(f.hoursWindow),
  maxApplicants: Number(f.maxApplicants),
  onlyPortuguese: f.onlyPortuguese,
  skipPromoted: f.skipPromoted,
  maxPerCompany: Number(f.maxPerCompany),
  titleTerms: lines(f.titleTerms),
  excludeTerms: lines(f.excludeTerms),
  delayMs: Math.round(Number(f.delaySeconds) * 1000),
  autoScan: f.autoScan,
  intervalMinutes: Number(f.intervalMinutes),
  notifyMinScore: Number(f.notifyMinScore),
  maxAiPerScan: Number(f.maxAiPerScan),
  geminiModel: f.geminiModel.trim(),
  resumeText: f.resumeText
})

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

function Card({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="settings-card">
      <header>
        <h2>{title}</h2>
        <p className="muted">{lead}</p>
      </header>
      {children}
    </section>
  )
}

/** Login opcional: a janela abre no Chrome, a senha vai direto para o LinkedIn. */
function LinkedInCard() {
  const [session, setSession] = useState<LinkedInSessionView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void window.vagalume.linkedin.status().then((s) => alive && setSession(s))
    return () => {
      alive = false
    }
  }, [])

  const run = async (fn: () => Promise<LinkedInSessionView>, connecting: boolean): Promise<void> => {
    setBusy(true)
    setError(null)
    if (connecting) setSession((s) => (s ? { ...s, connecting: true } : s))
    try {
      setSession(await fn())
    } catch (e) {
      setError(errorMessage(e))
      setSession(await window.vagalume.linkedin.status())
    } finally {
      setBusy(false)
    }
  }

  const connected = session?.connected ?? false
  return (
    <Card
      title="Conta do LinkedIn (opcional)"
      lead="Logado, o LinkedIn respeita o filtro remoto/híbrido/presencial e mostra o modelo de cada vaga. Sem login o app funciona, mas a busca mistura os modelos."
    >
      <div className="row">
        <span className={`pill${connected ? ' pill--on' : session?.expired ? ' pill--warn' : ''}`}>
          <Icon name={connected ? 'check' : 'key'} size={14} />
          {sessionLabel(session)}
        </span>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={busy || session === null}
          onClick={() => void run(() => window.vagalume.linkedin.connect(), true)}
        >
          {connected ? 'Entrar de novo' : 'Conectar LinkedIn'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy || !(connected || session?.expired)}
          onClick={() => void run(() => window.vagalume.linkedin.disconnect(), false)}
        >
          Desconectar
        </button>
      </div>
      {error && <p className="savebar__msg savebar__msg--erro">{error}</p>}
      <p className="muted">
        A janela do Chrome abre na página do LinkedIn: a senha vai direto para o site, o Vagalume não vê. A sessão fica só neste
        computador, num perfil separado do seu Chrome; "Desconectar" apaga tudo. O app só lê vagas (não se candidata nem manda
        mensagem) e mantém pausas entre as páginas, mas o LinkedIn não gosta de automação em conta logada: não diminua muito a
        pausa nem o intervalo.
      </p>
    </Card>
  )
}

export function SettingsPage({ initial, onSaved }: { initial: SettingsView; onSaved: (s: SettingsView) => void }) {
  const [form, setForm] = useState<Form>(() => toForm(initial))
  const [view, setView] = useState(initial)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'erro'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]): void => setForm((f) => ({ ...f, [k]: v }))
  const dirty = JSON.stringify(toSettings(form)) !== JSON.stringify(toSettings(toForm(view)))

  /** `resetForm`: só depois de salvar as configurações; salvar/remover a chave não mexe no que está sendo editado. */
  const act = async (fn: () => Promise<SettingsView | void>, okText: string, resetForm = false): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const next = await fn()
      if (next) {
        setView(next)
        if (resetForm) setForm(toForm(next))
        onSaved(next)
      }
      setStatus({ kind: 'ok', text: okText })
    } catch (e) {
      setStatus({ kind: 'erro', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const importPdf = (): Promise<void> =>
    act(async () => {
      const text = await window.vagalume.settings.importResumePdf()
      if (text === null) throw new Error('Importação cancelada.')
      set('resumeText', text)
    }, 'Texto do PDF importado. Confira e salve.')

  const testGemini = (): Promise<void> =>
    act(async () => {
      const r = await window.vagalume.settings.testGemini()
      if (!r.ok) throw new Error(r.message)
    }, 'Gemini respondeu. Tudo certo.')

  const testClaude = (): Promise<void> =>
    act(async () => {
      const r = await window.vagalume.settings.testClaude()
      if (!r.ok) throw new Error(r.message)
    }, 'Claude respondeu. Tudo certo.')

  return (
    <div className="page page--settings">
      <header className="page__head">
        <h1>Configurações</h1>
        <p className="muted">Tudo fica só neste computador. A chave do Gemini é guardada cifrada pelo Windows.</p>
      </header>

      <div className="settings">
        <Card title="Currículo" lead="A IA compara cada vaga nova com este texto para dar a nota de match.">
          <textarea
            className="input textarea textarea--tall"
            value={form.resumeText}
            placeholder="Cole aqui o texto do seu currículo (experiências, stack, formação)…"
            onChange={(e) => set('resumeText', e.target.value)}
          />
          <div className="row">
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void importPdf()}>
              <Icon name="upload" size={16} />
              Importar PDF
            </button>
            <span className="muted">{form.resumeText.length.toLocaleString('pt-BR')} caracteres</span>
          </div>
        </Card>

        <Card title="Motor de análise da IA" lead="Quem dá a nota de match. O Claude local usa o Claude Code deste PC (sua assinatura), sem a sobrecarga do Gemini grátis.">
          <div className="stack">
            <label className="check">
              <input type="radio" name="ai-engine" checked={form.aiEngine === 'gemini'} onChange={() => set('aiEngine', 'gemini')} />
              Google Gemini — grátis, mas em horário de pico fica sobrecarregado e pode falhar
            </label>
            <label className="check">
              <input type="radio" name="ai-engine" checked={form.aiEngine === 'claude'} onChange={() => set('aiEngine', 'claude')} />
              Claude local — usa o Claude Code deste computador (confiável, sem sobrecarga)
            </label>
          </div>
          {form.aiEngine === 'claude' && (
            <>
              <div className="grid-2">
                <Field label="Modelo do Claude" hint="Haiku é barato e rápido (recomendado).">
                  <select className="input" value={form.claudeModel} onChange={(e) => set('claudeModel', e.target.value)}>
                    <option value="haiku">Haiku — barato e rápido</option>
                    <option value="sonnet">Sonnet — equilíbrio</option>
                    <option value="opus">Opus — máximo (mais caro)</option>
                  </select>
                </Field>
              </div>
              <div className="row">
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void testClaude()}>
                  Testar Claude
                </button>
                <span className="muted">Precisa do Claude Code instalado e logado. Cada varredura consome um pouco do seu limite. Salve antes de testar se trocou o modelo.</span>
              </div>
            </>
          )}
        </Card>

        <Card title="Gemini" lead="Chave gratuita no Google AI Studio. Usada só se o motor for o Gemini.">
          <div className="row">
            <span className={`pill${view.hasGeminiKey ? ' pill--on' : view.geminiKeyUnreadable ? ' pill--warn' : ''}`}>
              <Icon name={view.hasGeminiKey ? 'check' : 'key'} size={14} />
              {view.hasGeminiKey ? 'Chave salva' : view.geminiKeyUnreadable ? 'Chave salva, mas o Windows não conseguiu abrir' : 'Sem chave'}
            </span>
            {view.geminiKeyUnreadable && <span className="muted">Cole a chave e salve de novo.</span>}
          </div>
          <div className="row">
            <input
              className="input"
              type="password"
              autoComplete="off"
              placeholder="Cole a chave da API"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={busy || !key.trim()}
              onClick={() => void act(async () => {
                const v = await window.vagalume.settings.setGeminiKey(key)
                setKey('')
                return v
              }, 'Chave salva.')}
            >
              Salvar chave
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn btn--ghost" disabled={busy || !view.hasGeminiKey} onClick={() => void testGemini()}>
              Testar
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy || (!view.hasGeminiKey && !view.geminiKeyUnreadable)}
              onClick={() => void act(() => window.vagalume.settings.clearGeminiKey(), 'Chave removida.')}
            >
              Remover chave
            </button>
          </div>
          <div className="grid-2">
            <Field label="Modelo" hint="Ex.: gemini-flash-latest">
              <input className="input" value={form.geminiModel} onChange={(e) => set('geminiModel', e.target.value)} />
            </Field>
            <Field label="Análises por varredura" hint="Respeita o limite do plano gratuito.">
              <input className="input" type="number" min={0} max={100} value={form.maxAiPerScan} onChange={(e) => set('maxAiPerScan', e.target.value)} />
            </Field>
          </div>
        </Card>

        <LinkedInCard />

        <Card title="Busca" lead="Os valores iniciais são os mesmos do bot antigo.">
          <div className="grid-2">
            <Field label="Palavras-chave" hint="Uma por linha. Cada uma vira uma busca remota e uma por cidade.">
              <textarea className="input textarea" rows={6} value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
            </Field>
            <div className="stack">
              <label className="check">
                <input type="checkbox" checked={form.searchRemote} onChange={(e) => set('searchRemote', e.target.checked)} />
                Vagas remotas no Brasil
              </label>
              <label className="check">
                <input type="checkbox" checked={form.onlyPortuguese} onChange={(e) => set('onlyPortuguese', e.target.checked)} />
                Só vagas em português (descarta descrição em inglês)
              </label>
              <label className="check">
                <input type="checkbox" checked={form.skipPromoted} onChange={(e) => set('skipPromoted', e.target.checked)} />
                Descartar vagas promovidas (“Promovida por quem está contratando”, só aparece com login)
              </label>
              <Field label="Cidades (presencial e híbrido)" hint='Uma por linha, como no LinkedIn: "Bauru, São Paulo, Brasil".'>
                <textarea className="input textarea" rows={3} value={form.cities} onChange={(e) => set('cities', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="grid-4">
            <Field label="Janela (horas)" hint="Vagas publicadas nas últimas N horas.">
              <input className="input" type="number" min={1} max={720} value={form.hoursWindow} onChange={(e) => set('hoursWindow', e.target.value)} />
            </Field>
            <Field label="Máx. candidatos" hint="0 desliga o limite.">
              <input className="input" type="number" min={0} value={form.maxApplicants} onChange={(e) => set('maxApplicants', e.target.value)} />
            </Field>
            <Field label="Máx. por empresa" hint="Em 24 h (anti-spam).">
              <input className="input" type="number" min={1} max={50} value={form.maxPerCompany} onChange={(e) => set('maxPerCompany', e.target.value)} />
            </Field>
            <Field label="Pausa entre buscas (s)" hint="Evita bloqueio do LinkedIn.">
              <input className="input" type="number" min={1} max={60} value={form.delaySeconds} onChange={(e) => set('delaySeconds', e.target.value)} />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="O título precisa ter" hint="Uma por linha (aceita expressão regular).">
              <textarea className="input textarea mono" rows={8} value={form.titleTerms} onChange={(e) => set('titleTerms', e.target.value)} />
            </Field>
            <Field label="Termos de exclusão" hint="Título ou card com qualquer um destes é descartado.">
              <textarea className="input textarea mono" rows={8} value={form.excludeTerms} onChange={(e) => set('excludeTerms', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Agendamento" lead="Com o app aberto (ou na bandeja), a varredura roda sozinha.">
          <label className="check">
            <input type="checkbox" checked={form.autoScan} onChange={(e) => set('autoScan', e.target.checked)} />
            Varrer automaticamente
          </label>
          <div className="grid-2">
            <Field label="A cada (minutos)" hint="Mínimo 15.">
              <input className="input" type="number" min={15} value={form.intervalMinutes} onChange={(e) => set('intervalMinutes', e.target.value)} />
            </Field>
            <Field label="Notificar a partir da nota" hint="Notificação do Windows para vaga com match alto.">
              <input className="input" type="number" min={0} max={100} value={form.notifyMinScore} onChange={(e) => set('notifyMinScore', e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      <footer className={`savebar${dirty ? ' is-dirty' : ''}`}>
        <span className={status ? `savebar__msg savebar__msg--${status.kind}` : 'savebar__msg'} role="status">
          {status?.text ?? (dirty ? 'Há mudanças não salvas.' : 'Tudo salvo.')}
        </span>
        <button type="button" className="btn btn--ghost" disabled={busy || !dirty} onClick={() => setForm(toForm(view))}>
          Desfazer
        </button>
        <button
          type="button"
          className="btn btn--lume"
          disabled={busy || !dirty}
          onClick={() => void act(() => window.vagalume.settings.save(toSettings(form)), 'Configurações salvas.', true)}
        >
          Salvar
        </button>
      </footer>
    </div>
  )
}

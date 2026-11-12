import { describe, expect, it } from 'vitest'
import { checkDetail, parseSearchHtml } from './parse'
import { hasJobSection, isJobViewUrl, isLoggedNoResults, isLoggedOutUrl, loggedCardsToHtml, loggedDetailToHtml, parseLoggedCard, splitLoggedDetail } from './loggedIn'

// Linhas reais (innerText) dos cards da busca logada, com nomes de empresas trocados.
const selected = {
  key: 'job-card-component-ref-4490030977',
  lines: ['Selecionada, Desenvolvedor(a)  Backend Pleno (vaga verificada)', 'Desenvolvedor(a)  Backend Pleno', 'Acme', 'Brasil (Remoto)', '1 conexão trabalha aqui', 'Visto', '·', 'Seja uma das primeiras pessoas a se candidatar']
}
const single = {
  key: 'job-card-component-ref-4489249135',
  lines: ['Backend Developer (Node.js & AWS)', 'Beta Talentos', 'Brasil (Remoto)', 'Anunciada há 20 horas', 'há 20 horas', '·', 'Candidatura simplificada']
}

describe('parseLoggedCard', () => {
  it('título repetido (com "Selecionada," e "vaga verificada" na 1ª linha)', () => {
    expect(parseLoggedCard(selected)).toMatchObject({ id: '4490030977', title: 'Desenvolvedor(a) Backend Pleno', company: 'Acme', location: 'Brasil (Remoto)' })
  })

  it('título numa linha só', () => {
    expect(parseLoggedCard(single)).toMatchObject({ id: '4489249135', title: 'Backend Developer (Node.js & AWS)', company: 'Beta Talentos', location: 'Brasil (Remoto)' })
  })

  it('sem id ou com poucas linhas devolve null', () => {
    expect(parseLoggedCard({ key: 'outro', lines: selected.lines })).toBeNull()
    expect(parseLoggedCard({ key: 'job-card-component-ref-1234567890', lines: ['Título'] })).toBeNull()
  })
})

describe('loggedCardsToHtml', () => {
  const patterns = { title: [/desenvolvedor|developer/i], exclude: [/s[eê]nior/i] }

  it('vira a mesma lista que o parser da busca pública lê, sem repetir cards', () => {
    const html = loggedCardsToHtml([selected, selected, single])
    const r = parseSearchHtml(html, { kind: 'remoto', city: null }, patterns)
    expect(r.cards).toBe(2)
    expect(r.candidates).toEqual([
      expect.objectContaining({ id: '4490030977', title: 'Desenvolvedor(a) Backend Pleno', company: 'Acme', model: 'Remoto', link: 'https://www.linkedin.com/jobs/view/4490030977/' }),
      expect.objectContaining({ id: '4489249135', model: 'Remoto' })
    ])
  })

  it('escapa HTML vindo do LinkedIn', () => {
    const html = loggedCardsToHtml([{ key: 'job-card-component-ref-4400000001', lines: ['Dev <script>x</script>', 'Acme & Cia', 'Brasil (Remoto)'] }])
    expect(html).not.toContain('<script>')
    expect(html).toContain('Acme &amp; Cia')
  })

  it('lista vazia não parece bloqueio (a busca logada só não achou nada)', () => {
    expect(parseSearchHtml(loggedCardsToHtml([]), { kind: 'remoto', city: null }, patterns).cards).toBe(0)
  })

  it('card marcado como promovido é ignorado', () => {
    const promoted = { key: 'job-card-component-ref-4400000002', lines: ['Desenvolvedor Node', 'Acme', 'Brasil (Remoto)', 'Promovida'] }
    expect(parseSearchHtml(loggedCardsToHtml([promoted]), { kind: 'remoto', city: null }, patterns).candidates).toEqual([])
  })
})

// innerText real do <main> da vaga logada (encurtado, nomes trocados).
const detailText = `Acme

Desenvolvedor(a)  Backend Pleno

Brasil  · há 14 horas · 77 pessoas clicaram em Candidate-se

Respostas gerenciadas fora do LinkedIn

Remoto
Tempo integral
Candidatar-se
Salvar
Use a IA para avaliar a adequação do seu perfil
Pessoas que você pode contatar
Fulano e outras pessoas da sua rede
Sobre a vaga

Buscamos pessoa desenvolvedora backend. Encontros presenciais trimestrais em São Paulo.

Requisitos: Node.js, SQL.
… mais
Sobre a empresa
Acme é uma empresa de tecnologia.`

describe('splitLoggedDetail', () => {
  it('separa o topo (modelo, candidatos) da descrição, sem "… mais" nem a parte da empresa', () => {
    const parts = splitLoggedDetail(detailText)
    expect(parts.top).toContain('77 pessoas clicaram em Candidate-se')
    expect(parts.top).toContain('Remoto')
    expect(parts.top).not.toContain('Pessoas que você pode contatar')
    expect(parts.description).toBe('Buscamos pessoa desenvolvedora backend. Encontros presenciais trimestrais em São Paulo.\nRequisitos: Node.js, SQL.')
  })

  it('sem "Sobre a vaga" a descrição fica vazia', () => {
    expect(splitLoggedDetail('Acme\nDev\nRemoto\nCandidatar-se').description).toBe('')
  })
})

describe('loggedDetailToHtml + checkDetail', () => {
  const candidate = {
    id: '4490030977',
    title: 'Desenvolvedor(a) Backend Pleno',
    company: 'Acme',
    location: 'Brasil (Remoto)',
    model: 'Remoto' as const,
    link: 'https://www.linkedin.com/jobs/view/4490030977/',
    searchKind: 'remoto' as const
  }

  it('modelo vem do selo do topo: "presencial" na descrição não derruba vaga remota', () => {
    const v = checkDetail(loggedDetailToHtml(splitLoggedDetail(detailText)), candidate, 100)
    expect(v).toEqual({
      ok: true,
      model: 'Remoto',
      applicants: 77,
      description: 'Buscamos pessoa desenvolvedora backend. Encontros presenciais trimestrais em São Paulo.\nRequisitos: Node.js, SQL.'
    })
  })

  it('selo Híbrido no topo descarta na busca remota', () => {
    const html = loggedDetailToHtml(splitLoggedDetail(detailText.replace('\nRemoto\n', '\nHíbrido\n')))
    expect(checkDetail(html, candidate, 100)).toMatchObject({ ok: false, reason: expect.stringContaining('Híbrido') })
  })

  it('respeita o limite de candidatos', () => {
    expect(checkDetail(loggedDetailToHtml(splitLoggedDetail(detailText)), candidate, 50)).toMatchObject({ ok: false })
  })
})

describe('isLoggedOutUrl', () => {
  it('reconhece login, authwall e checkpoint', () => {
    expect(isLoggedOutUrl('https://www.linkedin.com/login?session_redirect=x')).toBe(true)
    expect(isLoggedOutUrl('https://www.linkedin.com/authwall?trk=x')).toBe(true)
    expect(isLoggedOutUrl('https://www.linkedin.com/checkpoint/challenge/abc')).toBe(true)
    expect(isLoggedOutUrl('https://www.linkedin.com/uas/login')).toBe(true)
    expect(isLoggedOutUrl('https://www.linkedin.com/jobs/search-results/?keywords=Dev')).toBe(false)
    expect(isLoggedOutUrl('https://www.linkedin.com/jobs/view/4490030977/')).toBe(false)
  })
})

describe('ajustes da revisão', () => {
  it('conta em inglês: card e vaga também funcionam', () => {
    const card = { key: 'job-card-component-ref-4400000009', lines: ['Selected, Backend Developer (Verified job)', 'Backend Developer', 'Acme', 'Brazil (Remote)'] }
    expect(parseLoggedCard(card)).toMatchObject({ title: 'Backend Developer', company: 'Acme', location: 'Brazil (Remote)' })
    const text = 'Acme\nBackend Developer\nBrazil · 2 hours ago · 12 people clicked apply\nRemote\nFull-time\nApply\nSave\nAbout the job\nWe build APIs.\nAbout the company\nAcme.'
    const parts = splitLoggedDetail(text)
    expect(parts).toEqual({ top: 'Acme\nBackend Developer\nBrazil · 2 hours ago · 12 people clicked apply\nRemote\nFull-time', description: 'We build APIs.' })
    expect(hasJobSection(text)).toBe(true)
    expect(hasJobSection('Acme\nCarregando')).toBe(false)
  })

  it('"Benefícios" dentro da descrição não corta o resto', () => {
    const text = 'Acme\nDev\nRemoto\nCandidatar-se\nSobre a vaga\nAtividades: APIs\nBenefícios:\nVR\nRequisitos: Node\nSobre a empresa\nAcme.'
    expect(splitLoggedDetail(text).description).toBe('Atividades: APIs\nBenefícios:\nVR\nRequisitos: Node')
  })

  it('lista logada vazia só é "sem vagas" quando o LinkedIn diz isso', () => {
    expect(isLoggedNoResults('Nenhuma vaga corresponde aos seus critérios')).toBe(true)
    expect(isLoggedNoResults('No matching jobs found.')).toBe(true)
    expect(isLoggedNoResults('Vagas\nTodos os filtros')).toBe(false)
  })

  it('só abre com a sessão links de vaga do LinkedIn', () => {
    expect(isJobViewUrl('https://www.linkedin.com/jobs/view/4490030977/')).toBe(true)
    expect(isJobViewUrl('https://br.linkedin.com/jobs/view/dev-at-acme-4490030977')).toBe(true)
    expect(isJobViewUrl('https://evil.com/jobs/view/1')).toBe(false)
    expect(isJobViewUrl('https://www.linkedin.com/feed/')).toBe(false)
    expect(isJobViewUrl('http://www.linkedin.com/jobs/view/1')).toBe(false)
  })
})

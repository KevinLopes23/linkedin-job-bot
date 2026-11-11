import { describe, expect, it } from 'vitest'
import { compileTerms, DEFAULT_EXCLUDE_TERMS, DEFAULT_TITLE_TERMS } from './filters'
import { authwallPage, detailPage, searchPage } from './fixtures'
import { checkDetail, dedupeById, extractJobId, parseSearchHtml, type Candidate } from './parse'

const patterns = { title: compileTerms(DEFAULT_TITLE_TERMS), exclude: compileTerms(DEFAULT_EXCLUDE_TERMS) }
const remote = { kind: 'remoto' as const, city: null }
const bauru = { kind: 'local' as const, city: 'Bauru, São Paulo, Brasil' }

describe('extractJobId', () => {
  it('usa o data-entity-urn primeiro', () => expect(extractJobId('urn:li:jobPosting:4012345678', '')).toBe('4012345678'))
  it('cai para /jobs/view/<id>', () => expect(extractJobId(undefined, 'https://x/jobs/view/4012345678/')).toBe('4012345678'))
  it('cai para o fim do slug', () => expect(extractJobId(undefined, 'https://x/jobs/view/dev-react-4012345679?x=1')).toBe('4012345679'))
  it('vazio sem pistas', () => expect(extractJobId(undefined, 'https://x/abc')).toBe(''))
})

describe('parseSearchHtml', () => {
  it('lê título, empresa, local, modelo e link sem parâmetros', () => {
    const html = searchPage([{ id: '4000000001', title: 'Desenvolvedor React', company: 'Acme', location: 'São Paulo, SP (Remoto)' }])
    const r = parseSearchHtml(html, remote, patterns)
    expect(dedupeById(r.candidates)).toEqual([
      {
        id: '4000000001',
        title: 'Desenvolvedor React',
        company: 'Acme',
        location: 'São Paulo, SP (Remoto)',
        model: 'Remoto',
        link: 'https://br.linkedin.com/jobs/view/vaga-4000000001',
        searchKind: 'remoto'
      }
    ])
    // O <li> e o card interno são lidos (como no bot); a deduplicação junta depois.
    expect(r.cards).toBe(2)
  })

  it('descarta promovida, fora do perfil, excluída e sênior no texto do card', () => {
    const html = searchPage([
      { id: '4000000002', title: 'Desenvolvedor Node', company: 'Promo', location: 'Brasil', extra: '<span>Promovida</span>' },
      { id: '4000000003', title: 'Designer de Produto', company: 'Ux', location: 'Brasil' },
      { id: '4000000004', title: 'Desenvolvedor Java', company: 'Jv', location: 'Brasil' },
      { id: '4000000005', title: 'Desenvolvedor Node', company: 'Sn', location: 'Brasil', extra: '<span>Nível Senior</span>' },
      { id: '4000000006', title: 'Desenvolvedor Vue', company: 'Ok', location: 'Brasil' }
    ])
    expect(dedupeById(parseSearchHtml(html, remote, patterns).candidates).map((c) => c.id)).toEqual(['4000000006'])
  })

  it('busca remota descarta o que o card marca como híbrido/presencial', () => {
    const html = searchPage([{ id: '4000000007', title: 'Desenvolvedor .NET', company: 'H', location: 'Campinas (Híbrido)' }])
    expect(parseSearchHtml(html, remote, patterns).candidates).toEqual([])
  })

  it('busca local exige a cidade na localização', () => {
    const html = searchPage([
      { id: '4000000008', title: 'Desenvolvedor PHP', company: 'X', location: 'Bauru, SP' },
      { id: '4000000009', title: 'Desenvolvedor Python', company: 'Y', location: 'Bauru, SP' },
      { id: '4000000010', title: 'Desenvolvedor Python', company: 'Z', location: 'Marília, SP' }
    ])
    const ids = dedupeById(parseSearchHtml(html, bauru, patterns).candidates).map((c) => c.id)
    expect(ids).toEqual(['4000000009'])
  })

  it('aceita termos configurados pelo usuário', () => {
    const html = searchPage([{ id: '4000000011', title: 'Desenvolvedor Vue', company: 'Ok', location: 'Brasil' }])
    const custom = { title: compileTerms(['vue']), exclude: compileTerms(['\\bok\\b']) }
    expect(parseSearchHtml(html, remote, custom).candidates).toEqual([])
  })
})

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: '4000000020',
  title: 'Desenvolvedor React',
  company: 'Acme',
  location: 'Brasil',
  model: 'Remoto',
  link: 'https://br.linkedin.com/jobs/view/4000000020',
  searchKind: 'remoto',
  ...over
})

describe('checkDetail', () => {
  it('aprova e extrai descrição e candidatos', () => {
    const v = checkDetail(
      detailPage({ body: 'Remoto · 37 candidaturas', description: '<p>Stack:   React</p><ul><li>Node</li><li>SQL</li></ul>' }),
      candidate(),
      50
    )
    expect(v).toEqual({ ok: true, model: 'Remoto', applicants: 37, description: 'Stack: React\nNode\nSQL' })
  })

  it('ignora "Vagas semelhantes" (outras vagas híbridas/promovidas/com muitos candidatos na mesma página)', () => {
    const html = detailPage({
      body: 'Curitiba, PR · 12 candidaturas',
      similar: 'Desenvolvedor Full Stack Pleno - Híbrido · Promovida por quem está contratando · 900 candidaturas'
    })
    expect(checkDetail(html, candidate(), 50)).toMatchObject({ ok: true, model: 'Remoto', applicants: 12 })
  })

  it('página de login do LinkedIn não aprova (volta na próxima varredura)', () => {
    expect(checkDetail(authwallPage, candidate(), 50)).toMatchObject({ ok: false, reason: expect.stringContaining('login') })
  })

  it('busca remota: descarta se a página diz híbrido', () => {
    const v = checkDetail(detailPage({ body: 'Híbrido' }), candidate(), 50)
    expect(v).toMatchObject({ ok: false })
  })

  it('descarta promovida na página', () => {
    expect(checkDetail(detailPage({ body: 'Remoto · Promovida por quem está contratando' }), candidate(), 50)).toMatchObject({ ok: false, reason: 'é promovida' })
  })

  it('descarta acima do limite de candidatos e ignora o limite quando 0', () => {
    const html = detailPage({ body: 'Remoto · Mais de 200 candidaturas' })
    expect(checkDetail(html, candidate(), 50)).toMatchObject({ ok: false })
    expect(checkDetail(html, candidate(), 0)).toMatchObject({ ok: true, applicants: 200 })
  })

  it('modelo indefinido: remota descarta, local assume Presencial', () => {
    const html = detailPage({ body: 'Sem modelo', description: 'Vaga legal' })
    expect(checkDetail(html, candidate({ model: 'Indefinido' }), 50)).toMatchObject({ ok: false })
    expect(checkDetail(html, candidate({ model: 'Indefinido', searchKind: 'local' }), 50)).toMatchObject({ ok: true, model: 'Presencial' })
  })
})

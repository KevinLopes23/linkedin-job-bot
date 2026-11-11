import { describe, expect, it } from 'vitest'
import {
  buildSearchUrls,
  compileTerms,
  DEFAULT_EXCLUDE_TERMS,
  DEFAULT_TITLE_TERMS,
  isPromotedCard,
  isPromotedDetail,
  limitPerCompany,
  matchesAny,
  modelFromBadges,
  modelFromCard,
  modelFromDetail,
  parseApplicants
} from './filters'

const title = compileTerms(DEFAULT_TITLE_TERMS)
const exclude = compileTerms(DEFAULT_EXCLUDE_TERMS)

describe('termos padrão (iguais ao bot)', () => {
  it.each(['Desenvolvedor Full Stack', 'Software Engineer', 'Analista de Sistemas', 'Front-end Developer', 'Engenheira de Software', 'Programador .NET', 'Backend'])(
    'título relevante: %s',
    (t) => expect(matchesAny(title, t)).toBe(true)
  )

  it.each(['Analista de Dados', 'Designer UX', 'Business Analyst'])('título fora do perfil: %s', (t) => expect(matchesAny(title, t)).toBe(false))

  it.each([
    'Desenvolvedor Senior',
    'Dev Sênior React',
    'Desenvolvedor Sr. Node',
    'Tech Lead Developer',
    'Desenvolvedor Java',
    'Desenvolvedor PHP Laravel',
    'Desenvolvedor Flutter',
    'Desenvolvedor SAP ABAP',
    'Business Developer',
    'QA Developer',
    'Estágio em Desenvolvimento',
    'Desenvolvedor C++',
    'Engenheiro de Dados',
    'Developer at BairesDev'
  ])('excluído: %s', (t) => expect(matchesAny(exclude, t)).toBe(true))

  it.each(['Desenvolvedor Pleno React', 'Desenvolvedor .NET Júnior', 'Full Stack Developer Node', 'JavaScript Developer'])('não excluído: %s', (t) =>
    expect(matchesAny(exclude, t)).toBe(false)
  )

  it('"java" não pega "javascript" (word boundary)', () => {
    expect(matchesAny(exclude, 'JavaScript Developer')).toBe(false)
  })
})

describe('buildSearchUrls', () => {
  it('gera uma busca remota e uma por cidade para cada palavra-chave, com os filtros do bot', () => {
    const urls = buildSearchUrls({ keywords: ['Desenvolvedor', 'Full Stack'], searchRemote: true, cities: ['Bauru, São Paulo, Brasil'], hoursWindow: 1 })
    expect(urls).toHaveLength(4)
    expect(urls[0]).toMatchObject({ kind: 'remoto', city: null, keyword: 'Desenvolvedor' })
    expect(urls[0]?.url).toBe('https://www.linkedin.com/jobs/search/?f_TPR=r3600&f_WT=2&geoId=106057199&f_E=2%2C3%2C4&keywords=Desenvolvedor')
    expect(urls[1]?.url).toBe(
      'https://www.linkedin.com/jobs/search/?f_TPR=r3600&f_WT=1%2C3&location=Bauru%2C%20S%C3%A3o%20Paulo%2C%20Brasil&f_E=2%2C3%2C4&keywords=Desenvolvedor'
    )
    expect(urls[3]?.url).toContain('keywords=Full%20Stack')
  })

  it('respeita a janela de horas e a busca remota desligada', () => {
    const urls = buildSearchUrls({ keywords: ['Dev'], searchRemote: false, cities: ['Bauru, São Paulo, Brasil'], hoursWindow: 24 })
    expect(urls).toHaveLength(1)
    expect(urls[0]?.kind).toBe('local')
    expect(urls[0]?.url).toContain('f_TPR=r86400')
  })
})

describe('modelo de trabalho', () => {
  it('pelo card', () => {
    expect(modelFromCard('São Paulo (Remoto)')).toBe('Remoto')
    expect(modelFromCard('Bauru · Híbrido')).toBe('Híbrido')
    expect(modelFromCard('On-site')).toBe('Presencial')
    expect(modelFromCard('Bauru, SP')).toBe('Indefinido')
  })

  it('pelos badges (presencial primeiro)', () => {
    expect(modelFromBadges('Presencial remoto')).toBe('Presencial')
    expect(modelFromBadges('Bauru, SP')).toBeNull()
  })

  it('pela página: Híbrido vence Remoto e Presencial', () => {
    expect(modelFromDetail('Modelo híbrido com possibilidade de remoto')).toBe('Híbrido')
    expect(modelFromDetail('Trabalho presencial')).toBe('Presencial')
    expect(modelFromDetail('100% remote')).toBe('Remoto')
    expect(modelFromDetail('Sem informação')).toBeNull()
  })
})

describe('promovidas', () => {
  it('detecta no card por texto ou classe', () => {
    expect(isPromotedCard('Promovida', '')).toBe(true)
    expect(isPromotedCard('Recrutando ativamente', '')).toBe(true)
    expect(isPromotedCard('', '<span class="job-search-card__sponsored">')).toBe(true)
    expect(isPromotedCard('Desenvolvedor', '<div class="base-card">')).toBe(false)
  })

  it('detecta na página da vaga', () => {
    expect(isPromotedDetail('Promovida por quem está contratando', '')).toBe(true)
    expect(isPromotedDetail('Vaga normal', '<div class="x__sponsored">')).toBe(true)
    expect(isPromotedDetail('Vaga normal', '<div>')).toBe(false)
  })
})

describe('parseApplicants', () => {
  it.each([
    ['37 candidaturas', 37],
    ['Mais de 200 candidaturas', 200],
    ['Over 100 applicants', 100],
    ['12 pessoas clicaram em Candidatar-se', 12],
    ['Seja um dos 25 primeiros', null]
  ])('%s → %s', (text, expected) => expect(parseApplicants(text)).toBe(expected))
})

describe('limitPerCompany', () => {
  const jobs = [{ company: 'Acme' }, { company: 'ACME ' }, { company: 'acme' }, { company: 'Beta' }]

  it('mantém no máximo N por empresa (sem diferenciar maiúsculas/espaços)', () => {
    const { kept, dropped } = limitPerCompany(jobs, new Map(), 2)
    expect(kept.map((j) => j.company)).toEqual(['Acme', 'ACME ', 'Beta'])
    expect(dropped).toHaveLength(1)
  })

  it('soma o que já foi guardado nas últimas 24 h', () => {
    const { kept } = limitPerCompany(jobs, new Map([['acme', 2]]), 3)
    expect(kept.map((j) => j.company)).toEqual(['Acme', 'Beta'])
  })
})

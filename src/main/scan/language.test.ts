import { describe, expect, it } from 'vitest'
import { isEnglish } from './language'

describe('isEnglish', () => {
  it('reconhece descrição em inglês', () => {
    const text =
      'This position is listed on behalf of a partner company, who manages all applications and next steps. Our partner is looking for a Tech Generalist with experience in software and you will work with the team.'
    expect(isEnglish(text)).toBe(true)
  })

  it('não marca descrição em português, mesmo com termos técnicos em inglês', () => {
    const text =
      'Estamos buscando uma pessoa desenvolvedora Full Stack para atuar com Node.js, React e TypeScript. Você vai trabalhar com o time de produto em uma empresa que valoriza o clean code e a experiência do usuário.'
    expect(isEnglish(text)).toBe(false)
  })

  it('texto curto ou vazio não é descartado (sem evidência suficiente)', () => {
    expect(isEnglish('')).toBe(false)
    expect(isEnglish('Software Engineer')).toBe(false)
  })

  it('vaga bilíngue com a maior parte em português fica', () => {
    const text =
      'Sobre a vaga: você vai desenvolver APIs com NestJS para os nossos clientes e participar das decisões de arquitetura do time. Requisitos: experiência com Node.js e banco de dados. Nice to have: English for meetings with the team.'
    expect(isEnglish(text)).toBe(false)
  })
})

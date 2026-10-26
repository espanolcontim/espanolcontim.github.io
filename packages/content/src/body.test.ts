import { describe, expect, it } from 'vitest'
import { mergeLessonBodies, missingSentences, sentenceRefs } from './body.ts'
import type { LessonBody, Sentence } from './schema.ts'

const sentence = (n: number): Sentence => ({
  id: `a1-03-s0${n}`,
  ru: `задание ${n}`,
  es: [`respuesta ${n}`],
})

const free: LessonBody = {
  id: 'a1-03',
  summary: {
    phrases: [{ es: 'Hola.', ru: 'Привет.' }],
    rule: 'Правило.',
    mistake: { wrong: { es: 'Mal.' }, right: { es: 'Bien.' } },
    practice: ['a1-03-s02'],
  },
  quiz: [{ id: 'a1-03-s03.order', type: 'order', sentenceId: 'a1-03-s03' }],
  sentences: [sentence(2), sentence(3)],
}

const paid: LessonBody = {
  id: 'a1-03',
  practice: [{ name: 'Всё вместе', sentenceIds: ['a1-03-s01', 'a1-03-s02', 'a1-03-s03'] }],
  sentences: [sentence(1)],
}

describe('sentenceRefs', () => {
  it('собирает ссылки из выжимки, практики и упражнений', () => {
    expect([...sentenceRefs(free)].sort()).toEqual(['a1-03-s02', 'a1-03-s03'])
    expect([...sentenceRefs(paid)].sort()).toEqual(['a1-03-s01', 'a1-03-s02', 'a1-03-s03'])
  })
})

describe('mergeLessonBodies', () => {
  it('склеивает части и предложения половин', () => {
    const merged = mergeLessonBodies(free, paid)
    expect(merged.summary).toBe(free.summary)
    expect(merged.practice).toBe(paid.practice)
    expect(merged.sentences.map((s) => s.id).sort()).toEqual([
      'a1-03-s01',
      'a1-03-s02',
      'a1-03-s03',
    ])
    expect(missingSentences(merged)).toEqual([])
  })

  it('без платной половины — бесплатная как есть', () => {
    expect(mergeLessonBodies(free, undefined)).toBe(free)
  })

  it('часть в обеих половинах — ошибка', () => {
    expect(() => mergeLessonBodies(free, { ...paid, quiz: [] })).toThrow(/quiz/)
  })
})

describe('missingSentences', () => {
  it('находит ссылки без предложений', () => {
    expect(missingSentences(paid)).toEqual(['a1-03-s02', 'a1-03-s03'])
  })
})

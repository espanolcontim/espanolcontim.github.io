import type { LessonBody, LessonMeta } from '@espanolcontim/content'
import { describe, expect, it } from 'vitest'
import {
  lessonName,
  patternKind,
  practiceNote,
  repeatsLabel,
  sectionLocked,
  sectionNote,
  SUBSCRIPTION,
  tabTitle,
} from './labels.ts'
import {
  courseOrder,
  isPractice,
  lessonPath,
  lessonSections,
  neighbours,
  nextSection,
  planLabel,
  videoLink,
} from './navigation.ts'
import { StaticLessonRepository } from './StaticLessonRepository.ts'

const meta = (number: number, planLesson: number, level: 'A0' | 'B2' = 'A0'): LessonMeta => ({
  id: `${level.toLowerCase()}-${String(planLesson).padStart(2, '0')}`,
  number,
  level,
  planLesson,
  title: `Урок ${number}`,
  grammar: [],
  parts: { summary: 'free' },
})

const body = (id: string): LessonBody => ({ id, sentences: [] })

/** Практика 1 после урока 4: повторяет уроки 1–4. */
const practice: LessonMeta = {
  id: 'a0-p1',
  number: 1,
  level: 'A0',
  planLesson: 1,
  title: 'Я и ты',
  grammar: [],
  parts: { notes: 'free', practice: 'free', quiz: 'free' },
  repeats: { from: 1, to: 4 },
}

describe('StaticLessonRepository', () => {
  const repository = new StaticLessonRepository({ lessons: [meta(2, 2), meta(1, 1)] }, [
    body('a0-01'),
    body('a0-02'),
  ])

  it('отдаёт уроки по порядку номеров', async () => {
    expect((await repository.list()).map((lesson) => lesson.id)).toEqual(['a0-01', 'a0-02'])
    expect((await repository.getMeta('a0-02'))?.number).toBe(2)
    expect(await repository.getBody('a0-01')).toEqual(body('a0-01'))
    expect(await repository.getBody('a0-03')).toBeUndefined()
  })

  it('практика — сразу после урока, который она закрывает', async () => {
    const course = new StaticLessonRepository(
      { lessons: [meta(5, 5), practice, meta(4, 4), meta(3, 3)] },
      [],
    )
    expect((await course.list()).map((lesson) => lesson.id)).toEqual([
      'a0-03',
      'a0-04',
      'a0-p1',
      'a0-05',
    ])
    expect(courseOrder(practice)).toBeGreaterThan(courseOrder(meta(4, 4)))
  })

  it('битые данные ломают сборку, а не страницу', () => {
    expect(() => new StaticLessonRepository({ lessons: [{ id: 'урок' }] }, [])).toThrow(/"id"/)
  })
})

describe('навигация', () => {
  const lessons = [meta(1, 1), meta(2, 2), meta(3, 3)]

  it('адреса со слешем на конце', () => {
    expect(lessonPath('a0-01')).toBe('/lessons/a0-01/')
    expect(lessonPath('a0-01', 'notes')).toBe('/lessons/a0-01/notes/')
    expect(lessonPath('a0-01', 'overview')).toBe('/lessons/a0-01/')
  })

  it('соседние уроки', () => {
    expect(neighbours(lessons, 'a0-01')).toEqual({ previous: undefined, next: lessons[1] })
    expect(neighbours(lessons, 'a0-03').next).toBeUndefined()
  })

  it('номер в уровне и ссылка на видео', () => {
    expect(planLabel(meta(11, 11))).toBe('11/14')
    expect(planLabel(meta(85, 1, 'B2'))).toBe('1')
    const channel = 'https://www.youtube.com/@espanolcontimur'
    expect(videoLink(meta(1, 1), channel)).toBe(channel)
    expect(videoLink({ ...meta(1, 1), youtubeUrl: 'https://youtu.be/x' }, channel)).toBe(
      'https://youtu.be/x',
    )
  })
})

describe('практика', () => {
  it('без подразделов: упражнения — на её странице', () => {
    expect(isPractice(practice)).toBe(true)
    expect(isPractice(meta(4, 4))).toBe(false)
    expect(lessonSections(practice)).toEqual([])
    expect(nextSection(practice, 'overview')).toBeUndefined()
  })

  it('соседи: урок 4 → практика 1 → урок 5', () => {
    const course = [meta(4, 4), practice, meta(5, 5)]
    expect(neighbours(course, 'a0-04').next).toBe(practice)
    expect(neighbours(course, 'a0-p1')).toEqual({ previous: course[0], next: course[2] })
  })

  it('подписи', () => {
    expect(lessonName(practice)).toBe('Практика 1')
    expect(lessonName(meta(4, 4))).toBe('Урок 4')
    expect(repeatsLabel({ from: 1, to: 4 })).toBe('уроки 1–4')
    expect(repeatsLabel({ from: 5, to: 5 })).toBe('урок 5')
  })
})

describe('формула правила', () => {
  it('знаки, места для подстановки и испанские слова', () => {
    expect(['quiero', '+', 'инфинитив', '→', '¿'].map(patternKind)).toEqual([
      'word',
      'sign',
      'slot',
      'sign',
      'word',
    ])
  })
})

describe('пометка подписки у упражнений', () => {
  it('говорит, что именно закрыто', () => {
    expect(practiceNote({ practice: 'free', quiz: 'free' })).toBeUndefined()
    expect(practiceNote({ practice: 'paid', quiz: 'free' })).toBe(`фразы — ${SUBSCRIPTION}`)
    expect(practiceNote({ practice: 'free', quiz: 'paid' })).toBe(`проверка — ${SUBSCRIPTION}`)
    expect(practiceNote({ practice: 'paid', quiz: 'paid' })).toBe(SUBSCRIPTION)
    expect(practiceNote({})).toBeUndefined()
  })
})

describe('шаги урока', () => {
  const full: LessonMeta = {
    ...meta(2, 2),
    parts: { summary: 'free', notes: 'free', extras: 'paid', practice: 'free', quiz: 'free' },
  }
  const noExtras: LessonMeta = { ...meta(2, 2), parts: { summary: 'free', notes: 'free' } }

  it('обзор → конспект → допматериалы → упражнения, потом — следующий урок', () => {
    expect(lessonSections(full)).toEqual(['notes', 'extras', 'practice'])
    expect(nextSection(full, 'overview')).toBe('notes')
    expect(nextSection(full, 'notes')).toBe('extras')
    expect(nextSection(full, 'extras')).toBe('practice')
    expect(nextSection(full, 'practice')).toBeUndefined()
  })

  it('без допматериалов — сразу к упражнениям', () => {
    expect(lessonSections(noExtras)).toEqual(['notes', 'practice'])
    expect(nextSection(noExtras, 'notes')).toBe('practice')
    expect(nextSection(noExtras, 'extras')).toBeUndefined()
  })

  it('пометки и замки подразделов', () => {
    expect(tabTitle('overview')).toBe('Обзор')
    expect(tabTitle('extras')).toBe('Допматериалы')
    expect(sectionNote(full, 'notes')).toBeUndefined()
    expect(sectionNote(full, 'extras')).toBe(SUBSCRIPTION)
    expect(sectionLocked(full, 'extras')).toBe(true)
    const paidPhrases: LessonMeta = { ...full, parts: { ...full.parts, practice: 'paid' } }
    // Проверка после урока открыта — страница упражнений не закрыта целиком.
    expect(sectionNote(paidPhrases, 'practice')).toBe(`фразы — ${SUBSCRIPTION}`)
    expect(sectionLocked(paidPhrases, 'practice')).toBe(false)
    const allPaid: LessonMeta = { ...paidPhrases, parts: { ...paidPhrases.parts, quiz: 'paid' } }
    expect(sectionLocked(allPaid, 'practice')).toBe(true)
  })
})

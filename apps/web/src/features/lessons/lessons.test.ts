import type { LessonBody, LessonMeta } from '@espanolcontim/content'
import { describe, expect, it } from 'vitest'
import { patternKind } from './labels.ts'
import { lessonPath, neighbours, planLabel, videoLink } from './navigation.ts'
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

  it('битые данные ломают сборку, а не страницу', () => {
    expect(() => new StaticLessonRepository({ lessons: [{ id: 'урок' }] }, [])).toThrow(/"id"/)
  })
})

describe('навигация', () => {
  const lessons = [meta(1, 1), meta(2, 2), meta(3, 3)]

  it('адреса со слешем на конце', () => {
    expect(lessonPath('a0-01')).toBe('/lessons/a0-01/')
    expect(lessonPath('a0-01', 'notes')).toBe('/lessons/a0-01/notes/')
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

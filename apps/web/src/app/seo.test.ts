import type { LessonBody, LessonMeta } from '@espanolcontim/content'
import { describe, expect, it } from 'vitest'
import { StaticLessonRepository } from '../features/lessons/StaticLessonRepository.ts'
import { fitDescription, lessonSitemapPaths, robotsTxt, sitemapPaths, sitemapXml } from './seo.ts'

const meta = (n: number): LessonMeta => ({
  id: `a0-0${n}`,
  number: n,
  level: 'A0',
  planLesson: n,
  title: `Урок ${n}`,
  grammar: [],
  parts: { summary: 'free' },
})

const notes = { sections: [], tables: [], dialogues: [], vocabulary: [], outcome: [] }

describe('описание страницы', () => {
  it('пункты целиком, пока влезают в лимит', () => {
    expect(fitDescription('Урок 1: ', ['один', 'два', 'три'], 'запасной', 18)).toBe(
      'Урок 1: один; два.',
    )
    expect(fitDescription('Урок 1: ', ['один', 'два'], 'запасной')).toBe('Урок 1: один; два.')
  })

  it('без пунктов или если первый не влез — запасной текст', () => {
    expect(fitDescription('Урок 1: ', [], 'Привет')).toBe('Урок 1: Привет.')
    expect(fitDescription('Урок 1: ', ['очень длинный пункт'], 'Привет', 15)).toBe(
      'Урок 1: Привет.',
    )
  })
})

describe('sitemap', () => {
  it('закрытых конспекта и допматериалов нет', () => {
    const open = { id: 'a0-01', sentences: [], notes, extras: {} } as unknown as LessonBody
    const closed = { id: 'a0-02', sentences: [] } as LessonBody
    expect(lessonSitemapPaths(meta(1), open)).toEqual([
      '/lessons/a0-01/',
      '/lessons/a0-01/notes/',
      '/lessons/a0-01/extras/',
      '/lessons/a0-01/practice/',
    ])
    expect(lessonSitemapPaths(meta(2), closed)).toEqual([
      '/lessons/a0-02/',
      '/lessons/a0-02/practice/',
    ])
  })

  it('главная, список уроков и уроки по порядку', async () => {
    const lessons = new StaticLessonRepository({ lessons: [meta(2), meta(1)] }, [
      { id: 'a0-01', sentences: [] },
      { id: 'a0-02', sentences: [] },
    ])
    expect(await sitemapPaths(lessons)).toEqual([
      '/',
      '/lessons/',
      '/lessons/a0-01/',
      '/lessons/a0-01/practice/',
      '/lessons/a0-02/',
      '/lessons/a0-02/practice/',
    ])
  })

  it('полные адреса на адресе сайта', () => {
    const xml = sitemapXml(new URL('https://example.org'), ['/', '/lessons/a0-01/'])
    expect(xml).toContain('<loc>https://example.org/</loc>')
    expect(xml).toContain('<loc>https://example.org/lessons/a0-01/</loc>')
    expect(robotsTxt(new URL('https://example.org'))).toContain(
      'Sitemap: https://example.org/sitemap.xml',
    )
  })
})

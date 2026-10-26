/**
 * Раскладка урока по доступу: бесплатные части — в content/public (коммитится),
 * платные — в content/private (в .gitignore, потом в приватный бакет).
 */
import {
  partAccess,
  PARTS,
  sentenceRefs,
  type Access,
  type LessonBody,
  type LessonMeta,
  type LessonParts,
  type Part,
} from '@espanolcontim/content'
import type { ConvertedLesson } from './convert.ts'
import type { LessonSource } from './source.ts'

/** Какие части у урока есть и как они открыты — по access.ts. */
export function lessonAccess(
  lesson: LessonSource,
  converted: ConvertedLesson,
): Partial<Record<Part, Access>> {
  return Object.fromEntries(
    PARTS.filter((part) => converted.parts[part] !== undefined).map((part) => [
      part,
      partAccess(part, lesson),
    ]),
  )
}

/**
 * Предложение уходит в public, если на него ссылается хотя бы одна бесплатная
 * часть, иначе — в private. Часть, у которой доступ не указан, считается платной.
 */
export function splitLesson(
  id: string,
  converted: ConvertedLesson,
  access: Partial<Record<Part, Access>>,
): { free: LessonBody; paid?: LessonBody } {
  const freeParts: LessonParts = {}
  const paidParts: LessonParts = {}
  for (const part of PARTS) {
    const data = converted.parts[part]
    if (data === undefined) continue
    Object.assign(access[part] === 'free' ? freeParts : paidParts, { [part]: data })
  }

  const freeRefs = sentenceRefs(freeParts)
  const paidRefs = sentenceRefs(paidParts)
  const free: LessonBody = {
    id,
    ...freeParts,
    sentences: converted.sentences.filter((s) => freeRefs.has(s.id)),
  }
  if (Object.keys(paidParts).length === 0) return { free }
  const paid: LessonBody = {
    id,
    ...paidParts,
    sentences: converted.sentences.filter((s) => paidRefs.has(s.id) && !freeRefs.has(s.id)),
  }
  return { free, paid }
}

export function lessonMeta(
  id: string,
  lesson: LessonSource,
  access: Partial<Record<Part, Access>>,
  youtubeUrl: string | undefined,
): LessonMeta {
  return {
    id,
    number: lesson.number,
    level: lesson.level,
    planLesson: lesson.planLesson,
    title: lesson.title,
    grammar: lesson.newGrammar ?? [],
    youtubeUrl,
    parts: access,
  }
}

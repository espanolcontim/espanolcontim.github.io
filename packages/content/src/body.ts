import { PARTS, type Part } from './access.ts'
import type { Exercise, LessonBody } from './schema.ts'

export type LessonParts = Partial<Pick<LessonBody, Part>>

/** id предложений, на которые ссылаются части урока. */
export function sentenceRefs(parts: LessonParts): Set<string> {
  const refs = new Set<string>()
  const fromExercises = (items: Exercise[]) => {
    for (const item of items) if ('sentenceId' in item) refs.add(item.sentenceId)
  }
  for (const id of parts.summary?.practice ?? []) refs.add(id)
  for (const group of parts.practice ?? []) for (const id of group.sentenceIds) refs.add(id)
  for (const block of parts.extras?.exercises ?? []) fromExercises(block.items)
  fromExercises(parts.quiz ?? [])
  return refs
}

/**
 * Склеивает бесплатную и платную половины урока (content/public и
 * content/private). Части в половинах не пересекаются, предложения объединяются.
 */
export function mergeLessonBodies(free: LessonBody, paid: LessonBody | undefined): LessonBody {
  if (!paid) return free
  if (paid.id !== free.id) throw new Error(`склеиваются разные уроки: ${free.id} и ${paid.id}`)
  const merged: LessonBody = { ...free }
  for (const part of PARTS) {
    if (paid[part] === undefined) continue
    if (free[part] !== undefined) {
      throw new Error(`урок ${free.id}: часть «${part}» есть в обеих половинах`)
    }
    Object.assign(merged, { [part]: paid[part] })
  }
  const sentences = new Map(free.sentences.map((sentence) => [sentence.id, sentence]))
  for (const sentence of paid.sentences) sentences.set(sentence.id, sentence)
  merged.sentences = [...sentences.values()]
  return merged
}

/** Ссылки на предложения, которых нет в теле урока. */
export function missingSentences(body: LessonBody): string[] {
  const known = new Set(body.sentences.map((sentence) => sentence.id))
  return [...sentenceRefs(body)].filter((id) => !known.has(id))
}

/**
 * Постоянные id предложений и упражнений: content/ids.lock.json.
 *
 * video-lessons id не хранит, поэтому их выдаёт импорт. Ключ элемента — хэш
 * его нормализованного текста, номер — порядковый в уроке. В lock-файле
 * только хэши, без текста: его можно коммитить, платные фразы не утекают.
 *
 * - Фраза не изменилась → тот же номер, даже если её переставили или вставили
 *   перед ней новые.
 * - Новая фраза → следующий свободный номер. Номера исчезнувших фраз не
 *   переиспользуются: на них может держаться чей-то прогресс.
 * - Фразу отредактировали → у неё новый ключ и новый номер. Импорт покажет
 *   «исчезли / появились»; чтобы сохранить прогресс, в lock-файле номер
 *   новой фразы меняют на старый, а строку старого ключа удаляют.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { plainText } from '@espanolcontim/content'
import { z } from 'zod'

const Numbers = z
  .record(z.string(), z.number().int().positive())
  .refine((map) => new Set(Object.values(map)).size === Object.keys(map).length, {
    message: 'один номер выдан двум ключам',
  })

const LessonEntrySchema = z.object({ sentences: Numbers, exercises: Numbers })

export const IdsLockSchema = z.object({
  version: z.literal(1),
  lessons: z.record(z.string(), LessonEntrySchema),
})

export type IdsLock = z.infer<typeof IdsLockSchema>
type LessonEntry = z.infer<typeof LessonEntrySchema>

/**
 * Текст для ключа: без разметки, регистра, диакритики, пунктуации и лишних
 * пробелов — чтобы исправленная запятая или выделение не меняли id.
 */
export function normalizeForKey(text: string): string {
  return plainText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const hash = (parts: string[]): string =>
  createHash('sha256').update(parts.map(normalizeForKey).join('|')).digest('hex').slice(0, 12)

/** Предложение — это задание целиком: перевод, уточнение и эталон. */
export const sentenceKey = (sentence: { ru: string; hint?: string; es: string }): string =>
  hash([sentence.ru, sentence.hint ?? '', sentence.es])

/** Упражнение без предложения: тип и его тексты. */
export const exerciseKey = (type: string, ...texts: string[]): string => hash([type, ...texts])

/** Номера одного урока. Меняет запись lock-файла на месте. */
export class LessonIds {
  private readonly used = { sentences: new Set<string>(), exercises: new Set<string>() }
  readonly added = { sentences: [] as number[], exercises: [] as number[] }
  private readonly entry: LessonEntry

  constructor(entry: LessonEntry) {
    this.entry = entry
  }

  sentence(key: string): number {
    return this.take('sentences', key)
  }

  exercise(key: string): number {
    return this.take('exercises', key)
  }

  /** Номера из lock-файла, которые в этот раз не понадобились. */
  unused(): { sentences: number[]; exercises: number[] } {
    const left = (kind: keyof LessonEntry) =>
      Object.entries(this.entry[kind])
        .filter(([key]) => !this.used[kind].has(key))
        .map(([, n]) => n)
        .sort((a, b) => a - b)
    return { sentences: left('sentences'), exercises: left('exercises') }
  }

  private take(kind: keyof LessonEntry, key: string): number {
    this.used[kind].add(key)
    const map = this.entry[kind]
    const known = map[key]
    if (known !== undefined) return known
    const next = Math.max(0, ...Object.values(map)) + 1
    map[key] = next
    this.added[kind].push(next)
    return next
  }
}

export function lessonIds(lock: IdsLock, lesson: string): LessonIds {
  lock.lessons[lesson] ??= { sentences: {}, exercises: {} }
  return new LessonIds(lock.lessons[lesson])
}

export function readLock(path: string): IdsLock {
  if (!existsSync(path)) return { version: 1, lessons: {} }
  return IdsLockSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

/** Уроки и ключи — по порядку, чтобы дифф в git показывал только новое. */
export function writeLock(path: string, lock: IdsLock): void {
  const byNumber = (map: Record<string, number>) =>
    Object.fromEntries(Object.entries(map).sort(([, a], [, b]) => a - b))
  const lessons = Object.fromEntries(
    Object.keys(lock.lessons)
      .sort()
      .map((id) => {
        const entry = lock.lessons[id]!
        return [id, { sentences: byNumber(entry.sentences), exercises: byNumber(entry.exercises) }]
      }),
  )
  writeFileSync(path, `${JSON.stringify({ version: 1, lessons }, null, 2)}\n`)
}

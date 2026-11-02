import { createHash } from 'node:crypto'
import { LessonBodySchema, missingSentences } from '@espanolcontim/content'

/** Платная половина урока, готовая к выгрузке. Ключ в бакете — как читает `functions/api`. */
export interface LessonFile {
  key: string
  body: Uint8Array
  md5: string
}

export const LESSONS_PREFIX = 'lessons/'

/**
 * Файл из content/private/lessons → для бакета. Браузер получает его как есть и схемой
 * не проверяет, поэтому всё проверяем здесь: битый файл не должен попасть к ученикам.
 */
export function lessonFile(name: string, body: Uint8Array): LessonFile {
  const id = name.replace(/\.json$/, '')
  const lesson = LessonBodySchema.parse(JSON.parse(Buffer.from(body).toString('utf8')))
  if (lesson.id !== id) throw new Error(`${name}: внутри урок ${lesson.id}`)
  const missing = missingSentences(lesson)
  if (missing.length > 0) {
    throw new Error(`${name}: нет предложений ${missing.join(', ')} — повторите content:import`)
  }
  return {
    key: `${LESSONS_PREFIX}${name}`,
    body,
    md5: createHash('md5').update(body).digest('hex'),
  }
}

/** Что загрузить (новое и изменённое) и что удалить (урока больше нет среди платных). */
export function planUpload(
  files: LessonFile[],
  remote: ReadonlyMap<string, string>,
): { upload: LessonFile[]; remove: string[] } {
  const local = new Set(files.map((file) => file.key))
  return {
    upload: files.filter((file) => remote.get(file.key) !== file.md5),
    remove: [...remote.keys()].filter((key) => !local.has(key)).toSorted(),
  }
}

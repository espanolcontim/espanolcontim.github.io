import { LEVEL_LESSONS, type LessonMeta } from '@espanolcontim/content'

/** Подразделы урока. */
export type LessonSection = 'notes' | 'extras' | 'practice'

/** /lessons/a0-11/ или /lessons/a0-11/notes/ — со слешем на конце, как отдаёт хостинг. */
export function lessonPath(id: string, section?: LessonSection): string {
  return section ? `/lessons/${id}/${section}/` : `/lessons/${id}/`
}

/** Соседние уроки по сквозному номеру. */
export function neighbours(
  lessons: LessonMeta[],
  id: string,
): { previous?: LessonMeta | undefined; next?: LessonMeta | undefined } {
  const i = lessons.findIndex((lesson) => lesson.id === id)
  if (i < 0) return {}
  return { previous: lessons[i - 1], next: lessons[i + 1] }
}

/** «11/14», как на обложке; если размер уровня неизвестен — просто номер. */
export function planLabel(meta: LessonMeta): string {
  const total = LEVEL_LESSONS[meta.level]
  return total ? `${meta.planLesson}/${total}` : String(meta.planLesson)
}

/** Ссылка на видео урока, а если её нет — на канал. */
export function videoLink(meta: LessonMeta, channel: string): string {
  return meta.youtubeUrl ?? channel
}

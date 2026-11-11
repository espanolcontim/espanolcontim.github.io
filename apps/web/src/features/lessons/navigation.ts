import { LEVEL_LESSONS, type LessonMeta } from '@espanolcontim/content'

/** Подразделы урока. */
export type LessonSection = 'notes' | 'extras' | 'practice'

/** Страница урока: обзор (выжимка) или подраздел. */
export type LessonPage = 'overview' | LessonSection

/** /lessons/a0-11/ или /lessons/a0-11/notes/ — со слешем на конце, как отдаёт хостинг. */
export function lessonPath(id: string, section?: LessonPage): string {
  return section && section !== 'overview' ? `/lessons/${id}/${section}/` : `/lessons/${id}/`
}

/**
 * Практический урок: без теории и новых слов, упражнения — прямо на его странице,
 * подразделов нет.
 */
export function isPractice(meta: LessonMeta): boolean {
  return meta.repeats !== undefined
}

/** Место в курсе: урок — по сквозному номеру, практика — сразу после урока, который закрывает. */
export function courseOrder(meta: LessonMeta): number {
  return meta.repeats ? meta.repeats.to + 0.5 : meta.number
}

/** Подразделы урока в порядке прохождения. Допматериалов у урока может не быть. */
export function lessonSections(meta: LessonMeta): LessonSection[] {
  if (isPractice(meta)) return []
  return meta.parts.extras ? ['notes', 'extras', 'practice'] : ['notes', 'practice']
}

/** Следующий шаг после этой страницы урока; после упражнений — ничего: дальше следующий урок. */
export function nextSection(meta: LessonMeta, page: LessonPage): LessonSection | undefined {
  const sections = lessonSections(meta)
  if (page === 'overview') return sections[0]
  const i = sections.indexOf(page)
  return i < 0 ? undefined : sections[i + 1]
}

/** Соседние уроки в порядке курса, практики — среди них. */
export function neighbours(
  lessons: LessonMeta[],
  id: string,
): { previous?: LessonMeta | undefined; next?: LessonMeta | undefined } {
  const i = lessons.findIndex((lesson) => lesson.id === id)
  if (i < 0) return {}
  return { previous: lessons[i - 1], next: lessons[i + 1] }
}

/** «11/14», как на обложке; если размер уровня неизвестен — просто номер. Не для практики. */
export function planLabel(meta: LessonMeta): string {
  const total = LEVEL_LESSONS[meta.level]
  return total ? `${meta.planLesson}/${total}` : String(meta.planLesson)
}

/** Ссылка на видео урока, а если её нет — на канал. */
export function videoLink(meta: LessonMeta, channel: string): string {
  return meta.youtubeUrl ?? channel
}

import { LEVELS, type LessonAddress } from './levels.ts'

/**
 * id контента. На id предложений держится прогресс повторения, поэтому они
 * постоянные: номера выдаёт импорт и хранит в content/ids.lock.json.
 *
 *   a0-11              урок: уровень + номер в уровне
 *   a0-11-s07          предложение урока
 *   a0-11-s07.order    упражнение на предложении
 *   a0-11-x05          упражнение допматериалов без предложения
 */

/** Упражнения, которые строятся на предложении. */
export const SENTENCE_EXERCISES = ['translate', 'order', 'fix'] as const
export type SentenceExercise = (typeof SENTENCE_EXERCISES)[number]

const LEVEL = `(?:${LEVELS.map((level) => level.toLowerCase()).join('|')})`
const LESSON = `${LEVEL}-\\d{2}`
const SENTENCE = `${LESSON}-s\\d{2,}`

export const LESSON_ID = new RegExp(`^${LESSON}$`)
export const SENTENCE_ID = new RegExp(`^${SENTENCE}$`)
export const EXERCISE_ID = new RegExp(
  `^(?:${SENTENCE}\\.(?:${SENTENCE_EXERCISES.join('|')})|${LESSON}-x\\d{2,})$`,
)

const pad = (n: number): string => String(n).padStart(2, '0')

/** Урок, он же адрес страницы: A0, урок 11 → «a0-11». */
export function lessonId({ level, planLesson }: LessonAddress): string {
  return `${level.toLowerCase()}-${pad(planLesson)}`
}

/** «a0-11», 7 → «a0-11-s07». */
export function sentenceId(lesson: string, n: number): string {
  return `${lesson}-s${pad(n)}`
}

/** «a0-11-s07», order → «a0-11-s07.order». */
export function sentenceExerciseId(sentence: string, type: SentenceExercise): string {
  return `${sentence}.${type}`
}

/** «a0-11», 5 → «a0-11-x05». */
export function extraExerciseId(lesson: string, n: number): string {
  return `${lesson}-x${pad(n)}`
}

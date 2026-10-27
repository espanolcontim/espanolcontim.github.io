import type { Access, Extras, Level } from '@espanolcontim/content'

/** Подписи интерфейса для уроков. */

export const LEVEL_NAMES: Record<Level, string> = {
  A0: 'подготовительный',
  A1: 'начальный',
  A2: 'базовый',
  B1: 'средний',
  B2: 'выше среднего',
}

export const SUBSCRIPTION = 'в подписке «Практика»'

export const ACCESS_NOTE: Record<Access, string | undefined> = {
  free: undefined,
  paid: SUBSCRIPTION,
}

/** Под плашкой закрытой части: где её взять, пока нет входа на сайт. */
export const LOCKED_HINT =
  'Вход на сайт для подписчиков Boosty скоро появится. Пока эти материалы выходят в PDF на Boosty.'

/**
 * Пометка подраздела «Упражнения»: в нём фразы урока и проверка после урока,
 * а доступ к ним может различаться.
 */
export function practiceNote(parts: Partial<Record<'practice' | 'quiz', Access>>) {
  const phrases = parts.practice === 'paid'
  const quiz = parts.quiz === 'paid'
  if (phrases && quiz) return SUBSCRIPTION
  if (phrases) return `фразы — ${SUBSCRIPTION}`
  if (quiz) return `проверка — ${SUBSCRIPTION}`
  return undefined
}

export const CULTURE_KINDS: Record<Extras['culture']['kind'], string> = {
  refrán: 'Пословица',
  trabalenguas: 'Скороговорка',
  fact: 'Интересный факт',
  song: 'Песня',
}

/** Знаки формулы правила — рисуются знаком, а не плашкой. */
const PATTERN_SIGNS = new Set(['+', '→', '='])

/** Элемент формулы правила: знак, место для подстановки по-русски или испанское слово. */
export function patternKind(item: string): 'sign' | 'slot' | 'word' {
  if (PATTERN_SIGNS.has(item)) return 'sign'
  return /[а-яё]/i.test(item) ? 'slot' : 'word'
}

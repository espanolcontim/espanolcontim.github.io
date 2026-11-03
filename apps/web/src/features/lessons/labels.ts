import type { Access, Extras, LessonMeta, Level } from '@espanolcontim/content'
import type { LessonPage, LessonSection } from './navigation.ts'

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

/** Под плашкой закрытой части: как её открыть. */
export const LOCKED_HINT = 'Подписчики Boosty входят на сайт по ссылке на почту из своего аккаунта.'

/** Под плашкой, если ученик вошёл, а подписка не активна. */
export const LAPSED_HINT =
  'Вы вошли на сайт, но подписка на Boosty сейчас не активна. Если вы только что её продлили, обновите страницу через минуту.'

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

/** Подразделы урока: название, короткое — для вкладки, и что внутри. */
export const SECTIONS: Record<LessonSection, { title: string; tab: string; text: string }> = {
  notes: {
    title: 'Конспект',
    tab: 'Конспект',
    text: 'Теория с транскрипцией, сводные таблицы, диалоги и новые слова.',
  },
  extras: {
    title: 'Дополнительные материалы',
    tab: 'Допматериалы',
    text: 'Живые выражения, мини-история, фразы с характером и «Испания изнутри».',
  },
  practice: {
    title: 'Упражнения',
    tab: 'Упражнения',
    text: 'Перевод фраз урока с автопроверкой и проверка после урока.',
  },
}

/** Вкладки урока: обзор и подразделы. */
export function tabTitle(page: LessonPage): string {
  return page === 'overview' ? 'Обзор' : SECTIONS[page].tab
}

/** Пометка подписки у подраздела; у «Упражнений» — что именно закрыто. */
export function sectionNote(meta: LessonMeta, section: LessonSection): string | undefined {
  const { parts } = meta
  if (section === 'practice') return practiceNote(parts)
  const access = parts[section]
  return access && ACCESS_NOTE[access]
}

/** Закрыт ли подраздел целиком: тогда у вкладки — замок. */
export function sectionLocked(meta: LessonMeta, section: LessonSection): boolean {
  const { parts } = meta
  if (section === 'practice') return parts.practice === 'paid' && parts.quiz === 'paid'
  return parts[section] === 'paid'
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

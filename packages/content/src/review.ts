import type { Verdict } from './answer.ts'

/**
 * Интервальное повторение (Repaso) по Лейтнеру. Единица — предложение.
 *
 * Фраза лежит в одной из пяти коробок; из коробки N она возвращается через
 * LEITNER_DAYS[N - 1] дней. Верно — в следующую коробку, «почти верно» —
 * остаётся в своей, ошибка — обратно в первую. Новая фраза — в первой,
 * то есть вернётся завтра.
 *
 * Дни — строки «2026-10-27» по местному времени ученика: повтор назначается
 * на день, а не на час, и сравнение строк — это сравнение дат.
 */

/** Через сколько дней фраза вернётся из коробки 1, 2, 3, 4, 5. */
export const LEITNER_DAYS = [1, 3, 7, 14, 30] as const

export const BOXES = LEITNER_DAYS.length

export interface ReviewCard {
  /** id предложения: a0-01-s03. */
  id: string
  /** Коробка, 1–5. */
  box: number
  /** День следующего повтора. */
  due: string
}

/** «2026-10-27» — день по местному времени. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** «2026-10-27» + 7 → «2026-11-03». Считается в UTC: переход на летнее время не сбивает. */
export function addDays(day: string, days: number): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

const daysIn = (box: number): number => LEITNER_DAYS[box - 1] ?? LEITNER_DAYS[0]

/** Новая фраза: первая коробка, вернётся завтра. */
export function newCard(id: string, today: string): ReviewCard {
  return { id, box: 1, due: addDays(today, daysIn(1)) }
}

/** Карточка после ответа. */
export function reviewCard(card: ReviewCard, verdict: Verdict, today: string): ReviewCard {
  const box =
    verdict === 'correct' ? Math.min(card.box + 1, BOXES) : verdict === 'almost' ? card.box : 1
  return { id: card.id, box, due: addDays(today, daysIn(box)) }
}

/** Пора повторить: день повтора сегодня или уже прошёл. */
export function isDue(card: ReviewCard, today: string): boolean {
  return card.due <= today
}

/** Фразы на сегодня: сначала давно просроченные, среди них — из младших коробок. */
export function dueCards(cards: Iterable<ReviewCard>, today: string): ReviewCard[] {
  return [...cards]
    .filter((card) => isDue(card, today))
    .toSorted((a, b) => a.due.localeCompare(b.due) || a.box - b.box || a.id.localeCompare(b.id))
}

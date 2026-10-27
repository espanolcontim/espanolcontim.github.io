import { addDays, LEITNER_DAYS } from '@espanolcontim/content'
import { plural } from '../../shared/plural.ts'

/** Подписи повторения. */

const NAMED: Record<number, string> = {
  1: 'через день',
  7: 'через неделю',
  14: 'через 2 недели',
  30: 'через месяц',
}

/** Когда вернётся фраза из коробки 1–5 — по LEITNER_DAYS. */
export const BOX_LABELS: readonly string[] = LEITNER_DAYS.map(
  (days) => NAMED[days] ?? `через ${plural(days, ['день', 'дня', 'дней'])}`,
)

/** «завтра», «3 ноября» — когда следующие фразы. */
export function dayLabel(day: string, today: string): string {
  if (day <= today) return 'сегодня'
  if (day === addDays(today, 1)) return 'завтра'
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, date)),
  )
}

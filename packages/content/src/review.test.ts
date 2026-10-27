import { describe, expect, it } from 'vitest'
import { addDays, dueCards, isDue, localDay, newCard, reviewCard, type ReviewCard } from './review.ts'

const card = (box: number, due = '2026-10-27', id = 'a0-01-s01'): ReviewCard => ({ id, box, due })

describe('addDays', () => {
  it('переходит через месяц, год и 29 февраля', () => {
    expect(addDays('2026-10-27', 1)).toBe('2026-10-28')
    expect(addDays('2026-10-27', 7)).toBe('2026-11-03')
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('не сбивается на переходе на летнее время', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })
})

describe('localDay', () => {
  it('берёт день по местному времени', () => {
    expect(localDay(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27')
    expect(localDay(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
  })
})

describe('Лейтнер', () => {
  const today = '2026-10-27'

  it('новая фраза — в первой коробке, вернётся завтра', () => {
    expect(newCard('a0-01-s03', today)).toEqual({ id: 'a0-01-s03', box: 1, due: '2026-10-28' })
  })

  it('верно — в следующую коробку: 1, 3, 7, 14, 30 дней', () => {
    expect([1, 2, 3, 4].map((box) => reviewCard(card(box), 'correct', today))).toEqual([
      card(2, '2026-10-30'),
      card(3, '2026-11-03'),
      card(4, '2026-11-10'),
      card(5, '2026-11-26'),
    ])
  })

  it('из пятой коробки дальше не уходит', () => {
    expect(reviewCard(card(5), 'correct', today)).toEqual(card(5, '2026-11-26'))
  })

  it('«почти верно» — остаётся в своей коробке', () => {
    expect(reviewCard(card(3), 'almost', today)).toEqual(card(3, '2026-11-03'))
  })

  it('ошибка — обратно в первую, завтра', () => {
    expect(reviewCard(card(4), 'wrong', today)).toEqual(card(1, '2026-10-28'))
  })
})

describe('dueCards', () => {
  const today = '2026-10-27'

  it('берёт сегодняшние и просроченные, сначала самые старые и из младших коробок', () => {
    const cards = [
      card(1, '2026-10-28', 'tomorrow'),
      card(3, '2026-10-27', 'today-3'),
      card(1, '2026-10-27', 'today-1'),
      card(2, '2026-10-20', 'overdue'),
    ]
    expect(dueCards(cards, today).map((c) => c.id)).toEqual(['overdue', 'today-1', 'today-3'])
    expect(isDue(card(1, '2026-10-28'), today)).toBe(false)
  })
})

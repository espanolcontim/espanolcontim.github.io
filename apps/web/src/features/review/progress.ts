import { BOXES, newCard, reviewCard, type ReviewCard, type Verdict } from '@espanolcontim/content'

/**
 * Прогресс ученика: карточки повторения и результаты наборов упражнений.
 * Хранится в браузере (ProgressRepository), переносится между устройствами
 * файлом — поэтому формат с версией, а чтение проверяет каждое поле.
 */

export interface SetResult {
  /** Лучший результат: верно и «почти верно». */
  best: number
  total: number
  /** Когда поставлен. */
  day: string
}

export interface Progress {
  version: 1
  /** id предложения → коробка и день повтора. */
  cards: Record<string, { box: number; due: string }>
  /** «a0-01/quiz», «a0-01/p2» → лучший результат набора. */
  results: Record<string, SetResult>
}

export const emptyProgress = (): Progress => ({ version: 1, cards: {}, results: {} })

/** Ключ результата: урок и набор. */
export const resultKey = (lessonId: string, setId: string): string => `${lessonId}/${setId}`

export function cardsOf(progress: Progress): ReviewCard[] {
  return Object.entries(progress.cards).map(([id, card]) => ({ id, ...card }))
}

/** Новые фразы — в повторение; уже добавленные не трогаем. */
export function addToReview(progress: Progress, ids: readonly string[], today: string): Progress {
  const fresh = ids.filter((id) => !Object.hasOwn(progress.cards, id))
  if (fresh.length === 0) return progress
  const cards = { ...progress.cards }
  for (const id of fresh) {
    const { box, due } = newCard(id, today)
    cards[id] = { box, due }
  }
  return { ...progress, cards }
}

/** Ответ в повторении двигает фразу по коробкам. */
export function recordReview(
  progress: Progress,
  id: string,
  verdict: Verdict,
  today: string,
): Progress {
  const current = progress.cards[id]
  const { box, due } = current ? reviewCard({ id, ...current }, verdict, today) : newCard(id, today)
  return { ...progress, cards: { ...progress.cards, [id]: { box, due } } }
}

/** Фраза на время недоступна (платная, а вход не выполнен): не теряем её, а откладываем. */
export function postpone(progress: Progress, ids: readonly string[], until: string): Progress {
  if (ids.length === 0) return progress
  const cards = { ...progress.cards }
  for (const id of ids) {
    const card = cards[id]
    if (card) cards[id] = { ...card, due: until }
  }
  return { ...progress, cards }
}

const share = (result: SetResult): number => (result.total > 0 ? result.best / result.total : 0)

/** Результат набора — запоминаем лучший. */
export function recordResult(progress: Progress, key: string, result: SetResult): Progress {
  const previous = progress.results[key]
  if (previous && share(previous) > share(result)) return progress
  return { ...progress, results: { ...progress.results, [key]: result } }
}

/**
 * Склейка прогресса с двух устройств: у фразы берём ту карточку, что
 * дальше продвинулась (коробка старше, при равных — повтор позже),
 * у набора — лучший результат.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const cards = { ...a.cards }
  for (const [id, card] of Object.entries(b.cards)) {
    const mine = cards[id]
    if (!mine || card.box > mine.box || (card.box === mine.box && card.due > mine.due)) {
      cards[id] = card
    }
  }
  let merged: Progress = { ...a, cards }
  for (const [key, result] of Object.entries(b.results)) merged = recordResult(merged, key, result)
  return merged
}

/** С какой доли верных ответов проверка после урока считается сданной. */
export const QUIZ_PASS = 0.8

/**
 * Отметка урока в списке: сдана проверка — галочка и результат, проверку
 * проходил, но не сдал — просто результат, решал упражнения — «начат».
 */
export function lessonMark(
  progress: Progress,
  lessonId: string,
): { state: 'done' | 'started'; text: string } | undefined {
  const quiz = progress.results[resultKey(lessonId, 'quiz')]
  if (quiz) {
    const text = `проверка ${quiz.best}/${quiz.total}`
    return quiz.best >= quiz.total * QUIZ_PASS
      ? { state: 'done', text: `✓ ${text}` }
      : { state: 'started', text }
  }
  const started =
    Object.keys(progress.results).some((key) => key.startsWith(`${lessonId}/`)) ||
    Object.keys(progress.cards).some((id) => id.startsWith(`${lessonId}-`))
  return started ? { state: 'started', text: 'начат' } : undefined
}

// --- чтение из хранилища и файла ---------------------------------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0

/** Проверяет прогресс из хранилища или файла. Чужой формат — undefined, битые записи пропускаются. */
export function parseProgress(raw: unknown): Progress | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.cards) || !isRecord(raw.results)) {
    return undefined
  }
  const progress = emptyProgress()
  for (const [id, card] of Object.entries(raw.cards)) {
    if (!isRecord(card) || typeof card.due !== 'string' || !DAY.test(card.due)) continue
    const { box } = card
    if (!isCount(box) || box < 1 || box > BOXES) continue
    progress.cards[id] = { box, due: card.due }
  }
  for (const [key, result] of Object.entries(raw.results)) {
    if (!isRecord(result) || typeof result.day !== 'string' || !DAY.test(result.day)) continue
    const { best, total } = result
    if (!isCount(best) || !isCount(total) || best > total) continue
    progress.results[key] = { best, total, day: result.day }
  }
  return progress
}

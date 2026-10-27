import type { Verdict } from '@espanolcontim/content'
import type { Task } from './sets.ts'

/** Ход сессии упражнений: ответы, итог, перемешивание плашек. */

export interface TaskResult {
  task: Task
  verdict: Verdict
  /** Что ответил ученик; пусто — «не знаю» или самопроверка. */
  given: string
  /** Верный ответ, с которым сравнили, — для разбора ошибок. */
  right: string
}

export interface Score {
  total: number
  correct: number
  almost: number
  wrong: number
}

export function score(results: readonly TaskResult[]): Score {
  const count = (verdict: Verdict) => results.filter((result) => result.verdict === verdict).length
  return {
    total: results.length,
    correct: count('correct'),
    almost: count('almost'),
    wrong: count('wrong'),
  }
}

/**
 * Перемешивает плашки так, чтобы порядок не совпал с исходным, — если это
 * вообще возможно (одно слово или одинаковые слова не перемешать).
 */
export function shuffle<T>(
  items: readonly T[],
  same: (a: T, b: T) => boolean = Object.is,
  random: () => number = Math.random,
): T[] {
  const result = [...items]
  const unchanged = () => result.every((item, i) => same(item, items[i] as T))
  if (items.every((item) => same(item, items[0] as T))) return result
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[result[i], result[j]] = [result[j] as T, result[i] as T]
    }
    if (!unchanged()) return result
  }
  // Не повезло десять раз подряд — просто сдвигаем по кругу.
  return [...items.slice(1), items[0] as T]
}

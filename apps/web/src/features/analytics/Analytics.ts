/**
 * Статистика посещений. Сейчас — Яндекс Метрика (YandexMetrika.ts); счётчик
 * грузится только после согласия посетителя (consent.ts, CookieBanner.astro).
 */
export interface Analytics {
  /** Аналитика есть на этом сайте: задан счётчик и страница открыта на боевом адресе. */
  enabled(): boolean
  /** Загрузить счётчик. Вызывать только после согласия; повторный вызов ничего не делает. */
  start(): void
  /** Отметить цель. До start() — ничего. */
  goal(goal: Goal): void
}

/**
 * Цели: те же идентификаторы заводятся в настройках счётчика
 * («Цели → JavaScript-событие»).
 */
export const GOALS = {
  /** Клик по ссылке на Boosty. */
  boosty: 'boosty',
  /** Пройден набор упражнений. */
  practiceDone: 'practice_done',
  /** Пройдена проверка после урока. */
  quizDone: 'quiz_done',
  /** Начато занятие повторения. */
  reviewStart: 'review_start',
} as const

export type Goal = (typeof GOALS)[keyof typeof GOALS]

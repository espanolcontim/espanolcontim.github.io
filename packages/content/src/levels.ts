/** Уровни курса — те же, что в video-lessons (`LEVELS` в source.ts). */
export const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2'] as const
export type Level = (typeof LEVELS)[number]

/** Адрес урока в плане курса: «A0, урок 11». */
export interface LessonAddress {
  level: Level
  /** Номер урока внутри уровня, с 1. */
  planLesson: number
}

import type { Task } from '../practice/sets.ts'

/** Фраза для повторения: задание и откуда она. */
export interface ReviewSentence {
  /** id предложения. */
  id: string
  task: Task
  /** «Урок 3». */
  lesson: string
}

/** Сколько фраз за одно занятие. */
export const BATCH = 20

export const PHRASES = ['фраза', 'фразы', 'фраз'] as const

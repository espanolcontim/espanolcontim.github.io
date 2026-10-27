import { GAP, type AnswerCheck, type Verdict } from '@espanolcontim/content'
import type { Task } from './sets.ts'

/** Ответ на задание, пока карточка открыта. */
export interface Answer {
  verdict: Verdict
  /** Что ответил ученик; пусто — «не знаю» или самопроверка. */
  given: string
  /** Перевод, «найдите ошибку», «собери фразу». */
  check?: AnswerCheck | undefined
}

/** Верный ответ для показа: совпавший вариант, эталон, фраза со вставленным словом, перевод. */
export function rightAnswer(task: Task, answer?: Answer): string {
  switch (task.kind) {
    case 'gap':
      return task.text.replace(GAP, `**${task.answer}**`)
    case 'read':
      return task.ru
    default:
      return answer?.check?.answer ?? task.answers[0] ?? ''
  }
}

/** Другие верные варианты — «можно и так». */
export function otherAnswers(task: Task, shown: string): string[] {
  return 'answers' in task ? task.answers.filter((answer) => answer !== shown) : []
}

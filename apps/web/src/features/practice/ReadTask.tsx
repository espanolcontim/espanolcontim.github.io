import { useEffect, useRef, useState } from 'react'
import type { Answer } from './answer.ts'
import styles from './practice.module.css'
import type { Task } from './sets.ts'

/**
 * Перевод на русский с самопроверкой: русский ответ автоматически не
 * проверить, поэтому ученик сверяется с переводом и отмечает себя сам.
 */
export function ReadTask({
  task,
  onAnswer,
}: {
  task: Extract<Task, { kind: 'read' }>
  onAnswer: (answer: Answer) => void
}) {
  const [shown, setShown] = useState(false)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => first.current?.focus(), [shown])

  if (!shown) {
    return (
      <div className={styles.actions}>
        <button ref={first} type="button" className="button" onClick={() => setShown(true)}>
          Показать перевод
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={styles.feedback}>
        <p className={styles.answer}>{task.ru}</p>
      </div>
      <p className="ru">Перевели так же по смыслу?</p>
      <div className={styles.actions}>
        <button
          ref={first}
          type="button"
          className="button"
          onClick={() => onAnswer({ verdict: 'correct', given: '' })}
        >
          Да
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => onAnswer({ verdict: 'wrong', given: '' })}
        >
          Нет
        </button>
      </div>
    </>
  )
}

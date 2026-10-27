import { useEffect, useRef, useState } from 'react'
import { rightAnswer, type Answer } from './answer.ts'
import { Feedback } from './Feedback.tsx'
import { GapTask } from './GapTask.tsx'
import { OrderTask } from './OrderTask.tsx'
import styles from './practice.module.css'
import { Question } from './Question.tsx'
import { ReadTask } from './ReadTask.tsx'
import type { TaskResult } from './session.ts'
import type { Task } from './sets.ts'
import { TextTask } from './TextTask.tsx'

/**
 * Одно задание: вопрос, ответ, результат и «Дальше». После ответа фокус
 * переходит на «Дальше» — Enter ведёт к следующему заданию.
 */
export function TaskCard({
  task,
  last,
  note,
  onNext,
}: {
  task: Task
  last: boolean
  /** Откуда задание: «Урок 3» — в повторении фразы из разных уроков. */
  note?: string | undefined
  onNext: (result: TaskResult) => void
}) {
  const [answer, setAnswer] = useState<Answer>()
  const next = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (answer) next.current?.focus()
  }, [answer])

  const finish = (result: Answer) =>
    onNext({ task, verdict: result.verdict, given: result.given, right: rightAnswer(task, result) })

  return (
    <div className={styles.card}>
      {note && <p className={styles.note}>{note}</p>}
      <Question task={task} />
      <TaskInput
        task={task}
        answer={answer}
        // Самопроверку ученик уже увидел — сразу к следующему.
        onAnswer={task.kind === 'read' ? finish : setAnswer}
      />
      <div aria-live="polite">{answer && <Feedback task={task} answer={answer} />}</div>
      {answer && (
        <div className={styles.actions}>
          <button ref={next} type="button" className="button" onClick={() => finish(answer)}>
            {last ? 'Итог' : 'Дальше →'}
          </button>
        </div>
      )}
    </div>
  )
}

function TaskInput({
  task,
  answer,
  onAnswer,
}: {
  task: Task
  answer: Answer | undefined
  onAnswer: (answer: Answer) => void
}) {
  switch (task.kind) {
    case 'translate':
    case 'fix':
      return <TextTask task={task} answer={answer} onAnswer={onAnswer} />
    case 'order':
      return <OrderTask task={task} answer={answer} onAnswer={onAnswer} />
    case 'gap':
      return <GapTask task={task} answer={answer} onAnswer={onAnswer} />
    case 'read':
      return <ReadTask task={task} onAnswer={onAnswer} />
  }
}

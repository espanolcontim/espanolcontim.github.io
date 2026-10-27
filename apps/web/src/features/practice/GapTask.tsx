import type { Answer } from './answer.ts'
import styles from './practice.module.css'
import type { Task } from './sets.ts'

/** «Вставьте слово»: выбор из вариантов, проверка — сразу по нажатию. */
export function GapTask({
  task,
  answer,
  onAnswer,
}: {
  task: Extract<Task, { kind: 'gap' }>
  answer: Answer | undefined
  onAnswer: (answer: Answer) => void
}) {
  const state = (option: string) => {
    if (!answer) return undefined
    if (option === task.answer) return 'right'
    return option === answer.given ? 'wrong' : undefined
  }

  return (
    <fieldset className={styles.options} disabled={answer !== undefined}>
      <legend className="visually-hidden">Варианты</legend>
      {task.options.map((option) => (
        <button
          key={option}
          type="button"
          className={styles.option}
          lang="es"
          data-state={state(option)}
          onClick={() =>
            onAnswer({ verdict: option === task.answer ? 'correct' : 'wrong', given: option })
          }
        >
          {option}
        </button>
      ))}
    </fieldset>
  )
}

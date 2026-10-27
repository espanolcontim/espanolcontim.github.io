import { useState } from 'react'
import styles from './practice.module.css'
import type { TaskResult } from './session.ts'
import type { PracticeSet, Task } from './sets.ts'
import { Summary } from './Summary.tsx'
import { TaskCard } from './TaskCard.tsx'

/** Прохождение набора: задания по одному, прогресс, в конце — итог. */
export function Session({ set, onClose }: { set: PracticeSet; onClose: () => void }) {
  // round меняется при «ещё раз» — карточки создаются заново.
  const [round, setRound] = useState({ tasks: set.tasks, n: 0 })
  const [results, setResults] = useState<TaskResult[]>([])
  const index = results.length
  const task = round.tasks[index]
  const total = round.tasks.length

  const repeat = (tasks: Task[]) => {
    setRound(({ n }) => ({ tasks, n: n + 1 }))
    setResults([])
  }

  return (
    <div className={styles.session}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onClose}>
          ← Все упражнения
        </button>
        <h2>{set.title}</h2>
        {task && (
          <div className={styles.progress}>
            <span>
              Задание {index + 1} из {total}
            </span>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.barFill} style={{ width: `${(index / total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      {task ? (
        <TaskCard
          key={`${round.n}:${index}`}
          task={task}
          last={index === total - 1}
          onNext={(result) => setResults((previous) => [...previous, result])}
        />
      ) : (
        <Summary set={set} results={results} onRepeat={repeat} onClose={onClose} />
      )}
    </div>
  )
}

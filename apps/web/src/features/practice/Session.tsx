import { useEffect, useState } from 'react'
import { addToReview, recordResult, resultKey } from '../review/progress.ts'
import { updateProgress } from '../review/useProgress.ts'
import styles from './practice.module.css'
import { score, type TaskResult } from './session.ts'
import { taskSentence, type PracticeSet, type Task } from './sets.ts'
import { Summary } from './Summary.tsx'
import { TaskCard } from './TaskCard.tsx'

/**
 * Прохождение набора: задания по одному, прогресс, в конце — итог.
 * Решённая фраза попадает в повторение; результат всего набора запоминается.
 */
export function Session({
  set,
  lessonId,
  onClose,
}: {
  set: PracticeSet
  lessonId: string
  onClose: () => void
}) {
  // round меняется при «ещё раз» — карточки создаются заново.
  const [round, setRound] = useState({ tasks: set.tasks, n: 0 })
  const [results, setResults] = useState<TaskResult[]>([])
  const index = results.length
  const task = round.tasks[index]
  const total = round.tasks.length

  const answered = (result: TaskResult) => {
    const sentence = taskSentence(result.task)
    if (sentence) updateProgress((progress, today) => addToReview(progress, [sentence], today))
    setResults((previous) => [...previous, result])
  }

  // Набор пройден целиком (не «повторить ошибки») — запоминаем результат.
  const complete = task === undefined && round.tasks === set.tasks
  useEffect(() => {
    if (!complete) return
    const { correct, almost } = score(results)
    updateProgress((progress, today) =>
      recordResult(progress, resultKey(lessonId, set.id), {
        best: correct + almost,
        total: results.length,
        day: today,
      }),
    )
  }, [complete, results, lessonId, set.id])

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
          onNext={answered}
        />
      ) : (
        <Summary set={set} results={results} onRepeat={repeat} onClose={onClose} />
      )}
    </div>
  )
}

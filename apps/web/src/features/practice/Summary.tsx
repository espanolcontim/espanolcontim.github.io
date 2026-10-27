import { useEffect, useRef } from 'react'
import { plural } from '../../shared/plural.ts'
import styles from './practice.module.css'
import { Mistakes } from './Mistakes.tsx'
import { score, type TaskResult } from './session.ts'
import type { PracticeSet, Task } from './sets.ts'

/** Итог сессии: сколько верно, разбор ошибок, повторить ошибки или всё заново. */
export function Summary({
  set,
  results,
  onRepeat,
  onClose,
}: {
  set: PracticeSet
  results: TaskResult[]
  onRepeat: (tasks: Task[]) => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const { total, correct, almost, wrong } = score(results)
  const failed = results.filter((result) => result.verdict === 'wrong').map((result) => result.task)

  // Итог появляется вместо карточки — переводим на него фокус и читалку.
  useEffect(() => root.current?.focus(), [])

  return (
    <div ref={root} className={styles.summary} tabIndex={-1} aria-labelledby="summary-title">
      <h3 id="summary-title">{set.kind === 'quiz' ? 'Результат проверки' : 'Готово'}</h3>
      <p>
        <span className={styles.score}>
          {correct + almost} из {total}
        </span>{' '}
        верно
      </p>
      <p className="ru">
        {almost > 0 &&
          `${plural(almost, ['ответ', 'ответа', 'ответов'])} — почти: не те знаки над буквами. `}
        {wrong > 0 ? `Ошибок: ${wrong}.` : 'Без ошибок!'}
      </p>

      <Mistakes results={results} />

      <div className={styles.actions}>
        {failed.length > 0 && (
          <button type="button" className="button" onClick={() => onRepeat(failed)}>
            Повторить ошибки
          </button>
        )}
        <button
          type="button"
          className={failed.length > 0 ? 'button button--ghost' : 'button'}
          onClick={() => onRepeat(set.tasks)}
        >
          Пройти ещё раз
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Все упражнения
        </button>
      </div>
    </div>
  )
}

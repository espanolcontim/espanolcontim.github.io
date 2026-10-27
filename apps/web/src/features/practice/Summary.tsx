import { useEffect, useRef } from 'react'
import { MarkedText } from '../../shared/ui/MarkedText.tsx'
import { plural } from '../../shared/plural.ts'
import styles from './practice.module.css'
import { Question } from './Question.tsx'
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
  const mistakes = results.filter((result) => result.verdict !== 'correct')
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

      {mistakes.length > 0 && (
        <section className={styles.group} aria-labelledby="review-title">
          <h4 id="review-title">Разбор ошибок</h4>
          <ol className={styles.review}>
            {mistakes.map(({ task, verdict, given, right }, i) => (
              <li key={i} className={styles.reviewItem} data-verdict={verdict}>
                <Question task={task} compact />
                {given !== '' && (
                  <p>
                    <span className="ru">Ваш ответ: </span>
                    <span className={styles.given} lang="es">
                      {given}
                    </span>
                  </p>
                )}
                <p>
                  <span className="ru">Правильно: </span>
                  <MarkedText text={right} lang={task.kind === 'read' ? undefined : 'es'} />
                </p>
                {'why' in task && task.why && <p className="ru">{task.why}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

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

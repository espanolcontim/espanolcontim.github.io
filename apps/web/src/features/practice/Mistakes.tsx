import { MarkedText } from '../../shared/ui/MarkedText.tsx'
import styles from './practice.module.css'
import { Question } from './Question.tsx'
import type { TaskResult } from './session.ts'

/** Разбор ошибок в итоге: задание, ответ ученика, правильный ответ и пояснение. */
export function Mistakes({ results }: { results: TaskResult[] }) {
  const mistakes = results.filter((result) => result.verdict !== 'correct')
  if (mistakes.length === 0) return null

  return (
    <section className={styles.group} aria-labelledby="mistakes-title">
      <h4 id="mistakes-title">Разбор ошибок</h4>
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
  )
}

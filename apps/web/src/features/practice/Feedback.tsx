import { MarkedText } from '../../shared/ui/MarkedText.tsx'
import { otherAnswers, rightAnswer, type Answer } from './answer.ts'
import styles from './practice.module.css'
import type { Task } from './sets.ts'

/** Результат задания: вердикт, верный ответ, другие варианты и пояснение. */
export function Feedback({ task, answer }: { task: Task; answer: Answer }) {
  const shown = rightAnswer(task, answer)
  const others = otherAnswers(task, shown)
  const ipa = 'ipa' in task && shown === task.answers[0] ? task.ipa : undefined
  const why = 'why' in task ? task.why : undefined

  return (
    <div className={styles.feedback} data-verdict={answer.verdict}>
      <p className={styles.verdict}>
        <Verdict answer={answer} />
      </p>
      {answer.verdict === 'almost' && answer.check && (
        <p>
          Проверьте знаки над буквами:{' '}
          {answer.check.accents.map((word, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <strong lang="es">{word}</strong>
            </span>
          ))}
        </p>
      )}
      <p className={styles.answer}>
        <MarkedText text={shown} lang="es" /> {ipa && <span className="ipa">[{ipa}]</span>}
      </p>
      {others.length > 0 && (
        <p className="ru">
          Можно и так:{' '}
          {others.map((other, i) => (
            <span key={other}>
              {i > 0 && '; '}
              <MarkedText text={other} lang="es" />
            </span>
          ))}
        </p>
      )}
      {why && <p>{why}</p>}
    </div>
  )
}

function Verdict({ answer }: { answer: Answer }) {
  switch (answer.verdict) {
    case 'correct':
      return <>✓ Верно</>
    case 'almost':
      return <>≈ Почти верно</>
    case 'wrong':
      if (answer.given === '') return <>Правильный ответ</>
      if (answer.check?.unchanged) return <>✗ Фраза не изменилась — ошибка осталась</>
      return <>✗ Неверно, правильно так</>
  }
}

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { plural } from '../../shared/plural.ts'
import { SUBSCRIPTION } from '../lessons/labels.ts'
import { REVIEW_PATH } from '../review/navigation.ts'
import { resultKey, type SetResult } from '../review/progress.ts'
import { useProgress } from '../review/useProgress.ts'
import styles from './practice.module.css'
import type { PracticeSet, SetKind } from './sets.ts'

export interface Locked {
  /** Фразы урока — в подписке. */
  phrases: boolean
  /** Упражнения из дополнительных материалов — в подписке. */
  extras: boolean
}

const PHRASES = ['фраза', 'фразы', 'фраз'] as const
const TASKS = ['задание', 'задания', 'заданий'] as const

/**
 * Список наборов: фразы урока, упражнения из дополнительных материалов,
 * проверка после урока. Набор — ссылка #id: без скрипта она ничего не
 * ломает, а тренажёр открывает набор сам (onOpen).
 */
export function SetList({
  lessonId,
  sets,
  locked,
  boosty,
  returnTo,
  onOpen,
}: {
  lessonId: string
  sets: PracticeSet[]
  locked: Locked
  boosty: string
  /** Набор, из которого вернулись: на его ссылку — фокус. */
  returnTo: string | undefined
  onOpen: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
}) {
  const of = (kind: SetKind) => sets.filter((set) => set.kind === kind)
  const phrases = of('phrases')
  const extras = of('extras')
  const quiz = of('quiz')[0]
  const back = useRef<HTMLAnchorElement>(null)
  const progress = useProgress()
  /** Лучший результат набора; появляется после загрузки прогресса. */
  const best = (set: PracticeSet) => progress?.results[resultKey(lessonId, set.id)]
  const quizBest = quiz && best(quiz)

  useEffect(() => back.current?.focus(), [])

  const link = (set: PracticeSet, className: string, children: ReactNode) => (
    <a
      ref={set.id === returnTo ? back : undefined}
      className={className}
      href={`#${set.id}`}
      onClick={(event) => onOpen(event, set.id)}
    >
      {children}
    </a>
  )

  return (
    <>
      <div className={styles.intro}>
        <p>
          Ответ проверяется сразу. Регистр и знаки препинания не важны, а если забыли знак над
          буквой, засчитаем как «почти верно» и подскажем, где.
        </p>
        <p className="ru">
          Буквы <span lang="es">á, é, ñ</span> и знаки <span lang="es">¿ ¡</span> — кнопками под
          полем ввода. Решённые фразы попадут в <a href={REVIEW_PATH}>повторение</a>: они вернутся
          завтра, а потом через несколько дней.
        </p>
      </div>

      {(phrases.length > 0 || locked.phrases) && (
        <section className={styles.group} aria-labelledby="practice-phrases">
          <h2 id="practice-phrases">Фразы урока</h2>
          <p className="ru">Переводите с русского на испанский — по группам, как в уроке.</p>
          {phrases.length > 0 ? (
            <ul className={styles.sets}>
              {phrases.map((set) => (
                <li key={set.id}>
                  {link(
                    set,
                    `card ${styles.set}`,
                    <>
                      <span className={styles.setTitle}>{set.title}</span>
                      <SetMeta count={plural(set.tasks.length, PHRASES)} best={best(set)} />
                    </>,
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <LockedNote boosty={boosty} inside="перевод фраз урока с автопроверкой" />
          )}
        </section>
      )}

      {(extras.length > 0 || locked.extras) && (
        <section className={styles.group} aria-labelledby="practice-extras">
          <h2 id="practice-extras">Из дополнительных материалов</h2>
          {extras.length > 0 ? (
            <ul className={styles.sets}>
              {extras.map((set) => (
                <li key={set.id}>
                  {link(
                    set,
                    `card ${styles.set}`,
                    <>
                      <span className={styles.setTitle}>{set.title}</span>
                      <SetMeta count={plural(set.tasks.length, TASKS)} best={best(set)} />
                    </>,
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <LockedNote
              boosty={boosty}
              inside="«найдите ошибку», «вставьте слово», перевод с испанского и на испанский"
            />
          )}
        </section>
      )}

      {quiz && (
        <section className={styles.group} aria-labelledby="practice-quiz">
          <h2 id="practice-quiz">{quiz.title}</h2>
          <div className={`card ${styles.quiz}`}>
            <p>
              {plural(quiz.tasks.length, TASKS)} по фразам урока. В конце — результат и разбор
              ошибок.
            </p>
            {quizBest && (
              <p className={styles.best}>
                Лучший результат: {quizBest.best} из {quizBest.total}
              </p>
            )}
            {link(quiz, 'button', 'Начать проверку')}
          </div>
        </section>
      )}
    </>
  )
}

function SetMeta({ count, best }: { count: string; best: SetResult | undefined }) {
  return (
    <span className="ru">
      {count}
      {best && (
        <span className={styles.best}>
          {' '}
          · ✓ {best.best} из {best.total}
        </span>
      )}
    </span>
  )
}

function LockedNote({ boosty, inside }: { boosty: string; inside: string }) {
  return (
    <div className={`card ${styles.locked}`}>
      <p className="pill pill--lock">
        <span aria-hidden="true">🔒 </span>
        {SUBSCRIPTION}
      </p>
      <p>Внутри — {inside}.</p>
      <a className="button button--ghost" href={boosty}>
        Подписка на Boosty
      </a>
    </div>
  )
}

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { plural } from '../../shared/plural.ts'
import { lessonPath } from '../lessons/navigation.ts'
import { PaidNotice } from '../lessons/PaidNotice.tsx'
import type { PaidNotReady } from '../lessons/usePaidBody.ts'
import { REVIEW_PATH } from '../review/navigation.ts'
import { resultKey, type SetResult } from '../review/progress.ts'
import { useProgress } from '../review/useProgress.ts'
import styles from './practice.module.css'
import type { PracticeSet, SetKind, TrainerPlace } from './sets.ts'

export interface Locked {
  /** Фразы урока — в подписке. */
  phrases: boolean
  /** Упражнения из дополнительных материалов — в подписке. */
  extras: boolean
}

const PHRASES = ['фраза', 'фразы', 'фраз'] as const
const TASKS = ['задание', 'задания', 'заданий'] as const

/**
 * Подписи списка: в подразделе «Упражнения» урока и на странице практики. На странице
 * практики заголовок групп фраз стоит над тренажёром (PracticeLesson.astro): там он
 * открывает весь блок упражнений, вместе с подсказкой, как проверяются ответы.
 */
const TEXT: Record<
  TrainerPlace,
  { phrases?: { title: string; lead: string } | undefined; quiz: string }
> = {
  lesson: {
    phrases: {
      title: 'Фразы урока',
      lead: 'Переводите с русского на испанский — по группам, как в уроке.',
    },
    quiz: 'по фразам урока',
  },
  practice: { quiz: 'вперемешку по всем темам практики' },
}

/** Что внутри закрытых наборов. */
const INSIDE = {
  phrases: 'перевод фраз урока с автопроверкой',
  extras: '«найдите ошибку», «вставьте слово», перевод с испанского и на испанский',
}

/**
 * Список наборов: фразы урока, упражнения из дополнительных материалов,
 * проверка после урока. Набор — ссылка #id: без скрипта она ничего не
 * ломает, а тренажёр открывает набор сам (onOpen).
 */
export function SetList({
  lessonId,
  place,
  sets,
  locked,
  paid,
  returnTo,
  onOpen,
}: {
  lessonId: string
  place: TrainerPlace
  sets: PracticeSet[]
  /** Что закрыто в бесплатной половине урока. Закрытый набор пришёл из API — ссылка на него. */
  locked: Locked
  /** Что показать вместо закрытого, которое не пришло. */
  paid: PaidNotReady
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
  const heading = TEXT[place].phrases

  useEffect(() => back.current?.focus(), [])

  const notice = (inside: string) => (
    <PaidNotice
      paid={paid}
      inside={inside}
      from={lessonPath(lessonId, place === 'practice' ? 'overview' : 'practice')}
    />
  )

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

      {locked.phrases && locked.extras && phrases.length === 0 && extras.length === 0 ? (
        // Закрыто всё, кроме проверки, — одна плашка вместо двух одинаковых.
        <section className={styles.group} aria-labelledby="practice-locked">
          <h2 id="practice-locked">Фразы урока и дополнительные материалы</h2>
          {notice(`${INSIDE.phrases}, ${INSIDE.extras}`)}
        </section>
      ) : (
        <>
          {(phrases.length > 0 || locked.phrases) && (
            <section
              className={styles.group}
              {...(heading
                ? { 'aria-labelledby': 'practice-phrases' }
                : { 'aria-label': 'Группы фраз' })}
            >
              {heading && (
                <>
                  <h2 id="practice-phrases">{heading.title}</h2>
                  <p className="ru">{heading.lead}</p>
                </>
              )}
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
                notice(INSIDE.phrases)
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
                notice(INSIDE.extras)
              )}
            </section>
          )}
        </>
      )}

      {quiz && (
        <section className={styles.group} aria-labelledby="practice-quiz">
          <h2 id="practice-quiz">{quiz.title}</h2>
          <div className={`card ${styles.quiz}`}>
            <p>
              {plural(quiz.tasks.length, TASKS)} {TEXT[place].quiz}. В конце — результат и разбор
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

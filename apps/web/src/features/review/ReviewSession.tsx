import { useEffect, useRef, useState } from 'react'
import { plural } from '../../shared/plural.ts'
import { Mistakes } from '../practice/Mistakes.tsx'
import practice from '../practice/practice.module.css'
import { score, shuffle, type TaskResult } from '../practice/session.ts'
import { TaskCard } from '../practice/TaskCard.tsx'
import { recordReview } from './progress.ts'
import { BATCH, PHRASES, type ReviewSentence } from './session.ts'
import { updateProgress } from './useProgress.ts'

/** Одно занятие: до BATCH фраз вперемешку, каждый ответ сразу двигает фразу по коробкам. */
export function ReviewSession({
  sentences,
  left,
  onMore,
  onClose,
}: {
  sentences: ReviewSentence[]
  /** Сколько ещё на сегодня — счётчик живой, ответы его уменьшают. */
  left: number
  onMore: () => void
  onClose: () => void
}) {
  // Фразы из разных уроков вперемешку.
  const [batch] = useState(() => shuffle(sentences, (a, b) => a.id === b.id))
  const [results, setResults] = useState<TaskResult[]>([])
  const index = results.length
  const current = batch[index]

  if (current) {
    return (
      <div className={practice.session}>
        <div className={practice.head}>
          <button type="button" className={practice.back} onClick={onClose}>
            ← Повторение
          </button>
          <div className={practice.progress}>
            <span>
              Фраза {index + 1} из {batch.length}
            </span>
            <div className={practice.bar} aria-hidden="true">
              <div
                className={practice.barFill}
                style={{ width: `${(index / batch.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <TaskCard
          key={`${current.id}:${index}`}
          task={current.task}
          note={current.lesson}
          last={index === batch.length - 1}
          onNext={(result) => {
            updateProgress((progress, today) =>
              recordReview(progress, current.id, result.verdict, today),
            )
            setResults((previous) => [...previous, result])
          }}
        />
      </div>
    )
  }

  return <Done results={results} left={left} onMore={onMore} onClose={onClose} />
}

function Done({
  results,
  left,
  onMore,
  onClose,
}: {
  results: TaskResult[]
  left: number
  onMore: () => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const { correct, almost, total } = score(results)

  // Итог появляется вместо карточки — переводим на него фокус и читалку.
  useEffect(() => root.current?.focus(), [])

  return (
    <div ref={root} className={practice.summary} tabIndex={-1} aria-labelledby="review-done">
      <h2 id="review-done">Готово</h2>
      <p>
        <span className={practice.score}>
          {correct + almost} из {total}
        </span>{' '}
        верно
      </p>
      <p className="ru">
        {left > 0
          ? `На сегодня осталось: ${plural(left, PHRASES)}.`
          : 'На сегодня всё — каждая фраза вернётся в свой день.'}
      </p>
      <Mistakes results={results} />
      <div className={practice.actions}>
        {left > 0 && (
          <button type="button" className="button" onClick={onMore}>
            Ещё {Math.min(left, BATCH)}
          </button>
        )}
        <button
          type="button"
          className={left > 0 ? 'button button--ghost' : 'button'}
          onClick={onClose}
        >
          {left > 0 ? 'Хватит на сегодня' : 'К повторению'}
        </button>
      </div>
    </div>
  )
}

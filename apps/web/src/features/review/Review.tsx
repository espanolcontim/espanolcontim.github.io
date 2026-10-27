import { addDays, BOXES, dueCards, localDay } from '@espanolcontim/content'
import { useEffect, useMemo, useState } from 'react'
import { analytics, progress as repository } from '../../app/browser.ts'
import { plural } from '../../shared/plural.ts'
import { GOALS } from '../analytics/Analytics.ts'
import practice from '../practice/practice.module.css'
import { BOX_LABELS, dayLabel } from './labels.ts'
import { cardsOf, postpone } from './progress.ts'
import styles from './review.module.css'
import { ReviewSession } from './ReviewSession.tsx'
import { BATCH, PHRASES, type ReviewSentence } from './session.ts'
import { Transfer } from './Transfer.tsx'
import { updateProgress, useProgress } from './useProgress.ts'

/**
 * Повторение (Repaso) — React-остров страницы /repaso/: сколько фраз на
 * сегодня, занятие порциями по BATCH, коробки Лейтнера, перенос прогресса.
 */
export default function Review({
  sentences,
  start,
}: {
  /** Все фразы, к которым у ученика есть доступ. */
  sentences: ReviewSentence[]
  /** Куда идти, если повторять пока нечего: упражнения первого урока. */
  start: string
}) {
  const progress = useProgress()
  const [today] = useState(() => localDay(new Date()))
  const [batch, setBatch] = useState<{ sentences: ReviewSentence[]; n: number }>()
  const byId = useMemo(
    () => new Map(sentences.map((sentence) => [sentence.id, sentence])),
    [sentences],
  )

  const { known, due, missing } = useMemo(() => {
    const cards = progress ? cardsOf(progress) : []
    const known = cards.filter((card) => byId.has(card.id))
    return {
      known,
      due: dueCards(known, today),
      missing: dueCards(cards, today)
        .filter((card) => !byId.has(card.id))
        .map((card) => card.id),
    }
  }, [progress, byId, today])

  // Фразы, которых здесь нет (платные без входа, исправленные в уроке), не висят
  // в счётчике вечно: откладываем на месяц, прогресс по ним не теряется.
  useEffect(() => {
    if (missing.length > 0) updateProgress((now) => postpone(now, missing, addDays(today, 30)))
  }, [missing, today])

  if (!progress) return null

  const begin = () => {
    analytics.goal(GOALS.reviewStart)
    setBatch((previous) => ({
      sentences: due.slice(0, BATCH).flatMap((card) => byId.get(card.id) ?? []),
      n: (previous?.n ?? 0) + 1,
    }))
  }

  if (batch) {
    return (
      <ReviewSession
        key={batch.n}
        sentences={batch.sentences}
        left={due.length}
        onMore={begin}
        onClose={() => setBatch(undefined)}
      />
    )
  }

  const next = known
    .map((card) => card.due)
    .filter((day) => day > today)
    .toSorted()[0]
  const boxes = Array.from(
    { length: BOXES },
    (_, i) => known.filter((card) => card.box === i + 1).length,
  )

  return (
    <div className={styles.review}>
      {!repository.available() && (
        <p className={`card ${styles.warning}`}>
          Браузер не даёт сайту сохранять данные — например, в режиме инкогнито. Повторение не
          запомнит ваши ответы.
        </p>
      )}

      <section className={`card ${styles.today}`} aria-labelledby="review-today">
        {known.length === 0 ? (
          <>
            <h2 id="review-today">Пока повторять нечего</h2>
            <p>
              Решайте упражнения к урокам — каждая решённая фраза попадёт сюда и вернётся завтра.
            </p>
            <a className="button" href={start}>
              Упражнения к уроку 1
            </a>
          </>
        ) : (
          <>
            <h2 id="review-today">На сегодня</h2>
            {due.length > 0 ? (
              <>
                <p className={practice.score}>{plural(due.length, PHRASES)}</p>
                <button type="button" className="button" onClick={begin}>
                  {due.length > BATCH ? `Начать: первые ${BATCH}` : 'Начать'}
                </button>
              </>
            ) : (
              <p>
                Всё повторено.
                {next && ` Следующие фразы — ${dayLabel(next, today)}.`}
              </p>
            )}
          </>
        )}
      </section>

      {known.length > 0 && (
        <section className={practice.group} aria-labelledby="review-boxes">
          <h2 id="review-boxes">Как идёт запоминание</h2>
          <p className="ru">
            В повторении {plural(known.length, PHRASES)}. Верный ответ отправляет фразу в следующую
            коробку — она вернётся позже, ошибка — обратно в первую.
          </p>
          <ol className={styles.boxes}>
            {boxes.map((count, i) => (
              <li key={i} className={styles.box}>
                <span className={styles.count}>{count}</span>
                <span className="ru">{BOX_LABELS[i]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Transfer />
    </div>
  )
}

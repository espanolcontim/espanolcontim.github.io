import { LESSON_ID } from '@espanolcontim/content'
import { useEffect, useState } from 'react'
import { paidLessons } from '../../app/browser.ts'
import { ApiFailure } from '../../shared/ApiClient.ts'
import { useSignedIn } from '../auth/useSignedIn.ts'
import { translateTask } from '../practice/sets.ts'
import type { ReviewSentence } from './session.ts'

/**
 * Платные фразы для повторения: страница /repaso/ собрана только из бесплатных, а подписчик
 * решал и платные. Загружаются те уроки, по которым такие фразы есть в его прогрессе.
 * @param lessons id уроков через запятую — строка, чтобы не перезагружать при каждом ответе
 * @param names подписи уроков: «Урок 2», «Практика 1»
 */
export function usePaidSentences(
  lessons: string,
  names: Record<string, string>,
): {
  sentences: ReviewSentence[]
  /** Пока не ясно, какие фразы доступны, — откладывать «потерянные» рано. */
  pending: boolean
} {
  const signedIn = useSignedIn()
  const [loaded, setLoaded] = useState<{ lessons: string; sentences: ReviewSentence[] }>()
  const active = signedIn && lessons !== ''

  useEffect(() => {
    if (!active) return
    let stale = false
    const ids = lessons.split(',').filter((id) => LESSON_ID.test(id))
    Promise.all(ids.map((id) => paidLessons.getBody(id).then((body) => ({ id, body }))))
      .then((bodies) => {
        if (stale) return
        const sentences = bodies.flatMap(({ id, body }) =>
          (body?.sentences ?? []).map((sentence) => ({
            id: sentence.id,
            task: translateTask(sentence),
            lesson: names[id] ?? '',
          })),
        )
        setLoaded({ lessons, sentences })
      })
      .catch((failure: unknown) => {
        // Подписка кончилась — фраз нет, как у гостя. Сбой сети ничего не значит:
        // остаёмся в pending, и расписание подписчика не сдвинется.
        if (!stale && failure instanceof ApiFailure && failure.code === 'not_subscribed') {
          setLoaded({ lessons, sentences: [] })
        }
      })
    return () => {
      stale = true
    }
  }, [active, lessons, names])

  const ready = loaded?.lessons === lessons
  return { sentences: active && ready ? loaded.sentences : [], pending: active && !ready }
}

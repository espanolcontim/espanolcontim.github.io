import type { LessonBody } from '@espanolcontim/content'
import { useEffect, useState } from 'react'
import { paidLessons } from '../../app/browser.ts'
import { ApiFailure } from '../../shared/ApiClient.ts'
import { useSignedIn } from '../auth/useSignedIn.ts'

/** Что с платной половиной урока у этого ученика. */
export type PaidBody =
  /** Не вошёл. */
  | { status: 'guest' }
  | { status: 'loading' }
  | { status: 'ready'; body: LessonBody }
  /** Вошёл, но подписка сейчас не активна. */
  | { status: 'lapsed' }
  /** Подписка есть, а файла в бакете нет. */
  | { status: 'missing' }
  /** Нет сети или сбой сервера. */
  | { status: 'failed'; retry: () => void }

export type PaidNotReady = Exclude<PaidBody, { status: 'ready' }>

const GUEST: PaidBody = { status: 'guest' }
const LOADING: PaidBody = { status: 'loading' }

/** Платная половина урока. `needed` — false, если у этого урока закрытого нет. */
export function usePaidBody(lessonId: string, needed = true): PaidBody {
  const signedIn = useSignedIn()
  const [attempt, setAttempt] = useState(0)
  // Результат с номером попытки: при новой попытке старый сам становится неактуальным.
  const [result, setResult] = useState<{ attempt: number; paid: PaidBody }>()
  const active = signedIn && needed

  useEffect(() => {
    if (!active) return
    let stale = false
    const done = (paid: PaidBody) => {
      if (!stale) setResult({ attempt, paid })
    }
    paidLessons.getBody(lessonId).then(
      (body) => done(body ? { status: 'ready', body } : { status: 'missing' }),
      (failure: unknown) => {
        const code = failure instanceof ApiFailure ? failure.code : 'internal'
        // invalid_token: репозиторий уже вышел, signedIn станет false — ученик снова гость.
        if (code === 'not_subscribed') done({ status: 'lapsed' })
        else if (code !== 'invalid_token') {
          done({ status: 'failed', retry: () => setAttempt((n) => n + 1) })
        }
      },
    )
    return () => {
      stale = true
    }
  }, [active, lessonId, attempt])

  if (!active) return GUEST
  return result?.attempt === attempt ? result.paid : LOADING
}

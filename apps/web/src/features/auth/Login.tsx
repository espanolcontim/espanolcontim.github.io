import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { auth } from '../../app/browser.ts'
import { LOGIN_CONSENT_PATH } from '../../app/legal.ts'
import { LINKS, SUBSCRIBE_PATH } from '../../app/links.ts'
import { ApiFailure } from '../../shared/ApiClient.ts'
import styles from './auth.module.css'
import { AFTER_LOGIN } from './navigation.ts'
import { useSignedIn } from './useSignedIn.ts'

type Stage =
  | { name: 'form'; notice?: string | undefined }
  | { name: 'sent'; email: string }
  | { name: 'verifying' }
  /** Ссылка могла быть хорошей, но сервер не ответил: можно повторить с тем же токеном. */
  | { name: 'unreachable' }

const NO_STORAGE =
  'Браузер не даёт сайту сохранять данные — например, в режиме инкогнито — поэтому вход не запомнится. Откройте сайт в обычном окне.'
const OFFLINE = 'Не удалось связаться с сайтом. Проверьте интернет и попробуйте ещё раз.'

const code = (failure: unknown) => (failure instanceof ApiFailure ? failure.code : 'internal')

const requestNotice = (failure: unknown) => {
  switch (code(failure)) {
    case 'bad_request':
      return 'Проверьте адрес почты: в нём опечатка.'
    case 'mail_failed':
      return 'Письмо не ушло. Попробуйте через несколько минут, а если не получится — напишите в личку на Boosty.'
    default:
      return OFFLINE
  }
}

/** Токен из письма: скрипт страницы входа сразу убирает его из адреса в history.state. */
const loginToken = () => (history.state as { loginToken?: string } | null)?.loginToken
const forgetToken = () => history.replaceState(null, '', location.pathname + location.search)

/**
 * Вход — React-остров страницы /login/: почта → «проверьте почту» → ссылка из письма → сессия.
 * Письмо ведёт сюда же, поэтому и форма, и обработчик ссылки — на одном адресе.
 */
export default function Login() {
  const signedIn = useSignedIn()
  const [token] = useState(loginToken)
  const [stage, setStage] = useState<Stage>(() => {
    if (!token) return { name: 'form' }
    // Сессию негде хранить — и обменивать ссылку незачем.
    return auth.available() ? { name: 'verifying' } : { name: 'form', notice: NO_STORAGE }
  })
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (stage.name !== 'verifying' || !token) return
    auth
      .signIn(token)
      .then((path) => {
        forgetToken()
        location.replace(path)
      })
      .catch((failure: unknown) => {
        switch (code(failure)) {
          case 'invalid_token':
            forgetToken()
            setStage({
              name: 'form',
              notice: 'Ссылка устарела: она действует 15 минут. Введите почту, и мы пришлём новую.',
            })
            break
          case 'not_subscribed':
            forgetToken()
            setStage({
              name: 'form',
              notice:
                'Подписка на Boosty сейчас не активна. Если вы только что её продлили, через минуту запросите ссылку ещё раз.',
            })
            break
          default:
            setStage({ name: 'unreachable' })
        }
      })
  }, [stage.name, token])

  // Экран сменился — фокус на заголовке: так смену слышат экранные читалки.
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) heading.current?.focus()
    first.current = false
  }, [stage.name])

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    setSending(true)
    try {
      const from = new URLSearchParams(location.search).get('from') ?? undefined
      await auth.requestLink(email.trim(), from)
      setStage({ name: 'sent', email: email.trim() })
    } catch (failure) {
      setStage({ name: 'form', notice: requestNotice(failure) })
    } finally {
      setSending(false)
    }
  }

  if (stage.name === 'verifying') {
    return <output className={`card ${styles.status}`}>Входим…</output>
  }

  if (stage.name === 'unreachable') {
    return (
      <div className={`card ${styles.box}`}>
        <h2 ref={heading} tabIndex={-1}>
          Не получилось войти
        </h2>
        <p role="alert">{OFFLINE}</p>
        <button type="button" className="button" onClick={() => setStage({ name: 'verifying' })}>
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (stage.name === 'sent') {
    return (
      <div className={`card ${styles.box}`}>
        <h2 ref={heading} tabIndex={-1}>
          Проверьте почту
        </h2>
        <p>Если {stage.email} есть среди подписчиков, письмо уже в пути.</p>
        <p className="ru">
          Не пришло за 5 минут — проверьте папку «Спам» и что эта почта указана в настройках Boosty,
          или напишите в <a href={LINKS.boosty}>личку на Boosty</a>.
        </p>
        <p className="ru">
          Откройте ссылку на этом устройстве и в этом браузере: вход запоминается там, где открыта
          ссылка.
        </p>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setStage({ name: 'form' })}
        >
          Ввести другую почту
        </button>
      </div>
    )
  }

  if (signedIn) {
    return (
      <div className={`card ${styles.box}`}>
        <h2 ref={heading} tabIndex={-1}>
          Вы вошли
        </h2>
        <p>Материалы подписки открыты на этом устройстве, пока подписка на Boosty активна.</p>
        <p className={styles.actions}>
          <a className="button" href={AFTER_LOGIN}>
            К урокам
          </a>
          <button type="button" className="button button--ghost" onClick={() => auth.signOut()}>
            Выйти
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.login}>
      <form className={`card ${styles.box}`} onSubmit={submit}>
        <h2 ref={heading} tabIndex={-1}>
          Войти по почте
        </h2>
        <p>
          Укажите почту из вашего аккаунта Boosty, и мы пришлём ссылку для входа. Входить нужно один
          раз на каждом устройстве.
        </p>
        <label className={styles.field}>
          Почта
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {stage.notice && (
          <p className={styles.notice} role="alert">
            {stage.notice}
          </p>
        )}
        {!auth.available() && !stage.notice && (
          <p className={styles.notice} role="alert">
            {NO_STORAGE}
          </p>
        )}
        <button type="submit" className="button" disabled={sending}>
          {sending ? 'Отправляем…' : 'Получить ссылку'}
        </button>
        <p className={`ru ${styles.consent}`}>
          Нажимая кнопку, вы даёте{' '}
          <a href={LOGIN_CONSENT_PATH}>согласие на обработку персональных данных</a>.
        </p>
      </form>
      <p className="ru">
        Ещё не подписаны? <a href={SUBSCRIBE_PATH}>Что входит в подписку</a>.
      </p>
    </div>
  )
}

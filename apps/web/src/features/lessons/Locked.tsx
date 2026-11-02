import { LINKS, SUBSCRIBE_PATH } from '../../app/links.ts'
import { loginPath } from '../auth/navigation.ts'
import { LAPSED_HINT, LOCKED_HINT, SUBSCRIPTION } from './labels.ts'
import styles from './Locked.module.css'

/** Закрытая часть урока: что внутри, где взять и как войти. */
export function Locked({
  inside,
  from,
  lapsed = false,
}: {
  /** Что внутри: «теория, таблицы, диалоги и новые слова». */
  inside: string
  /** Эта страница: сюда ученик вернётся после входа. */
  from: string
  /** Уже вошёл, но подписка не активна: войти ещё раз не поможет. */
  lapsed?: boolean
}) {
  return (
    <div className={`${styles.locked} card`}>
      <p className="pill pill--lock">{SUBSCRIPTION}</p>
      <p>Внутри — {inside}.</p>
      <p className="ru">
        {lapsed ? LAPSED_HINT : LOCKED_HINT} <a href={SUBSCRIBE_PATH}>Что входит в подписку</a>.
      </p>
      <p className={styles.actions}>
        <a className="button" href={LINKS.boosty}>
          Подписка на Boosty
        </a>
        {!lapsed && (
          <a className="button button--ghost" href={loginPath(from)}>
            Войти
          </a>
        )}
      </p>
    </div>
  )
}

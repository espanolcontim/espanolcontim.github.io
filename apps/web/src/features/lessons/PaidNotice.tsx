import { Locked } from './Locked.tsx'
import styles from './Locked.module.css'
import type { PaidNotReady } from './usePaidBody.ts'

/** Что показать вместо платной части, пока её нет: плашку, загрузку или ошибку. */
export function PaidNotice({
  paid,
  inside,
  from,
}: {
  paid: PaidNotReady
  inside: string
  from: string
}) {
  switch (paid.status) {
    case 'guest':
      return <Locked inside={inside} from={from} />
    case 'lapsed':
      return <Locked inside={inside} from={from} lapsed />
    case 'loading':
      return <output className={`${styles.status} card`}>Загружаем материалы подписки…</output>
    case 'missing':
      return <p className="card">Этих материалов на сайте пока нет — скоро добавим.</p>
    case 'failed':
      return (
        <div className={`${styles.locked} card`}>
          <p role="alert">
            Не удалось загрузить материалы подписки. Проверьте интернет и попробуйте ещё раз.
          </p>
          <button type="button" className="button" onClick={paid.retry}>
            Попробовать ещё раз
          </button>
        </div>
      )
  }
}

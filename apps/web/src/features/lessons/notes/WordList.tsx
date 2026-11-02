import { IpaText } from '../../../shared/ui/IpaText.tsx'
import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import styles from './WordList.module.css'

/**
 * Слова и фразы: испанский, транскрипция, перевод. На телефоне испанский
 * и транскрипция — одной строкой с переносом, перевод — под ними;
 * на широком экране — три колонки.
 */
export function WordList({
  rows,
  headers,
}: {
  rows: { es: string; ru: string; ipa?: string | undefined }[]
  headers?: { es: string; ru: string } | undefined
}) {
  return (
    <div>
      {headers && (
        <div className={styles.head} aria-hidden="true">
          <span>{headers.es}</span>
          <span>Произношение</span>
          <span>{headers.ru}</span>
        </div>
      )}
      <ul className={styles.rows}>
        {rows.map((row, i) => (
          <li key={i} className={styles.row}>
            <span className={styles.line}>
              <MarkedText text={row.es} lang="es" className="es" />
              <IpaText ipa={row.ipa} />
            </span>
            <MarkedText text={row.ru} className="ru" />
          </li>
        ))}
      </ul>
    </div>
  )
}

import type { NoteBlock } from '@espanolcontim/content'
import { IpaText } from '../../../shared/ui/IpaText.tsx'
import styles from './Conjugation.module.css'

/** Спряжение: местоимение, основа + окончание (выделено), транскрипция, перевод. */
export function Conjugation({ verb, ru, rows }: Extract<NoteBlock, { type: 'conjugation' }>) {
  return (
    <div>
      <h3>
        <span lang="es">{verb}</span> — {ru}
      </h3>
      <ul className={styles.rows}>
        {rows.map((row, i) => (
          <li key={i} className={styles.row}>
            <span className={styles.pronoun} lang="es">
              {row.pronoun}
            </span>
            <span>
              <span className={styles.form} lang="es">
                {row.stem}
                <strong className={styles.ending}>{row.ending}</strong>
              </span>{' '}
              <IpaText ipa={row.ipa} />
              <br />
              <span className="ru">{row.ru}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

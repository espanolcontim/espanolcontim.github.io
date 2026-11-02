import type { NoteBlock } from '@espanolcontim/content'
import { IpaText } from '../../../shared/ui/IpaText.tsx'
import styles from './ConjugationCompare.module.css'

/** Два спряжения рядом: местоимение и форма каждого глагола. */
export function ConjugationCompare({
  title,
  verbs,
  rows,
}: Extract<NoteBlock, { type: 'conjugationCompare' }>) {
  return (
    <div>
      <h3>{title}</h3>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- пустой угол таблицы */}
              <td></td>
              {verbs.map((verb, i) => (
                <th key={i} scope="col">
                  <span lang="es">{verb.verb}</span>
                  <span className="ru">{verb.ru}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <th scope="row" lang="es">
                  {row.pronoun}
                </th>
                {row.forms.map((form, j) => (
                  <td key={j}>
                    <span className={styles.form} lang="es">
                      {form.stem}
                      <strong className={styles.ending}>{form.ending}</strong>
                    </span>
                    <br />
                    <IpaText ipa={form.ipa} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

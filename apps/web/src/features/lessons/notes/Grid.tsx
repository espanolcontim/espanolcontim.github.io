import type { Grid as GridData } from '@espanolcontim/content'
import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import styles from './Grid.module.css'

/** Сводная таблица: подписи строк слева, в ячейке «es — ru». */
export function Grid({ title, columns, rows }: GridData) {
  return (
    <div>
      <h3>{title}</h3>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- пустой угол таблицы */}
              <td></td>
              {columns.map((column, i) => (
                <th key={i} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, j) => (
                  <td key={j}>
                    <MarkedText text={cell.es} lang="es" className="es" />
                    {cell.ru && (
                      <>
                        <br />
                        <MarkedText text={cell.ru} className="ru" />
                      </>
                    )}
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

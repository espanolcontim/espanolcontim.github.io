import type { NoteBlock } from '@espanolcontim/content'
import { IpaText } from '../../../shared/ui/IpaText.tsx'
import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import styles from './Compare.module.css'

const MARK = { wrong: '✗', right: '✓' } as const

/**
 * Сравнение в две колонки: ser / estar, «так не говорят / так говорят».
 * Пункты идут парами: левый напротив правого.
 */
export function Compare({ title, left, right }: Extract<NoteBlock, { type: 'compare' }>) {
  return (
    <div>
      <h3>{title}</h3>
      <div className={styles.sides}>
        {[left, right].map((side, i) => (
          <div key={i} className={`${styles.side} ${side.tone ? styles[side.tone] : ''}`}>
            <p className={styles.label}>
              {side.tone && <span aria-hidden="true">{MARK[side.tone]} </span>}
              {side.label}
            </p>
            <ul className={styles.items}>
              {side.items.map((item, j) => (
                <li key={j}>
                  <MarkedText text={item.es} lang="es" className="es" />
                  {item.ipa && (
                    <>
                      {' '}
                      <IpaText ipa={item.ipa} />
                    </>
                  )}
                  {item.ru && (
                    <>
                      <br />
                      <MarkedText text={item.ru} className="ru" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

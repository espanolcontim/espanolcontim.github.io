import type { NoteBlock } from '@espanolcontim/content'
import { IpaText } from '../../../shared/ui/IpaText.tsx'
import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import { patternKind } from '../labels.ts'
import styles from './Rule.module.css'

/** Правило: формула («quiero + инфинитив»), пояснение и примеры. */
export function Rule({ title, pattern, text, examples }: Extract<NoteBlock, { type: 'rule' }>) {
  return (
    <div className={`${styles.rule} card`}>
      <h3>{title}</h3>
      <p className={styles.pattern}>
        {pattern.map((item, i) => {
          const kind = patternKind(item)
          if (kind === 'sign') {
            return (
              <span key={i} className={styles.sign}>
                {item}
              </span>
            )
          }
          if (kind === 'slot') {
            return (
              <span key={i} className={styles.slot}>
                {item}
              </span>
            )
          }
          return (
            <span key={i} className={styles.word} lang="es">
              {item}
            </span>
          )
        })}
      </p>
      {text && <p className={styles.text}>{text}</p>}
      <ul className={styles.examples}>
        {examples.map((example, i) => (
          <li key={i}>
            <MarkedText text={example.es} lang="es" className="es" /> <IpaText ipa={example.ipa} />
            <br />
            <MarkedText text={example.ru} className="ru" />
          </li>
        ))}
      </ul>
    </div>
  )
}

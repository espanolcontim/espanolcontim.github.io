import type { NoteBlock } from '@espanolcontim/content'
import { Fragment } from 'react'
import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import styles from './Passage.module.css'

/**
 * Связный текст — рассказ, мини-история: испанский одним абзацем, перевод —
 * абзацем под ним, как на слайде и в полном PDF.
 */
export function Passage({ title, sentences }: Extract<NoteBlock, { type: 'text' }>) {
  const paragraph = (key: 'es' | 'ru') =>
    sentences.map((sentence, i) => (
      <Fragment key={i}>
        {i > 0 && ' '}
        <MarkedText text={sentence[key]} />
      </Fragment>
    ))

  return (
    <div>
      <h3>{title}</h3>
      <p lang="es" className={styles.es}>
        {paragraph('es')}
      </p>
      <p className={`ru ${styles.ru}`}>{paragraph('ru')}</p>
    </div>
  )
}

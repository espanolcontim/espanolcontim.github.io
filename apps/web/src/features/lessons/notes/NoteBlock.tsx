import type { NoteBlock as NoteBlockData } from '@espanolcontim/content'
import { Compare } from './Compare.tsx'
import { Conjugation } from './Conjugation.tsx'
import { ConjugationCompare } from './ConjugationCompare.tsx'
import styles from './NoteBlock.module.css'
import { Passage } from './Passage.tsx'
import { Rule } from './Rule.tsx'
import { WordList } from './WordList.tsx'

/** Блок теории конспекта — по типу. */
export function NoteBlock({ block }: { block: NoteBlockData }) {
  switch (block.type) {
    case 'words':
      return (
        <div>
          <h3 className={styles.title}>{block.title}</h3>
          <WordList rows={block.rows} headers={block.headers} />
        </div>
      )
    case 'rule':
      return <Rule {...block} />
    case 'conjugation':
      return <Conjugation {...block} />
    case 'conjugationCompare':
      return <ConjugationCompare {...block} />
    case 'compare':
      return <Compare {...block} />
    case 'text':
      return <Passage {...block} />
  }
}

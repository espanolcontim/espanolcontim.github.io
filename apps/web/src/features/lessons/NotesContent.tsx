import type { Notes } from '@espanolcontim/content'
import { Dialogue } from './notes/Dialogue.tsx'
import { Grid } from './notes/Grid.tsx'
import { NoteBlock } from './notes/NoteBlock.tsx'
import { WordList } from './notes/WordList.tsx'
import styles from './NotesContent.module.css'

/**
 * Конспект — как полный PDF: теория по разделам, сводные таблицы, диалоги,
 * новые слова, итог. Сверху — оглавление. Бесплатный рисуется при сборке,
 * платный — в браузере (PaidNotes.tsx).
 */
export function NotesContent({ notes }: { notes: Notes }) {
  const { sections, tables, dialogues, vocabulary, outcome } = notes
  const toc = [
    ...sections.map((section) => ({ id: section.id, title: section.title })),
    ...(tables.length > 0 ? [{ id: 'tables', title: 'Сводные таблицы' }] : []),
    ...(dialogues.length > 0 ? [{ id: 'dialogues', title: 'Диалоги' }] : []),
    ...(vocabulary.length > 0 ? [{ id: 'vocabulary', title: 'Новые слова' }] : []),
    ...(outcome ? [{ id: 'outcome', title: outcome.title }] : []),
  ]

  return (
    <>
      <nav className={`${styles.toc} card`} aria-labelledby="toc">
        <h2 id="toc">Оглавление</h2>
        <ol>
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.notes}>
        {sections.map((section) => (
          <section key={section.id} className={styles.section} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.title}</h2>
            {section.hint && <p className={styles.hint}>{section.hint}</p>}
            {section.blocks.map((block, i) => (
              <NoteBlock key={i} block={block} />
            ))}
          </section>
        ))}

        {tables.length > 0 && (
          <section className={styles.section} aria-labelledby="tables">
            <h2 id="tables">Сводные таблицы</h2>
            {tables.map((table, i) => (
              <Grid key={i} {...table} />
            ))}
          </section>
        )}

        {dialogues.length > 0 && (
          <section className={styles.section} aria-labelledby="dialogues">
            <h2 id="dialogues">Диалоги</h2>
            {dialogues.map((dialogue, i) => (
              <Dialogue key={i} {...dialogue} />
            ))}
          </section>
        )}

        {vocabulary.length > 0 && (
          <section className={styles.section} aria-labelledby="vocabulary">
            <h2 id="vocabulary">Новые слова</h2>
            <WordList rows={vocabulary} />
          </section>
        )}

        {outcome && (
          <section className={`${styles.section} ${styles.outcome} card`} aria-labelledby="outcome">
            <h2 id="outcome">{outcome.title}</h2>
            <ul>
              {outcome.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            <p className="ru">
              <strong>{outcome.next.title}:</strong> {outcome.next.text}
            </p>
          </section>
        )}
      </div>
    </>
  )
}

import { MarkedText } from '../../../shared/ui/MarkedText.tsx'
import styles from './Dialogue.module.css'

/** Диалог или история в репликах. Цвет говорящего — по порядку появления. */
export function Dialogue({
  title,
  lines,
}: {
  title?: string | undefined
  lines: { speaker?: string | undefined; es: string; ru: string }[]
}) {
  const speakers = [...new Set(lines.flatMap((line) => (line.speaker ? [line.speaker] : [])))]
  const color = (speaker: string) => styles[`speaker${(speakers.indexOf(speaker) % 3) + 1}`]

  return (
    <div>
      {title && <h3>{title}</h3>}
      <ul className={styles.lines}>
        {lines.map((line, i) => (
          <li key={i} className={styles.line}>
            {line.speaker && (
              <span className={`${styles.speaker} ${color(line.speaker)}`}>{line.speaker}</span>
            )}
            <span>
              <MarkedText text={line.es} lang="es" className="es" />
              <br />
              <MarkedText text={line.ru} className="ru" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

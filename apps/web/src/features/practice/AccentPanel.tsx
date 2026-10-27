import styles from './practice.module.css'

/** Буквы, которых нет на русской раскладке и не найти на телефоне. */
const KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'] as const

/**
 * Панель букв под полем ввода. Нажатие не уводит фокус из поля —
 * клавиатура телефона не прячется.
 */
export function AccentPanel({
  onInsert,
  disabled,
}: {
  onInsert: (letter: string) => void
  disabled: boolean
}) {
  return (
    <fieldset className={styles.panel} disabled={disabled}>
      <legend className="visually-hidden">Испанские буквы и знаки</legend>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.key}
          lang="es"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(key)}
        >
          {key}
        </button>
      ))}
    </fieldset>
  )
}

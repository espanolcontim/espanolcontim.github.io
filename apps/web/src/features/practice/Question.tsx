import { GAP } from '@espanolcontim/content'
import { MarkedText } from '../../shared/ui/MarkedText.tsx'
import styles from './practice.module.css'
import type { Task } from './sets.ts'

const LABELS: Record<Task['kind'], string> = {
  translate: 'Переведите на испанский',
  order: 'Соберите фразу',
  fix: 'Найдите и исправьте ошибку',
  gap: 'Вставьте слово',
  read: 'Переведите на русский',
}

/** Задание: что сделать и с чем. compact — в разборе ошибок, без подписи. */
export function Question({ task, compact = false }: { task: Task; compact?: boolean }) {
  return (
    <div className={styles.question}>
      {!compact && <p className={styles.label}>{LABELS[task.kind]}</p>}
      <p className={compact ? undefined : styles.prompt}>
        <Prompt task={task} />
      </p>
      {(task.kind === 'fix' || task.kind === 'gap') && task.ru && (
        <p className="ru">
          <MarkedText text={task.ru} />
        </p>
      )}
    </div>
  )
}

function Prompt({ task }: { task: Task }) {
  switch (task.kind) {
    case 'translate':
    case 'order':
      return (
        <>
          <MarkedText text={task.ru} />
          {task.hint && <span className={styles.hint}> ({task.hint})</span>}
        </>
      )
    case 'fix':
      return <MarkedText text={task.wrong} lang="es" />
    case 'gap': {
      const [before = '', after = ''] = task.text.split(GAP)
      return (
        <span lang="es">
          <MarkedText text={before} />
          <span className={styles.gap}>
            {' '}
            <span className="visually-hidden">пропуск</span>
          </span>
          <MarkedText text={after} />
        </span>
      )
    }
    case 'read':
      return <MarkedText text={task.es} lang="es" />
  }
}

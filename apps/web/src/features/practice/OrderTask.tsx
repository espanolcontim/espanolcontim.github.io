import { checkAnswer, orderTiles } from '@espanolcontim/content'
import { useState } from 'react'
import type { Answer } from './answer.ts'
import styles from './practice.module.css'
import { shuffle } from './session.ts'
import type { Task } from './sets.ts'

interface Tile {
  id: number
  text: string
}

/** «Собери фразу»: плашки из слов эталона, нажимаешь по порядку; нажатие в строке возвращает плашку. */
export function OrderTask({
  task,
  answer,
  onAnswer,
}: {
  task: Extract<Task, { kind: 'order' }>
  answer: Answer | undefined
  onAnswer: (answer: Answer) => void
}) {
  const [pool, setPool] = useState<Tile[]>(() =>
    shuffle(
      orderTiles(task.answers[0] ?? '').map((text, id) => ({ id, text })),
      (a, b) => a.text === b.text,
    ),
  )
  const [line, setLine] = useState<Tile[]>([])
  const done = answer !== undefined

  const move = (tile: Tile, from: Tile[], to: Tile[]): [Tile[], Tile[]] => [
    from.filter((item) => item.id !== tile.id),
    [...to, tile],
  ]
  const pick = (tile: Tile) => {
    const [nextPool, nextLine] = move(tile, pool, line)
    setPool(nextPool)
    setLine(nextLine)
  }
  const unpick = (tile: Tile) => {
    const [nextLine, nextPool] = move(tile, line, pool)
    setLine(nextLine)
    setPool(nextPool)
  }

  const submit = () => {
    const given = line.map((tile) => tile.text).join(' ')
    const check = checkAnswer(given, task.answers)
    onAnswer({ verdict: check.verdict, given, check })
  }

  const giveUp = () =>
    onAnswer({ verdict: 'wrong', given: '', check: checkAnswer('', task.answers) })

  return (
    <>
      <fieldset className={styles.line} disabled={done}>
        <legend className="visually-hidden">Ваша фраза</legend>
        {line.length === 0 && (
          <span className={styles.placeholder}>Нажимайте на слова по порядку</span>
        )}
        {line.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={styles.tile}
            lang="es"
            onClick={() => unpick(tile)}
          >
            {tile.text}
          </button>
        ))}
      </fieldset>
      {pool.length > 0 && (
        <fieldset className={styles.pool} disabled={done}>
          <legend className="visually-hidden">Слова</legend>
          {pool.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={styles.tile}
              lang="es"
              onClick={() => pick(tile)}
            >
              {tile.text}
            </button>
          ))}
        </fieldset>
      )}
      {!done && (
        <div className={styles.actions}>
          <button type="button" className="button" disabled={pool.length > 0} onClick={submit}>
            Проверить
          </button>
          <button type="button" className="button button--ghost" onClick={giveUp}>
            Не знаю
          </button>
        </div>
      )}
    </>
  )
}

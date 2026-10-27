import { checkAnswer } from '@espanolcontim/content'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { AccentPanel } from './AccentPanel.tsx'
import type { Answer } from './answer.ts'
import styles from './practice.module.css'
import type { Task } from './sets.ts'

type TextTaskKind = Extract<Task, { kind: 'translate' | 'fix' }>

/**
 * Ответ текстом: перевод на испанский или исправленная фраза.
 * Enter — проверить, панель букв — под полем.
 */
export function TextTask({
  task,
  answer,
  onAnswer,
}: {
  task: TextTaskKind
  answer: Answer | undefined
  onAnswer: (answer: Answer) => void
}) {
  const wrong = task.kind === 'fix' ? task.wrong : undefined
  // «Найдите ошибку»: фраза уже в поле — исправить проще, чем набрать заново.
  const [value, setValue] = useState(wrong ?? '')
  const field = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  useEffect(() => {
    const element = field.current
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [])

  const submit = () => {
    if (answer || value.trim() === '') return
    const check = checkAnswer(value, task.answers, { wrong })
    onAnswer({ verdict: check.verdict, given: value.trim(), check })
  }

  const giveUp = () =>
    onAnswer({ verdict: 'wrong', given: '', check: checkAnswer('', task.answers) })

  const insert = (letter: string) => {
    const element = field.current
    if (!element) return
    const { selectionStart: start, selectionEnd: end } = element
    setValue(value.slice(0, start) + letter + value.slice(end))
    const caret = start + letter.length
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(caret, caret)
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <>
      <label htmlFor={id} className="visually-hidden">
        {task.kind === 'fix' ? 'Исправленная фраза' : 'Перевод на испанский'}
      </label>
      <textarea
        ref={field}
        id={id}
        className={styles.input}
        lang="es"
        rows={2}
        value={value}
        readOnly={answer !== undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <AccentPanel onInsert={insert} disabled={answer !== undefined} />
      {!answer && (
        <div className={styles.actions}>
          <button type="button" className="button" disabled={value.trim() === ''} onClick={submit}>
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

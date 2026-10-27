import { localDay } from '@espanolcontim/content'
import { useRef, useState, type ChangeEvent } from 'react'
import { progress as repository } from '../../app/browser.ts'
import { plural } from '../../shared/plural.ts'
import { mergeProgress, parseProgress } from './progress.ts'
import styles from './review.module.css'
import { PHRASES } from './session.ts'

/**
 * Перенос прогресса между устройствами: файл скачивается на одном и
 * загружается на другом. Загрузка не затирает, а склеивает: у каждой фразы
 * остаётся то, что дальше продвинулось.
 */
export function Transfer() {
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')

  const download = () => {
    const blob = new Blob([JSON.stringify(repository.load(), null, 1)], {
      type: 'application/json',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `espanolcontim-progress-${localDay(new Date())}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let loaded
    try {
      loaded = parseProgress(JSON.parse(await file.text()))
    } catch {
      loaded = undefined
    }
    if (!loaded) {
      setStatus('Не получилось: это не файл прогресса с этого сайта.')
      return
    }
    repository.save(mergeProgress(repository.load(), loaded))
    setStatus(`Загружено: ${plural(Object.keys(loaded.cards).length, PHRASES)} в повторении.`)
  }

  return (
    <section className={styles.group} aria-labelledby="review-transfer">
      <h2 id="review-transfer">Перенос на другое устройство</h2>
      <p className="ru">
        Прогресс хранится в этом браузере. Чтобы заниматься на другом устройстве, скачайте файл
        здесь и загрузите его там — ответы с обоих устройств сложатся.
      </p>
      <div className={styles.actions}>
        <button type="button" className="button button--ghost" onClick={download}>
          Скачать файл прогресса
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => input.current?.click()}
        >
          Загрузить файл
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Файл прогресса"
          onChange={(event) => void upload(event)}
        />
      </div>
      <p className="ru">
        <output>{status}</output>
      </p>
    </section>
  )
}

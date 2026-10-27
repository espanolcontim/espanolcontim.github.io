import { localDay } from '@espanolcontim/content'
import { useEffect, useState } from 'react'
import { progress as repository } from '../../app/browser.ts'
import type { Progress } from './progress.ts'

/**
 * Прогресс для острова. До монтирования — undefined: при сборке страницы
 * хранилища нет, и разметка не должна от него зависеть.
 */
export function useProgress(): Progress | undefined {
  const [progress, setProgress] = useState<Progress>()
  useEffect(() => {
    const update = () => setProgress(repository.load())
    update()
    return repository.subscribe(update)
  }, [])
  return progress
}

/** Изменить прогресс: прочитать свежий, применить, сохранить. */
export function updateProgress(change: (progress: Progress, today: string) => Progress): void {
  const current = repository.load()
  const next = change(current, localDay(new Date()))
  if (next !== current) repository.save(next)
}

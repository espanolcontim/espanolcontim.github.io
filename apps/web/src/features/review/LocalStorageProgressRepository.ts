import { emptyProgress, parseProgress, type Progress } from './progress.ts'
import type { ProgressRepository } from './ProgressRepository.ts'

export const PROGRESS_KEY = 'espanolcontim:progress'
/** Событие на window: прогресс изменился в этой вкладке. */
const CHANGED = 'espanolcontim:progress'

/**
 * Прогресс в localStorage. Все обращения к хранилищу — в try/catch: без него
 * (приватный режим, запрет в настройках) сайт работает, просто ничего не помнит.
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly storage: () => Storage | undefined
  private readonly events: () => EventTarget | undefined
  // load() отдаёт тот же объект, пока строка в хранилище не изменилась.
  private cached: { raw: string | null; progress: Progress } | undefined

  /**
   * @param storage хранилище; функция — потому что сам доступ к localStorage может бросить
   * @param events куда слать и откуда слушать изменения; в браузере — window
   */
  constructor(storage: () => Storage | undefined, events: () => EventTarget | undefined) {
    this.storage = storage
    this.events = events
  }

  available(): boolean {
    try {
      const storage = this.storage()
      if (!storage) return false
      storage.setItem(`${PROGRESS_KEY}:test`, '1')
      storage.removeItem(`${PROGRESS_KEY}:test`)
      return true
    } catch {
      return false
    }
  }

  load(): Progress {
    let raw: string | null = null
    try {
      raw = this.storage()?.getItem(PROGRESS_KEY) ?? null
    } catch {
      raw = null
    }
    if (this.cached?.raw === raw) return this.cached.progress
    let progress: Progress | undefined
    try {
      progress = raw === null ? undefined : parseProgress(JSON.parse(raw))
    } catch {
      progress = undefined
    }
    this.cached = { raw, progress: progress ?? emptyProgress() }
    return this.cached.progress
  }

  save(progress: Progress): void {
    try {
      this.storage()?.setItem(PROGRESS_KEY, JSON.stringify(progress))
    } catch {
      // Не сохранилось — работаем дальше без памяти.
    }
    this.events()?.dispatchEvent(new Event(CHANGED))
  }

  subscribe(listener: () => void): () => void {
    const target = this.events()
    if (!target) return () => {}
    // storage — изменение из другой вкладки.
    const onStorage = (event: Event) => {
      if ((event as StorageEvent).key === PROGRESS_KEY) listener()
    }
    target.addEventListener(CHANGED, listener)
    target.addEventListener('storage', onStorage)
    return () => {
      target.removeEventListener(CHANGED, listener)
      target.removeEventListener('storage', onStorage)
    }
  }
}

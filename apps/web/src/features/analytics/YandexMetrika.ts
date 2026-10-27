import type { Analytics, Goal } from './Analytics.ts'

/** Функция ym из официального кода счётчика: до загрузки tag.js копит вызовы в a. */
type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number }

declare global {
  interface Window {
    ym?: Ym
  }
}

/** Скрипт счётчика — как в коде из настроек Метрики, с номером в адресе. */
export const metrikaScript = (id: number) => `https://mc.yandex.ru/metrika/tag.js?id=${id}`

/**
 * Яндекс Метрика. Состояние — на window (window.ym), а не в объекте: острова
 * и скрипты страниц собираются в разные бандлы, и экземпляров может быть несколько.
 */
export class YandexMetrika implements Analytics {
  private readonly id: number
  private readonly host: string
  private readonly window: () => Window | undefined

  /**
   * @param id номер счётчика; 0 — Метрики нет
   * @param host адрес сайта из сборки: на localhost и чужих адресах счётчик не грузится
   */
  constructor(id: number, host: string, window: () => Window | undefined) {
    this.id = id
    this.host = host
    this.window = window
  }

  enabled(): boolean {
    return this.id > 0 && this.window()?.location.hostname === this.host
  }

  start(): void {
    const window = this.window()
    if (!window || !this.enabled() || window.ym) return
    const ym: Ym = (...args) => {
      ;(ym.a ??= []).push(args)
    }
    ym.l = Date.now()
    window.ym = ym
    const script = window.document.createElement('script')
    script.async = true
    script.src = metrikaScript(this.id)
    window.document.head.append(script)
    // Параметры — как в коде из настроек счётчика, без электронной коммерции и Вебвизора.
    ym(this.id, 'init', {
      ssr: true,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
    })
  }

  goal(goal: Goal): void {
    this.window()?.ym?.(this.id, 'reachGoal', goal)
  }
}

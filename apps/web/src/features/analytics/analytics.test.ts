import { describe, expect, it } from 'vitest'
import { GOALS } from './Analytics.ts'
import { CONSENT_KEY, ConsentStore } from './consent.ts'
import { metrikaScript, YandexMetrika } from './YandexMetrika.ts'

/** Окно браузера — ровно столько, сколько трогает счётчик. */
function fakeWindow(hostname: string) {
  const scripts: { async?: boolean; src?: string }[] = []
  const window = {
    location: { hostname },
    document: {
      createElement: () => ({}),
      head: { append: (script: { src?: string }) => scripts.push(script) },
    },
  } as unknown as Window
  return { window, scripts }
}

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

describe('Яндекс Метрика', () => {
  it('только с номером счётчика и только на адресе сайта', () => {
    const site = fakeWindow('espanolcontim.github.io').window
    const local = fakeWindow('localhost').window
    expect(new YandexMetrika(123, 'espanolcontim.github.io', () => site).enabled()).toBe(true)
    expect(new YandexMetrika(0, 'espanolcontim.github.io', () => site).enabled()).toBe(false)
    expect(new YandexMetrika(123, 'espanolcontim.github.io', () => local).enabled()).toBe(false)
    expect(new YandexMetrika(123, 'espanolcontim.github.io', () => undefined).enabled()).toBe(false)
  })

  it('до start() — ни скрипта, ни целей', () => {
    const { window, scripts } = fakeWindow('localhost')
    const metrika = new YandexMetrika(123, 'espanolcontim.github.io', () => window)
    metrika.start()
    metrika.goal(GOALS.boosty)
    expect(scripts).toEqual([])
    expect(window.ym).toBeUndefined()
  })

  it('start() подключает скрипт один раз, цели копятся до его загрузки', () => {
    const { window, scripts } = fakeWindow('espanolcontim.github.io')
    const metrika = new YandexMetrika(123, 'espanolcontim.github.io', () => window)
    metrika.start()
    metrika.start()
    metrika.goal(GOALS.quizDone)
    expect(scripts).toEqual([{ async: true, src: metrikaScript(123) }])
    expect(window.ym?.a).toEqual([
      [
        123,
        'init',
        { ssr: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false },
      ],
      [123, 'reachGoal', 'quiz_done'],
    ])
  })

  it('второй экземпляр (другой бандл) видит уже запущенный счётчик', () => {
    const { window, scripts } = fakeWindow('espanolcontim.github.io')
    new YandexMetrika(123, 'espanolcontim.github.io', () => window).start()
    const other = new YandexMetrika(123, 'espanolcontim.github.io', () => window)
    other.start()
    other.goal(GOALS.reviewStart)
    expect(scripts).toHaveLength(1)
    expect(window.ym?.a?.at(-1)).toEqual([123, 'reachGoal', 'review_start'])
  })
})

describe('согласие', () => {
  it('нет решения, пока посетитель не нажал кнопку', () => {
    const storage = memoryStorage()
    const consent = new ConsentStore(() => storage)
    expect(consent.load()).toBeUndefined()
    consent.save('accepted')
    expect(consent.load()).toBe('accepted')
    consent.save('declined')
    expect(consent.load()).toBe('declined')
    storage.setItem(CONSENT_KEY, 'что-то')
    expect(consent.load()).toBeUndefined()
  })

  it('без хранилища — решения нет и ошибок нет', () => {
    const broken = new ConsentStore(() => {
      throw new DOMException('нельзя', 'SecurityError')
    })
    expect(broken.load()).toBeUndefined()
    expect(() => broken.save('accepted')).not.toThrow()
  })
})

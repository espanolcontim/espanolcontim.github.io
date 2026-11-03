import { describe, expect, it } from 'vitest'
import { hashEmail, isLoginSync, LOGIN_SYNC } from './subscribers.ts'

describe('hashEmail', () => {
  it('регистр и пробелы по краям не важны', () => {
    expect(hashEmail(' Tim@Yandex.RU ', 's')).toBe(hashEmail('tim@yandex.ru', 's'))
  })

  it('зависит от секрета и не содержит почты', () => {
    const hash = hashEmail('tim@yandex.ru', 's')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toBe(hashEmail('tim@yandex.ru', 'другой'))
  })
})

describe('isLoginSync', () => {
  it('вызов от api — объектом или строкой; таймер и тест в консоли — нет', () => {
    expect(isLoginSync(LOGIN_SYNC)).toBe(true)
    expect(isLoginSync(JSON.stringify(LOGIN_SYNC))).toBe(true)
    for (const event of [{}, { messages: [{ details: {} }] }, '', 'не json', null, undefined]) {
      expect(isLoginSync(event)).toBe(false)
    }
  })
})

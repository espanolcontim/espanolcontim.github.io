import { isLoginSync } from '@espanolcontim/functions-shared'
import { describe, expect, it } from 'vitest'
import { invokeSync } from './sync.ts'

describe('invokeSync', () => {
  it('вызывает функцию sync по id, с IAM-токеном и телом для входа', async () => {
    const requests: { url: string; init: RequestInit }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      return Response.json({ total: 1 })
    }) as typeof fetch

    await invokeSync('d4e123', 'iam-token', fetchFn)()

    expect(requests[0]?.url).toBe('https://functions.yandexcloud.net/d4e123?integration=raw')
    expect(requests[0]?.init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer iam-token', 'Content-Type': 'application/json' },
    })
    expect(isLoginSync(requests[0]?.init.body)).toBe(true)
  })

  it('sync упала — ошибка с кодом', async () => {
    const fetchFn = (async () =>
      new Response('{"errorMessage":"Boosty: 401"}', { status: 502 })) as typeof fetch
    await expect(invokeSync('d4e123', 'iam-token', fetchFn)()).rejects.toThrow(/sync: 502/)
  })
})

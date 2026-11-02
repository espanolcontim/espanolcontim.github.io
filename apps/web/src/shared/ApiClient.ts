/** Коды ошибок `functions/api` и `network` — ответа нет: нет интернета, сервер недоступен. */
const CODES = [
  'bad_request',
  'invalid_token',
  'not_subscribed',
  'not_found',
  'mail_failed',
  'internal',
  'network',
] as const
export type ApiFailureCode = (typeof CODES)[number]

export class ApiFailure extends Error {
  readonly code: ApiFailureCode

  constructor(code: ApiFailureCode) {
    super(code)
    this.name = 'ApiFailure'
    this.code = code
  }
}

const isCode = (value: unknown): value is ApiFailureCode =>
  (CODES as readonly unknown[]).includes(value)

/** Чуть дольше таймаута функции (30 секунд): письмо может отправляться долго. */
const TIMEOUT_MS = 35_000

/** Запросы к `functions/api`: тело и ответ — JSON, сессия — в `Authorization`, ошибки — ApiFailure. */
export class ApiClient {
  private readonly baseUrl: string
  private readonly fetch: typeof globalThis.fetch

  constructor(baseUrl: string, fetch: typeof globalThis.fetch) {
    this.baseUrl = baseUrl
    this.fetch = fetch
  }

  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    { token, body }: { token?: string; body?: unknown } = {},
  ): Promise<T> {
    let response: Response
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new ApiFailure('network')
    }
    const data: unknown = await response.json().catch(() => undefined)
    if (response.ok && data !== undefined) return data as T
    const code = (data as { error?: unknown } | undefined)?.error
    throw new ApiFailure(isCode(code) ? code : 'internal')
  }
}

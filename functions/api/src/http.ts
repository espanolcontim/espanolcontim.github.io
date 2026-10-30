/** Запрос и ответ без привязки к API Gateway: так `api` одинаково работает в облаке, на компьютере и в тестах. */
export interface ApiRequest {
  method: string
  path: string
  /** Имена заголовков — в нижнем регистре. */
  headers: Record<string, string | undefined>
  body: string
}

export interface ApiResponse {
  status: number
  headers: Record<string, string>
  body: string
}

/** Коды ошибок: тексты для учеников — на сайте. */
export type ApiError =
  | 'bad_request'
  | 'invalid_token'
  | 'not_subscribed'
  | 'not_found'
  | 'method_not_allowed'
  | 'mail_failed'
  | 'internal'

export const json = (status: number, data: unknown): ApiResponse => ({
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(data),
})

export const error = (status: number, code: ApiError): ApiResponse => json(status, { error: code })

/**
 * CORS: сайт и API на разных доменах. Разрешены только адреса из `allowedOrigins`;
 * остальным браузер ответ не покажет. Это не защита данных — её дают токены.
 */
export const corsHeaders = (
  origin: string | undefined,
  allowedOrigins: readonly string[],
): Record<string, string> =>
  origin && allowedOrigins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' }

export const preflight = (cors: Record<string, string>): ApiResponse => ({
  status: 204,
  headers: {
    ...cors,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  },
  body: '',
})

/** Токен из `Authorization: Bearer …`. */
export const bearer = (request: ApiRequest): string | undefined => {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')
  return match?.[1]
}

/** Тело запроса как JSON; `undefined` — не JSON. */
export const parseBody = (request: ApiRequest): unknown => {
  try {
    return JSON.parse(request.body)
  } catch {
    return undefined
  }
}

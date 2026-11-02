/**
 * Минимальный клиент Object Storage по протоколу S3: список, загрузка, удаление. Своя подпись
 * вместо SDK: для `content:upload` хватает 30 строк, а на компьютере нет AWS CLI, как на раннерах.
 */
import { createHash, createHmac } from 'node:crypto'

export interface S3Credentials {
  accessKeyId: string
  secretAccessKey: string
}

const REGION = 'ru-central1'
export const YANDEX_ENDPOINT = 'https://storage.yandexcloud.net'

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')
const hmac = (key: string | Uint8Array, data: string) =>
  createHmac('sha256', key).update(data).digest()

const encode = (text: string) =>
  encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )

/** Заголовок `Authorization` по AWS Signature V4. Заголовки — с именами в нижнем регистре. */
export function signature(request: {
  method: string
  url: URL
  /** Подписываемые заголовки, кроме host. */
  headers: Record<string, string>
  payloadHash: string
  /** `20130524T000000Z`. */
  amzDate: string
  credentials: S3Credentials
  region?: string
}): string {
  const { method, url, headers, payloadHash, amzDate, credentials } = request
  const region = request.region ?? REGION
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${region}/s3/aws4_request`

  const all = { ...headers, host: url.host }
  const names = Object.keys(all).toSorted()
  const canonicalHeaders = names
    .map((name) => `${name}:${all[name as keyof typeof all]?.trim()}\n`)
    .join('')
  const signedHeaders = names.join(';')
  const query = [...url.searchParams]
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .toSorted()
    .join('&')
  const canonical = [
    method,
    url.pathname,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const key = ['s3', 'aws4_request'].reduce(
    (current, part) => hmac(current, part),
    hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), region),
  )
  const signed = createHmac('sha256', key).update(toSign).digest('hex')
  return (
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signed}`
  )
}

/** Кавычки в ETag Object Storage пишет числом: `&#34;`. */
const unescapeXml = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]

export class S3Bucket {
  private readonly endpoint: string
  private readonly bucket: string
  private readonly credentials: S3Credentials
  private readonly fetch: typeof globalThis.fetch
  private readonly now: () => Date

  constructor(options: {
    endpoint: string
    bucket: string
    credentials: S3Credentials
    fetch: typeof globalThis.fetch
    now: () => Date
  }) {
    this.endpoint = options.endpoint
    this.bucket = options.bucket
    this.credentials = options.credentials
    this.fetch = options.fetch
    this.now = options.now
  }

  /** Файлы с этим началом ключа: ключ → ETag (MD5 содержимого). */
  async list(prefix: string): Promise<Map<string, string>> {
    const objects = new Map<string, string>()
    let token: string | undefined
    do {
      const query = new URLSearchParams({ 'list-type': '2', prefix })
      if (token) query.set('continuation-token', token)
      const xml = await (await this.request('GET', '', query)).text()
      for (const [, entry = ''] of xml.matchAll(/<Contents>(.*?)<\/Contents>/gs)) {
        const key = tag(entry, 'Key')
        const etag = tag(entry, 'ETag')
        if (key && etag) objects.set(unescapeXml(key), unescapeXml(etag).replaceAll('"', ''))
      }
      token = tag(xml, 'NextContinuationToken')
    } while (token)
    return objects
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.request('PUT', key, undefined, body, { 'content-type': contentType })
  }

  async delete(key: string): Promise<void> {
    await this.request('DELETE', key)
  }

  private async request(
    method: string,
    key: string,
    query?: URLSearchParams,
    body?: Uint8Array,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const path = key.split('/').map(encode).join('/')
    const url = new URL(`${this.endpoint}/${this.bucket}/${path}`)
    if (query) url.search = query.toString()
    const amzDate = this.now()
      .toISOString()
      .replace(/[-:]|\.\d{3}/g, '')
    const payloadHash = sha256(body ?? '')
    const signed = { ...headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
    const response = await this.fetch(url, {
      method,
      headers: {
        ...signed,
        Authorization: signature({
          method,
          url,
          headers: signed,
          payloadHash,
          amzDate,
          credentials: this.credentials,
        }),
      },
      ...(body ? { body: Buffer.from(body) } : {}),
    })
    if (!response.ok) {
      const text = await response.text()
      const code = tag(text, 'Code') ?? text.slice(0, 200)
      throw new Error(
        `Object Storage: ${method} ${key || this.bucket} → ${response.status} ${code}`,
      )
    }
    return response
  }
}

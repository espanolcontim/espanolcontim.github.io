import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * Приватный бакет: токены Boosty, кэш подписчиков, платные уроки.
 * В облаке — `BucketStorage`, на компьютере — `DirStorage` (папка `.bucket`), в тестах — `MemoryStorage`.
 */
export interface Storage {
  /** Содержимое файла; `null` — файла нет. */
  read(key: string): Promise<string | null>
  write(key: string, body: string): Promise<void>
}

/** JSON-файл из хранилища, проверенный схемой; `null` — файла нет. */
export const readJson = async <T>(
  storage: Storage,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> => {
  const raw = await storage.read(key)
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`${key}: не JSON`)
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error(`${key}: ${z.prettifyError(parsed.error)}`)
  return parsed.data
}

export const writeJson = (storage: Storage, key: string, data: unknown): Promise<void> =>
  storage.write(key, `${JSON.stringify(data, null, 2)}\n`)

const ENDPOINT = 'https://storage.yandexcloud.net'
/** Сколько раз пробовать запрос, если Object Storage ответил 5xx или не ответил. */
const ATTEMPTS = 3

/**
 * Бакет Object Storage через S3 API. Вход — IAM-токеном сервисного аккаунта функции
 * (`context.token`): с ним запросы не нужно подписывать, а ключи доступа не нужно хранить.
 */
export class BucketStorage implements Storage {
  private readonly bucket: string
  private readonly token: string
  private readonly fetch: typeof fetch

  constructor(bucket: string, token: string, fetchFn: typeof fetch = fetch) {
    this.bucket = bucket
    this.token = token
    this.fetch = fetchFn
  }

  async read(key: string): Promise<string | null> {
    const res = await this.request('GET', key)
    return res === null ? null : res.text()
  }

  async write(key: string, body: string): Promise<void> {
    await this.request('PUT', key, body)
  }

  /** `null` — у GET нет такого файла. Нет бакета — тоже 404, но это ошибка, а не «нет файла». */
  private async request(
    method: 'GET' | 'PUT',
    key: string,
    body?: string,
  ): Promise<Response | null> {
    const url = `${ENDPOINT}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8'
    let failure = ''
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await this.fetch(url, { method, headers, body })
        if (res.ok) return res
        const text = await res.text()
        if (method === 'GET' && res.status === 404 && text.includes('<Code>NoSuchKey</Code>')) {
          return null
        }
        failure = `${res.status} ${text.slice(0, 300)}`
        if (res.status < 500) break
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error)
      }
    }
    throw new Error(`Object Storage, ${method} ${this.bucket}/${key}: ${failure}`)
  }
}

/** Папка на компьютере вместо бакета: `npm run sync:local`. Файлы — только для владельца. */
export class DirStorage implements Storage {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async read(key: string): Promise<string | null> {
    try {
      return await readFile(join(this.root, key), 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async write(key: string, body: string): Promise<void> {
    const path = join(this.root, key)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    // Через временный файл: оборванная запись не оставит половину токенов.
    await writeFile(`${path}.tmp`, body, { mode: 0o600 })
    await rename(`${path}.tmp`, path)
  }
}

export class MemoryStorage implements Storage {
  readonly files = new Map<string, string>()

  async read(key: string): Promise<string | null> {
    return this.files.get(key) ?? null
  }

  async write(key: string, body: string): Promise<void> {
    this.files.set(key, body)
  }
}

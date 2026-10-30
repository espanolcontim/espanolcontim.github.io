import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { BucketStorage, DirStorage, MemoryStorage, readJson, writeJson } from './storage.ts'

describe('BucketStorage', () => {
  const recording = (responses: Response[]) => {
    const requests: { url: string; method: string; auth: string | null; body: unknown }[] = []
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        auth: new Headers(init?.headers).get('Authorization'),
        body: init?.body,
      })
      const next = responses.shift()
      if (!next) throw new Error('лишний запрос')
      return next
    }) as typeof fetch
    return { fetchFn, requests }
  }

  it('читает и пишет по S3 API с IAM-токеном', async () => {
    const { fetchFn, requests } = recording([new Response('{"a":1}'), new Response('')])
    const storage = new BucketStorage('private-bucket', 't1.token', fetchFn)

    expect(await storage.read('boosty/auth.json')).toBe('{"a":1}')
    await storage.write('subscribers.json', '{}')

    expect(requests).toEqual([
      {
        url: 'https://storage.yandexcloud.net/private-bucket/boosty/auth.json',
        method: 'GET',
        auth: 'Bearer t1.token',
        body: undefined,
      },
      {
        url: 'https://storage.yandexcloud.net/private-bucket/subscribers.json',
        method: 'PUT',
        auth: 'Bearer t1.token',
        body: '{}',
      },
    ])
  })

  const s3Error = (code: string) =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code></Error>`, {
      status: 404,
    })

  it('NoSuchKey — файла нет; NoSuchBucket — ошибка, и при записи тоже', async () => {
    const missing = recording([s3Error('NoSuchKey')])
    expect(await new BucketStorage('b', 't', missing.fetchFn).read('overrides.json')).toBeNull()

    const noBucket = recording([s3Error('NoSuchBucket')])
    await expect(new BucketStorage('b', 't', noBucket.fetchFn).read('x.json')).rejects.toThrow(
      /GET b\/x\.json: 404 [\s\S]*NoSuchBucket/,
    )
    const noBucketWrite = recording([s3Error('NoSuchBucket')])
    await expect(
      new BucketStorage('b', 't', noBucketWrite.fetchFn).write('x.json', '{}'),
    ).rejects.toThrow(/PUT b\/x\.json: 404/)
  })

  it('5xx — повторяет, 403 — сразу ошибка', async () => {
    const retried = recording([new Response('', { status: 503 }), new Response('ok')])
    expect(await new BucketStorage('b', 't', retried.fetchFn).read('x.json')).toBe('ok')

    const denied = recording([new Response('AccessDenied', { status: 403 })])
    await expect(new BucketStorage('b', 't', denied.fetchFn).read('x.json')).rejects.toThrow(
      /GET b\/x\.json: 403 AccessDenied/,
    )
  })
})

describe('DirStorage', () => {
  let root = ''
  afterEach(() => rm(root, { recursive: true, force: true }))

  it('нет файла — null; запись создаёт папки, файл только для владельца', async () => {
    root = await mkdtemp(join(tmpdir(), 'bucket-'))
    const storage = new DirStorage(root)

    expect(await storage.read('boosty/auth.json')).toBeNull()
    await storage.write('boosty/auth.json', '{"x":1}')

    expect(await readFile(join(root, 'boosty/auth.json'), 'utf8')).toBe('{"x":1}')
    expect((await stat(join(root, 'boosty/auth.json'))).mode & 0o777).toBe(0o600)
  })
})

describe('readJson', () => {
  const Schema = z.object({ n: z.number() })

  it('проверяет схемой и называет файл в ошибке', async () => {
    const storage = new MemoryStorage()
    await writeJson(storage, 'ok.json', { n: 1 })
    storage.files.set('bad.json', '{"n":"1"}')
    storage.files.set('broken.json', '{')

    expect(await readJson(storage, 'ok.json', Schema)).toEqual({ n: 1 })
    expect(await readJson(storage, 'missing.json', Schema)).toBeNull()
    await expect(readJson(storage, 'bad.json', Schema)).rejects.toThrow(/^bad\.json:/)
    await expect(readJson(storage, 'broken.json', Schema)).rejects.toThrow('broken.json: не JSON')
  })
})

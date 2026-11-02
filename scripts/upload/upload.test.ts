import { describe, expect, it } from 'vitest'
import { lessonFile, planUpload } from './plan.ts'
import { S3Bucket, signature } from './s3.ts'

const credentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}

const bytes = (data: unknown) => new TextEncoder().encode(JSON.stringify(data))

describe('подпись запроса', () => {
  it('совпадает с примером из документации AWS (GET Object)', () => {
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    const authorization = signature({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: {
        range: 'bytes=0-9',
        'x-amz-content-sha256': emptyHash,
        'x-amz-date': '20130524T000000Z',
      },
      payloadHash: emptyHash,
      amzDate: '20130524T000000Z',
      credentials,
      region: 'us-east-1',
    })
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    )
  })
})

describe('S3Bucket', () => {
  const bucket = (handler: (url: URL, init: RequestInit) => Response) => {
    const requests: { url: URL; init: RequestInit }[] = []
    const client = new S3Bucket({
      endpoint: 'https://storage.test',
      bucket: 'private',
      credentials,
      now: () => new Date('2026-11-02T12:00:00.500Z'),
      fetch: (async (url: URL, init: RequestInit) => {
        requests.push({ url, init })
        return handler(url, init)
      }) as typeof fetch,
    })
    return { client, requests }
  }

  it('список — все страницы, ETag без кавычек', async () => {
    const pages = [
      `<ListBucketResult><Contents><Key>lessons/a.json</Key><ETag>&quot;aaa&quot;</ETag></Contents>
       <NextContinuationToken>next</NextContinuationToken></ListBucketResult>`,
      `<ListBucketResult><Contents><Key>lessons/b.json</Key><ETag>"bbb"</ETag></Contents></ListBucketResult>`,
    ]
    const { client, requests } = bucket(() => new Response(pages.shift()))
    const list = await client.list('lessons/')
    expect([...list]).toEqual([
      ['lessons/a.json', 'aaa'],
      ['lessons/b.json', 'bbb'],
    ])
    expect(requests[0]?.url.search).toBe('?list-type=2&prefix=lessons%2F')
    expect(requests[1]?.url.searchParams.get('continuation-token')).toBe('next')
  })

  it('кавычки в ETag как в ответе Object Storage: &#34; — файл считается тем же', async () => {
    const xml = `<ListBucketResult><Contents><Key>lessons/a0-02.json</Key><Owner><ID>x</ID></Owner>
      <ETag>&#34;97c3874a4c65c579fb287d572ab13a47&#34;</ETag><Size>18822</Size></Contents></ListBucketResult>`
    const { client } = bucket(() => new Response(xml))
    const list = await client.list('lessons/')
    expect(list.get('lessons/a0-02.json')).toBe('97c3874a4c65c579fb287d572ab13a47')
  })

  it('загрузка — подписанный PUT с типом и хэшем тела', async () => {
    const { client, requests } = bucket(() => new Response(''))
    await client.put('lessons/a.json', bytes({ a: 1 }), 'application/json')
    const { url, init } = requests[0] ?? {}
    expect(String(url)).toBe('https://storage.test/private/lessons/a.json')
    expect(init?.method).toBe('PUT')
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-amz-date': '20261102T120000Z',
      Authorization: expect.stringContaining(
        'SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date',
      ),
    })
  })

  it('отказ — понятная ошибка с кодом', async () => {
    const { client } = bucket(
      () => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }),
    )
    await expect(client.delete('lessons/a.json')).rejects.toThrow(/403 AccessDenied/)
  })
})

describe('выгрузка платных уроков', () => {
  const lesson = { id: 'a0-02', sentences: [] }

  it('ключ — как читает api, id совпадает с именем файла', () => {
    const file = lessonFile('a0-02.json', bytes(lesson))
    expect(file.key).toBe('lessons/a0-02.json')
    expect(file.md5).toMatch(/^[0-9a-f]{32}$/)
    expect(() => lessonFile('a0-03.json', bytes(lesson))).toThrow(/внутри урок a0-02/)
  })

  it('битый файл не проходит', () => {
    expect(() => lessonFile('a0-02.json', bytes({ id: 'a0-02' }))).toThrow(/sentences/)
    expect(() => lessonFile('a0-02.json', new TextEncoder().encode('{нет'))).toThrow(SyntaxError)
  })

  it('ссылка на предложение, которого нет в файле, не проходит', () => {
    const practice = [{ name: 'Группа', sentenceIds: ['a0-02-s01'] }]
    expect(() => lessonFile('a0-02.json', bytes({ ...lesson, practice }))).toThrow(/a0-02-s01/)
  })

  it('загружает новое и изменённое, удаляет лишнее, не трогает совпавшее', () => {
    const same = lessonFile('a0-02.json', bytes(lesson))
    const changed = lessonFile('a0-03.json', bytes({ id: 'a0-03', sentences: [] }))
    const added = lessonFile('a0-04.json', bytes({ id: 'a0-04', sentences: [] }))
    const remote = new Map([
      [same.key, same.md5],
      [changed.key, 'старый'],
      ['lessons/a0-09.json', 'zzz'],
    ])
    const { upload, remove } = planUpload([same, changed, added], remote)
    expect(upload.map((file) => file.key)).toEqual([changed.key, added.key])
    expect(remove).toEqual(['lessons/a0-09.json'])
  })
})

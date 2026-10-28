import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { bucketFile, CACHE_IMMUTABLE, CACHE_REVALIDATE, deployPlan } from './bucket.ts'

const text = (s: string) => Buffer.from(s, 'utf8')

describe('bucketFile', () => {
  it('HTML — сжатый, с кодировкой и проверкой кэша', () => {
    const file = bucketFile('lessons/a0-01/index.html', text('<p>Hola</p>'))
    expect(file.contentType).toBe('text/html; charset=utf-8')
    expect(file.contentEncoding).toBe('gzip')
    expect(file.cacheControl).toBe(CACHE_REVALIDATE)
    expect(gunzipSync(file.body).toString('utf8')).toBe('<p>Hola</p>')
  })

  it('сжимает одинаково при каждом запуске — иначе каждый деплой перезаливал бы всё', () => {
    const a = bucketFile('index.html', text('<p>Hola</p>'))
    const b = bucketFile('index.html', text('<p>Hola</p>'))
    expect(a.md5).toBe(b.md5)
    expect(a.md5).toMatch(/^[0-9a-f]{32}$/)
  })

  it('файлы из _astro/ кэшируются навсегда, шрифты и картинки не сжимаются', () => {
    const font = bucketFile('_astro/manrope.Bx1.woff2', text('font'))
    expect(font.contentType).toBe('font/woff2')
    expect(font.cacheControl).toBe(CACHE_IMMUTABLE)
    expect(font.contentEncoding).toBeUndefined()
    expect(font.body.toString('utf8')).toBe('font')

    expect(bucketFile('_astro/tim.Ab2.avif', text('')).contentType).toBe('image/avif')
    expect(bucketFile('_astro/app.Cd3.js', text('')).contentEncoding).toBe('gzip')
  })

  it('значки и sitemap вне _astro/ — с проверкой кэша', () => {
    expect(bucketFile('favicon.ico', text('')).cacheControl).toBe(CACHE_REVALIDATE)
    expect(bucketFile('sitemap.xml', text('')).contentEncoding).toBe('gzip')
  })

  it('неизвестный тип — ошибка, а не application/octet-stream', () => {
    expect(() => bucketFile('docs/plan.pdf', text(''))).toThrow(/\.pdf/)
    expect(() => bucketFile('CNAME', text(''))).toThrow(/CNAME/)
  })
})

describe('deployPlan', () => {
  const page = bucketFile('index.html', text('<p>1</p>'))
  const style = bucketFile('_astro/index.A1.css', text('p{}'))
  const icon = bucketFile('favicon.png', text('png'))

  it('загружает новое и изменённое, неизменённое пропускает, лишнее удаляет', () => {
    const remote = new Map([
      ['index.html', 'старый'],
      ['_astro/index.A1.css', style.md5],
      ['_astro/index.Z9.css', 'x'],
    ])
    const plan = deployPlan([page, style, icon], remote)
    expect(plan.upload.flat().map((f) => f.key)).toEqual(['favicon.png', 'index.html'])
    expect(plan.remove).toEqual(['_astro/index.Z9.css'])
    expect(plan.unchanged).toBe(1)
  })

  it('сначала _astro/, потом прочее, HTML — последним', () => {
    const plan = deployPlan([page, icon, style], new Map())
    expect(plan.upload.map((queue) => queue.map((f) => f.key))).toEqual([
      ['_astro/index.A1.css'],
      ['favicon.png'],
      ['index.html'],
    ])
  })

  it('force загружает всё, даже неизменённое', () => {
    const remote = new Map([[page.key, page.md5]])
    const plan = deployPlan([page], remote, true)
    expect(plan.upload).toEqual([[page]])
    expect(plan.unchanged).toBe(0)
  })

  it('ничего не изменилось — пустые очереди', () => {
    const plan = deployPlan([page], new Map([[page.key, page.md5]]))
    expect(plan).toEqual({ upload: [], remove: [], unchanged: 1 })
  })
})

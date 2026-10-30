/**
 * `api` на этом компьютере: `npm run api:local` → http://localhost:8787. Для разработки входа на сайте.
 *
 *   --subscriber <почта>   считать эту почту активным платным подписчиком (Boosty id 1):
 *                          платных подписчиков пока нет, а вход проверить нужно
 *   --send                 отправлять письма по-настоящему (SMTP из .env); без него ссылка
 *                          для входа печатается здесь, в консоли
 *
 * Бакет — папка `.bucket` (кэш подписчиков — от `npm run sync:local`), платные уроки —
 * прямо из `content/private/lessons`. Секреты — из `.env`. Сайт — http://localhost:4321.
 */
import { createServer } from 'node:http'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  DirStorage,
  hashEmail,
  requireEnv,
  SUBSCRIBERS_KEY,
  type Storage,
} from '@espanolcontim/functions-shared'
import { createApi } from './api.ts'
import { SmtpMailer, type Mailer } from './mailer.ts'

const PORT = 8787
const SITE = 'http://localhost:4321'
const ROOT = join(import.meta.dirname, '..', '..', '..')
process.loadEnvFile(join(ROOT, '.env'))

const { values: args } = parseArgs({
  options: { subscriber: { type: 'string' }, send: { type: 'boolean', default: false } },
})
const emailHashSecret = requireEnv('EMAIL_HASH_SECRET')

const bucket = new DirStorage(join(ROOT, '.bucket'))
const privateContent = new DirStorage(join(ROOT, 'content', 'private'))
const storage: Storage = {
  async read(key) {
    if (key.startsWith('lessons/')) return privateContent.read(key)
    const body = await bucket.read(key)
    if (key !== SUBSCRIBERS_KEY || !args.subscriber) return body
    const cache = body ? JSON.parse(body) : { updatedAt: new Date().toISOString(), subscribers: [] }
    cache.subscribers.push({
      id: 1,
      emailHash: hashEmail(args.subscriber, emailHashSecret),
      level: 'тест',
    })
    return JSON.stringify(cache)
  },
  write: (key, body) => bucket.write(key, body),
}

const printMailer: Mailer = {
  async send(letter) {
    console.log(`\nПисьмо для ${letter.to}:\n${letter.text}\n`)
  },
}

const api = createApi({
  storage,
  mailer: args.send
    ? new SmtpMailer(requireEnv('SMTP_USER'), requireEnv('SMTP_PASSWORD'))
    : printMailer,
  now: Date.now,
  sessionSecret: requireEnv('SESSION_SECRET'),
  emailHashSecret,
  siteUrl: SITE,
  allowedOrigins: [SITE],
})

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.join(', ') : value,
    ]),
  )
  const response = await api({
    method: req.method ?? 'GET',
    path: new URL(req.url ?? '/', 'http://localhost').pathname,
    headers,
    body: Buffer.concat(chunks).toString('utf8'),
  })
  res.writeHead(response.status, response.headers).end(response.body)
}).listen(PORT, () => {
  console.log(`api: http://localhost:${PORT}`)
  if (args.subscriber) console.log(`подписчик для проверки: ${args.subscriber}`)
  console.log(args.send ? 'письма отправляются по-настоящему' : 'письма печатаются здесь')
})

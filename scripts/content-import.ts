/**
 * Импорт контента из ../video-lessons (только чтение):
 *
 *   npm run content:import                все уроки
 *   npm run content:import -- 1 8 11      только эти (сквозные номера уроков)
 *   npm run content:import -- --check     проверить и собрать, ничего не записывая
 *
 * Путь к источнику — CONTENT_SOURCE (по умолчанию ../video-lessons).
 *
 * Каждый запуск пересобирает content/public и content/private целиком: на
 * сайте ровно те уроки, что импортированы этим запуском. id предложений
 * берутся из content/ids.lock.json и дописываются туда, ссылки на видео —
 * из content/videos.json. Если хоть один файл не прошёл проверку, ничего
 * не записывается.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  ContentIndexSchema,
  LessonBodySchema,
  lessonId,
  mergeLessonBodies,
  missingSentences,
  VideosSchema,
  type Access,
  type LessonBody,
  type LessonMeta,
  type Part,
  type Videos,
} from '@espanolcontim/content'
import type { z } from 'zod'
import { convertLesson, type ConvertedLesson } from './import/convert.ts'
import { lessonIds, readLock, writeLock, type LessonIds } from './import/ids.ts'
import { ExtraSourceSchema, LessonSourceSchema, type LessonSource } from './import/source.ts'
import { lessonAccess, lessonMeta, splitLesson } from './import/split.ts'
import { ipaLookup } from './import/vocabulary.ts'

const ROOT = join(import.meta.dirname, '..')
const SOURCE = resolve(ROOT, process.env.CONTENT_SOURCE ?? '../video-lessons')
const CONTENT = join(ROOT, 'content')
const PUBLIC = join(CONTENT, 'public')
const PRIVATE = join(CONTENT, 'private')
const LOCK = join(CONTENT, 'ids.lock.json')
const VIDEOS = join(CONTENT, 'videos.json')

const FILE = /^lesson-(\d+)\.json$/

const PART_LABELS: Record<Part, string> = {
  summary: 'выжимка',
  notes: 'конспект',
  practice: 'упражнения',
  extras: 'допматериалы',
  quiz: 'проверка',
}
const ACCESS_LABELS: Record<Access, string> = { free: 'бесплатно', paid: 'по подписке' }

// --- чтение -------------------------------------------------------------------------

/** slides[12].rows[0].ipa */
const formatPath = (path: PropertyKey[]): string =>
  path
    .map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i > 0 ? '.' : ''}${String(key)}`))
    .join('')

function readJson(file: string, errors: string[]): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    errors.push(
      `${relative(ROOT, file)}: не JSON — ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
}

function validate<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  where: string,
  errors: string[],
): T | undefined {
  const result = schema.safeParse(raw)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    errors.push(
      `${where}${issue.path.length > 0 ? ` → ${formatPath(issue.path)}` : ''}: ${issue.message}`,
    )
  }
  return undefined
}

/** lessons/ или extras/ источника: номер → файл, номер в файле сверяется с именем. */
function readSource<T extends { number: number }>(
  dir: 'lessons' | 'extras',
  schema: z.ZodType<T>,
  errors: string[],
): Map<number, T> {
  const out = new Map<number, T>()
  const path = join(SOURCE, dir)
  if (!existsSync(path)) return out
  for (const name of readdirSync(path).sort()) {
    const number = FILE.exec(name)?.[1]
    if (!number) continue
    const where = `${dir}/${name}`
    const raw = readJson(join(path, name), errors)
    const data = raw === undefined ? undefined : validate(schema, raw, where, errors)
    if (!data) continue
    if (data.number !== Number(number)) {
      errors.push(`${where}: number = ${data.number}, а имя файла обещает ${Number(number)}`)
      continue
    }
    out.set(data.number, data)
  }
  return out
}

// --- отчёт --------------------------------------------------------------------------

/** s, [1, 2, 3, 5] → «s01–s03, s05». */
function ranges(prefix: string, numbers: number[]): string {
  const id = (n: number) => `${prefix}${String(n).padStart(2, '0')}`
  const parts: string[] = []
  for (let i = 0; i < numbers.length; i++) {
    const start = numbers[i]!
    let end = start
    while (numbers[i + 1] === end + 1) end = numbers[++i]!
    parts.push(start === end ? id(start) : `${id(start)}–${id(end)}`)
  }
  return parts.join(', ')
}

const numbered = (list: { sentences: number[]; exercises: number[] }): string =>
  [ranges('s', list.sentences), ranges('x', list.exercises)].filter(Boolean).join(', ')

interface Imported {
  id: string
  lesson: LessonSource
  converted: ConvertedLesson
  ids: LessonIds
  free: LessonBody
  paid?: LessonBody | undefined
  meta: LessonMeta
}

function report(item: Imported): string {
  const { id, lesson, converted, ids, free, paid, meta } = item
  const parts = Object.entries(meta.parts)
    .map(([part, access]) => `${PART_LABELS[part as Part]} — ${ACCESS_LABELS[access]}`)
    .join(', ')
  const extraTasks = converted.parts.extras?.exercises.reduce((sum, b) => sum + b.items.length, 0)
  const lines = [
    `✓ ${id} · Урок ${lesson.number}. ${lesson.title}`,
    `    ${parts}`,
    `    предложений ${converted.sentences.length}: public ${free.sentences.length}, private ${paid?.sentences.length ?? 0}` +
      ` · разделов конспекта ${converted.parts.notes?.sections.length ?? 0}` +
      (extraTasks === undefined ? '' : ` · заданий допматериалов ${extraTasks}`) +
      ` · проверка ${converted.parts.quiz?.length ?? 0}`,
  ]
  const added = numbered(ids.added)
  if (added) lines.push(`    новые номера: ${added}`)
  const unused = numbered(ids.unused())
  if (unused) {
    lines.push(
      `    ⚠ исчезли из урока: ${unused} — если фразу правили, номер можно вернуть в content/ids.lock.json`,
    )
  }
  for (const warning of converted.warnings) lines.push(`    ⚠ ${warning}`)
  return lines.join('\n')
}

// --- запуск -------------------------------------------------------------------------

const args = process.argv.slice(2)
const check = args.includes('--check')
const wanted = args.filter((arg) => !arg.startsWith('--')).map(Number)
if (wanted.some((n) => !Number.isInteger(n) || n <= 0)) {
  console.error('Использование: npm run content:import [-- <номера уроков>] [-- --check]')
  process.exit(1)
}
if (!existsSync(SOURCE)) {
  console.error(`Нет папки источника ${SOURCE} — укажите путь в CONTENT_SOURCE`)
  process.exit(1)
}

const errors: string[] = []
const lessons = readSource('lessons', LessonSourceSchema, errors)
const extras = readSource('extras', ExtraSourceSchema, errors)
for (const n of extras.keys()) {
  if (!lessons.has(n))
    errors.push(`extras/lesson-${String(n).padStart(2, '0')}.json: нет урока ${n}`)
}
const numberById = new Map<string, number>()
for (const [n, lesson] of lessons) {
  const id = lessonId(lesson)
  const other = numberById.get(id)
  if (other !== undefined) errors.push(`уроки ${other} и ${n}: оба получают id ${id}`)
  numberById.set(id, n)
}
for (const n of wanted) if (!lessons.has(n)) errors.push(`урока ${n} нет в ${SOURCE}/lessons`)

const videos: Videos | undefined = existsSync(VIDEOS)
  ? validate(VideosSchema, readJson(VIDEOS, errors), 'content/videos.json', errors)
  : undefined

const lock = readLock(LOCK)
const all = [...lessons.values()].sort((a, b) => a.number - b.number)
const selected =
  wanted.length > 0 ? [...new Set(wanted)].sort((a, b) => a - b) : all.map((l) => l.number)
const imported: Imported[] = []

if (errors.length === 0) {
  for (const n of selected) {
    const lesson = lessons.get(n)!
    const id = lessonId(lesson)
    const ids = lessonIds(lock, id)
    const converted = convertLesson({
      id,
      lesson,
      extra: extras.get(n),
      ids,
      ipa: ipaLookup([lesson, ...all.filter((other) => other !== lesson)]),
    })
    const access = lessonAccess(lesson, converted)
    const split = splitLesson(id, converted, access)

    // Контракт: обе половины проходят схему сайта, ссылки на предложения целы.
    const free = validate(LessonBodySchema, split.free, `${id} (public)`, errors)
    const paid = split.paid && validate(LessonBodySchema, split.paid, `${id} (private)`, errors)
    if (!free || (split.paid && !paid)) continue
    const missing = missingSentences(mergeLessonBodies(free, paid))
    if (missing.length > 0)
      errors.push(`${id}: ссылки на несуществующие предложения ${missing.join(', ')}`)

    const meta = lessonMeta(id, lesson, access, videos?.lessons[id])
    imported.push({ id, lesson, converted, ids, free, paid, meta })
  }
}

const index = validate(
  ContentIndexSchema,
  { lessons: imported.map((item) => item.meta) },
  'content/public/index.json',
  errors,
)

if (errors.length > 0 || !index) {
  for (const error of errors) console.error(`✗ ${error}`)
  console.error(`\nОшибок: ${errors.length}. Ничего не записано.`)
  process.exit(1)
}

for (const item of imported) console.log(report(item))

if (check) {
  console.log(`\nПроверено уроков: ${imported.length}. --check: ничего не записано.`)
  process.exit(0)
}

const writeJson = (file: string, data: unknown) =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

for (const dir of [join(PUBLIC, 'lessons'), join(PRIVATE, 'lessons')]) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}
writeJson(join(PUBLIC, 'index.json'), index)
for (const { id, free, paid } of imported) {
  writeJson(join(PUBLIC, 'lessons', `${id}.json`), free)
  if (paid) writeJson(join(PRIVATE, 'lessons', `${id}.json`), paid)
}
writeLock(LOCK, lock)

const privateCount = imported.filter((item) => item.paid).length
console.log(
  `\nУроков: ${imported.length} → content/public (${imported.length}), content/private (${privateCount}).` +
    ` id — content/ids.lock.json.`,
)

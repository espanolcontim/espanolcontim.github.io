/**
 * Импорт контента из ../video-lessons (только чтение):
 *
 *   npm run content:import                все уроки и практики
 *   npm run content:import -- 1 8 11 p1   только эти: уроки — сквозными номерами, практики — pN
 *   npm run content:import -- --check     проверить и собрать, ничего не записывая
 *
 * Путь к источнику — CONTENT_SOURCE (по умолчанию ../video-lessons). Уроки —
 * lessons/lesson-NN.json, практические уроки — lessons/practice-NN.json.
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
  practiceId,
  VideosSchema,
  type Access,
  type LessonAddress,
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

const LESSON_FILE = /^lesson-(\d+)\.json$/
const PRACTICE_FILE = /^practice-(\d+)\.json$/

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
  file = LESSON_FILE,
): Map<number, T> {
  const out = new Map<number, T>()
  const path = join(SOURCE, dir)
  if (!existsSync(path)) return out
  for (const name of readdirSync(path).sort()) {
    const number = file.exec(name)?.[1]
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
  /** «Урок 4», «Практика 1». */
  name: string
  lesson: LessonSource
  converted: ConvertedLesson
  ids: LessonIds
  free: LessonBody
  paid?: LessonBody | undefined
  meta: LessonMeta
}

function report(item: Imported): string {
  const { id, name, lesson, converted, ids, free, paid, meta } = item
  const parts = Object.entries(meta.parts)
    .map(([part, access]) => `${PART_LABELS[part as Part]} — ${ACCESS_LABELS[access]}`)
    .join(', ')
  const extraTasks = converted.parts.extras?.exercises.reduce((sum, b) => sum + b.items.length, 0)
  const lines = [
    `✓ ${id} · ${name}. ${lesson.title}` +
      (meta.repeats ? ` · повторяет уроки ${meta.repeats.from}–${meta.repeats.to}` : ''),
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
  if (!meta.youtubeUrl) lines.push('    ⚠ нет ссылки на видео в content/videos.json')
  return lines.join('\n')
}

// --- запуск -------------------------------------------------------------------------

const args = process.argv.slice(2)
const check = args.includes('--check')
const tokens = args.filter((arg) => !arg.startsWith('--'))
const wantedLessons = tokens.filter((arg) => /^\d+$/.test(arg)).map(Number)
const wantedPractices = tokens.flatMap((arg) => /^p(\d+)$/.exec(arg)?.[1] ?? []).map(Number)
if (
  tokens.length !== wantedLessons.length + wantedPractices.length ||
  [...wantedLessons, ...wantedPractices].some((n) => n <= 0)
) {
  console.error('Использование: npm run content:import [-- <номера уроков> <pN>] [-- --check]')
  process.exit(1)
}
if (!existsSync(SOURCE)) {
  console.error(`Нет папки источника ${SOURCE} — укажите путь в CONTENT_SOURCE`)
  process.exit(1)
}

const errors: string[] = []
const lessons = readSource('lessons', LessonSourceSchema, errors)
const practices = readSource('lessons', LessonSourceSchema, errors, PRACTICE_FILE)
const extras = readSource('extras', ExtraSourceSchema, errors)
const fileName = (kind: 'lesson' | 'practice', n: number) =>
  `lessons/${kind}-${String(n).padStart(2, '0')}.json`
for (const [n, lesson] of lessons) {
  if (lesson.kind === 'practice') errors.push(`${fileName('lesson', n)}: kind = practice у урока`)
}
for (const [n, practice] of practices) {
  if (practice.kind !== 'practice') errors.push(`${fileName('practice', n)}: нет kind: practice`)
}
for (const n of extras.keys()) {
  if (!lessons.has(n))
    errors.push(`extras/lesson-${String(n).padStart(2, '0')}.json: нет урока ${n}`)
}

/**
 * Что импортировать: урок или практика. Доступ практики — как у урока, после
 * которого она стоит; повторяет она уроки от предыдущей практики уровня (или
 * от первого урока уровня) до этого урока — как «Повторяем уроки 1–4» в её PDF.
 */
interface Entry {
  id: string
  name: string
  source: LessonSource
  access: LessonAddress
  repeats?: LessonMeta['repeats']
}

const lessonEntry = (lesson: LessonSource): Entry => ({
  id: lessonId(lesson),
  name: `Урок ${lesson.number}`,
  source: lesson,
  access: lesson,
})

function practiceEntry(practice: LessonSource): Entry | undefined {
  const where = fileName('practice', practice.number)
  const after = practice.afterLesson === undefined ? undefined : lessons.get(practice.afterLesson)
  if (!after) {
    errors.push(`${where}: нет урока ${String(practice.afterLesson)}, после которого она стоит`)
    return undefined
  }
  if (after.level !== practice.level) {
    errors.push(`${where}: уровень ${practice.level}, а урок ${after.number} — ${after.level}`)
    return undefined
  }
  const previous = [...practices.values()]
    .filter((other) => other.level === practice.level && other.number < practice.number)
    .sort((a, b) => a.number - b.number)
    .at(-1)?.afterLesson
  const from = previous === undefined ? after.number - after.planLesson + 1 : previous + 1
  return {
    id: practiceId(practice),
    name: `Практика ${practice.number}`,
    source: practice,
    access: after,
    repeats: { from, to: after.number },
  }
}

/** В порядке курса: практика — сразу после своего урока. */
const entries = [
  ...[...lessons.values()].map(lessonEntry),
  ...[...practices.values()].flatMap((practice) => practiceEntry(practice) ?? []),
].sort(
  (a, b) =>
    (a.repeats?.to ?? a.source.number) - (b.repeats?.to ?? b.source.number) ||
    Number(a.repeats !== undefined) - Number(b.repeats !== undefined),
)
const nameById = new Map<string, string>()
for (const entry of entries) {
  const other = nameById.get(entry.id)
  if (other !== undefined) errors.push(`${other} и ${entry.name}: оба получают id ${entry.id}`)
  nameById.set(entry.id, entry.name)
}
for (const n of wantedLessons)
  if (!lessons.has(n)) errors.push(`урока ${n} нет в ${SOURCE}/lessons`)
for (const n of wantedPractices) {
  if (!practices.has(n)) errors.push(`практики ${n} нет в ${SOURCE}/lessons`)
}

const videos: Videos | undefined = existsSync(VIDEOS)
  ? validate(VideosSchema, readJson(VIDEOS, errors), 'content/videos.json', errors)
  : undefined

const lock = readLock(LOCK)
const all = [...lessons.values()].sort((a, b) => a.number - b.number)
const selected =
  tokens.length === 0
    ? entries
    : entries.filter((entry) =>
        entry.repeats
          ? wantedPractices.includes(entry.source.number)
          : wantedLessons.includes(entry.source.number),
      )
const imported: Imported[] = []

if (errors.length === 0) {
  for (const { id, name, source: lesson, access: address, repeats } of selected) {
    const ids = lessonIds(lock, id)
    const converted = convertLesson({
      id,
      lesson,
      extra: lesson.kind === 'practice' ? undefined : extras.get(lesson.number),
      ids,
      ipa: ipaLookup([lesson, ...all.filter((other) => other !== lesson)]),
    })
    const access = lessonAccess(address, converted)
    const split = splitLesson(id, converted, access)

    // Контракт: обе половины проходят схему сайта, ссылки на предложения целы.
    const free = validate(LessonBodySchema, split.free, `${id} (public)`, errors)
    const paid = split.paid && validate(LessonBodySchema, split.paid, `${id} (private)`, errors)
    if (!free || (split.paid && !paid)) continue
    const missing = missingSentences(mergeLessonBodies(free, paid))
    if (missing.length > 0)
      errors.push(`${id}: ссылки на несуществующие предложения ${missing.join(', ')}`)

    const meta = lessonMeta(id, lesson, access, videos?.lessons[id], repeats)
    imported.push({ id, name, lesson, converted, ids, free, paid, meta })
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
  console.log(`\nПроверено уроков и практик: ${imported.length}. --check: ничего не записано.`)
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
const practiceCount = imported.filter((item) => item.meta.repeats).length
console.log(
  `\nУроков: ${imported.length - practiceCount}, практик: ${practiceCount}` +
    ` → content/public (${imported.length}), content/private (${privateCount}).` +
    ` id — content/ids.lock.json.`,
)

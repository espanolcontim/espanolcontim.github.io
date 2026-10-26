/**
 * Урок video-lessons → части урока на сайте: выжимка, конспект, упражнения
 * по фразам урока, допматериалы, проверка. Слайды как таковые на сайт не
 * попадают: это только источник данных.
 */
import {
  extraExerciseId,
  plainText,
  sentenceExerciseId,
  sentenceId,
  type Dialogue,
  type Exercise,
  type Extras,
  type LessonParts,
  type NoteBlock,
  type NoteSection,
  type Notes,
  type Practice,
  type Sentence,
} from '@espanolcontim/content'
import { exerciseKey, sentenceKey, type LessonIds } from './ids.ts'
import type { ExtraSource, LessonSource } from './source.ts'

export interface ConvertInput {
  /** id урока на сайте: «a0-11». */
  id: string
  lesson: LessonSource
  extra?: ExtraSource | undefined
  ids: LessonIds
  /** Транскрипция слова для «Новых слов» — см. vocabulary.ts. */
  ipa: (es: string) => string | undefined
}

export interface ConvertedLesson {
  parts: LessonParts
  /** Все предложения урока; по частям их раскладывает split.ts. */
  sentences: Sentence[]
  warnings: string[]
}

export function convertLesson({ id, lesson, extra, ids, ipa }: ConvertInput): ConvertedLesson {
  const warnings: string[] = []
  const book = sentenceBook(id, ids)

  // Порядок важен: при первом импорте номера предложений идут по практике урока.
  const practice = practiceGroups(lesson, book.add)
  const summary = lesson.summary && {
    phrases: lesson.summary.phrases,
    rule: lesson.summary.rule,
    mistake: lesson.summary.mistake,
    practice: lesson.summary.practice.map(book.add),
  }
  const extras = extra && convertExtras(id, extra, ids, book.add)

  const notes: Notes = {
    sections: noteSections(lesson),
    tables: lesson.handoutTables ?? [],
    dialogues: dialogues(lesson),
    vocabulary: (lesson.newVocabulary ?? []).map((entry) => {
      const value = entry.ipa ?? ipa(entry.es)
      if (!value) warnings.push(`нет транскрипции у слова «${entry.es}»`)
      return { ...entry, ipa: value }
    }),
    outcome: outcome(lesson),
  }

  return {
    parts: {
      summary,
      notes,
      practice: practice.length > 0 ? practice : undefined,
      extras,
      quiz: practice.length > 0 ? quiz(practice, book.byId) : undefined,
    },
    sentences: book.list(),
    warnings,
  }
}

// --- предложения ------------------------------------------------------------------

interface SentenceSource {
  ru: string
  hint?: string | undefined
  es: string
  alternatives?: string[] | undefined
  ipa?: string | undefined
  why?: string | undefined
}

/** Одно и то же задание в практике, выжимке и допматериалах — одно предложение. */
function sentenceBook(lesson: string, ids: LessonIds) {
  const byKey = new Map<string, Sentence>()
  const byId = new Map<string, Sentence>()
  const numbers = new Map<string, number>()

  const add = (source: SentenceSource): string => {
    const key = sentenceKey(source)
    const known = byKey.get(key)
    if (known) return known.id
    const n = ids.sentence(key)
    const sentence: Sentence = {
      id: sentenceId(lesson, n),
      ru: source.ru,
      hint: source.hint,
      es: [source.es, ...(source.alternatives ?? [])],
      ipa: source.ipa,
      why: source.why,
    }
    byKey.set(key, sentence)
    byId.set(sentence.id, sentence)
    numbers.set(sentence.id, n)
    return sentence.id
  }

  const list = (): Sentence[] =>
    [...byId.values()].sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!)

  return { add, list, byId }
}

/** Задания практики урока по группам, в порядке слайдов. */
function practiceGroups(lesson: LessonSource, add: (s: SentenceSource) => string): Practice {
  const tasks = lesson.slides.flatMap((slide) =>
    slide.type === 'practice' ? [{ group: slide.group, id: add(slide.phrase) }] : [],
  )
  return lesson.practiceGroups
    .map((group) => ({
      name: group.name,
      sentenceIds: tasks.filter((task) => task.group === group.name).map((task) => task.id),
    }))
    .filter((group) => group.sentenceIds.length > 0)
}

// --- конспект --------------------------------------------------------------------

/**
 * Теория по разделам, как в полном PDF: таблицы, правила, спряжения, сравнения.
 * Подряд идущие таблицы с одинаковым заголовком — одна таблица («1/2» на слайдах).
 * Разделы без теории («Практика», «Мини-диалог») пропускаются.
 */
function noteSections(lesson: LessonSource): NoteSection[] {
  const sections: Omit<NoteSection, 'id'>[] = []
  let current: Omit<NoteSection, 'id'> | undefined
  const push = (block: NoteBlock) => {
    if (!current) {
      current = { title: lesson.title, blocks: [] }
      sections.push(current)
    }
    current.blocks.push(block)
  }

  const slides = lesson.slides
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!
    switch (slide.type) {
      case 'section':
        current = { title: slide.title, hint: slide.hint, blocks: [] }
        sections.push(current)
        break
      case 'table': {
        const rows = [...slide.rows]
        while (true) {
          const next = slides[i + 1]
          if (next?.type !== 'table' || next.title !== slide.title) break
          rows.push(...next.rows)
          i++
        }
        push({
          type: 'words',
          title: slide.title,
          headers: { ...lesson.tableHeaders, ...slide.headers },
          rows,
        })
        break
      }
      case 'rule':
        push({
          type: 'rule',
          title: slide.title,
          pattern: slide.pattern,
          text: slide.text,
          examples: slide.examples,
        })
        break
      case 'conjugation':
        push({ type: 'conjugation', verb: slide.verb, ru: slide.ru, rows: slide.rows })
        break
      case 'conjugationCompare':
        push({
          type: 'conjugationCompare',
          title: slide.title,
          verbs: slide.verbs,
          rows: slide.rows,
        })
        break
      case 'compare':
        push({ type: 'compare', title: slide.title, left: slide.left, right: slide.right })
        break
      default:
        break
    }
  }

  return sections
    .filter((section) => section.blocks.length > 0)
    .map((section, i) => ({ id: `section-${i + 1}`, ...section }))
}

/** Подряд идущие диалоги с одинаковым заголовком — один диалог. */
function dialogues(lesson: LessonSource): Dialogue[] {
  const runs: Dialogue[] = []
  lesson.slides.forEach((slide, i) => {
    if (slide.type !== 'dialogue') return
    const lines = slide.lines.map((line) => ({
      speaker: lesson.speakers[line.speaker] ?? line.speaker,
      es: line.es,
      ru: line.ru,
    }))
    const previous = lesson.slides[i - 1]
    const last = runs.at(-1)
    if (last && previous?.type === 'dialogue' && previous.title === slide.title) {
      last.lines.push(...lines)
    } else {
      runs.push({ title: slide.title, lines })
    }
  })
  return runs
}

function outcome(lesson: LessonSource): Notes['outcome'] {
  const final = lesson.slides.findLast((slide) => slide.type === 'final')
  if (final?.type !== 'final') return undefined
  return {
    title: final.title,
    bullets: final.bullets,
    next: { title: final.nextTitle, text: final.nextText },
  }
}

// --- допматериалы -----------------------------------------------------------------

function convertExtras(
  lesson: string,
  extra: ExtraSource,
  ids: LessonIds,
  add: (s: SentenceSource) => string,
): Extras {
  const onSentence = (sentence: string, type: 'translate' | 'fix') => ({
    id: sentenceExerciseId(sentence, type),
    sentenceId: sentence,
  })

  const items = (block: ExtraSource['exercises'][number]): Exercise[] => {
    switch (block.type) {
      case 'translate':
        return block.tasks.map((task): Exercise => ({
          type: 'translate',
          ...onSentence(add(task), 'translate'),
        }))
      case 'fix':
        return block.tasks.map((task): Exercise => ({
          type: 'fix',
          wrong: task.wrong,
          ...onSentence(add({ ru: task.ru, es: task.es, why: task.why }), 'fix'),
        }))
      case 'gap':
        return block.tasks.map((task): Exercise => ({
          id: extraExerciseId(lesson, ids.exercise(exerciseKey('gap', task.es, task.answer))),
          type: 'gap',
          text: task.es,
          answer: task.answer,
          options: block.options,
          ru: task.ru,
        }))
      case 'read':
        return block.tasks.map((task): Exercise => ({
          id: extraExerciseId(lesson, ids.exercise(exerciseKey('read', task.es, task.ru))),
          type: 'read',
          es: task.es,
          ru: task.ru,
        }))
    }
  }

  return {
    expressions: extra.expressions,
    exercises: extra.exercises.map((block) => ({ title: block.title, items: items(block) })),
    story: extra.story,
    phrases: extra.phrases,
    culture: extra.culture,
    yourTurn: extra.yourTurn,
  }
}

// --- проверка после урока ------------------------------------------------------------

const QUIZ_SIZE = 10
const QUIZ_ORDER = 2
/** Порядок слов имеет смысл во фразе из 3–8 слов. */
const ORDER_WORDS = { min: 3, max: 8 }

/**
 * Проверка собирается из практики урока: задания последней группы
 * («Всё вместе»), при нехватке — предыдущих групп. Две фразы подходящей
 * длины идут в конец как «собери фразу», остальные — перевод.
 */
function quiz(practice: Practice, sentences: Map<string, Sentence>): Exercise[] {
  const picked: string[] = []
  for (const group of [...practice].reverse()) {
    for (const id of group.sentenceIds) {
      if (picked.length < QUIZ_SIZE && !picked.includes(id)) picked.push(id)
    }
  }
  const position = new Map(practice.flatMap((group) => group.sentenceIds).map((id, i) => [id, i]))
  picked.sort((a, b) => position.get(a)! - position.get(b)!)

  const orderable = (id: string) => {
    const es = plainText(sentences.get(id)!.es[0]!)
    const words = es.split(/\s+/).length
    // Вопрос и ответ через тире — две реплики, а не одна фраза из плашек.
    return !es.includes(' — ') && words >= ORDER_WORDS.min && words <= ORDER_WORDS.max
  }
  const forOrder = picked.filter(orderable).slice(-QUIZ_ORDER)

  return [
    ...picked
      .filter((id) => !forOrder.includes(id))
      .map((id): Exercise => ({
        id: sentenceExerciseId(id, 'translate'),
        type: 'translate',
        sentenceId: id,
      })),
    ...forOrder.map((id): Exercise => ({
      id: sentenceExerciseId(id, 'order'),
      type: 'order',
      sentenceId: id,
    })),
  ]
}

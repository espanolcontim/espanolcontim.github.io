import { z } from 'zod'
import { ACCESS_VALUES, PARTS } from './access.ts'
import { EXERCISE_ID, LESSON_ID, SENTENCE_ID } from './ids.ts'
import { LEVELS } from './levels.ts'
import { hasUnclosedMark } from './markup.ts'

/**
 * Контракт контента сайта: что пишет `npm run content:import` в content/public
 * и content/private и что читают сайт и функции. Описание — «Схема контента»
 * в docs/SPEC.md, источники — docs/content-sources.md.
 *
 * Лимиты оформления слайдов (≤ 5 строк в таблице и т. п.) сюда не переносятся:
 * сайту они не нужны, а проверяет их сам video-lessons.
 */

const Text = z.string().min(1)

/** Строка с выделением нового: "Quiero **aprender** español." */
export const MarkedSchema = Text.refine((value) => !hasUnclosedMark(value), {
  message: 'не закрыто выделение **',
})

export const LevelSchema = z.enum(LEVELS)
export const AccessSchema = z.enum(ACCESS_VALUES)
export const PartSchema = z.enum(PARTS)

export const LessonIdSchema = z.string().regex(LESSON_ID)
export const SentenceIdSchema = z.string().regex(SENTENCE_ID)
export const ExerciseIdSchema = z.string().regex(EXERCISE_ID)

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adj',
  'adv',
  'pron',
  'prep',
  'conj',
  'art',
  'num',
  'interj',
  'phrase',
] as const

export const CULTURE_KINDS = ['refrán', 'trabalenguas', 'fact', 'song'] as const

/** Пропуск в задании «вставьте слово». */
export const GAP = '___'

/** Фраза: испанский, перевод, транскрипция. */
export const PhraseSchema = z.object({
  es: MarkedSchema,
  ru: MarkedSchema,
  ipa: Text.optional(),
})

/** Фраза, у которой перевода может не быть: неверный вариант, ячейка сводной таблицы. */
const LoosePhraseSchema = z.object({
  es: MarkedSchema,
  ru: MarkedSchema.optional(),
  ipa: Text.optional(),
})

// --- предложения и упражнения ------------------------------------------------

/** Предложение — единица упражнений и повторения: задание по-русски, ответ по-испански. */
export const SentenceSchema = z.object({
  id: SentenceIdSchema,
  /** Задание. */
  ru: MarkedSchema,
  /** Уточнение, без которого перевод неоднозначен: «вежливо», «в 11 утра». */
  hint: Text.optional(),
  /** Верные ответы: первый — эталон, дальше — alternatives. */
  es: z.array(MarkedSchema).min(1),
  ipa: Text.optional(),
  /** Пояснение при ошибке. */
  why: Text.optional(),
})

export const ExerciseSchema = z.discriminatedUnion('type', [
  /** RU → ES. */
  z.object({ id: ExerciseIdSchema, type: z.literal('translate'), sentenceId: SentenceIdSchema }),
  /** Собрать фразу из плашек: плашки режутся из эталона при показе. */
  z.object({ id: ExerciseIdSchema, type: z.literal('order'), sentenceId: SentenceIdSchema }),
  /** Найдите ошибку: ученик вводит верную фразу. */
  z.object({
    id: ExerciseIdSchema,
    type: z.literal('fix'),
    wrong: Text,
    sentenceId: SentenceIdSchema,
  }),
  /** Вставьте слово: выбор из вариантов. */
  z
    .object({
      id: ExerciseIdSchema,
      type: z.literal('gap'),
      text: MarkedSchema.refine((value) => value.split(GAP).length === 2, {
        message: `в тексте должен быть ровно один пропуск ${GAP}`,
      }),
      answer: Text,
      options: z.array(Text).min(2),
      ru: Text.optional(),
    })
    .refine((gap) => gap.options.includes(gap.answer), {
      message: 'ответ не из вариантов',
      path: ['answer'],
    }),
  /** ES → RU с самопроверкой: русский ответ автоматически не проверяем. */
  z.object({ id: ExerciseIdSchema, type: z.literal('read'), es: MarkedSchema, ru: Text }),
])

// --- выжимка -------------------------------------------------------------------

const MistakeSideSchema = z.object({
  /** По умолчанию «так не говорят» / «так говорят». */
  label: Text.optional(),
  es: MarkedSchema,
  ru: MarkedSchema.optional(),
})

export const SummarySchema = z.object({
  phrases: z.array(PhraseSchema).min(1),
  rule: MarkedSchema,
  mistake: z.object({ wrong: MistakeSideSchema, right: MistakeSideSchema }),
  practice: z.array(SentenceIdSchema).min(1),
})

// --- конспект ------------------------------------------------------------------

const VerbFormSchema = z.object({ stem: z.string(), ending: z.string(), ipa: Text.optional() })

const CompareSideSchema = z.object({
  label: Text,
  /** wrong — ✗ и зачёркивание, right — ✓, без tone — равноправные колонки. */
  tone: z.enum(['wrong', 'right']).optional(),
  items: z.array(LoosePhraseSchema).min(1),
})

export const NoteBlockSchema = z.discriminatedUnion('type', [
  /** Слова и фразы с транскрипцией; разрезанные на слайды таблицы склеены. */
  z.object({
    type: z.literal('words'),
    title: Text,
    headers: z.object({ es: Text, ru: Text }),
    rows: z.array(PhraseSchema).min(1),
  }),
  /** Формула («quiero + инфинитив»), пояснение, примеры. */
  z.object({
    type: z.literal('rule'),
    title: Text,
    pattern: z.array(Text).min(1),
    text: Text.optional(),
    examples: z.array(PhraseSchema).min(1),
  }),
  z.object({
    type: z.literal('conjugation'),
    verb: Text,
    ru: Text,
    rows: z.array(VerbFormSchema.extend({ pronoun: Text, ru: Text })).min(1),
  }),
  z.object({
    type: z.literal('conjugationCompare'),
    title: Text,
    verbs: z.array(z.object({ verb: Text, ru: Text })).min(1),
    rows: z.array(z.object({ pronoun: Text, forms: z.array(VerbFormSchema).min(1) })).min(1),
  }),
  z.object({
    type: z.literal('compare'),
    title: Text,
    left: CompareSideSchema,
    right: CompareSideSchema,
  }),
])

export const NoteSectionSchema = z.object({
  /** Якорь для оглавления. */
  id: Text,
  title: Text,
  hint: Text.optional(),
  blocks: z.array(NoteBlockSchema).min(1),
})

/** Сводная таблица: подписи строк слева, по ячейке на колонку. */
export const GridSchema = z.object({
  title: Text,
  columns: z.array(Text).min(1),
  rows: z.array(z.object({ label: Text, cells: z.array(LoosePhraseSchema).min(1) })).min(1),
})

export const DialogueSchema = z.object({
  title: Text,
  /** `speaker` — имя: Ana, Carlos. Цвет — по порядку появления. */
  lines: z.array(PhraseSchema.extend({ speaker: Text })).min(1),
})

export const VocabularyEntrySchema = z.object({
  es: Text,
  ru: Text,
  pos: z.enum(PARTS_OF_SPEECH),
  ipa: Text.optional(),
})

export const NotesSchema = z.object({
  sections: z.array(NoteSectionSchema),
  tables: z.array(GridSchema),
  dialogues: z.array(DialogueSchema),
  vocabulary: z.array(VocabularyEntrySchema),
  /** «Теперь вы умеете» и анонс следующего урока. */
  outcome: z
    .object({
      title: Text,
      bullets: z.array(Text),
      next: z.object({ title: Text, text: Text }),
    })
    .optional(),
})

// --- упражнения по фразам урока ---------------------------------------------------

export const PracticeGroupSchema = z.object({
  name: Text,
  sentenceIds: z.array(SentenceIdSchema).min(1),
})

export const PracticeSchema = z.array(PracticeGroupSchema).min(1)

// --- дополнительные материалы ------------------------------------------------------

export const ExtrasSchema = z.object({
  /** Живые выражения. */
  expressions: z.array(
    PhraseSchema.extend({
      ipa: Text,
      note: Text.optional(),
      example: PhraseSchema.optional(),
    }),
  ),
  /** Блоки упражнений — показываются в подразделе «Упражнения». */
  exercises: z.array(z.object({ title: Text, items: z.array(ExerciseSchema).min(1) })),
  story: z.object({
    title: Text,
    lines: z.array(PhraseSchema.extend({ speaker: Text.optional() })).min(1),
    glossary: z.array(PhraseSchema).optional(),
    questions: z.array(z.object({ question: Text, answer: Text })),
  }),
  /** Фразы с характером. */
  phrases: z.array(PhraseSchema),
  /** «Испания изнутри». */
  culture: z.object({
    kind: z.enum(CULTURE_KINDS),
    title: Text,
    text: MarkedSchema,
    es: Text.optional(),
    ipa: Text.optional(),
    ru: Text.optional(),
  }),
  /** «Ваш ход»: открытое задание, начала фраз и образец. */
  yourTurn: z.object({
    task: Text,
    template: z.array(Text).optional(),
    model: z.array(PhraseSchema).min(1),
  }),
})

// --- файлы -------------------------------------------------------------------------

/**
 * Тело урока. Одна форма и для content/public, и для content/private:
 * каждая часть лежит в одном из двух файлов, сайт их склеивает.
 */
export const LessonBodySchema = z.object({
  id: LessonIdSchema,
  summary: SummarySchema.optional(),
  notes: NotesSchema.optional(),
  practice: PracticeSchema.optional(),
  extras: ExtrasSchema.optional(),
  quiz: z.array(ExerciseSchema).optional(),
  /** Только предложения, на которые ссылаются части этого файла. */
  sentences: z.array(SentenceSchema),
})

/** Метаданные урока — публичны для всех уроков, в том числе платных. */
export const LessonMetaSchema = z.object({
  id: LessonIdSchema,
  /** Сквозной номер: «Урок 11», как в видео. */
  number: z.number().int().positive(),
  level: LevelSchema,
  /** Номер в уровне: «11/14», как на обложке. */
  planLesson: z.number().int().positive(),
  title: Text,
  grammar: z.array(Text),
  youtubeUrl: z.url().optional(),
  /** Какие части есть и как открыты; считает access.ts. */
  parts: z.partialRecord(PartSchema, AccessSchema),
})

/** content/public/index.json */
export const ContentIndexSchema = z.object({
  lessons: z.array(LessonMetaSchema),
})

/** content/videos.json — ведёт Тимур. */
export const VideosSchema = z.object({
  channel: z.url(),
  /** id урока → ссылка на видео. */
  lessons: z.record(LessonIdSchema, z.url()),
})

export type Phrase = z.infer<typeof PhraseSchema>
export type Sentence = z.infer<typeof SentenceSchema>
export type Exercise = z.infer<typeof ExerciseSchema>
export type Summary = z.infer<typeof SummarySchema>
export type NoteBlock = z.infer<typeof NoteBlockSchema>
export type NoteSection = z.infer<typeof NoteSectionSchema>
export type Grid = z.infer<typeof GridSchema>
export type Dialogue = z.infer<typeof DialogueSchema>
export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>
export type Notes = z.infer<typeof NotesSchema>
export type PracticeGroup = z.infer<typeof PracticeGroupSchema>
export type Practice = z.infer<typeof PracticeSchema>
export type Extras = z.infer<typeof ExtrasSchema>
export type LessonBody = z.infer<typeof LessonBodySchema>
export type LessonMeta = z.infer<typeof LessonMetaSchema>
export type ContentIndex = z.infer<typeof ContentIndexSchema>
export type Videos = z.infer<typeof VideosSchema>

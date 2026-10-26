/**
 * Файлы ../video-lessons глазами импорта: lessons/lesson-NN.json и
 * extras/lesson-NN.json. Форматы — docs/content-sources.md.
 *
 * Здесь проверяется форма данных, на которую опирается импорт: типы,
 * обязательные поля, парность `**`, ссылки на группы практики и говорящих.
 * Правила оформления слайдов (≤ 5 строк в таблице, обязательная ipa на A0
 * и т. п.) проверяет сам video-lessons — `npm run lessons:validate`.
 *
 * Полей, которых здесь нет (`notes`, `pauseMs`, `agenda`, `course`…), zod
 * не пропускает дальше: на сайт они не попадают.
 */
import {
  CULTURE_KINDS,
  GAP,
  hasUnclosedMark,
  LEVELS,
  PARTS_OF_SPEECH,
} from '@espanolcontim/content'
import { z } from 'zod'

const Text = z.string().min(1)
const Marked = Text.refine((value) => !hasUnclosedMark(value), {
  message: 'не закрыто выделение **',
})

const Phrase = z.object({ es: Marked, ru: Marked, ipa: Text.optional() })
const LoosePhrase = z.object({ es: Marked, ru: Marked.optional(), ipa: Text.optional() })
const PracticePhrase = Phrase.extend({
  hint: Text.optional(),
  alternatives: z.array(Marked).optional(),
})

/** stem + ending; у неправильной формы stem пустой, но не оба сразу. */
const VerbForm = z.object({ stem: z.string(), ending: z.string(), ipa: Text.optional() })
const hasForm = (form: { stem: string; ending: string }) => form.stem + form.ending !== ''
const formMessage = { message: 'stem и ending пусты одновременно' }

const CompareSide = z.object({
  label: Text,
  tone: z.enum(['wrong', 'right']).optional(),
  items: z.array(LoosePhrase).min(1),
})

const Slide = z.discriminatedUnion('type', [
  z.object({ type: z.literal('title') }),
  z.object({ type: z.literal('section'), title: Text, hint: Text.optional() }),
  z.object({
    type: z.literal('table'),
    title: Text,
    headers: z.object({ es: Text.optional(), ru: Text.optional() }).optional(),
    rows: z.array(Phrase).min(1),
  }),
  z.object({
    type: z.literal('rule'),
    title: Text,
    pattern: z.array(Text).min(1),
    text: Text.optional(),
    examples: z.array(Phrase).min(1),
  }),
  z.object({
    type: z.literal('conjugation'),
    verb: Text,
    ru: Text,
    rows: z.array(VerbForm.extend({ pronoun: Text, ru: Text }).refine(hasForm, formMessage)).min(1),
  }),
  z
    .object({
      type: z.literal('conjugationCompare'),
      title: Text,
      verbs: z.array(z.object({ verb: Text, ru: Text })).min(1),
      rows: z
        .array(
          z.object({ pronoun: Text, forms: z.array(VerbForm.refine(hasForm, formMessage)).min(1) }),
        )
        .min(1),
    })
    .refine((slide) => slide.rows.every((row) => row.forms.length === slide.verbs.length), {
      message: 'форм в строке должно быть столько же, сколько глаголов',
      path: ['rows'],
    }),
  z.object({ type: z.literal('compare'), title: Text, left: CompareSide, right: CompareSide }),
  z.object({ type: z.literal('practice'), group: Text, phrase: PracticePhrase }),
  z.object({
    type: z.literal('dialogue'),
    title: Text,
    lines: z.array(Phrase.extend({ speaker: Text })).min(1),
  }),
  z.object({
    type: z.literal('final'),
    title: Text,
    bullets: z.array(Text),
    nextTitle: Text,
    nextText: Text,
  }),
])

const MistakeSide = z.object({ label: Text.optional(), es: Marked, ru: Marked.optional() })

export const LessonSourceSchema = z
  .object({
    schemaVersion: z.literal(3),
    number: z.number().int().positive(),
    level: z.enum(LEVELS),
    planLesson: z.number().int().positive(),
    title: Text,
    newVocabulary: z
      .array(z.object({ es: Text, ru: Text, pos: z.enum(PARTS_OF_SPEECH), ipa: Text.optional() }))
      .optional(),
    newGrammar: z.array(Text).optional(),
    speakers: z.record(z.string(), Text),
    tableHeaders: z.object({ es: Text, ru: Text }),
    practiceGroups: z.array(z.object({ name: Text })),
    slides: z.array(Slide).min(1),
    summary: z
      .object({
        phrases: z.array(Phrase).min(1),
        rule: Marked,
        mistake: z.object({ wrong: MistakeSide, right: MistakeSide }),
        practice: z.array(PracticePhrase).min(1),
      })
      .optional(),
    handoutTables: z
      .array(
        z
          .object({
            title: Text,
            columns: z.array(Text).min(1),
            rows: z
              .array(z.object({ label: Text, cells: z.array(LoosePhrase.omit({ ipa: true })) }))
              .min(1),
          })
          .refine((table) => table.rows.every((row) => row.cells.length === table.columns.length), {
            message: 'ячеек в строке должно быть столько же, сколько колонок',
            path: ['rows'],
          }),
      )
      .optional(),
  })
  .superRefine((lesson, ctx) => {
    const groups = new Set(lesson.practiceGroups.map((group) => group.name))
    lesson.slides.forEach((slide, i) => {
      if (slide.type === 'practice' && !groups.has(slide.group)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slides', i, 'group'],
          message: `группа «${slide.group}» не описана в practiceGroups`,
        })
      }
      if (slide.type === 'dialogue') {
        slide.lines.forEach((line, j) => {
          if (!(line.speaker in lesson.speakers)) {
            ctx.addIssue({
              code: 'custom',
              path: ['slides', i, 'lines', j, 'speaker'],
              message: `говорящий «${line.speaker}» не описан в speakers`,
            })
          }
        })
      }
    })
  })

const ExtraBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('translate'), title: Text, tasks: z.array(PracticePhrase).min(1) }),
  z.object({
    type: z.literal('fix'),
    title: Text,
    tasks: z.array(z.object({ wrong: Text, es: Marked, ru: Marked, why: Text.optional() })).min(1),
  }),
  z
    .object({
      type: z.literal('gap'),
      title: Text,
      options: z.array(Text).min(2),
      tasks: z
        .array(
          z.object({
            es: Marked.refine((value) => value.split(GAP).length === 2, {
              message: `в «es» должен быть ровно один пропуск ${GAP}`,
            }),
            answer: Text,
            ru: Text.optional(),
          }),
        )
        .min(1),
    })
    .superRefine((block, ctx) => {
      block.tasks.forEach((task, i) => {
        if (!block.options.includes(task.answer)) {
          ctx.addIssue({
            code: 'custom',
            path: ['tasks', i, 'answer'],
            message: `ответ «${task.answer}» не из вариантов: ${block.options.join(', ')}`,
          })
        }
      })
    }),
  z.object({ type: z.literal('read'), title: Text, tasks: z.array(Phrase).min(1) }),
])

export const ExtraSourceSchema = z.object({
  number: z.number().int().positive(),
  expressions: z.array(
    Phrase.extend({ ipa: Text, note: Text.optional(), example: Phrase.optional() }),
  ),
  exercises: z.array(ExtraBlock),
  story: z.object({
    title: Text,
    lines: z.array(Phrase.extend({ speaker: Text.optional() })).min(1),
    glossary: z.array(Phrase).optional(),
    questions: z.array(z.object({ question: Text, answer: Text })),
  }),
  phrases: z.array(Phrase),
  culture: z.object({
    kind: z.enum(CULTURE_KINDS),
    title: Text,
    text: Marked,
    es: Text.optional(),
    ipa: Text.optional(),
    ru: Text.optional(),
  }),
  yourTurn: z.object({
    task: Text,
    template: z.array(Text).optional(),
    model: z.array(Phrase).min(1),
  }),
})

export type LessonSource = z.infer<typeof LessonSourceSchema>
export type SlideSource = LessonSource['slides'][number]
export type ExtraSource = z.infer<typeof ExtraSourceSchema>

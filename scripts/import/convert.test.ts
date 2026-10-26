import { describe, expect, it } from 'vitest'
import { convertLesson } from './convert.ts'
import { lessonIds, type IdsLock } from './ids.ts'
import type { ExtraSource, LessonSource, SlideSource } from './source.ts'
import { lessonAccess, splitLesson } from './split.ts'

const practice = (group: string, ru: string, es: string, alternatives?: string[]): SlideSource => ({
  type: 'practice',
  group,
  phrase: alternatives ? { ru, es, alternatives } : { ru, es },
})

const lesson = (slides: SlideSource[] = []): LessonSource => ({
  schemaVersion: 3,
  number: 17,
  level: 'A1',
  planLesson: 3,
  title: 'Тестовый урок',
  newVocabulary: [
    { es: 'hablar', ru: 'говорить', pos: 'verb', ipa: 'aˈblaɾ' },
    { es: 'el idioma', ru: 'язык', pos: 'noun' },
  ],
  newGrammar: ['hablo / hablas'],
  speakers: { ana: 'Ana', carlos: 'Carlos' },
  tableHeaders: { es: 'Испанский', ru: 'Перевод' },
  practiceGroups: [{ name: 'Разминка' }, { name: 'Всё вместе' }],
  summary: {
    phrases: [{ es: 'Hablo.', ru: 'Я говорю.' }],
    rule: 'Окончание **-o** — «я».',
    mistake: { wrong: { es: 'Yo hablas.' }, right: { es: 'Yo **hablo**.' } },
    practice: [{ ru: 'Я говорю по-испански.', es: 'Hablo español.' }],
  },
  slides: [
    { type: 'title' },
    { type: 'section', title: 'Я и ты', hint: 'Окончание показывает лицо' },
    {
      type: 'table',
      title: 'Глагол hablar',
      rows: [{ es: 'hablo', ru: 'я говорю', ipa: 'ˈablo' }],
    },
    {
      type: 'table',
      title: 'Глагол hablar',
      rows: [{ es: 'hablas', ru: 'ты говоришь', ipa: 'ˈablas' }],
    },
    { type: 'section', title: 'Практика' },
    ...slides,
    practice('Разминка', 'Я говорю.', 'Hablo.', ['Yo hablo.']),
    practice('Всё вместе', 'Я говорю по-испански.', 'Hablo español.'),
    practice('Всё вместе', 'Ты говоришь по-испански и по-английски?', '¿Hablas español e inglés?'),
    { type: 'section', title: 'Мини-диалог' },
    {
      type: 'dialogue',
      title: 'Знакомство',
      lines: [{ speaker: 'ana', es: 'Hola.', ru: 'Привет.' }],
    },
    {
      type: 'dialogue',
      title: 'Знакомство',
      lines: [{ speaker: 'carlos', es: '¡Hola!', ru: 'Привет!' }],
    },
    {
      type: 'final',
      title: 'Теперь вы умеете',
      bullets: ['Говорить о себе'],
      nextTitle: 'Следующий урок',
      nextText: 'Урок 18',
    },
  ],
})

const extra: ExtraSource = {
  number: 17,
  expressions: [{ es: '¡Vale!', ipa: 'ˈbale', ru: 'Ладно!' }],
  exercises: [
    { type: 'translate', title: 'Переведите', tasks: [{ ru: 'Я говорю.', es: 'Hablo.' }] },
    {
      type: 'fix',
      title: 'Найдите ошибку',
      tasks: [{ wrong: 'Yo hablas.', es: 'Yo **hablo**.', ru: 'Я говорю.', why: 'Я — -o.' }],
    },
    {
      type: 'gap',
      title: 'Вставьте',
      options: ['hablo', 'hablas'],
      tasks: [{ es: 'Yo ___ español.', answer: 'hablo' }],
    },
    {
      type: 'read',
      title: 'Переведите на русский',
      tasks: [{ es: 'Hablas mucho.', ru: 'Ты много говоришь.' }],
    },
  ],
  story: { title: 'История', lines: [{ es: 'Hola.', ru: 'Привет.' }], questions: [] },
  phrases: [],
  culture: { kind: 'fact', title: 'Факт', text: 'Текст.' },
  yourTurn: { task: 'Напишите', model: [{ es: 'Hablo.', ru: 'Я говорю.' }] },
}

const convert = (source: LessonSource, lock: IdsLock = { version: 1, lessons: {} }) =>
  convertLesson({
    id: 'a1-03',
    lesson: source,
    extra,
    ids: lessonIds(lock, 'a1-03'),
    ipa: (es) => (es === 'el idioma' ? undefined : 'x'),
  })

describe('convertLesson: конспект', () => {
  const { parts, warnings } = convert(lesson())

  it('теория по разделам, разрезанные таблицы склеены, разделы без теории пропущены', () => {
    expect(parts.notes?.sections).toEqual([
      {
        id: 'section-1',
        title: 'Я и ты',
        hint: 'Окончание показывает лицо',
        blocks: [
          {
            type: 'words',
            title: 'Глагол hablar',
            headers: { es: 'Испанский', ru: 'Перевод' },
            rows: [
              { es: 'hablo', ru: 'я говорю', ipa: 'ˈablo' },
              { es: 'hablas', ru: 'ты говоришь', ipa: 'ˈablas' },
            ],
          },
        ],
      },
    ])
  })

  it('диалог из двух слайдов — один, говорящие по именам', () => {
    expect(parts.notes?.dialogues).toEqual([
      {
        title: 'Знакомство',
        lines: [
          { speaker: 'Ana', es: 'Hola.', ru: 'Привет.' },
          { speaker: 'Carlos', es: '¡Hola!', ru: 'Привет!' },
        ],
      },
    ])
  })

  it('новые слова с транскрипцией, итог урока', () => {
    expect(parts.notes?.vocabulary.map((entry) => entry.ipa)).toEqual(['aˈblaɾ', undefined])
    expect(warnings).toEqual(['нет транскрипции у слова «el idioma»'])
    expect(parts.notes?.outcome?.next).toEqual({ title: 'Следующий урок', text: 'Урок 18' })
  })
})

describe('convertLesson: предложения и упражнения', () => {
  const { parts, sentences } = convert(lesson())

  it('практика по группам, alternatives — допустимые ответы', () => {
    expect(parts.practice).toEqual([
      { name: 'Разминка', sentenceIds: ['a1-03-s01'] },
      { name: 'Всё вместе', sentenceIds: ['a1-03-s02', 'a1-03-s03'] },
    ])
    expect(sentences[0]).toMatchObject({
      id: 'a1-03-s01',
      ru: 'Я говорю.',
      es: ['Hablo.', 'Yo hablo.'],
    })
  })

  it('одно и то же задание в выжимке и допматериалах — то же предложение', () => {
    expect(parts.summary?.practice).toEqual(['a1-03-s02'])
    const translate = parts.extras?.exercises[0]?.items[0]
    expect(translate).toEqual({
      id: 'a1-03-s01.translate',
      type: 'translate',
      sentenceId: 'a1-03-s01',
    })
  })

  it('«найдите ошибку» — предложение с пояснением, «вставьте» и «прочитайте» — свои номера', () => {
    const [, fix, gap, read] = parts.extras!.exercises.map((block) => block.items[0])
    expect(fix).toMatchObject({ type: 'fix', wrong: 'Yo hablas.', sentenceId: 'a1-03-s04' })
    expect(sentences.find((s) => s.id === 'a1-03-s04')?.why).toBe('Я — -o.')
    expect(gap).toMatchObject({
      id: 'a1-03-x01',
      type: 'gap',
      answer: 'hablo',
      options: ['hablo', 'hablas'],
    })
    expect(read).toMatchObject({ id: 'a1-03-x02', type: 'read' })
  })

  it('проверка: перевод, а фраза из 3–8 слов — «собери фразу» в конце', () => {
    expect(parts.quiz?.map((exercise) => exercise.id)).toEqual([
      'a1-03-s01.translate',
      'a1-03-s02.translate',
      'a1-03-s03.order',
    ])
  })

  it('реплики через тире в «собери фразу» не попадают', () => {
    const dialog = practice('Всё вместе', 'Где ты? — Дома.', '¿Dónde estás? — En casa.')
    const ids = convert(lesson([dialog])).parts.quiz?.map((exercise) => exercise.id)
    expect(ids).toContain('a1-03-s01.translate')
    expect(ids).not.toContain('a1-03-s01.order')
  })

  it('новое задание в начале практики не сдвигает id старых', () => {
    const lock: IdsLock = { version: 1, lessons: {} }
    convert(lesson(), lock)
    const again = convert(lesson([practice('Разминка', 'Ты говоришь.', 'Hablas.')]), lock)
    expect(again.parts.practice?.[0]?.sentenceIds).toEqual(['a1-03-s05', 'a1-03-s01'])
  })
})

describe('splitLesson', () => {
  const source = lesson()
  const converted = convert(source)

  it('A1, урок 3: выжимка и проверка — public, остальное — private', () => {
    const access = lessonAccess(source, converted)
    expect(access).toEqual({
      summary: 'free',
      notes: 'paid',
      practice: 'paid',
      extras: 'paid',
      quiz: 'free',
    })
    const { free, paid } = splitLesson('a1-03', converted, access)
    expect(Object.keys(free)).toEqual(['id', 'summary', 'quiz', 'sentences'])
    expect(Object.keys(paid ?? {})).toEqual(['id', 'notes', 'practice', 'extras', 'sentences'])
    // предложения проверки и выжимки публичны, остальные — только в private
    expect(free.sentences.map((s) => s.id)).toEqual(['a1-03-s01', 'a1-03-s02', 'a1-03-s03'])
    expect(paid?.sentences.map((s) => s.id)).toEqual(['a1-03-s04'])
  })

  it('часть без указанного доступа считается платной', () => {
    const { free, paid } = splitLesson('a1-03', converted, { summary: 'free' })
    expect(free.quiz).toBeUndefined()
    expect(paid?.quiz).toBeDefined()
  })

  it('всё бесплатно — private не нужен', () => {
    const access = lessonAccess({ ...source, planLesson: 1 }, converted)
    expect(splitLesson('a1-01', converted, access).paid).toBeUndefined()
  })
})

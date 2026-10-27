import { checkAnswer, orderTiles, type LessonBody } from '@espanolcontim/content'
import { describe, expect, it } from 'vitest'
import { container } from '../../app/container.ts'
import { plural } from '../../shared/plural.ts'
import { score, shuffle } from './session.ts'
import { buildPracticeSets, QUIZ_TITLE } from './sets.ts'

const body: LessonBody = {
  id: 'a0-01',
  practice: [{ name: 'Приветствия', sentenceIds: ['a0-01-s01', 'a0-01-s02'] }],
  extras: {
    expressions: [],
    exercises: [
      {
        title: 'Найдите ошибку',
        items: [
          { id: 'a0-01-s03.fix', type: 'fix', wrong: 'Ola.', sentenceId: 'a0-01-s03' },
          {
            id: 'a0-01-x01',
            type: 'gap',
            text: 'Buenos ___.',
            answer: 'días',
            options: ['días', 'noches'],
          },
          { id: 'a0-01-x02', type: 'read', es: 'Hola.', ru: 'Привет.' },
        ],
      },
    ],
    story: { title: 'История', lines: [{ es: 'Hola.', ru: 'Привет.' }], questions: [] },
    phrases: [],
    culture: { kind: 'fact', title: 'Факт', text: 'Текст' },
    yourTurn: { task: 'Задание', model: [{ es: 'Hola.', ru: 'Привет.' }] },
  },
  quiz: [{ id: 'a0-01-s02.order', type: 'order', sentenceId: 'a0-01-s02' }],
  sentences: [
    { id: 'a0-01-s01', ru: 'Привет.', es: ['Hola.'], ipa: 'ˈola' },
    { id: 'a0-01-s02', ru: 'Добрый день.', hint: 'в 11 утра', es: ['Buenos días.'] },
    { id: 'a0-01-s03', ru: 'Привет.', es: ['**Hola**.'], why: 'h пишется.' },
  ],
}

describe('buildPracticeSets', () => {
  const sets = buildPracticeSets(body)

  it('собирает группы фраз, блоки допматериалов и проверку — по порядку', () => {
    expect(sets.map((set) => [set.id, set.kind, set.title])).toEqual([
      ['p1', 'phrases', 'Приветствия'],
      ['x1', 'extras', 'Найдите ошибку'],
      ['quiz', 'quiz', QUIZ_TITLE],
    ])
  })

  it('фразы урока — перевод, с текстом предложения', () => {
    expect(sets[0]?.tasks[1]).toEqual({
      kind: 'translate',
      id: 'a0-01-s02.translate',
      sentenceId: 'a0-01-s02',
      ru: 'Добрый день.',
      hint: 'в 11 утра',
      answers: ['Buenos días.'],
      ipa: undefined,
      why: undefined,
    })
  })

  it('упражнения допматериалов и проверки — со своим типом', () => {
    expect(sets[1]?.tasks.map((task) => task.kind)).toEqual(['fix', 'gap', 'read'])
    expect(sets[1]?.tasks[0]).toMatchObject({
      wrong: 'Ola.',
      answers: ['**Hola**.'],
      why: 'h пишется.',
    })
    expect(sets[1]?.tasks[1]).not.toHaveProperty('type')
    expect(sets[2]?.tasks[0]).toMatchObject({ kind: 'order', answers: ['Buenos días.'] })
  })

  it('без упражнений — без наборов', () => {
    expect(buildPracticeSets({ id: 'a0-02', sentences: [] })).toEqual([])
  })

  it('ссылка на несуществующее предложение ломает сборку', () => {
    expect(() => buildPracticeSets({ ...body, sentences: [] })).toThrow('нет предложения a0-01-s01')
  })
})

/** Что в упражнениях урока проверяется не так, как задумано. */
function problems(lesson: LessonBody): string[] {
  const found: string[] = []
  for (const task of buildPracticeSets(lesson).flatMap((set) => set.tasks)) {
    if (task.kind === 'gap' || task.kind === 'read') continue
    const wrong = task.kind === 'fix' ? task.wrong : undefined
    for (const answer of task.answers) {
      const { verdict } = checkAnswer(answer, task.answers, { wrong })
      if (verdict !== 'correct') found.push(`${task.id}: верный ответ «${answer}» — ${verdict}`)
    }
    if (wrong !== undefined && checkAnswer(wrong, task.answers, { wrong }).verdict !== 'wrong') {
      found.push(`${task.id}: фраза с ошибкой «${wrong}» засчитана`)
    }
    if (task.kind === 'order') {
      const tiles = orderTiles(task.answers[0] ?? '').join(' ')
      if (checkAnswer(tiles, task.answers).verdict !== 'correct') {
        found.push(`${task.id}: собранная из плашек фраза не засчитана`)
      }
    }
  }
  return found
}

describe('упражнения бесплатных уроков', async () => {
  const lessons = await container.lessons.list()

  it.each(lessons.map((lesson) => lesson.id))(
    '%s: эталоны засчитываются, ошибки — нет',
    async (id) => {
      const lesson = await container.lessons.getBody(id)
      expect(lesson).toBeDefined()
      expect(problems(lesson ?? { id, sentences: [] })).toEqual([])
    },
  )
})

describe('score', () => {
  it('считает ответы по вердиктам', () => {
    const task = { kind: 'read', id: 'a0-01-x01', es: 'Hola.', ru: 'Привет.' } as const
    expect(
      score([
        { task, verdict: 'correct', given: '', right: '' },
        { task, verdict: 'almost', given: '', right: '' },
        { task, verdict: 'wrong', given: '', right: '' },
        { task, verdict: 'correct', given: '', right: '' },
      ]),
    ).toEqual({ total: 4, correct: 2, almost: 1, wrong: 1 })
  })
})

describe('shuffle', () => {
  it('перемешивает, но не оставляет исходный порядок', () => {
    const items = ['a', 'b', 'c']
    // random() = 0.99 оставляет всё на местах — тогда сдвиг по кругу.
    expect(shuffle(items, Object.is, () => 0.99)).toEqual(['b', 'c', 'a'])
    expect(shuffle(items, Object.is, () => 0)).not.toEqual(items)
    expect(shuffle(items).toSorted()).toEqual(items)
  })

  it('одинаковые плашки и одна плашка — как есть', () => {
    expect(shuffle(['a'])).toEqual(['a'])
    expect(shuffle(['a', 'a'])).toEqual(['a', 'a'])
  })
})

describe('plural', () => {
  it('склоняет по числу', () => {
    const forms = ['фраза', 'фразы', 'фраз'] as const
    expect([1, 2, 5, 11, 12, 21, 24, 25, 111].map((n) => plural(n, forms))).toEqual([
      '1 фраза',
      '2 фразы',
      '5 фраз',
      '11 фраз',
      '12 фраз',
      '21 фраза',
      '24 фразы',
      '25 фраз',
      '111 фраз',
    ])
  })
})

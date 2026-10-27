import { describe, expect, it } from 'vitest'
import { container } from '../../app/container.ts'
import { BOX_LABELS, dayLabel } from './labels.ts'
import { addToReview, emptyProgress, lessonMark, recordResult } from './progress.ts'
import { reviewSentences } from './sentences.ts'

const today = '2026-10-27'

describe('lessonMark', () => {
  it('сдана проверка — галочка, не сдана — результат, решал упражнения — «начат»', () => {
    const started = addToReview(emptyProgress(), ['a0-01-s05'], today)
    expect(lessonMark(emptyProgress(), 'a0-01')).toBeUndefined()
    expect(lessonMark(started, 'a0-01')).toEqual({ state: 'started', text: 'начат' })
    expect(lessonMark(started, 'a0-10')).toBeUndefined()

    const failed = recordResult(started, 'a0-01/quiz', { best: 7, total: 10, day: today })
    expect(lessonMark(failed, 'a0-01')).toEqual({ state: 'started', text: 'проверка 7/10' })
    const passed = recordResult(started, 'a0-01/quiz', { best: 8, total: 10, day: today })
    expect(lessonMark(passed, 'a0-01')).toEqual({ state: 'done', text: '✓ проверка 8/10' })
    expect(
      lessonMark(
        recordResult(emptyProgress(), 'a0-02/x1', { best: 1, total: 2, day: today }),
        'a0-02',
      ),
    ).toEqual({ state: 'started', text: 'начат' })
  })
})

describe('подписи', () => {
  it('коробки — по интервалам Лейтнера', () => {
    expect(BOX_LABELS).toEqual([
      'через день',
      'через 3\u00a0дня',
      'через неделю',
      'через 2\u00a0недели',
      'через месяц',
    ])
  })

  it('день следующих фраз', () => {
    expect(dayLabel('2026-10-27', today)).toBe('сегодня')
    expect(dayLabel('2026-10-28', today)).toBe('завтра')
    expect(dayLabel('2026-11-03', today)).toBe('3 ноября')
  })
})

describe('reviewSentences', () => {
  it('все бесплатные предложения — заданиями на перевод, с номером урока', async () => {
    const sentences = await reviewSentences(container.lessons)
    const lessons = await container.lessons.list()
    let total = 0
    for (const meta of lessons)
      total += (await container.lessons.getBody(meta.id))?.sentences.length ?? 0
    expect(sentences).toHaveLength(total)
    expect(new Set(sentences.map((sentence) => sentence.id)).size).toBe(total)
    expect(sentences[0]).toMatchObject({
      id: 'a0-01-s01',
      lesson: 'Урок 1',
      task: { kind: 'translate', id: 'a0-01-s01.translate', sentenceId: 'a0-01-s01' },
    })
  })
})

import { describe, expect, it } from 'vitest'
import { LocalStorageProgressRepository, PROGRESS_KEY } from './LocalStorageProgressRepository.ts'
import {
  addToReview,
  emptyProgress,
  mergeProgress,
  parseProgress,
  postpone,
  recordResult,
  recordReview,
  type Progress,
} from './progress.ts'

const today = '2026-10-27'

describe('прогресс', () => {
  it('новые фразы попадают в повторение на завтра, старые не сбрасываются', () => {
    const start = addToReview(emptyProgress(), ['a0-01-s01'], today)
    expect(start.cards).toEqual({ 'a0-01-s01': { box: 1, due: '2026-10-28' } })

    const learned = recordReview(start, 'a0-01-s01', 'correct', '2026-10-28')
    const again = addToReview(learned, ['a0-01-s01', 'a0-01-s02'], '2026-10-29')
    expect(again.cards['a0-01-s01']).toEqual({ box: 2, due: '2026-10-31' })
    expect(again.cards['a0-01-s02']).toEqual({ box: 1, due: '2026-10-30' })
    expect(addToReview(again, ['a0-01-s02'], today)).toBe(again)
  })

  it('ответ в повторении двигает фразу по коробкам', () => {
    let progress = addToReview(emptyProgress(), ['a0-01-s01'], today)
    progress = recordReview(progress, 'a0-01-s01', 'correct', '2026-10-28')
    progress = recordReview(progress, 'a0-01-s01', 'wrong', '2026-10-31')
    expect(progress.cards['a0-01-s01']).toEqual({ box: 1, due: '2026-11-01' })
  })

  it('недоступные фразы откладываются, а не теряются', () => {
    const progress = postpone(
      addToReview(emptyProgress(), ['a1-02-s01'], today),
      ['a1-02-s01'],
      '2026-11-26',
    )
    expect(progress.cards['a1-02-s01']).toEqual({ box: 1, due: '2026-11-26' })
  })

  it('у набора запоминается лучший результат', () => {
    let progress = recordResult(emptyProgress(), 'a0-01/quiz', { best: 7, total: 10, day: today })
    progress = recordResult(progress, 'a0-01/quiz', { best: 5, total: 10, day: '2026-10-28' })
    expect(progress.results['a0-01/quiz']).toEqual({ best: 7, total: 10, day: today })
    progress = recordResult(progress, 'a0-01/quiz', { best: 9, total: 10, day: '2026-10-29' })
    expect(progress.results['a0-01/quiz']?.best).toBe(9)
  })

  it('склейка с другого устройства берёт то, что дальше продвинулось', () => {
    const phone: Progress = {
      version: 1,
      cards: { s1: { box: 3, due: '2026-11-01' }, s2: { box: 1, due: '2026-10-28' } },
      results: { 'a0-01/quiz': { best: 6, total: 10, day: today } },
    }
    const laptop: Progress = {
      version: 1,
      cards: {
        s1: { box: 2, due: '2026-11-05' },
        s2: { box: 4, due: '2026-11-10' },
        s3: { box: 1, due: today },
      },
      results: {
        'a0-01/quiz': { best: 9, total: 10, day: today },
        'a0-01/p1': { best: 3, total: 4, day: today },
      },
    }
    expect(mergeProgress(phone, laptop)).toEqual({
      version: 1,
      cards: {
        s1: { box: 3, due: '2026-11-01' },
        s2: { box: 4, due: '2026-11-10' },
        s3: { box: 1, due: today },
      },
      results: {
        'a0-01/quiz': { best: 9, total: 10, day: today },
        'a0-01/p1': { best: 3, total: 4, day: today },
      },
    })
  })
})

describe('parseProgress', () => {
  it('принимает свой формат и пропускает битые записи', () => {
    expect(
      parseProgress({
        version: 1,
        cards: {
          ok: { box: 2, due: '2026-10-28' },
          box0: { box: 0, due: '2026-10-28' },
          box9: { box: 9, due: '2026-10-28' },
          day: { box: 1, due: 'завтра' },
          junk: 'x',
        },
        results: {
          ok: { best: 3, total: 4, day: today },
          more: { best: 5, total: 4, day: today },
          minus: { best: -1, total: 4, day: today },
        },
      }),
    ).toEqual({
      version: 1,
      cards: { ok: { box: 2, due: '2026-10-28' } },
      results: { ok: { best: 3, total: 4, day: today } },
    })
  })

  it('чужой формат — undefined', () => {
    for (const raw of [
      null,
      'x',
      [],
      {},
      { version: 2, cards: {}, results: {} },
      { version: 1, cards: [] },
    ]) {
      expect(parseProgress(raw)).toBeUndefined()
    }
  })
})

/** Хранилище в памяти; broken — бросает на любое обращение, как в приватном режиме. */
function memoryStorage(broken = false): Storage {
  const data = new Map<string, string>()
  const guard = () => {
    if (broken) throw new DOMException('нельзя', 'SecurityError')
  }
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => (guard(), data.get(key) ?? null),
    setItem: (key, value) => (guard(), void data.set(key, value)),
    removeItem: (key) => (guard(), void data.delete(key)),
  }
}

describe('LocalStorageProgressRepository', () => {
  it('сохраняет, читает и сообщает об изменении', () => {
    const storage = memoryStorage()
    const events = new EventTarget()
    const repository = new LocalStorageProgressRepository(
      () => storage,
      () => events,
    )
    let changes = 0
    const unsubscribe = repository.subscribe(() => changes++)

    expect(repository.available()).toBe(true)
    expect(repository.load()).toEqual(emptyProgress())
    const progress = addToReview(emptyProgress(), ['a0-01-s01'], today)
    repository.save(progress)
    expect(changes).toBe(1)
    expect(repository.load()).toEqual(progress)
    expect(repository.load()).toBe(repository.load())

    unsubscribe()
    repository.save(emptyProgress())
    expect(changes).toBe(1)
  })

  it('битые данные в хранилище — пустой прогресс', () => {
    const storage = memoryStorage()
    storage.setItem(PROGRESS_KEY, '{не json')
    const repository = new LocalStorageProgressRepository(
      () => storage,
      () => undefined,
    )
    expect(repository.load()).toEqual(emptyProgress())
  })

  it('без хранилища сайт работает: ничего не бросает', () => {
    for (const storage of [
      () => memoryStorage(true),
      () => undefined,
      () => {
        throw new DOMException('нельзя', 'SecurityError')
      },
    ]) {
      const repository = new LocalStorageProgressRepository(storage, () => undefined)
      expect(repository.available()).toBe(false)
      expect(repository.load()).toEqual(emptyProgress())
      expect(() => repository.save(emptyProgress())).not.toThrow()
      expect(() => repository.subscribe(() => {})()).not.toThrow()
    }
  })
})

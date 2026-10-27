import { describe, expect, it } from 'vitest'
import { checkAnswer, orderTiles } from './answer.ts'

const verdict = (input: string, answers: string[], wrong?: string) =>
  checkAnswer(input, answers, { wrong }).verdict

describe('checkAnswer', () => {
  it('не обращает внимания на регистр, пробелы, пунктуацию и ¿ ¡', () => {
    const answers = ['Hola. ¿De dónde eres?']
    expect(verdict('Hola. ¿De dónde eres?', answers)).toBe('correct')
    expect(verdict('hola de dónde eres', answers)).toBe('correct')
    expect(verdict('  HOLA,   ¿de  dónde   eres!!  ', answers)).toBe('correct')
    expect(verdict('Hola — de dónde eres?', answers)).toBe('correct')
  })

  it('не путается в разметке выделения', () => {
    expect(verdict('Quiero aprender español', ['Quiero **aprender** español.'])).toBe('correct')
  })

  it('без знаков над буквами — почти верно, с подсказкой, в каких словах', () => {
    const check = checkAnswer('Buenos dias, Victor', ['Buenos días, Víctor.'])
    expect(check.verdict).toBe('almost')
    expect(check.accents).toEqual(['días', 'Víctor'])

    expect(checkAnswer('Soy de Espana', ['Soy de España.']).accents).toEqual(['España'])
    expect(checkAnswer('Hóla', ['Hola.']).accents).toEqual(['Hola'])
  })

  it('буквы, разложенные на знаки (NFD), — то же, что обычные', () => {
    expect(verdict('Buenos días', ['Buenos días.'])).toBe('correct')
  })

  it('принимает любой из верных ответов и называет, с каким совпало', () => {
    const answers = ['Hablo español.', 'Yo hablo español.']
    expect(checkAnswer('yo hablo español', answers)).toMatchObject({
      verdict: 'correct',
      answer: 'Yo hablo español.',
    })
    expect(checkAnswer('yo hablo espanol', answers)).toMatchObject({
      verdict: 'almost',
      answer: 'Yo hablo español.',
      accents: ['español'],
    })
  })

  it('верный ответ важнее «почти»: сначала ищет точное совпадение', () => {
    // Первый вариант совпал бы без знаков, второй — точно.
    expect(verdict('tu hablas', ['Tú hablas.', 'Tu hablas.'])).toBe('correct')
  })

  it('при ошибке отдаёт эталон', () => {
    expect(checkAnswer('Buenas días', ['Buenos días.', 'Buen día.'])).toEqual({
      verdict: 'wrong',
      answer: 'Buenos días.',
      accents: [],
      unchanged: false,
    })
    expect(verdict('', ['Hola.'])).toBe('wrong')
    expect(verdict('Hola Hola', ['Hola.'])).toBe('wrong')
  })

  describe('«Найдите ошибку»', () => {
    it('ошибка в букве — обычные правила', () => {
      const answers = ['**Hola**, me llamo Ana.']
      expect(verdict('Hola, me llamo Ana.', answers, 'Ola, me llamo Ana.')).toBe('correct')
      expect(verdict('Ola, me llamo Ana.', answers, 'Ola, me llamo Ana.')).toBe('wrong')
    })

    it('ошибка в знаке над буквой — без него неверно, а не «почти»', () => {
      const answers = ['Buenos **días**, Víctor.']
      const wrong = 'Buenos dias, Víctor.'
      expect(verdict('Buenos días, Víctor.', answers, wrong)).toBe('correct')
      expect(verdict('Buenos dias, Víctor.', answers, wrong)).toBe('wrong')
      // Исправил ошибку, но потерял знак в другом слове — почти верно.
      expect(checkAnswer('Buenos días, Victor', answers, { wrong })).toMatchObject({
        verdict: 'almost',
        accents: ['Víctor'],
      })
    })

    it('ошибка в ¿ ¡ — без него неверно', () => {
      const answers = ['Hola. **¿**De dónde eres?']
      const wrong = 'Hola. De dónde eres?'
      expect(verdict('Hola. ¿De dónde eres?', answers, wrong)).toBe('correct')
      expect(verdict('Hola. De dónde eres?', answers, wrong)).toBe('wrong')
      expect(verdict('¿Hola. De dónde eres?', answers, wrong)).toBe('wrong')
      expect(verdict('Hola. ¿De donde eres?', answers, wrong)).toBe('almost')
    })

    it('замечает, что фразу оставили как была', () => {
      const answers = ['Me llamo Jorge. ¿Y **tú**?']
      const wrong = 'Me llamo Jorge. ¿Y tu?'
      expect(checkAnswer('me llamo jorge ¿y tu', answers, { wrong }).unchanged).toBe(true)
      expect(checkAnswer('Me llamo Jorge. Y tu?', answers, { wrong }).unchanged).toBe(false)
      expect(checkAnswer('', answers, { wrong }).unchanged).toBe(false)
    })
  })
})

describe('orderTiles', () => {
  it('режет ответ на слова без пунктуации и ¿ ¡, как написаны', () => {
    expect(orderTiles('Hola. **¿**De dónde eres?')).toEqual(['Hola', 'De', 'dónde', 'eres'])
    expect(orderTiles('¿Vas a cenar? — Sí, voy a cenar.')).toEqual([
      'Vas',
      'a',
      'cenar',
      'Sí',
      'voy',
      'a',
      'cenar',
    ])
  })

  it('собранная из плашек фраза засчитывается', () => {
    const answers = ['Gracias, hasta luego.', 'Gracias. Hasta luego.']
    expect(verdict(orderTiles(answers[0] ?? '').join(' '), answers)).toBe('correct')
    expect(verdict('hasta Gracias luego', answers)).toBe('wrong')
  })
})

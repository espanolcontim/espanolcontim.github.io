import { describe, expect, it } from 'vitest'
import { hasUnclosedMark, plainText, splitMarks } from './markup.ts'

describe('splitMarks', () => {
  it('делит строку на обычные и выделенные куски', () => {
    expect(splitMarks('Quiero **aprender** español.')).toEqual([
      { text: 'Quiero ', marked: false },
      { text: 'aprender', marked: true },
      { text: ' español.', marked: false },
    ])
  })

  it('выделение в начале строки и строка без выделения', () => {
    expect(splitMarks('**Porque** quiero.')).toEqual([
      { text: 'Porque', marked: true },
      { text: ' quiero.', marked: false },
    ])
    expect(splitMarks('Hola.')).toEqual([{ text: 'Hola.', marked: false }])
  })
})

describe('plainText', () => {
  it('убирает разметку', () => {
    expect(plainText('¿**De dónde** eres?')).toBe('¿De dónde eres?')
  })
})

describe('hasUnclosedMark', () => {
  it('ловит непарные звёздочки', () => {
    expect(hasUnclosedMark('Quiero **aprender español.')).toBe(true)
    expect(hasUnclosedMark('Quiero **aprender** español.')).toBe(false)
    expect(hasUnclosedMark('Hola.')).toBe(false)
  })
})

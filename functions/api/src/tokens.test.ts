import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LOGIN_TTL_MS, signToken, verifyToken } from './tokens.ts'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const SECRET = 'secret'

describe('токены', () => {
  it('подписанный токен проверяется: Boosty id, вид, срок', () => {
    const token = signToken('login', 12345, LOGIN_TTL_MS, NOW, SECRET)
    expect(verifyToken(token, 'login', NOW + LOGIN_TTL_MS - 1000, SECRET)).toEqual({
      use: 'login',
      sub: '12345',
      iat: NOW / 1000,
      exp: (NOW + LOGIN_TTL_MS) / 1000,
    })
  })

  it('просроченный, чужой секрет, другой вид — не принимается', () => {
    const token = signToken('login', 1, LOGIN_TTL_MS, NOW, SECRET)
    expect(verifyToken(token, 'login', NOW + LOGIN_TTL_MS, SECRET)).toBeNull()
    expect(verifyToken(token, 'login', NOW, 'other')).toBeNull()
    expect(verifyToken(token, 'session', NOW, SECRET)).toBeNull()
  })

  it('подмена данных или alg: none — не принимается', () => {
    const token = signToken('session', 1, LOGIN_TTL_MS, NOW, SECRET)
    const [header, payload, signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ use: 'session', sub: '2', iat: NOW / 1000, exp: NOW / 1000 + 60 }),
    ).toString('base64url')
    expect(verifyToken(`${header}.${forged}.${signature}`, 'session', NOW, SECRET)).toBeNull()

    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    expect(verifyToken(`${none}.${payload}.`, 'session', NOW, SECRET)).toBeNull()

    // HS256 с тем же секретом, но другим заголовком — тоже нет: принимаем только свой.
    const other = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url')
    const resigned = createHmac('sha256', SECRET).update(`${other}.${payload}`).digest('base64url')
    expect(verifyToken(`${other}.${payload}.${resigned}`, 'session', NOW, SECRET)).toBeNull()
  })

  it('мусор вместо токена — null, а не исключение', () => {
    for (const junk of ['', 'abc', 'a.b.c', 'a.b.c.d', '..']) {
      expect(verifyToken(junk, 'session', NOW, SECRET)).toBeNull()
    }
  })
})

import { ApiFailure, type ApiClient } from '../../shared/ApiClient.ts'
import type { AuthService, Session } from './AuthService.ts'
import { safeReturnPath } from './navigation.ts'

export const SESSION_KEY = 'espanolcontim:session'
/** Страница, с которой ученик пошёл входить: письмо откроется в новой вкладке. */
export const RETURN_KEY = 'espanolcontim:login-return'
/** Событие на window: вход или выход в этой вкладке. */
const CHANGED = 'espanolcontim:session'

const DAY = 24 * 60 * 60 * 1000
/** Как в functions/api/src/tokens.ts: сессия — 90 дней, `/auth/refresh` продлевает ту, что старше недели. */
const RENEW_WHEN_LEFT_MS = (90 - 7) * DAY

/** Сессия в хранилище. `retryAt` — продление не вышло, раньше этого времени не пробовать. */
type Stored = Session & { retryAt?: number }

const isStored = (value: unknown): value is Stored => {
  const stored = value as Partial<Stored> | null
  return typeof stored?.token === 'string' && typeof stored.expiresAt === 'string'
}

/**
 * Сессия в localStorage: сайт и API на разных доменах, куки не подходят. Все обращения
 * к хранилищу — в try/catch: без него сайт работает, только вход не запоминается.
 */
export class ApiAuthService implements AuthService {
  private readonly api: ApiClient
  private readonly storage: () => Storage | undefined
  private readonly events: () => EventTarget | undefined
  private readonly now: () => number

  /**
   * @param storage хранилище; функция — потому что сам доступ к localStorage может бросить
   * @param events куда слать и откуда слушать изменения; в браузере — window
   */
  constructor(
    api: ApiClient,
    storage: () => Storage | undefined,
    events: () => EventTarget | undefined,
    now: () => number,
  ) {
    this.api = api
    this.storage = storage
    this.events = events
    this.now = now
  }

  available(): boolean {
    try {
      const storage = this.storage()
      if (!storage) return false
      storage.setItem(`${SESSION_KEY}:test`, '1')
      storage.removeItem(`${SESSION_KEY}:test`)
      return true
    } catch {
      return false
    }
  }

  session(): Session | undefined {
    const stored = this.read()
    return stored && Date.parse(stored.expiresAt) > this.now() ? stored : undefined
  }

  async requestLink(email: string, returnTo?: string): Promise<void> {
    await this.api.request('POST', '/auth/request', { body: { email } })
    this.set(RETURN_KEY, returnTo)
  }

  async signIn(loginToken: string): Promise<string> {
    const session = await this.api.request<Session>('POST', '/auth/verify', {
      body: { token: loginToken },
    })
    this.write(session)
    const returnTo = this.get(RETURN_KEY)
    this.set(RETURN_KEY, undefined)
    return safeReturnPath(returnTo)
  }

  async renew(): Promise<void> {
    const stored = this.read()
    if (!stored) return
    const now = this.now()
    const left = Date.parse(stored.expiresAt) - now
    if (left <= 0 || left > RENEW_WHEN_LEFT_MS || (stored.retryAt ?? 0) > now) return
    try {
      this.write(await this.api.request<Session>('POST', '/auth/refresh', { token: stored.token }))
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.code === 'invalid_token') {
        this.signOut()
        return
      }
      // Подписка кончилась или нет сети: сессию не трогаем, запас большой — через сутки ещё раз.
      this.write({ ...stored, retryAt: now + DAY })
    }
  }

  signOut(): void {
    this.set(SESSION_KEY, undefined)
    this.events()?.dispatchEvent(new Event(CHANGED))
  }

  subscribe(listener: () => void): () => void {
    const target = this.events()
    if (!target) return () => {}
    // storage — изменение из другой вкладки.
    const onStorage = (event: Event) => {
      if ((event as StorageEvent).key === SESSION_KEY) listener()
    }
    target.addEventListener(CHANGED, listener)
    target.addEventListener('storage', onStorage)
    return () => {
      target.removeEventListener(CHANGED, listener)
      target.removeEventListener('storage', onStorage)
    }
  }

  private read(): Stored | undefined {
    try {
      const value: unknown = JSON.parse(this.get(SESSION_KEY) ?? 'null')
      return isStored(value) ? value : undefined
    } catch {
      return undefined
    }
  }

  private write(session: Stored): void {
    this.set(SESSION_KEY, JSON.stringify(session))
    this.events()?.dispatchEvent(new Event(CHANGED))
  }

  private get(key: string): string | null {
    try {
      return this.storage()?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  private set(key: string, value: string | undefined): void {
    try {
      if (value === undefined) this.storage()?.removeItem(key)
      else this.storage()?.setItem(key, value)
    } catch {
      // Не сохранилось — вход не запомнится, страница входа об этом предупреждает.
    }
  }
}

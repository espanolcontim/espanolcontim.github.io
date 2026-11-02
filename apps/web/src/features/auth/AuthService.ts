/** Сессия подписчика: токен для `Authorization` и когда он кончится (ISO). */
export interface Session {
  token: string
  expiresAt: string
}

/**
 * Вход подписчика: запрос ссылки, обмен её на сессию, продление, выход.
 * Ошибки API — ApiFailure.
 */
export interface AuthService {
  /** Можно ли запомнить вход: без хранилища сессию негде держать. */
  available(): boolean
  /** Действующая сессия; вышла или просрочена — undefined. */
  session(): Session | undefined
  /** Письмо со ссылкой на почту. `returnTo` — куда вернуть ученика после входа. */
  requestLink(email: string, returnTo?: string): Promise<void>
  /** Токен из ссылки → сессия. Возвращает страницу, куда теперь идти. */
  signIn(loginToken: string): Promise<string>
  /** Продлить сессию, если пора; не вышло — ничего страшного, попробует позже. */
  renew(): Promise<void>
  signOut(): void
  /** Подписка на вход и выход, в том числе в других вкладках. */
  subscribe(listener: () => void): () => void
}

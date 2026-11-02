import type { LessonBody } from '@espanolcontim/content'
import { ApiFailure, type ApiClient } from '../../shared/ApiClient.ts'
import type { AuthService } from '../auth/AuthService.ts'
import type { LessonRepository } from './LessonRepository.ts'

/**
 * Платные части урока через API — в браузере подписчика. Списка уроков здесь нет:
 * его страницы получают при сборке (StaticLessonRepository).
 * Схемой ответ не проверяем: zod не тянем в браузер, а файлы проверены при выгрузке в бакет.
 */
export class ApiLessonRepository implements Pick<LessonRepository, 'getBody'> {
  private readonly api: ApiClient
  private readonly auth: AuthService

  constructor(api: ApiClient, auth: AuthService) {
    this.api = api
    this.auth = auth
  }

  /** Платная половина урока; такой нет в бакете — undefined. Нет доступа — ApiFailure. */
  async getBody(id: string): Promise<LessonBody | undefined> {
    const token = this.auth.session()?.token
    if (!token) throw new ApiFailure('invalid_token')
    try {
      return await this.api.request<LessonBody>('GET', `/lessons/${encodeURIComponent(id)}/body`, {
        token,
      })
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.code === 'not_found') return undefined
      // Сессия больше не действует: дальше ученик — гость и может войти заново.
      if (failure instanceof ApiFailure && failure.code === 'invalid_token') this.auth.signOut()
      throw failure
    }
  }
}

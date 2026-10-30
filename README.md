# Español con Tim — сайт курса

Сайт курса «Испанский с нуля»: конспекты уроков, дополнительные материалы, упражнения.

- Сайт: https://espanolcontim.ru/ — Yandex Object Storage (`docs/object-storage.md`). Публикуется сам при каждом push в `main` (`.github/workflows/deploy.yml`).
- Разработка — в ветке `develop`: push туда проверяет линтер, тесты и сборку (`.github/workflows/check.yml`), но ничего не публикует. Выложить на сайт — влить `develop` в `main`.
- Поиск, превью ссылок, Яндекс Метрика — `docs/seo.md`; персональные данные и Роскомнадзор — `docs/privacy.md`.
- Вход подписчиков Boosty: функции Yandex Cloud и приватный бакет — `docs/backend.md`.
- Спецификация и план по фазам — `docs/SPEC.md`.
- Где остановились и что дальше — `docs/STATUS.md`.
- Правила для Claude Code — `CLAUDE.md`.
- Откуда берётся контент — `docs/content-sources.md`.

## Как развернуть на новом компьютере

1. Нужны git и Node.js 22.23 или новее; проверки и деплой собирают на Node 24. С nvm в папке проекта достаточно `nvm install` / `nvm use` — версия берётся из `.nvmrc`.
2. Два репозитория — рядом, в одной папке:
   ```bash
   git clone https://github.com/espanolcontim/espanolcontim.github.io.git espanolcontim
   git clone git@github.com:timu-ryan/video-lessons.git video-lessons
   ```
3. В папке `espanolcontim`:
   ```bash
   # почта автора коммитов — только для этого репозитория
   git config user.name "Тимур Гафаров"
   git config user.email espanolcontim@gmail.com
   git switch develop       # разработка — здесь; main — то, что на сайте

   npm ci
   npm run content:import   # пересобирает content/ и создаёт content/private (его нет в git)
   npm run dev              # сайт на http://localhost:4321/
   ```
4. Claude Code запускать из `espanolcontim` с доступом к урокам:
   ```bash
   claude --add-dir ../video-lessons
   ```
5. Для `git push` по HTTPS GitHub просит не пароль, а personal access token
   (GitHub → Settings → Developer settings → Personal access tokens).
6. Исходник фото на главной (`docs/design/tim.png`) в git не хранится — он нужен, только чтобы заново вырезать фото; перенести вручную, если понадобится.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | сайт локально, http://localhost:4321/ |
| `npm run build` | проверка типов Astro и сборка в `apps/web/dist/` |
| `npm test` | тесты (Vitest) |
| `npm run typecheck` | проверка типов всех пакетов |
| `npm run lint` | линтер (oxlint) |
| `npm run format` | форматирование (Prettier) |
| `npm run content:import` | импорт уроков из `../video-lessons`; `-- 1 8 11` — только эти, `-- --check` — проверить без записи |
| `npm run sync:local` | функция `sync` на этом компьютере: настоящий Boosty, вместо бакета — папка `.bucket` |
| `npm run api:local` | функция `api` на http://localhost:8787; `-- --subscriber почта` — считать её подписчиком, `-- --send` — отправлять письма по-настоящему |
| `npm run functions:build` | сборка функций Yandex Cloud в `functions/<имя>/dist/` |

## Как обновить уроки на сайте

1. В `video-lessons` появился или изменился урок.
2. `npm run content:import` и прочитать отчёт. Строка «исчезли из урока» означает, что фразы правили. Если правка небольшая и прогресс учеников по фразе нужно сохранить, номер возвращают в `content/ids.lock.json` (см. «Стабильные id» в `docs/SPEC.md`).
3. Закоммитить `content/public` и `content/ids.lock.json`, сделать push — сайт обновится сам.

`content/private` — платные материалы — в git не попадают никогда.

## Функция sync

Раз в час выгружает подписчиков Boosty и пишет в приватный бакет кэш активных платных: Boosty id, хэш почты, уровень (`functions/sync/`, план — фаза 2 в `docs/SPEC.md`). Сама обновляет токен Boosty за неделю до конца (токен живёт 30 дней). Если Boosty не ответил или ответил странно, кэш не перезаписывается: вход у подписчиков продолжает работать по прежнему списку.

**Файлы в приватном бакете** (на компьютере — в папке `.bucket/`, она в `.gitignore`):

| Файл | Что | Кто пишет |
|---|---|---|
| `boosty/auth.json` | токены Boosty | вы — один раз; дальше `sync` обновляет сам |
| `overrides.json` | почта подписчиков, у которых её нет в Boosty | вы, вручную |
| `subscribers.json` | кэш активных платных подписчиков, без почты в открытом виде | `sync` |

**Токены Boosty** (`boosty/auth.json`). Брать из отдельного входа в Boosty, не из основного браузера: refresh token после каждого обновления новый, и две копии одного входа (браузер и функция, облако и компьютер), скорее всего, будут выбивать друг друга.
1. Новое приватное окно (или другой профиль браузера) → boosty.to → войти.
2. F12 → Application → Local Storage → `https://boosty.to`: скопировать значение ключа `auth` и значение ключа `_clentId` (так, с опечаткой, у Boosty).
3. Закрыть окно, **не нажимая «Выйти»**: выход отменяет токены.
4. Файл `boosty/auth.json` — это `auth` и ещё одно поле `deviceId` со значением `_clentId`:
   ```json
   { "accessToken": "…", "refreshToken": "…", "expiresAt": 1796000000000, "deviceId": "…" }
   ```
   Токены не вставлять в чаты и не коммитить: они дают полный доступ к аккаунту Boosty.

Заменить токены нужно, если в логах `sync` — «Boosty не обновил токен».

**Подписчики без почты в Boosty** (аккаунт через VK). Подписчик пишет почту в личку на Boosty → дописать в `overrides.json` его Boosty id и почту:
```json
{ "12345678": "ivan@example.ru" }
```
Запись сама доступа не даёт: она действует, только пока у подписчика активная платная подписка. Boosty id — в ссылке на профиль подписчика.

**Переменные окружения функции:** `BUCKET` — приватный бакет, `BOOSTY_BLOG` — `espanolcontim`, `EMAIL_HASH_SECRET` — случайная строка (`openssl rand -hex 32`), одна и та же у `sync` и `api`. Бакет функция читает от имени своего сервисного аккаунта, ключи доступа не нужны.

**На компьютере** — `npm run sync:local`: настоящий Boosty, вместо бакета — `.bucket/`, переменные — из `.env`. Токены в `.bucket/boosty/auth.json` — от своего отдельного входа в Boosty, не копия облачных.

**В Yandex Cloud** — каталог `backend`, бакет, сервисный аккаунт, функция и таймер: `docs/backend.md`. Новая версия функции: `npm run functions:build` и загрузить `functions/sync/dist/sync.zip` в консоли (функция → «Редактор» → ZIP-архив → «Сохранить изменения»).

## Функция api

Вход подписчиков и платные уроки (`functions/api/`), за API Gateway на `https://api.espanolcontim.ru` (`docs/backend.md`). Сессия — подписанный токен на 90 дней, субъект — Boosty id; подписка проверяется на каждом запросе по кэшу `sync`. Базы нет: всё — файлы в приватном бакете.

| Запрос | Что делает |
|---|---|
| `POST /auth/request {email}` | письмо со ссылкой `https://espanolcontim.ru/login/#token=…` (15 минут), если почта есть среди активных платных подписчиков. Ответ `{ok: true}` в любом случае — кто подписан, не видно. На один адрес — не чаще раза в минуту и не больше 5 писем в час |
| `POST /auth/verify {token}` | ссылка из письма → `{token, expiresAt}` — сессия на 90 дней |
| `POST /auth/refresh` | сессия старше недели → новая на 90 дней, иначе та же |
| `GET /lessons/:id/body` | платная часть урока — `lessons/<id>.json` из бакета |

Сессия передаётся в `Authorization: Bearer …`. Ошибки — `{error: код}`: `bad_request` (400), `invalid_token` (401 — ссылка или сессия недействительна), `not_subscribed` (403 — подписка кончилась), `not_found` (404), `mail_failed` (502 — письмо не ушло). CORS — только для адреса сайта.

**На компьютере** — `npm run api:local`: http://localhost:8787, бакет — `.bucket/`, платные уроки — прямо из `content/private/lessons`, секреты — из `.env` (`SESSION_SECRET`, `EMAIL_HASH_SECRET`, для `--send` — `SMTP_USER` и `SMTP_PASSWORD`). Платных подписчиков пока нет, поэтому для проверки входа — `npm run api:local -- --subscriber почта`. Письма печатаются в консоль; `-- --send` — отправить по-настоящему.

## Устройство

```
apps/web/            сайт: Astro + React, страницы в src/pages, фичи в src/features
packages/content/    схема контента (zod), правила доступа, id, общие функции
functions/           функции Yandex Cloud: sync — подписчики Boosty; api — вход и платные уроки; shared — общий код (бакет, кэш подписчиков)
scripts/             импорт контента (content:import), сборка функций
content/public/      бесплатный контент (в git)
content/private/     платный контент (не в git)
content/ids.lock.json   постоянные id предложений
content/videos.json     ссылки на YouTube
docs/                спецификация, статус, источники, обложки
```

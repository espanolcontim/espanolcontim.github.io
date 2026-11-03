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
4. `.env` — перенести с другого компьютера руками (см. «Секреты»). Сайт, тесты и сборка работают и без него; он нужен для `sync:local`, `api:local` и `content:upload`.
5. Claude Code запускать из `espanolcontim` с доступом к урокам:
   ```bash
   claude --add-dir ../video-lessons
   ```
6. Для `git push` по HTTPS GitHub просит не пароль, а personal access token
   (GitHub → Settings → Developer settings → Personal access tokens).
7. Исходник фото на главной (`docs/design/tim.png`) в git не хранится — он нужен, только чтобы заново вырезать фото; перенести вручную, если понадобится.

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

Раз в час выгружает подписчиков Boosty и пишет в приватный бакет кэш активных платных: Boosty id, хэш почты, уровень (`functions/sync/`, план — фаза 2 в `docs/SPEC.md`). Ещё её вызывает `api`, когда почты нет в кэше: так новый подписчик входит сразу после оплаты. Тогда `sync` не повторяет запросы к Boosty и не обновляет токен. Токен Boosty обновляет только таймер, за неделю до конца (токен живёт 30 дней). Если Boosty не ответил или ответил странно, кэш не перезаписывается: вход у подписчиков продолжает работать по прежнему списку.

**Файлы в приватном бакете** (на компьютере — в папке `.bucket/`, она в `.gitignore`):

| Файл | Что | Кто пишет |
|---|---|---|
| `boosty/auth.json` | токены Boosty | вы — один раз; дальше `sync` обновляет сам |
| `overrides.json` | почта подписчиков, у которых её нет в Boosty | вы, вручную |
| `free-access.json` | кто входит без подписки: вы, тестеры | вы, вручную |
| `subscribers.json` | кэш тех, кому открыт вход, без почты в открытом виде | `sync` |
| `lessons/<id>.json` | платные половины уроков | `npm run content:upload` |
| `login-requests/<хэш почты>.json` | когда отправлялись письма со ссылкой | `api` |

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

**Вход без подписки** (вы, тестеры) — `free-access.json`, в том же виде. id — любые цифры. Здесь запись сама даёт доступ: убрать её — доступ закроется при следующем запуске `sync`. В отчёте `sync` такие люди считаются отдельно (`freeAccess`), подписчиками не становятся.

**Переменные окружения функции:** `BUCKET` — приватный бакет, `BOOSTY_BLOG` — `espanolcontim`, `EMAIL_HASH_SECRET` — случайная строка (`openssl rand -hex 32`), одна и та же у `sync` и `api`. Бакет функция читает от имени своего сервисного аккаунта, ключи доступа не нужны.

**На компьютере** — `npm run sync:local`: настоящий Boosty, вместо бакета — `.bucket/`, переменные — из `.env`. Токены в `.bucket/boosty/auth.json` — от своего отдельного входа в Boosty, не копия облачных.

**В Yandex Cloud** — каталог `backend`, бакет, сервисный аккаунт, функция и таймер: `docs/backend.md`. Новая версия функции: `npm run functions:build` и загрузить `functions/<имя>/dist/<имя>.zip` в консоли (функция → «Редактор» → ZIP-архив → «Сохранить изменения»).

## Функция api

Вход подписчиков и платные уроки (`functions/api/`), за API Gateway на `https://api.espanolcontim.ru` (`docs/backend.md`). Сессия — подписанный токен на 90 дней, субъект — Boosty id; подписка проверяется на каждом запросе по кэшу `sync` (нет в кэше — как и для почты, сначала вызывает `sync`: так продлившему подписку не нужно входить заново). Базы нет: всё — файлы в приватном бакете.

Переменные в облаке: `BUCKET`, `EMAIL_HASH_SECRET`, `SESSION_SECRET`, `SMTP_USER`, `SMTP_PASSWORD` и `SYNC_FUNCTION_ID` — id функции `sync`, не секрет (`docs/backend.md`, шаг 19). Без `SYNC_FUNCTION_ID` новый подписчик ждёт таймера.

| Запрос | Что делает |
|---|---|
| `POST /auth/request {email}` | письмо со ссылкой `https://espanolcontim.ru/login/#token=…` (15 минут), если почта есть среди активных платных подписчиков. Нет в кэше — сначала вызывает `sync` (не чаще раза в минуту на всех) и смотрит ещё раз. Ответ `{ok: true}` в любом случае и не раньше чем через 3 секунды — ни по ответу, ни по времени не видно, кто подписан. На один адрес — не чаще раза в минуту и не больше 5 писем в час |
| `POST /auth/verify {token}` | ссылка из письма → `{token, expiresAt}` — сессия на 90 дней |
| `POST /auth/refresh` | сессия старше недели → новая на 90 дней, иначе та же |
| `GET /lessons/:id/body` | платная часть урока — `lessons/<id>.json` из бакета |

Сессия передаётся в `Authorization: Bearer …`. Ошибки — `{error: код}`: `bad_request` (400), `invalid_token` (401 — ссылка или сессия недействительна), `not_subscribed` (403 — подписка кончилась), `not_found` (404), `mail_failed` (502 — письмо не ушло). CORS — только для адреса сайта.

**На компьютере** — `npm run api:local`: http://localhost:8787, бакет — `.bucket/`, платные уроки — прямо из `content/private/lessons`, секреты — из `.env` (`SESSION_SECRET`, `EMAIL_HASH_SECRET`, для `--send` — `SMTP_USER` и `SMTP_PASSWORD`). Войти под любой почтой, не подписываясь, — `npm run api:local -- --subscriber почта`. Письма печатаются в консоль; `-- --send` — отправить по-настоящему. `npm run dev` сам ходит на этот адрес: вход на сайте проверяется на http://localhost:4321/login/. Другой адрес API для сборки — `PUBLIC_API_URL`.

**Платные уроки в бакет** — `npm run content:upload` (`-- --check` — только показать, что изменится). Проверяет файлы схемой, загружает изменённое, удаляет лишнее. Ключ — `CONTENT_UPLOAD_KEY_ID` и `CONTENT_UPLOAD_SECRET` в `.env` (`docs/backend.md`, шаг 16). Запускать после `content:import`, если изменились платные части.

## Yandex Cloud

Всё — в https://console.yandex.cloud под Яндекс ID почты `espanolcontim@yandex.ru`, в двух каталогах. Ключ деплоя сайта до каталога `backend` не дотягивается. Как всё создавалось, по шагам, — `docs/object-storage.md` (сайт) и `docs/backend.md` (вход, шаги 1–18); по ним же разворачивать заново.

| Каталог | Что там |
|---|---|
| `site` | бакеты `espanolcontim.ru` (сайт) и `www.espanolcontim.ru` (переадресация), зона DNS `espanolcontim.ru.`, сертификат сайта, сервисный аккаунт `site-deploy` |
| `backend` | приватный бакет `espanolcontim-private`; функции `sync` и `api` и одноимённые сервисные аккаунты; таймер `sync-hourly` (каждый час в :00 по UTC); API Gateway `api` на `api.espanolcontim.ru` (`functions/api/gateway.yaml`) и его сертификат; сервисный аккаунт `content-upload` |

**Как обновить:**
- сайт — push в `main`, дальше сам;
- функцию — `git pull`, `npm ci`, `npm run functions:build` → в консоли функция → «Редактор» → «ZIP-архив» → `functions/<имя>/dist/<имя>.zip` → «Сохранить изменения». Остальные настройки и переменные консоль берёт из прошлой версии. Таймер и шлюз вызывают `$latest`, больше ничего делать не нужно;
- платные уроки — `npm run content:upload`;
- `overrides.json`, `free-access.json` — загрузить поверх в корень бакета. Новая почта действует сразу: её нет в кэше, и `api` сама вызовет `sync`. Убранная запись — со следующего запуска по таймеру, в течение часа; сразу — «Тестирование» функции `sync` с входными данными `{}`.

Что делать, если сломалось, — `docs/backend.md`, «Если что-то сломалось».

## Секреты

В git нет ни одного. Значения не вставлять в чаты и не пересылать.

| Секрет | Где лежит | Если утёк или потерялся |
|---|---|---|
| Токены Boosty | бакет, `boosty/auth.json`; `sync` обновляет их сама | взять заново из отдельного входа в Boosty («Функция sync») и загрузить поверх |
| `EMAIL_HASH_SECRET` | переменные `sync` и `api`, `.env`; везде один и тот же | новый — в обе функции и в `.env`, потом тест `sync`: пока кэш не пересчитан, писем не будет никому |
| `SESSION_SECRET` | переменная `api`. В `.env` — другой, для `api:local`: сессии с компьютера в облаке не действуют | новый у `api`: все сессии недействительны, подписчики входят заново |
| `SMTP_PASSWORD` (и `SMTP_USER`) | переменные `api`, `.env` | удалить пароль приложения на id.yandex.ru, создать новый, заменить у `api` и в `.env` (`docs/backend.md`, шаг 9) |
| `CONTENT_UPLOAD_KEY_ID`, `CONTENT_UPLOAD_SECRET` | `.env` | удалить ключ у сервисного аккаунта `content-upload`, выпустить новый (`docs/backend.md`, шаг 16) |
| `YC_ACCESS_KEY_ID`, `YC_SECRET_ACCESS_KEY` | секреты репозитория на GitHub (Settings → Secrets and variables → Actions) | ключ `site-deploy` — удалить и выпустить новый (`docs/object-storage.md`, шаг 8) |

Почта подписчиков в открытом виде — только в бакете (`overrides.json`, `free-access.json`) и в `.bucket/` на компьютере (в `.gitignore`). Файлы для бакета создавать вне папки проекта и удалять после загрузки (`docs/backend.md`, шаг 17).

`.env` — в корне проекта, на каждом компьютере свой (в `.gitignore`). Строки: `BOOSTY_BLOG`, `EMAIL_HASH_SECRET`, `SESSION_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, `CONTENT_UPLOAD_KEY_ID`, `CONTENT_UPLOAD_SECRET`. Lockbox не используем: он платный, а переменные функции видит только владелец облака.

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

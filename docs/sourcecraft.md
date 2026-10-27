# Переезд на SourceCraft Sites

Решение Тимура: основной хостинг — SourceCraft Sites (Яндекс, Россия), адрес `https://espanolcontim.sourcecraft.site/`. Зачем — `docs/privacy.md` (GitHub Pages в США видит IP посетителей).

## Что известно из документации

- Сайт публикуется из **публичного репозитория публичной организации**. Если репозиторий называется так же, как организация (`espanolcontim/espanolcontim`), сайт открывается в корне `https://espanolcontim.sourcecraft.site/` и ещё по пути `/espanolcontim/` — это дубль, canonical его закрывает.
- Настройки — `.sourcecraft/sites.yaml`:
  ```yaml
  site:
    root: "<папка с файлами сайта>"   # от корня репозитория, по умолчанию — корень
    ref: "<ветка или тег>"            # по умолчанию — основная ветка
  ```
  После коммита в эту ветку сайт обновляется за несколько минут.
- HTTPS — сам, сертификат не нужен. Серверного кода нет (у нас и так статика).
- Подтверждение в Яндекс Вебмастере: репозиторий с именем организации + мета-тег `yandex-verification` на главной — подтверждает все сайты организации.
- Документация: https://sourcecraft.dev/portal/docs/ru/sourcecraft/concepts/sites, https://sourcecraft.dev/portal/docs/ru/sourcecraft/tutorials/sites, FAQ — https://sourcecraft.dev/portal/docs/ru/sourcecraft/qa/sourcecraft-sites.
- Нельзя: service worker и встраивание сайта во `<iframe>` (заголовок `Content-Security-Policy: frame-ancestors 'none'; worker-src 'none'`). Своего домена нет.
- **Зеркало GitHub.** Репозиторий можно импортировать с GitHub с синхронизацией выбранных веток: раз в два часа или по кнопке «Синхронизировать сейчас» на странице репозитория (не больше 50 синхронизаций в сутки). Зеркальные ветки в SourceCraft защищены — менять их можно только через GitHub; незеркальные (у нас `release`) — обычные. Документация: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/migration. Синхронизация запускает CI так же, как push (проверено 27.10.2026).
- **CI бесплатно:** 1000 минут в месяц на публичные репозитории (наша сборка — около 3 минут); кубик — до 20 минут, клонирование — до 60 секунд. Справочник `ci.yaml` — https://sourcecraft.dev/portal/docs/ru/sourcecraft/ci-cd-ref/. CI умеет собирать сайт: в шаблоне `sites-landing` воркфлоу `build-site` в `.sourcecraft/ci.yaml` — кубик в `node:22-slim` собирает, кубик без образа (у воркера есть git и права на запись) делает `git checkout -b release` и `git push origin release -f`. Имени и почты для коммитов у воркера нет — без `git config user.name/user.email` коммит падает.

## Как устроено

Код по-прежнему пушим на GitHub. SourceCraft-репозиторий https://sourcecraft.dev/espanolcontim/espanolcontim — зеркало GitHub (`main`). После синхронизации CI SourceCraft (`.sourcecraft/ci.yaml`) собирает сайт с `SITE_URL=https://espanolcontim.sourcecraft.site` и кладёт `apps/web/dist` в корень ветки `release` одним коммитом без истории; Sites публикует `release` (`.sourcecraft/sites.yaml`). GitHub Pages пока собирается как раньше, из того же `main`.

## Как отдаёт сайт (проверено 27.10.2026)

- Работает: главная, все разделы, `/lessons/a0-01/` → `index.html`, `/lessons/a0-01` → 302 на адрес со слэшем, robots.txt, sitemap, значки, картинка превью, скрипты и стили. Дубль `/espanolcontim/…` тоже открывается, canonical ведёт на корень.
- **404 — своя страница SourceCraft** («Page Not Found - SourceCraft Sites»), наш `404.html` не используется. Код ответа верный (404), для поиска этого достаточно. Настройки для своей 404 в документации нет.
- **Нет сжатия и кэширования.** Ответы без `Content-Encoding` (gzip/br), без `Cache-Control`, `ETag` и `Last-Modified` — браузер скачивает файлы целиком при каждом переходе. По весу без сжатия: главная 12 КБ (сжатая была бы 3), упражнения урока 43 КБ (8), `/repaso/` 211 КБ (23), все скрипты и стили 279 КБ (90). Шрифты (woff2) и картинки (AVIF) и так сжаты. На GitHub Pages — gzip и `max-age=600`. Настроить заголовки на SourceCraft Sites нельзя; можно спросить поддержку.
- **Cookie хостинга.** На каждый ответ балансировщик Яндекс Облака (`server: ycalb`) ставит cookie `_yasc` на `.espanolcontim.sourcecraft.site`, срок — 10 лет, `Secure`, `SameSite=None`. Ставится до любого согласия, убрать его с нашей стороны нельзя. Назначение в документации SourceCraft не описано (у Яндекса этот cookie связан с защитой от ботов). Нужно назвать в политике, раздел «Хостинг» (`docs/privacy.md`, «После подачи»).

## Что сделать Тимуру

1. ~~Войти на https://sourcecraft.dev через Яндекс ID.~~
2. ~~Публичная организация `espanolcontim`, в ней публичный репозиторий `espanolcontim`~~ — сделан импортом с GitHub с синхронизацией. В синхронизации — только `main`: ветку `release` пишет CI SourceCraft, синхронизация не должна её трогать.
3. ~~Персональный токен доступа~~ — при зеркале не нужен: пушим на GitHub. Понадобится, если откажемся от зеркала.
4. Яндекс Вебмастер: добавить `https://espanolcontim.sourcecraft.site`, способ подтверждения «Мета-тег», прислать значение `content`.
5. Метрика: в настройках счётчика 113827960 поменять адрес сайта на `espanolcontim.sourcecraft.site`.

## Что сделать Claude

1. ~~Второй remote~~ — вместо него зеркало (см. «Как устроено»).
2. ~~`.sourcecraft/ci.yaml` и `.sourcecraft/sites.yaml`~~ — работают: синхронизация запускает `build-site` (Node 24, как на GitHub; перед сборкой — lint и тесты), сборка — в ветке `release`, сайт открывается.
3. Основной адрес по умолчанию — SourceCraft: `site` в `apps/web/astro.config.mjs` (тогда и сборка GitHub Pages ставит canonical на SourceCraft), ссылки в README, `CLAUDE.md`, `docs/seo.md`, `docs/privacy.md`. ~~`/lessons/a0-01/` и 404~~ — проверено (см. «Как отдаёт сайт»).
4. Новый мета-тег Вебмастера — в `YANDEX_VERIFICATION` (`app/seo.ts`).
5. В день запуска (дата из уведомления в Роскомнадзор): `METRIKA_ID = 113827960`, политика — почта на Яндексе, раздел «Хостинг» (с cookie `_yasc`), дата редакции; выключить GitHub Pages (Settings → Pages, убрать `.github/workflows/deploy.yml`) — если Тимур согласен (ответ «пока пусть остаётся» был до разговора о трансграничной передаче; см. `docs/privacy.md`).
6. Проверить на новом адресе: ~~sitemap, robots.txt, превью ссылок (картинка отдаётся), значок~~, уведомление о cookie, Метрику (`docs/seo.md`).

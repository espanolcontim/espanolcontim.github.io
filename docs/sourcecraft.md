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
- **CI/CD умеет собирать сайт.** В шаблоне `sites-landing` воркфлоу `build-site` (`.sourcecraft/ci.yaml`) собирает сайт из `main` и кладёт готовые файлы в ветку `release`, откуда Sites и публикует. Содержимое `ci.yaml` в документации не приведено — посмотреть в шаблоне.
- HTTPS — сам, сертификат не нужен. Серверного кода нет (у нас и так статика).
- Подтверждение в Яндекс Вебмастере: репозиторий с именем организации + мета-тег `yandex-verification` на главной — подтверждает все сайты организации.
- Документация: https://sourcecraft.dev/portal/docs/ru/sourcecraft/concepts/sites, https://sourcecraft.dev/portal/docs/ru/sourcecraft/tutorials/sites, FAQ — https://sourcecraft.dev/portal/docs/ru/sourcecraft/qa/sourcecraft-sites.

## Что сделать Тимуру

1. Войти на https://sourcecraft.dev через Яндекс ID.
2. Создать **публичную организацию** `espanolcontim` и в ней **публичный репозиторий** `espanolcontim` (пустой). Можно сначала посмотреть шаблон `sites-landing` — в нём готовый `ci.yaml`.
3. Создать **персональный токен доступа** для git (в чат его не вставлять — сохранить в git на своём компьютере).
4. Яндекс Вебмастер: добавить `https://espanolcontim.sourcecraft.site`, способ подтверждения «Мета-тег», прислать значение `content`.
5. Метрика: в настройках счётчика 113827960 поменять адрес сайта на `espanolcontim.sourcecraft.site`.

## Что сделать Claude

1. Добавить SourceCraft как второй remote; репозиторий кода может остаться и на GitHub — там нет персональных данных.
2. `.sourcecraft/ci.yaml`: Node.js 22.23+ (так требует Astro 7), `npm ci`, `npm run build` с `SITE_URL=https://espanolcontim.sourcecraft.site`, готовый `apps/web/dist/` — в ветку `release`. `.sourcecraft/sites.yaml`: `ref: release`, `root` — корень ветки.
   Если CI не подойдёт — запасной путь: `npm run deploy` собирает локально и коммитит сборку в `release`.
3. Основной адрес по умолчанию — SourceCraft: `site` в `apps/web/astro.config.mjs`, ссылки в README, `CLAUDE.md`, `docs/seo.md`, `docs/privacy.md`. Проверить, что `/lessons/a0-01/` отдаёт `index.html`, а несуществующий адрес — 404.
4. Новый мета-тег Вебмастера — в `YANDEX_VERIFICATION` (`app/seo.ts`).
5. В день запуска (дата из уведомления в Роскомнадзор): `METRIKA_ID = 113827960`, политика — почта на Яндексе, раздел «Хостинг», дата редакции; выключить GitHub Pages (Settings → Pages, убрать `.github/workflows/deploy.yml`) — если Тимур согласен (ответ «пока пусть остаётся» был до разговора о трансграничной передаче; см. `docs/privacy.md`).
6. Проверить на новом адресе: sitemap, robots.txt, превью ссылок, значок, уведомление о cookie, Метрику (`docs/seo.md`).

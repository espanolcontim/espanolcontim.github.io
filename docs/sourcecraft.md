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
- **Зеркало GitHub.** Репозиторий можно импортировать с GitHub с синхронизацией выбранных веток: раз в два часа или по кнопке «Синхронизировать сейчас» на странице репозитория (не больше 50 синхронизаций в сутки). Зеркальные ветки в SourceCraft защищены — менять их можно только через GitHub; незеркальные (у нас `release`) — обычные. Документация: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/migration. Запускает ли синхронизация CI — в документации не сказано.
- **CI бесплатно:** 1000 минут в месяц на публичные репозитории; кубик — до 20 минут, клонирование — до 60 секунд. Справочник `ci.yaml` — https://sourcecraft.dev/portal/docs/ru/sourcecraft/ci-cd-ref/. CI умеет собирать сайт: в шаблоне `sites-landing` воркфлоу `build-site` в `.sourcecraft/ci.yaml` — кубик в `node:22-slim` собирает, кубик без образа (у воркера есть git и права на запись) делает `git checkout -b release` и `git push origin release -f`.

## Как устроено

Код по-прежнему пушим на GitHub. SourceCraft-репозиторий https://sourcecraft.dev/espanolcontim/espanolcontim — зеркало GitHub (`main`). После синхронизации CI SourceCraft (`.sourcecraft/ci.yaml`) собирает сайт с `SITE_URL=https://espanolcontim.sourcecraft.site` и кладёт `apps/web/dist` в корень ветки `release` одним коммитом без истории; Sites публикует `release` (`.sourcecraft/sites.yaml`). GitHub Pages пока собирается как раньше, из того же `main`.

## Что сделать Тимуру

1. ~~Войти на https://sourcecraft.dev через Яндекс ID.~~
2. ~~Публичная организация `espanolcontim`, в ней публичный репозиторий `espanolcontim`~~ — сделан импортом с GitHub с синхронизацией. В синхронизации — только `main`: ветку `release` пишет CI SourceCraft, синхронизация не должна её трогать.
3. ~~Персональный токен доступа~~ — при зеркале не нужен: пушим на GitHub. Понадобится, если откажемся от зеркала.
4. Яндекс Вебмастер: добавить `https://espanolcontim.sourcecraft.site`, способ подтверждения «Мета-тег», прислать значение `content`.
5. Метрика: в настройках счётчика 113827960 поменять адрес сайта на `espanolcontim.sourcecraft.site`.

## Что сделать Claude

1. ~~Второй remote~~ — вместо него зеркало (см. «Как устроено»).
2. ~~`.sourcecraft/ci.yaml` и `.sourcecraft/sites.yaml`~~ — написаны (Node 24, как на GitHub; перед сборкой — lint и тесты). Шаг публикации проверен локально на копии репозитория. Осталось проверить в SourceCraft: после синхронизации в разделе «CI/CD» репозитория появился запуск `build-site`, он успешен, в ветке `release` — файлы сайта.
   Если синхронизация не запускает CI — варианты: запускать `build-site` вручную в разделе «CI/CD»; отключить зеркало и пушить прямо в SourceCraft (второй remote, нужен токен); добавить в `ci.yaml` запуск по расписанию (`schedule`).
3. Основной адрес по умолчанию — SourceCraft: `site` в `apps/web/astro.config.mjs`, ссылки в README, `CLAUDE.md`, `docs/seo.md`, `docs/privacy.md`. Проверить, что `/lessons/a0-01/` отдаёт `index.html`, а несуществующий адрес — 404.
4. Новый мета-тег Вебмастера — в `YANDEX_VERIFICATION` (`app/seo.ts`).
5. В день запуска (дата из уведомления в Роскомнадзор): `METRIKA_ID = 113827960`, политика — почта на Яндексе, раздел «Хостинг», дата редакции; выключить GitHub Pages (Settings → Pages, убрать `.github/workflows/deploy.yml`) — если Тимур согласен (ответ «пока пусть остаётся» был до разговора о трансграничной передаче; см. `docs/privacy.md`).
6. Проверить на новом адресе: sitemap, robots.txt, превью ссылок, значок, уведомление о cookie, Метрику (`docs/seo.md`).

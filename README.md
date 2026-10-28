# Español con Tim — сайт курса

Сайт курса «Испанский с нуля»: конспекты уроков, дополнительные материалы, упражнения.

- Сайт: https://espanolcontim.ru/ — Yandex Object Storage (`docs/object-storage.md`). Публикуется сам при каждом push в `main` (`.github/workflows/deploy.yml`).
- Разработка — в ветке `develop`: push туда проверяет линтер, тесты и сборку (`.github/workflows/check.yml`), но ничего не публикует. Выложить на сайт — влить `develop` в `main`.
- Поиск, превью ссылок, Яндекс Метрика — `docs/seo.md`; персональные данные и Роскомнадзор — `docs/privacy.md`.
- Спецификация и план по фазам — `docs/SPEC.md`.
- Где остановились и что дальше — `docs/STATUS.md`.
- Правила для Claude Code — `CLAUDE.md`.
- Откуда берётся контент — `docs/content-sources.md`.

## Как развернуть на новом компьютере

1. Нужны git и Node.js 22.23 или новее (проверено на Node 24).
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

## Как обновить уроки на сайте

1. В `video-lessons` появился или изменился урок.
2. `npm run content:import` и прочитать отчёт. Строка «исчезли из урока» означает, что фразы правили. Если правка небольшая и прогресс учеников по фразе нужно сохранить, номер возвращают в `content/ids.lock.json` (см. «Стабильные id» в `docs/SPEC.md`).
3. Закоммитить `content/public` и `content/ids.lock.json`, сделать push — сайт обновится сам.

`content/private` — платные материалы — в git не попадают никогда.

## Устройство

```
apps/web/            сайт: Astro + React, страницы в src/pages, фичи в src/features
packages/content/    схема контента (zod), правила доступа, id, общие функции
scripts/             импорт контента (content:import)
content/public/      бесплатный контент (в git)
content/private/     платный контент (не в git)
content/ids.lock.json   постоянные id предложений
content/videos.json     ссылки на YouTube
docs/                спецификация, статус, источники, обложки
```

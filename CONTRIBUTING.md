# Как работаем (коротко)

1. Бери issue → назначь себя → ветка `feat/<область>-<кратко>` от `main`.
2. Маленькие коммиты в стиле Conventional Commits: `feat(lunge): count reps per leg`, `fix(ui): …`, `test(rules): …`.
3. Перед push: `npm run lint && npm run typecheck && npm test`.
4. PR в `main`, в описании `Closes #N`, скрин/GIF. Ревью ≤ 15 мин. **Без squash** — жюри смотрит историю.
5. Деплой на Netlify: `npm run build && npx netlify-cli deploy --prod --dir dist` (настройки в `netlify.toml`).

## Добавить упражнение (шаблон — `src/exercises/squat`)

1. `src/exercises/<id>/config.ts` — пороги.
2. `src/exercises/<id>/index.ts` — `ExerciseDefinition`: `phases`, `nextPhase` (с гистерезисом), `repStart`,
   `progress`, `initMetrics`/`track` (экстремумы за повтор), `frameRules`, `repRules`.
3. Строки в `src/i18n/ru.ts` (`<id>.name`, `<id>.howTo`, `<id>.<rule>.msg|fix`).
4. Регистрация в `src/exercises/registry.ts`.
5. Тесты: синтетика через `tests/helpers/pose.ts` (`makePose`, `repSequence`, `blend`) и/или записанные фикстуры.
6. Подбор порогов: открой `?dev=1`, смотри живые углы.

## Правило ошибки = конкретная подсказка

`message` — что не так («Колени заваливаются внутрь»), `fix` — что сделать («Разводи колени наружу, по линии носков»).
Никаких «движение не распознано». Укажи `joints` для подсветки и, если можно, `arrows` для направления.

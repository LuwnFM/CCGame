# Firewell CCG — проверка модульности игровых механик
Дата: 21 октября 2026. Источник: `main`, коммит `0d7b78fe8920c383b98fe9541344f82da903a3a4`, версия правил `0.9.15-alpha`.

## Подтверждённая архитектура

- 18 файлов зарегистрированных эффектов: `mechanics/effects/{bind,cleanse,damageAllCreatures,damageController,damageOpponent,draw,healRuler,raiseSacrifice,reanimate,recoverCreature,silence,stasisEnemy,stunEnemy,summon,summonBonePair,summonSignature,summonSkeleton,ward}.ts`.
- 15 модулей пассивных свойств: `mechanics/traits/{auraAttack,cannotAttack,extraAttacks,firstStrike,flying,guard,haste,lifesteal,majestic,piercing,poisonHit,sacrifice,shield,stealth,zeal}.ts`.
- 16 команд в шести независимых файлах `mechanics/commands/{setup,battlefield,techniques,legends,rituals,combat}.ts`.
- `mechanics/zones.ts` — общие операции карт и зон; `events.ts` — ограниченная FIFO-очередь; `effects-registry.ts` — реестр по каналу и типу эффекта; `trait-registry.ts` — регистрация признаков; `combat-hooks.ts` — хуки боевых стадий.
- `core.ts` — проверка ревизии, очередности, идемпотентности, транзакционное клонирование, откат и ограничение операций. Типы `Card`, `Game`, контракты эффектов и команд допускают расширение TypeScript.
- `src/cards/<color>/<type>/<id>.ts` — отдельные данные каждой карты. `src/cards/catalog.ts` и цветные `index.ts` собирают стартовые колоды без именных функций карт.
- `test/mechanics-modularity.test.ts` проверяет регистрацию, `test/engine-extensibility.test.ts` создаёт дополнительные эффекты и команды без правки ядра; `test/events-zones-registry.test.ts` проверяет зоны, события и откат.

## Оговорки: файл модуля ≠ полностью законченная механика

- **Оберег / `ward`**: файл и регистрация существуют, но обработчик намеренно бросает `RuleError`. Нельзя считать работающей механикой.
- **Не реализованы по дорожной карте:** Предвидение, Отклик Владения, Детонация, Рикошет — нужны правила, отдельные обработчики, UI и тесты.
- **Исторические адаптеры:** `summonSkeleton`, `summonBonePair`, `summonSignature`, `raiseSacrifice`; новые карты должны использовать параметризованный `summon`.
- Модули `traits/*.ts` содержат регистрацию признака, но некоторые фазовые правила находятся в `combat.ts`, `commands/*.ts`, `ritual.ts`, `zones.ts`. Для новой механики с особой стадией нужен хук или модуль команды.
- В `commands/rituals.ts` есть особая проверка ID Церы для бонусного добора; её надо сделать декларативной.
- Для новой механики интерфейс `web/app.js` пока часто требует отдельное название, подсказку и правило выбора цели.
- Расхождение нормативных правил Стазис/Отрава v0.9.12 и v0.9.13 требует решения автора.
- 324 сценария архивной матрицы (229 нормативных, 88 открытых, 7 предложений) не являются 324 успешными тестами.

## Создание новой механики

1. Определить юридически однозначный текст правила, ограничения цели, фазы и событие.
2. Расширить `effect-contracts.ts` или `Card`, создать `effects/<kind>.ts` или `traits/<kind>.ts` с единственным общим параметризованным обработчиком.
3. Подключить статическим импортом через `effects/index.ts`, `traits/index.ts` или `plugins/index.ts`.
4. Создать карту-данные и включить её в цветовой манифест. **Не** изменять ядро ради названия карты.
5. Добавить серверный тест, негативные и граничные сценарии, цепочки событий, старые версии, клиентский выбор цели, RU/EN и PvP E2E.
6. Нельзя выполнять код из пользовательских файлов карт, `eval` или внешних непроверенных плагинов.

### Источники
`docs/mechanics-modules-guide.md`, `docs/decisions-v0.9.13.md`, исходные `src/mechanics/**`, `src/cards/**`, `test/mechanics-modularity.test.ts`, `test/engine-extensibility.test.ts`.
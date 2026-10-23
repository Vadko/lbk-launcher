# Добірка тижня: секція на головній лаунчера

Репозиторії: `lbk-admin` (міграція, API, вкладка) і `lbk-launcher` (IPC, секція). Гілка в обох: `feat/weekly-picks`, від `main`.

## Мета

На головній сторінці лаунчера з'являється секція з трьох перекладів, спільна для всіх користувачів:

- раз на тиждень сервер сам обирає 3 випадкові переклади, які не зроблені ШІ;
- адмін може в адмінці вручну задати або замінити набір, наприклад тематичний «Хелловін»;
- лаунчер синхронізується з сервером і показує актуальний набір.

Це окремий механізм. Існуючі рекомендації на сторінці гри (`recommendations-source.ts`, `RecommendedGamesSection`, налаштування «Рекомендації ігор») не змінюються і до нового механізму не прив'язані.

## Узгоджені рішення

- Набір завжди рівно з 3 перекладів.
- Автовибір бере лише схвалені, не приховані переклади з `ai IS NULL` і статусом не `planned` та не `tech-improvement`. Ручний вибір може містити будь-який схвалений і не прихований переклад, ШІ-переклади теж.
- Набір живе 7 днів від моменту, коли став поточним. Будь-яке збереження в адмінці створює новий ручний набір і перезапускає 7-денний відлік. Якщо за 7 днів нічого не зберегли, сервер сам обирає наступний автонабір.
- Заголовок набору необов'язковий. Без нього лаунчер показує «Добірка тижня».
- Вкладку бачить лише `admin`, як банери.
- Нового налаштування в лаунчері немає. Секція показується завжди, коли є що показати.

## Дані та життєвий цикл (міграція `192_home_picks.sql` в lbk-admin)

Таблиці (RLS увімкнено, політик для `anon` і `authenticated` немає, пишуть лише через service-role):

- `home_pick_sets`: `id uuid pk default gen_random_uuid()`, `source text not null check (source in ('auto','manual'))`, `title text null check (title is null or char_length(title) between 1 and 60)`, `starts_at timestamptz not null default now()`, `expires_at timestamptz not null`, `created_by uuid null references auth.users(id) on delete set null`. Індекс по `starts_at desc`.
- `home_pick_games`: `set_id uuid not null references home_pick_sets(id) on delete cascade`, `position smallint not null check (position between 0 and 2)`, `game_id uuid not null references games(id) on delete cascade`, `primary key (set_id, position)`, `unique (set_id, game_id)`.

Поточний набір це рядок `home_pick_sets` з найбільшим `starts_at`. Історія зберігається.

Функції (усі `SECURITY DEFINER`, `SET search_path = public`):

- `generate_auto_home_picks(p_force boolean default false) returns uuid`. `EXECUTE` лише для `service_role`.
  - Бере `pg_advisory_xact_lock`, спільний із `save_home_picks`, щоб cron і адмін не гналися.
  - Без `p_force` повертає `null`, якщо поточний набір існує і `expires_at > now()`.
  - Кандидати: умови з розділу «Узгоджені рішення», без ігор з останніх 8 наборів. Дедуп за `coalesce(steam_app_id::text, 'slug:' || slug)`: з кожної групи береться один випадковий переклад. Далі `ORDER BY random() LIMIT 3`.
  - Якщо кандидатів менше 3, виключення недавніх знімається. Якщо їх і тоді менше 3, функція нічого не вставляє, пише `RAISE WARNING` і повертає `null`, а cron повторить за годину.
  - Вставляє набір `source = 'auto'`, `starts_at = now()`, `expires_at = now() + interval '7 days'`, `created_by = null`.
- `save_home_picks(p_game_ids uuid[], p_user uuid, p_title text default null) returns uuid`. `EXECUTE` лише для `service_role`. Необов'язковий аргумент останній, бо Postgres забороняє необов'язковий параметр перед обов'язковими, а згенеровані типи тоді дозволяють не передавати заголовок.
  - Той самий advisory lock.
  - Перевіряє рівно 3 різні id, що всі вони існують, схвалені і не приховані. Інакше `RAISE EXCEPTION` зі стабільним кодом `invalid_home_picks`, який API мапить на 400.
  - Заголовок обрізається, порожній стає `null`.
  - Вставляє набір `source = 'manual'`, `starts_at = now()`, `expires_at = now() + interval '7 days'`, `created_by = p_user`.
- `get_home_picks()`: `LANGUAGE sql STABLE`, `EXECUTE` для `anon` і `authenticated`. Повертає не більше одного рядка: `title`, `starts_at`, `expires_at`, `game_ids uuid[]` (впорядкований за `position`) для поточного набору.

Cron: `cron.schedule('generate-auto-home-picks', '0 * * * *', 'SELECT public.generate_auto_home_picks();')`, з попереднім `cron.unschedule` у `DO`-блоці, як у `121_cron_edge_functions_with_jwt.sql`. Затримка між спливом набору і новим автонабором не перевищує годину. В кінці міграції викликається `generate_auto_home_picks()`, щоб набір з'явився одразу після деплою.

Вироджені випадки, прийняті свідомо:

- Гру з поточного набору видалили, сховали чи зняли зі схвалення: лаунчер показує те, що лишилось. Якщо не лишилось жодної, секція прихована. Набір не перегенерується, поки не спливе його термін.
- Cron зупинився: на головній лишається останній набір, а не порожня секція.

## Адмінка (`lbk-admin`)

Вкладка `homePicks` («Добірка тижня») в `AdminPanel.tsx`, `visible: isAdmin`, з `prefetchHomePicks` у `TAB_PREFETCH`.

Компонент `HomePicksTab`:

- «Поточний набір»: заголовок, мітка «Автоматично» чи «Вручну», «діє до …», три картки з назвою, командою і позначкою ШІ.
- Редагування: поле заголовка (порожнє означає «Добірка тижня»), три слоти з кнопкою «Замінити» і пошуком за назвою, slug чи командою. «Зберегти» активна лише для 3 різних перекладів. Під кнопкою підпис, що збереження запускає новий 7-денний відлік.
- «Випадкова трійка»: одразу створює новий автонабір, відлік теж стартує заново.
- «Історія»: останні 8 наборів, лише читання.

API у `src/app/api/admin/home-picks/`. Усі з `requireAuth(request, { requireRole: 'admin' })`, помилки через `t(...)`, кожен роут має `route.test.ts`:

- `GET`: `{ current, history }`, ігри підтягуються одним join-ом через `home_pick_games`.
- `PUT`: тіло перевіряє zod 4: `title` рядок до 60 символів або `null`, `gameIds` рівно 3 різні uuid. Викликає `save_home_picks`. Код `invalid_home_picks` дає 400.
- `POST`: викликає `generate_auto_home_picks(true)`. Якщо повернулось `null`, відповідь 409 з повідомленням, що кандидатів замало.
- `GET /games?search=`: від 2 символів, до 10 схвалених не прихованих ігор, фільтр через наявний `buildIlikeOrFilter(['name', 'slug', 'team'], search)`.

Клієнт: `useHomePicksQuery` (ключі з фабрики `queryKeys`, мутації інвалідують `homePicks`), `useActionPhase` на кнопках, без емодзі. Тексти через `useTranslations` лежать у словниках `uk`, `be` і `en` пакета `@lbk/i18n` (`supabase/functions/_shared/i18n/`): кожен новий ключ додається в усі три, а `dictionaries.test.ts` вимагає, щоб ключ `uk` реально читався в коді.

## Лаунчер (`lbk-launcher`)

Main:

- `src/main/db/home-picks-api.ts`: `fetchHomePicks()` викликає `supabase.rpc('get_home_picks')`. Помилка чи порожня відповідь повертає `null`. Лог із тегом `[HomePicks]`.
- `src/main/ipc/home-picks.ts`: `setupHomePicksHandlers()` реєструє канал `fetch-home-picks`. Виклик додається в `src/main/index.ts` до інших `setup*Handlers()`, усередині гілки single-instance lock.
- `src/shared/home-picks-types.ts`: `HomePicks { title: string | null; startsAt: string; expiresAt: string; gameIds: string[] }` і `HomePicksAPI { fetchHomePicks(): Promise<HomePicks | null> }`. В `src/shared/types.ts` додається лише `ElectronAPI extends HomePicksAPI`, бо файл уже 536 рядків.
- `src/preload/index.ts`: метод `fetchHomePicks`.

Renderer:

- `src/renderer/queries/useHomePicks.ts` через `useSyncAwareQuery`. Бере `HomePicks` з IPC, потім `fetchGamesByIds(ids, undefined, hideAiTranslations)`, зберігає серверний порядок, відкидає ігри, яких немає в локальному каталозі. Ключ містить `hideAiTranslations`, а сам фільтр ШІ виконує `fetchGamesByIds` у SQL (`ai IS NULL`). `staleTime` і `refetchInterval` по 1 годині. Застосунок глобально вимикає `refetchOnWindowFocus` (`queryClient.ts`), тож для цього запиту він вмикається явно: лаунчер днями висить у треї, і `refetchInterval` у фоні не працює. Якщо IPC повернув `null`, запит кидає помилку: React Query тоді лишає останні дані, а без жодних даних секція прихована.
- Перетворення «id → впорядковані ігри» (`orderHomePickGames`, чиста функція в `src/renderer/utils/homePicks.ts`) зберігає серверний порядок, прибирає дублікати та ігри, яких немає в локальному каталозі.
- `src/renderer/components/MainContent/HomePicksSection.tsx` за зразком `TrendGamesSection`: `<h2>` із `title ?? t('homeSections.weeklyPicks')`, три `GameListItem` (`isCardStyle`), без кнопки «Переглянути всі». Без даних компонент повертає `null`. Клік шле `trackEvent('Select game', { 'Is home pick': true, 'Home pick title': …, 'Game Id': …, 'Game Name': … })`. Тексти через `t()` з `@/shared/i18n/i18n`: заголовок за замовчуванням це ключ `homeSections.weeklyPicks` у `packages/lbk-i18n/src/{uk,be,en}.ts`.
- `MainPage.tsx`: секція одразу після `InstalledGamesSection` і перед `NewGamesSection`.

Навігація геймпадом працює без змін: `GameListItem` уже несе потрібні атрибути.

## Тестування

- SQL: PGlite-тест `src/lib/homePicks/homePicksSql.test.ts`, що програє міграцію, за зразком `packages/scan-core/src/scan/scanSql.test.ts`. `@electric-sql/pglite` зараз є лише в `scan-core`, тож додається в корінь як devDependency тієї самої версії. Перевіряє `generate_auto_home_picks` (пропуск, поки набір чинний; виключення ШІ, `planned`, `tech-improvement`, прихованих; дедуп за Steam-грою; виключення недавніх і його зняття; примусовий запуск), `save_home_picks` (валідація, зміщення відліку) і `get_home_picks`. Функції `pg_cron` і Vault у PGlite відсутні, тож перевіряється лише plpgsql.
- API адмінки: тести роутів за шаблоном `requireAuth.test.ts`: ролі, валідація тіла, мапінг `invalid_home_picks` на 400 і `null` на 409.
- Лаунчер: node-vitest для чистої функції порядку та для `fetchHomePicks` із замоканим клієнтом (успіх, помилка, порожньо). Тестів компонентів немає, їх не додаємо.

## Порядок робіт

1. `lbk-admin`: міграція 192 і SQL-тест. Мердж на `main` застосовує міграцію workflow-ом, і бот перегенерує типи БД у `lbk-admin`, `lbk-landing` і `lbk-launcher`.
2. Після мерджу міграції і появи типів: `lbk-admin` (API, вкладка) та `lbk-launcher` (IPC, запит, секція) можна вести паралельно. До цього код на типізованому клієнті не пройде `type-check`, а вручну файли типів не правимо.
3. Перед релізом лаунчера перевірити, що в `src/shared/changelog.json` є запис для нової версії.

## Поза межами

- Миттєва доставка через realtime. Лаунчер оновлюється при старті, щогодини і при поверненні фокуса.
- Персоналізація набору для окремого користувача.
- Окремий перемикач секції в налаштуваннях.
- Показ добірки на лендингу `lbk-site`.
- Сторінка «Переглянути всі» і запланована черга майбутніх наборів.

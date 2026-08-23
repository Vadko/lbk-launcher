/**
 * Прапорець адмінської збірки.
 *
 * Значення інлайниться Vite під час білда: у звичайних збірках `VITE_ADMIN_MODE`
 * не задано, тому адмінські гілки коду відпадають при tree-shaking і в публічний
 * реліз не потрапляють.
 *
 * Вмикається в `.github/workflows/tg-build.yml` (крок «Build application»),
 * локально - через `VITE_ADMIN_MODE=true pnpm build`.
 *
 * Що змінює: приховані переклади (`hide = 1`) видно без коду розблокування
 * (див. `VISIBLE_GAMES_SQL` у `src/main/db/db-queries.ts`).
 */
export const IS_ADMIN_BUILD = import.meta.env.VITE_ADMIN_MODE === 'true';

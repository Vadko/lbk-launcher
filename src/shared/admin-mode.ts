/**
 * Admin build flag.
 *
 * The value is inlined by Vite at build time: in regular builds `VITE_ADMIN_MODE`
 * is unset, so admin-only branches are tree-shaken away and never reach a public
 * release.
 *
 * Enabled in `.github/workflows/tg-build.yml` (the «Build application» step),
 * locally via `VITE_ADMIN_MODE=true pnpm build`.
 *
 * What it changes: hidden translations (`hide = 1`) are visible without an unlock
 * code (see `VISIBLE_GAMES_SQL` in `src/main/db/db-queries.ts`).
 */
export const IS_ADMIN_BUILD = import.meta.env.VITE_ADMIN_MODE === 'true';

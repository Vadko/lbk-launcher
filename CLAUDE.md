# LBK Launcher

Electron 39 + React 19 desktop app (Windows, macOS, Linux incl. Steam Deck) that installs Ukrainian game localizations. Catalog lives in a local better-sqlite3 DB synced from Supabase; the installer downloads and extracts archives into detected game folders and wires up Steam integration. UI copy is Ukrainian, code identifiers are English. `package.json` version is currently 2.22.0.

## Commands

```bash
pnpm dev              # prebuild (spellfix) + electron-vite dev, renderer on port 5173
pnpm build            # electron-vite build → out/{main,preload,renderer}
pnpm prebuild         # node scripts/build-spellfix.js — compiles spellfix1
pnpm type-check       # tsc --noEmit — CI gate 1
pnpm test:unit        # vitest run — CI gate 2
pnpm lint             # eslint . — CI gate 3
pnpm format:check     # biome check --max-diagnostics=200 . — CI gate 4
pnpm find-unused      # knip — CI gate 5, an unused export fails the build
pnpm format           # biome check --write .
pnpm dist:win|linux|mac        # electron-builder → release/<version>/
pnpm dist:mac:local            # env-cmd + CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm test:e2e         # playwright over CDP :19222 against the packaged app
```

`.github/workflows/ci.yml` runs gates 1–5 in that order on Node 22.20.0 / pnpm 11.4.0. `--publish never` is not in the scripts — `release.yml` appends it to `pnpm dist:*`. `.husky/pre-commit` runs `npx lint-staged`, which runs only `biome check --write --no-errors-on-unmatched` on staged `*.{js,ts,tsx,json,css,scss}`; type-check, eslint and knip do not run locally.

## Architecture

Three processes plus a DB worker thread. `electron.vite.config.ts` builds **two** main-process rollup entries: `index` (`src/main/index.ts`) and `db-worker` (`src/main/db/db-worker.ts`). `better-sqlite3` and `electron-liquid-glass` are rollup externals; `got` is deliberately bundled (`externalizeDeps.exclude`).

**Only `@` is aliased in the main and preload builds.** `@renderer`, `@components`, `@store` and `@resources` exist solely in the renderer build even though `tsconfig.json` declares all five, and vite does not read tsconfig paths — a value import through one of them from main/preload passes `pnpm type-check` and then fails at build. Use `@/...` outside the renderer.

The whole app body lives inside the single-instance-lock `else` branch of `src/main/index.ts` (`if (!gotTheLock) { app.quit() } else { … }`). Put new app wiring inside it, or it runs in the doomed second instance too.

### IPC — six bridges, not one

`src/preload/index.ts` calls `contextBridge.exposeInMainWorld` six times: `electronAPI`, `windowControls`, `liquidGlassAPI`, `loggerAPI`, `api`, `storeStorage`.

- `electronAPI` is typed by the `ElectronAPI` interface in `src/shared/types.ts` (`const electronAPI: ElectronAPI = {...}` makes a missing method a compile error), and `declare global` there adds it to `Window`.
- The other five are typed by hand in `src/window.d.ts`. Editing `src/shared/types.ts` for them does nothing.
- `src/env.d.ts` owns `ImportMetaEnv` (the `VITE_*` keys) and `declare const __SENTRY_RELEASE__`. It is incomplete: `VITE_SENTRY_DSN` is read in `src/main/index.ts` and listed in `.env.example` but is missing from the interface.

To add a channel:
1. Register inside the matching setup function in `src/main/ipc/` — `games.ts`, `installer.ts`, `tg-news.ts`, `feedback-replies.ts`, `window-controls.ts` (that one exports `setupWindowControls`, not `…Handlers`, and is a grab-bag: `show-system-notification`, `clear-cache-only`, `clear-all-data-and-restart`, `logger:log` and `logger:open-logs-folder` live there too — look there before adding a logging, cache-clearing or notification channel). Handlers also live outside `ipc/`: `src/main/window.ts` (`liquid-glass:*`, registered at module import time), `src/main/utils/store-storage.ts`, `src/main/auto-updater.ts`, `src/main/changelog.ts`, `src/main/index.ts`.
2. Call the setup function from `src/main/index.ts` (~lines 220-227). Nothing is auto-discovered.
3. Add the method to `ElectronAPI` in `src/shared/types.ts`, **or** to `src/window.d.ts` for the other five bridges.
4. Wire it in `src/preload/index.ts`.

**Push-event bridges own their teardown.** All 20 `on*` methods in `src/preload/index.ts` return `() => ipcRenderer.removeListener(channel, handler)`; give a new listener the same disposer in both the preload impl and its `ElectronAPI` / `window.d.ts` type (`(cb) => () => void`), and call it from effect cleanup — returning `void` compiles and leaks a listener on every remount, and `removeAllListeners` would kill other subscribers of the same channel. `windowControls.onMaximizedChange` is the one whose `src/window.d.ts` type still says `=> void`, so its disposer is invisible to callers.

**Handlers never throw across the boundary.** Return `{ success, error }` — custom Error properties do not survive IPC. `src/main/ipc/installer.ts` maps `ManualSelectionError` / `RateLimitError` / `NetworkError` (all from `src/main/installer/errors.ts`) into `needsManualSelection` / `isRateLimit` / `isNetworkError` booleans. Read-only handlers return `null`/`[]` instead.

Window channels are colon-separated: `window:minimize` (which **hides to tray** — the tray is the only way back), `window:maximize`, `window:close`, `window:is-visible`. Maximize state is pushed as the `window:maximized` event from `src/main/window.ts`; there is no `window-is-maximized` handler.

## Database and sync

`src/main/db/database.ts` is a synchronous better-sqlite3 singleton on the main thread. Get the handle with `getDatabase()` — `DatabaseManager` is not exported and has no `.prepare`.

- **The worker thread does WRITES ONLY**: `upsertGames`, `deleteGame`, `deleteGames`, consumed solely by `src/main/db/sync-manager.ts`. Every read, FTS5 search and spellfix fallback runs synchronously on the main thread in `GamesRepository`.
- `src/main/db/db-worker-client.ts` resolves the worker at `process.resourcesPath/app.asar/out/main/db-worker.js` when packaged. Nothing type-checks that string — renaming the rollup entry breaks sync at runtime only.
- **Migrations are name-keyed, not versioned.** `src/main/db/migrations.ts` replays the entire array on every start with no `user_version` and no applied-migrations table. Every migration must self-check: column adds via `addColumnIfMissing()`, one-shot data work via a marker row in `sync_metadata` (`forceResyncOnce()`). `runMigrations()` rethrows, so a throw propagates out of the `DatabaseManager` constructor.
- **Migrations never run on a fresh DB.** `database.ts` calls `createTables()` and returns; `runMigrations()` is only reached for a pre-existing DB that already has a `games` table. Anything that must also hold for first launch has to be duplicated into `createTables()`.
- **Adding a `games` column is a five-place lockstep change**: the DDL in `createTables()`, an `addColumnIfMissing` migration, `gameToInsertParams()`, the `SYNCED_COLUMNS` array (both in `src/main/db/db-queries.ts`), and usually a `forceResyncOnce` migration. The `_assertNever<…>()` guards in `db-queries.ts` make `pnpm type-check` fail if steps 3/4 diverge; steps 1/2/5 fail silently at runtime.
- `UPSERT_GAME_SQL` uses `ON CONFLICT(id) DO UPDATE` built from `SYNCED_COLUMNS` specifically so `user_unlocked` (local-only, how a user reveals a `hide = 1` translation) survives sync. Any new local-only column must stay out of `SYNCED_COLUMNS`; never switch to `INSERT OR REPLACE`.
- **Every query that lists games must use `VISIBLE_GAMES_SQL`** (`db-queries.ts`) or it leaks hidden translations. It is `approved = 1 AND (hide = 0 OR user_unlocked = 1)`, relaxing to `approved = 1` when `IS_ADMIN_BUILD` (`src/shared/admin-mode.ts`, from `VITE_ADMIN_MODE`, set only by `.github/workflows/tg-build.yml`).
- Search: FTS5 for queries ≥ 2 chars, `name LIKE ?` for 1 char (and as fallback when tokenization yields nothing), spellfix fallback only when the query returned zero rows and `isSpellfixAvailable()`. The dictionary table is `spellfix_words` (a flat list of the ≥3-char words of `name`, no transliterated forms) and is fully rebuilt on every batch upsert. `games_fts` is `fts5(game_id UNINDEXED, name_search, search_keywords, tokenize='unicode61')`, maintained by manual delete+insert. Cross-script matching (Cyrillic query → Latin title and back) comes from transliteration, not spellfix: `generateSearchableString()` in `src/shared/search-utils.ts` stores lowercased `name` plus its `cyrillic-to-translit-js` transliteration plus an apostrophe-stripped variant into the derived `name_search` column at upsert time, and `buildFtsQuery()` transliterates the query the same way. `name_search` is written, never computed at read time — changing the search helpers needs a reindex migration over existing rows (see `reindex_fts_without_apostrophes`), not just a redeploy.
- `SyncManager.getInstance().sync(...)` does a full sync when the games table is empty or no `last_sync_timestamp` exists, otherwise a delta, falling back to full on delta failure. There is no staleness window.
- Server-side deletions of games whose translation is still installed are **tombstoned** into `pending_game_deletions` in `sync_metadata` and cleared later by `processPendingDeletions()`.
- Realtime is broadcast-channel based (`src/main/db/supabase-realtime.ts`), not `postgres_changes`; `subscribe()` takes an **array** of `BroadcastSubscription` objects.
- **Clearing the catalog DB is two-phase and restart-based**: `clear-cache-only` / `clear-all-data-and-restart` call `closeDatabase()` → `deleteDatabaseFile()` → `app.relaunch()`. `deleteDatabaseFile()` unlinks `lbk.db`/`-wal`/`-shm` eagerly and, if an unlink fails (Windows keeps WAL files locked), writes a `lbk.db.delete` marker in userData that the `DatabaseManager` constructor consumes on the next launch. Never unlink the DB files directly — go through `deleteDatabaseFile()`.

## Installer

Orchestrator is `src/main/installer.ts` (there is no `src/main/installer/index.ts`). Order: platform compatibility → resolve gamePath (custom paths blocked for `license_only`) → `resolveGameBuildOs()` → stage into `<gamePath>/.lbk-temp` → disk check for 2× archive size → download+extract → optional backup → copy → cleanup → `saveInstallationInfo` → `applySteamIntegration`.

- **Archive variant priority**, identical in the disk-space step and the download step and must stay in sync: build-OS variant (`steam_linux_*` / `steam_mac_*`) → store-specific (`epic/gog/xbox/uplay/ea_*`) → `archive_path`. `resolveGameBuildOs` (`src/main/utils/game-build.ts`) sniffs ELF/Mach-O magic on disk, then Steam's compat tool, then host OS — the host OS is *not* the build OS for Linux Steam titles under Proton.
- **There is no macOS installer column** — only `installation_file_windows_path` and `installation_file_linux_path` exist. macOS falls back to the Linux path and runs it directly after `chmod +x`; `checkPlatformCompatibility()` (`src/main/installer/platform.ts`) blocks a translation on macOS when only the Windows installer exists.
- Install metadata is written **twice**: `.lbk-translation.json` in the game folder and a mirror at `userData/installation-cache/<gameId>.json`. The userData directory is the source of truth for "what is installed" (`getAllInstalledGameIds()` reads filenames). `src/main/installation-watcher.ts` fs.watches it with a 100 ms debounce; `checkInstallation()` rewrites the cache only when fields actually changed, to avoid a watcher feedback loop.
- Backups go into a hidden `.lbk-backup/` dir at the game root and are only written if absent, so re-installing never overwrites the pristine original. Restore tries `.lbk-backup/<rel>`, then legacy `<file>_backup`, then `<file>.kbak`. `findBackupDir()` / `findInstallationInfoFile()` **rename** legacy `.littlebit-*` paths as a side effect.
- Translations shipping an executable installer return early through a `installer:confirm-run` → `installer:run-decision` round trip. If the renderer never calls `respondRunInstaller(gameId, …)` the main-process promise hangs forever. That path also returns before the backup/copy branch — it records `installedFiles: []`, `components.text.files: []` and `hasBackup: false`, so no backup exists and uninstall relies entirely on the shipped uninstaller (`installInfo.installerPath`); backup restore is a no-op for installer-based translations and the manual-cleanup fallback has nothing to delete.
- `runProton()` **renames the installer file on disk** to a transliterated name (`renameFileToTranslit`, cyrillic-to-translit-js 'uk' preset) before launching it, so a Cyrillic installer path stored earlier is stale afterwards. `runUninstaller()` and `rerunInstaller()` retry via `getTransliteratedPath(storedPath)` when the recorded path no longer exists — keep that fallback in any new code that re-opens a saved installer path.
- `applySteamIntegration` (`src/main/installer/steam-integration.ts`) is the shared tail for both paths — steps appended after the normal flow were silently skipped for installer-based translations.
- Achievements re-install is skipped when `components.achievements.archiveHash` matches; that sets `achievementsChanged = false` so the renderer suppresses the restart-Steam prompt.
- Downloads go through the Supabase Edge Function `get-download-url` (invoked by `getSignedDownloadUrl()` in `src/main/tracking.ts`) that enforces rate limits. Writes to `<output>.part`; a `NetworkError` **preserves** the `.part` for resume, 404/cancel deletes it. Pause aborts with reason `'PAUSED'`, persists to `userData/paused-downloads/`, and throws `PausedSignal` at the IPC boundary so the renderer sees `{ success: false, paused: true }`. Resume refreshes the signed URL after 55 minutes.

## Game detection and Steam

`src/main/game-detector/` has ten modules: `steam`, `gog`, `epic`, `xbox`, `uplay`, `ea`, `rockstar`, plus `heroic`/`lutris` (Linux helpers behind GOG and Epic) and `kurin` (a separate catalog source via `syncKurinGames()`, not a path detector). `detectGamePath(installPath, steamAppId?)` switches on the seven store types and returns `exists: false` for `emulator` and `other`. GOG and Epic **do** resolve on Linux via the Heroic and Lutris helpers.

- Steam resolution is **app-id-first** via `appmanifest_<appid>.acf`; the installdir map is only a fallback (Steam suffixes duplicate installdirs with the app id). Always pass `steamAppId` — omitting it silently degrades to ambiguous folder-name lookup. `getSteamLibraryAppIds()` is async.
- The «Доступно з GOG» / «Доступно з Epic» filters match the store library's **titles** against catalog `name` with `name COLLATE NOCASE IN (...)` — exact, no fuzzy matching. `getCleanTitle()` (`src/main/game-detector/game-titles.ts`) is a hand-written alias table (catalog title → store title variants, looked up in reverse) applied in `gog.ts`, `epic.ts` and `lutris.ts` before the titles cross IPC, so a game whose store title differs (edition suffix, ™) stays invisible under those filters until it gets an entry there — fix it in the table, not with fuzzy matching in the renderer.
- `src/main/steam-watcher.ts` watches `libraryfolders.vdf`, the `steamapps` dirs and `licensecache` with a 2 s debounce (`DEBOUNCE_DELAY`).
- CEF bridge (`src/main/utils/steam-cef.ts`): CDP to `127.0.0.1:8080` against `SharedJSContext`, with hand-rolled timeouts. The port opens only if `.cef-enable-remote-debugging` exists in Steam's working directory **and** Steam restarted since. On macOS that directory is `Steam.AppBundle/Steam/Contents/MacOS` (`MACOS_APP_BUNDLE_SUBPATH` in `src/main/utils/cef-flag-file.ts`), not the data root. Bootstrap is skipped entirely when Millennium is detected (`isMillenniumInstalled()`). Launch options, workshop subscription, collections and the self-shortcut all run over CEF and must handle a `cef-unavailable` result.
- **Never edit `localconfig.vdf` while Steam is running.** `writeSteamLaunchOptions(params)` (`src/main/utils/steam-launch-options.ts`) returns a mode: `noop` | `cef` | `file` | `needs-shutdown` | `unresolved` | `failed`. The file path writes atomically to `<path>.lbk.tmp` then renames — a truncating write that crashes wipes the user's whole Steam config. `needs-shutdown` surfaces as `InstallResult.launchOptionsPending`.

## Platform branches

Use the helpers in `src/main/utils/platform.ts` (`isWindows` / `isLinux` / `isMacOS` / `getPlatform` / `isPortable` / `forCurrentOS`), not bare `process.platform`. `getPlatform()` can return `'unknown'`, which is why `forCurrentOS` uses an `in` check rather than truthiness.

- **Windows**: registry reads build an absolute `System32/reg.exe` path, never bare `reg`. `.exe`/`.msi` spawn through an argument array with no shell; only `.bat`/`.cmd` get `shell: true`, and their path must first pass `isCmdSafePath()` (`src/main/utils/shell-safety.ts`, called at `src/main/installer/platform.ts:223`), which rejects quotes, control chars and `%VAR%` rather than escaping them.
- **Linux/Steam Deck**: `src/main/index.ts` appends Chromium switches (`no-sandbox`, `disable-gpu-sandbox`, `enable-gamepad-extensions`, `VaapiVideoDecoder`, `ignore-gpu-blocklist`) and deletes `GTK_IM_MODULE` / `QT_IM_MODULE` in a top-level `if (isLinux())` block that sits **above the bulk of the imports** and long before `app.whenReady()` — moving it later silently breaks Gaming Mode. `runProton({ protonPath, filePath, args })` prefers the bundled `resources/umu/umu-run`; the installer window renders in Game Mode only with gamescope plus `STEAM_MULTIPLE_XWAYLANDS=1` and `PROTON_VERB=waitforexitandrun`. Extraction prefers a system 7z and strips `LD_PRELOAD`.
- **The Proton prefix is a throwaway**: `~/lbk-proton-prefixes/<sanitized translit installer basename>`, `rmSync`'d ~1 s after the installer exits. A `steamapps/compatdata/<appId>` prefix is reused and kept only when an appmanifest resolves from the *Proton build's* own folder (`findSteamAppId(dirname(protonPath))`) and that compatdata dir already exists — so assume nothing written into the prefix survives.
- **Flatpak sandbox**: on Linux the app may run inside one, so anything launching an external process (Steam, Heroic, Lutris, host `flatpak`) must check `process.env.FLATPAK_ID` and route through `flatpak-spawn --host`. `steam-launcher.ts`, `heroic-launcher.ts` and `lutris-launcher.ts` each hand-roll that check with private `isRunningInFlatpak` / `execOnHost` / `spawnOnHost` helpers — nothing is exported, so a new launch path repeats the check itself; a bare `spawn('steam', …)` silently fails for every Flatpak/Steam Deck user.
- **macOS**: builds are **per-arch dmg + zip for x64 and arm64 — not a universal binary**. Liquid Glass is gated on Darwin ≥ 25 (macOS 26). Installs must run `resignMacBundles()` (`src/main/installer/mac-codesign.ts`): replacing `Contents/MacOS/*` or `Info.plist` makes the kernel SIGKILL the game, so the bundle is `xattr -cr`'d and ad-hoc signed with `--preserve-metadata=entitlements,flags` and deliberately **not** `--deep`. A signing failure sets `hasInstallError: true` rather than failing the install.
- **Open http(s) links through `openExternalUrl()`** (`src/main/utils/open-external.ts`), never `shell.openExternal` directly: on Linux it resolves the browser itself (xdg-settings → Flatpak → native binary, cached) because SteamOS's xdg-open hands the URL to the Discover store. It also rejects `file:`/`javascript:`/`data:`/`vbscript:` and returns `{ success, error }` rather than throwing. Bare `shell.openExternal` is reserved for launcher protocol URLs (`epic://`, `uplay://`, `steam://`).

## Renderer

State is split three ways and the split is intentional.

- **9 Zustand stores** in `src/renderer/store/`. The five with middleware (`useSettingsStore`, `useSubscriptionsStore`, `useWorkshopInstallsStore`, `usePromoModalStore`, `useChangelogStore`) use the curried `create<Interface>()(...)` form; the plain four use `create<Interface>((set, get) => ...)`. Colocate actions, and read across stores with `OtherStore.getState()`, never a hook.
- **React Query** covers only the read-only catalog queries. **Any hook reading the local SQLite catalog must go through `useSyncAwareQuery`** (`src/renderer/queries/useSyncAwareQuery.ts`), which forces `enabled: syncStatus === 'ready' || 'error'`. Skipping it caches an empty result for the 5-minute default `staleTime` during the Supabase sync. Non-React-Query hooks hand-roll the same guard.
- `src/renderer/hooks/useGames.ts` is **not** React Query — it is hand-rolled `useState` + `AbortController` + four IPC listeners (`onGameUpdated`, `onGameRemoved`, `onInstalledGamesChanged`, `onSteamLibraryChanged`) that patch the list in place. Status and author filters run in SQL; content-type filters (`with-achievements`, `with-voice`, `from-workshop`) are AND-combined client-side. A new filter type needs both the SQL path **and** `matchesContentTypes`, or realtime rows bypass it. It does no debouncing of its own and fires an IPC/SQLite query per prop change — the 300 ms debounce lives in its single caller (`useDebounce(searchQuery, 300)` in `Sidebar.tsx`), so a second search entry point wired straight to `useStore.searchQuery` would run an FTS5 query per keystroke.
- **"Is a translation installed" is dual-sourced** — file installs in `useStore.installedTranslations` and Workshop subscriptions in `useWorkshopInstallsStore`. Always read through `src/renderer/hooks/useInstalledTranslations.ts`; reading `useStore.installedTranslations` directly misreports every Workshop translation as not installed.
- Persistence goes through electron-store, never `localStorage` (an ESLint **error** via `no-restricted-globals`). The one exception is the one-time `localStorage` → electron-store migration that runs at module import time in `src/renderer/store/electronStorage.ts` (keys `lbk-settings`, `subscriptions-storage`, `has-launched-before`, guarded by `__migration-v1-done`) — the tree's only `no-restricted-globals` disable; do not "clean it up", it must keep running before any store's `getItem` or every pre-migration user silently loses settings and subscriptions on upgrade. `electronStorage.ts` `getItem` is deliberately synchronous (`sendSync`) so rehydration has no flash of defaults. Only `subscriptions-storage` has a Map/Set-serializing storage; adding a `Set` or `Map` to `lbk-settings`, `promo-modal-storage` or `workshop-installs-storage` persists as `{}`.
- `useSettingsStore` force-disables `animationsEnabled` and `liquidGlassEnabled` on weak hardware (`cpuCount <= 4 || totalRamGB <= 8`) on every rehydrate, and `toggleAnimations()` / `toggleLiquidGlass()` additionally return without setting state when `isHardwareWeak` — flipping either flag on such a machine is a silent no-op, not just an override. `isHardwareWeak` is computed once at module load (`electronAPI.getSystemInfo()`, falling back to `navigator.hardwareConcurrency <= 4`) and exported from `useSettingsStore.ts`; gate UI on it instead of re-detecting hardware in a component. Animations are gated globally by `MotionConfig` in `MainLayout.tsx` plus a `.no-animations` class in `globals.css`, not per component.
- **Gamepad navigation is a DOM-attribute contract**, driven by `document.querySelector` in `useGamepadModeNavigation.ts`. New interactive UI is unreachable on Steam Deck unless it opts in with `data-gamepad-card`, `data-gamepad-action`, `data-gamepad-primary-action`, `data-gamepad-index`, `data-gamepad-dropdown[-item]`, `data-gamepad-confirm` / `-cancel` / `-skip`, `data-gamepad-header-item`, `data-gamepad-modal-item`, or `role="dialog"`. There is no central registry.
- Virtualizer sizing constants live once in `src/renderer/components/Sidebar/constants.ts` (`GAMEPAD_CARD_STRIDE = 156`, `GAME_LIST_ROW_ESTIMATE = 84`) and are shared by the game lists and gamepad scroll math. Changing a card's Tailwind size without updating the constant desyncs focus.
- There is **no i18n layer** — every Ukrainian string is an inline literal in JSX, store actions, hooks and helper maps. Changing copy can break e2e.
- Colours come from CSS variables via `bg-glass` / `bg-bg-dark` / `text-color-main` / `text-color-accent`, not `gray-*` or `cyan-*`. In `tailwind.config.js` the plain `var()` forms live under `backgroundColor`/`textColor`/`borderColor` and the `rgb(var(--x-rgb) / <alpha-value>)` forms under `colors`; only a token that has the RGB-triplet form supports `/NN` alpha and `from-`/`to-` gradients (`bg-dark` is declared in both blocks for exactly that reason). Keep `--x` and `--x-rgb` in sync by hand.
- `src/renderer/utils/global-error-handler.ts` is raw DOM + inline styles on purpose — it renders when React is dead. Do not convert it to a component.
- Notification and gamepad sounds are synthesised with WebAudio oscillators (`src/renderer/utils/gamepadSounds.ts`); `resources/` holds no audio files.
- `src/renderer/components/ui/MarkdownText.tsx` allows exactly 8 tags (`p`, `strong`, `em`, `ul`, `ol`, `li`, `br`, `code`) and rewrites headings to `<p>`. Widening the allowlist changes the trust boundary for Supabase-sourced text.

## Conventions

- **Named exports.** Components are `export const Name: React.FC<Props>` with a local non-exported `interface NameProps`. The single default export in the tree is `src/renderer/components/MainContent/Gallery.tsx`. There are two barrel files (`renderer/components/Placements/index.ts` and `renderer/queries/index.ts`, the latter knip-ignored) — do not add more, and remember knip fails the build on an export nobody imports.
- Hooks and stores: one `use*` export per file, file named after the export.
- `import type` for type-only imports (`consistent-type-imports`, a warn). In `src/shared/types.ts` and `src/preload/index.ts` the `import type` of `BannerData` / `GameBannersResult` / `ImpressionType` from `@/main/db/banners-api` is load-bearing rather than stylistic: that module value-imports `getSupabaseClient`, so downgrading it to a value import drags the main-process Supabase client into the renderer and preload bundles.
- No `any` (ESLint error). No `var`, no duplicate imports (both errors).
- Escape hatches are `/* eslint-disable rule -- reason */` with the reason after `--`. There are zero `@ts-ignore`, `@ts-expect-error` and `biome-ignore` in `src`; keep it that way.
- Every `if`/`else` uses a block statement — `style/useBlockStatements` is Biome's only enabled lint rule (`preset: none`).
- Formatting: 2-space indent, 90 columns, single quotes, es5 trailing commas, always semicolons.
- Console logs carry a bracketed module tag: `[Main]`, `[Installer]`, `[Database]`, `[Migrations]`, `[SyncManager]`, `[Steam]`, `[Downloader]`, `[Proton]`, `[App]`, `[Store]`, `[useGames]`, `[Analytics]`. `console.error` in main is also captured as a Sentry event (`captureConsoleIntegration`).
- Prefer an existing dependency over a hand-rolled helper — check `package.json` (and npm) before writing one.
- Domain types come from Supabase codegen: `Game`, `Platform`, `BannerType`, `FeedbackType` and `InstallPath` are derived from `src/lib/database.types.ts`. You cannot add a platform by editing `src/shared/types.ts`; the Supabase enum (`install_source`) must be regenerated first. There is no `types:generate` script — the file is generated out-of-band.
- Ukrainian copy: a translation entry is «переклад», the Steam Workshop area is «Майстерня». **Never write «айтем»** in strings, comments or copy. Install/uninstall/backup copy uses «українізатор» and the catalog/filters use «переклад» — keep each area as it is, do not mass-rename between them. Identifiers, filenames and data attributes stay English.
- Git commits: plain messages. No AI co-author or attribution trailers.

## Comments

Everyone here reads TS faster than prose about TS. **Default to no comment** — write one only for what the code can't say: a workaround and what breaks without it, a business or regulatory rule, a non-obvious ordering or idempotency constraint.

Never narrate a function body — no step-by-step, no `// Step 1:`, no `// loop over users` above a loop. No JSDoc restating the signature; types carry it. No divider or changelog comments, no commented-out code. TODOs need an issue number.

Comments that do exist stay to **one line**; never write a multi-line comment block.

## Testing and verification

- `pnpm test:unit` is `environment: 'node'`, `include: ['src/**/*.test.ts']` (no `.tsx`), and only aliases `@`. All four suites live in `src/main/utils/` (`platform`, `shell-safety`, `launch-options-value`, `steam-launch-options`). **There are zero renderer unit tests** — do not assume this command covers UI changes. Adding the first one requires editing `vitest.config.ts` (jsdom, `.tsx` glob, `@renderer`/`@components`/`@store` aliases).
- `pnpm test:e2e` needs a packaged app at `release/<package.json version>/` — bump the version without re-packaging and it fails with "Release directory not found". Port 19222 must be free; on Linux you need a display.
- **E2E is strictly serial.** `e2e/playwright.config.ts` pins `workers: 1` (with `retries: 1`, `trace: 'on-first-retry'`) and every spec launches its own packaged app in `beforeAll`, all bound to the same hard-coded CDP port — `launchApp()` force-kills whatever holds it. Never add `fullyParallel` or `test.describe.configure({ mode: 'parallel' })`; a second instance cannot get a port.
- **E2E selects on Ukrainian visible text and ARIA**, e.g. `getByPlaceholder('Пошук гри...')`, `getByText('Ігор не знайдено')`, `button[title="Налаштування"]`, `#modal-title`, `.drag-region`, `[data-nav-group="game-list"]`. There is not one `data-testid` in `src` or `e2e/tests`. Renaming that copy, dropping the settings gear's `title`, or changing `Modal.tsx`'s `id` breaks e2e, which runs on every PR (`e2e.yml` also calls `ci.yml`).
- `test/games.json` is a **dev-only hot-reload catalog override** watched by `games-repository.ts`, not a vitest fixture.
- `pnpm type-check` does not cover `e2e/` (own tsconfig, never invoked) and does not cover `electron.vite.config.ts`: `tsconfig.json` includes only `src`, and the referenced `tsconfig.node.json` lists `vite.config.ts` (which does not exist) and `vitest.config.ts` — and project references are not built by a bare `tsc --noEmit`. Verify before relying on either being checked.

## Build, release, secrets

- `resources/extensions/spellfix.{dylib,so,dll}` is compiled by `scripts/build-spellfix.js` from `resources/extensions/spellfix.c`, is gitignored (`resources/extensions/*` with a `!*.c` negation), and is a hard `extraResources` requirement — `pnpm dist:*` without a prior prebuild has nothing to copy. `pnpm build` only triggers it because `pnpm-workspace.yaml` sets `enablePrePostScripts: true`. Windows needs MSVC (`cl.exe` located via vswhere). `isUpToDate()` compares mtimes only, so a stale binary survives a better-sqlite3 upgrade — delete it by hand after upgrading.
- At runtime a missing spellfix degrades gracefully: search just loses typo tolerance.
- `VITE_*` values are inlined by Vite **into the main process too** (`src/main/db/supabase-credentials.ts`, `src/main/game-detector/kurin.ts`, `src/main/index.ts`). Rotating the Supabase anon key silently breaks every already-shipped binary until a rebuild and release. `.env.example` lists the keys; `.env` is gitignored.
- `verifyUpdateCodeSignature: false` in `electron-builder.config.cjs` is deliberate (Azure Trusted Signing's root ships via a Windows Update many users lack). Do not "fix" it. Windows signing only activates when `AZURE_TENANT_ID` is set, so local `dist:win` is unsigned by design.
- Two update paths: electron-updater, and a portable-only `latest.yml` poller (`src/main/portable-updater.ts`) that emits the same `update-available` event with an extra `downloadUrl`.
- `LBK_E2E=1` or `--e2e` sets `remote-debugging-port=19222` and disables Sentry and all tracking. The port is a bare literal in three places — `src/main/index.ts`, `e2e/helpers/launch.ts`, `e2e/tests/clear-cache.spec.ts` — change all of them.
- Release is tag-driven (`push: tags: v*.*.*`): draft release → per-OS build with `--publish never` → E2E on the packaged app → `gh release upload --clobber` from `release/<package.json version>`, so a version/tag mismatch uploads nothing. Linux targets are AppImage + rpm; the AUR job downloads `LBK-Launcher-linux.AppImage` by name.

## Do not

- Do not add a `games` column without all five edits — `pnpm type-check` catches only two of them.
- Do not write a games-listing query without `VISIBLE_GAMES_SQL`.
- Do not put a read or a search on the DB worker — it handles writes only.
- Do not assume a migration ran on a fresh install; it runs on the second launch.
- Do not call `window.electronAPI.checkForUpdates()` or `onInstallProgress()` — `check-for-updates` has no main handler and `install-progress` is never sent. `ipcMain.on('windows: restore')` in `window-controls.ts` has a typo'd name no preload code invokes.
- Do not use `localStorage`, or `React.lazy` (used nowhere — the cold-start strategy is `isOpen`-gated modals, `useIdleEffect`, `ShaderWarmup`, and deferred image decode).
- Do not edit `localconfig.vdf` while Steam is running, and do not replace the atomic tmp+rename write.
- Do not skip `resignMacBundles()` on macOS installs.
- Do not move the Linux Chromium switches lower in `src/main/index.ts`.
- Do not rewrite or trim `src/shared/changelog.json` — it is append-only. Add the entry for version N **before** tag `vN` is cut: `src/main/changelog.ts` fetches the file as it existed at that tag, so a later commit is invisible forever. It currently holds 2.22.0 and 2.23.0, so the practical history starts at 2.22.0.
- Do not edit files not covered by tooling and assume CI caught it: Biome sees only `src/**` (minus `src/lib/database.types.ts`) plus `electron.vite.config.ts`, `vitest.config.ts`, `package.json` and `tsconfig*.json` (`e2e/` and `scripts/` are unformatted), and ESLint ignores every `*.js`/`*.cjs`/`*.mjs`.

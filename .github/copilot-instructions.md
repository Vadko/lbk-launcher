# LBK Launcher - Copilot Instructions

## Project Overview

LBK Launcher is a cross-platform Electron desktop application that helps Ukrainian gamers discover and install fan-made Ukrainian localizations for video games. It aggregates translations from multiple teams and provides one-click installation.

**Tech Stack:**
- Electron 39+ with electron-vite for build tooling
- React 19 with TypeScript (strict mode)
- Zustand for state management
- better-sqlite3 for local database (with spellfix1 extension for fuzzy search)
- Supabase for backend (real-time sync, authentication)
- TailwindCSS for styling
- Playwright for E2E testing

**Target Platforms:** Windows, macOS, Linux (including Steam Deck via Flatpak/AppImage)

---

## Architecture

### Process Model (Electron IPC)

```
┌─────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                       │
│   src/renderer/                                             │
│   - React UI (components, hooks, store)                     │
│   - Communicates via window.electronAPI (contextBridge)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (ipcRenderer.invoke)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       PRELOAD SCRIPT                        │
│   src/preload/index.ts                                      │
│   - Exposes safe APIs to renderer via contextBridge         │
│   - Type-safe ElectronAPI interface                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (ipcMain.handle)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       MAIN PROCESS                          │
│   src/main/                                                 │
│   - Window management (window.ts)                           │
│   - IPC handlers (ipc/*.ts)                                 │
│   - Installer logic (installer/, installer.ts)              │
│   - Game detection (game-detector/)                         │
│   - Database operations (db/)                               │
│   - Platform utilities (utils/)                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Directories

| Path | Purpose |
|------|---------|
| `src/main/` | Electron main process (Node.js environment) |
| `src/main/db/` | SQLite database, Supabase sync, migrations |
| `src/main/installer/` | Download, extract, backup, platform-specific install |
| `src/main/game-detector/` | Detect games from Steam/GOG/Epic/Xbox/Rockstar |
| `src/main/ipc/` | IPC handler registration |
| `src/main/utils/` | Platform helpers, Steam integration, file utils |
| `src/preload/` | Context bridge (renderer ↔ main communication) |
| `src/renderer/` | React UI application |
| `src/renderer/components/` | React components (organized by feature) |
| `src/renderer/store/` | Zustand stores (useStore, useSettingsStore, etc.) |
| `src/renderer/hooks/` | Custom React hooks |
| `src/renderer/queries/` | React Query hooks for data fetching |
| `src/shared/` | Types and utilities shared between processes |
| `e2e/` | Playwright end-to-end tests |
| `resources/` | Static assets bundled with app |

---

## Code Conventions

### TypeScript

- **Strict mode enabled** - no implicit any, strict null checks
- Use `type` imports for type-only imports: `import type { Game } from './types'`
- Prefer interfaces for object shapes, type aliases for unions/primitives
- Path aliases configured:
  - `@/*` → `./src/*`
  - `@renderer/*` → `./src/renderer/*`
  - `@components/*` → `./src/renderer/components/*`
  - `@store/*` → `./src/renderer/store/*`
  - `@resources/*` → `./resources/*`

### React

- **Functional components only** (no class components)
- Use named exports for components
- Hooks follow `use*` naming convention
- Component files use PascalCase: `GameCard.tsx`
- Component folders group related files: `GameCard/GameCard.tsx`, `GameCard/index.ts`

### State Management (Zustand)

- Main stores in `src/renderer/store/`:
  - `useStore.ts` - Main application state (games, installation status)
  - `useSettingsStore.ts` - User preferences (persisted)
  - `useModalStore.ts` - Modal state
  - `useGamepadModeStore.ts` - Steam Deck gamepad navigation
  - `useSubscriptionsStore.ts` - Game/team subscriptions

### Styling

- **TailwindCSS** for utility-first styling
- Custom CSS in `src/renderer/styles/`
- Avoid inline styles; prefer Tailwind classes
- Use `framer-motion` for animations (respect `animationsEnabled` setting)

### Error Handling

- Custom error classes in `src/main/installer/errors.ts`:
  - `ManualSelectionError` - Game path needs manual selection
  - `NetworkError` - Network-related failures
  - `RateLimitError` - API rate limiting
  - `PausedSignal` - Download paused (not an error)
- Use try/catch with proper error typing
- Log errors with context: `console.error('[Module] Description:', error)`

---

## Platform-Specific Code

### Windows
- Registry operations for uninstaller detection
- `spawn` with `shell: true` for `.bat/.cmd` files
- Azure code signing in CI

### Linux
- Proton/Wine integration for Windows installers (`src/main/installer/proton.ts`)
- Flatpak and AppImage support
- Steam Deck specific flags (gamepad, no sandbox)
- Environment: `STEAM_COMPAT_DATA_PATH`, `STEAM_COMPAT_CLIENT_INSTALL_PATH`

### macOS
- Liquid Glass effect (macOS 26+)
- Universal binary support (arm64/x64)
- Entitlements for code signing

### Platform Detection
```typescript
import { isWindows, isLinux, isMacOS } from './utils/platform';
```

---

## Database

### Local SQLite (better-sqlite3)
- Located at `userData/lbk.db`
- WAL mode for performance
- spellfix1 extension for typo-tolerant search
- Migrations in `src/main/db/migrations.ts`

### Worker Thread
- Heavy DB operations run in worker (`db-worker.ts`)
- Communication via `db-worker-client.ts`

### Supabase Sync
- Real-time subscriptions for game updates
- Offline-first with periodic sync
- Credentials managed via `supabase-credentials.ts`

---

## Installation Flow

1. **Platform Check** - Verify OS compatibility
2. **Game Detection** - Find game path (auto or manual)
3. **Disk Space Check** - Ensure sufficient space
4. **Download** - Fetch archives with progress tracking
5. **Backup** - Create backup of original files (optional)
6. **Extract/Install** - Extract archives or run installer
7. **Post-Install** - Steam launch options, achievements

### Key Files
- `src/main/installer.ts` - Main installation orchestrator
- `src/main/installer/platform.ts` - Platform-specific installation
- `src/main/installer/proton.ts` - Linux Proton integration
- `src/main/installer/backup.ts` - File backup/restore
- `src/main/installer/download.ts` - Download with pause/resume

---

## Testing

### E2E Tests (Playwright)
```bash
pnpm test:e2e
```
- Tests in `e2e/tests/`
- Helper utilities in `e2e/helpers/`
- Requires built app: `pnpm dist:win` (or `:mac`, `:linux`)

### Linting & Formatting
```bash
pnpm lint          # ESLint
pnpm format        # Biome formatter
pnpm format:check  # Check formatting
pnpm type-check    # TypeScript compilation check
pnpm find-unused   # Knip - find unused exports
```

---

## Build & Release

### Development
```bash
pnpm dev           # Start dev server with hot reload
```

### Production Build
```bash
pnpm build         # Build for current platform
pnpm dist:win      # Package for Windows
pnpm dist:mac      # Package for macOS
pnpm dist:linux    # Package for Linux
```

### Environment Variables
Required for production builds:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` - Supabase
- `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` - Error tracking
- `VITE_MIXPANEL_TOKEN_*` - Analytics

---

## Common Patterns

### Adding IPC Handler
1. Define handler in `src/main/ipc/*.ts`
2. Register in setup function (called from `index.ts`)
3. Add type to `ElectronAPI` in `src/shared/types.ts`
4. Expose via `contextBridge` in `src/preload/index.ts`
5. Call from renderer: `window.electronAPI.methodName()`

### Adding Game Detector
1. Create detector in `src/main/game-detector/{platform}.ts`
2. Export from `src/main/game-detector/index.ts`
3. Add platform type to `Platform` enum in `src/shared/types.ts`
4. Update `detectGamePath()` switch statement

### Adding Installer Component
Components are modular pieces (text, voice, achievements):
1. Define in `InstallationInfo.components` type
2. Handle in `installTranslation()` function
3. Track in installation cache

---

## Important Notes

### Security
- Never expose Node.js APIs directly to renderer
- All file system operations go through IPC
- Sanitize user inputs (especially paths)
- Use `shell: true` carefully on Windows

### Performance
- Use worker thread for database queries
- Lazy load components when possible
- Cache game detection results
- Debounce search queries

### Localization Context
This app specifically handles Ukrainian (`uk-UA`) game localizations. Keywords in installer detection:
- `українізатор`, `українською`, `localization`, `ukrainizator`

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `pnpm dev` |
| Type check | `pnpm type-check` |
| Lint code | `pnpm lint` |
| Format code | `pnpm format` |
| Build app | `pnpm build` |
| Run E2E tests | `pnpm test:e2e` |
| Generate DB types | `pnpm types:generate` |
| Find unused code | `pnpm find-unused` |

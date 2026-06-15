# LBK Launcher - AI Agent Guidelines

This document provides comprehensive guidance for AI agents working on the LBK Launcher codebase.

## Project Context

**LBK Launcher** is a cross-platform desktop application that installs Ukrainian game localizations. Think of it as a "package manager" for fan-made translations, with automatic game detection and one-click installation.

### Core Capabilities
- **Game Detection**: Find installed games across Steam, GOG, Epic, Xbox, Rockstar, Heroic, Lutris
- **Translation Installation**: Download, extract, backup original files, run installers
- **Cross-Platform**: Windows, macOS, Linux (including Steam Deck with Proton support)
- **Real-time Sync**: Supabase for database sync, notifications

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON APP                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    IPC     ┌──────────────┐    IPC    ┌─────────────┐ │
│  │   RENDERER   │◄──────────►│   PRELOAD    │◄─────────►│    MAIN     │ │
│  │   (React)    │            │ (contextBridge)│          │   (Node.js) │ │
│  └──────────────┘            └──────────────┘           └─────────────┘ │
│         │                                                      │        │
│         ▼                                                      ▼        │
│  ┌──────────────┐                                      ┌─────────────┐  │
│  │   Zustand    │                                      │   SQLite    │  │
│  │   Stores     │                                      │ (better-    │  │
│  │              │                                      │  sqlite3)   │  │
│  └──────────────┘                                      └─────────────┘  │
│                                                               │         │
│                                                               ▼         │
│                                                        ┌─────────────┐  │
│                                                        │  Supabase   │  │
│                                                        │  (Remote)   │  │
│                                                        └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Knowledge

### 1. Process Boundaries (Electron)

**NEVER** mix code between processes:

| Process | Location | Environment | Can Access |
|---------|----------|-------------|------------|
| Main | `src/main/` | Node.js | fs, child_process, electron APIs |
| Preload | `src/preload/` | Node.js (sandboxed) | contextBridge only |
| Renderer | `src/renderer/` | Browser | DOM, window.electronAPI |

**Communication Pattern:**
```typescript
// Renderer → Main (invoke pattern)
const result = await window.electronAPI.installTranslation(game, options);

// Main → Renderer (event pattern)
getMainWindow()?.webContents.send('download-progress', gameId, progress);
```

### 2. Platform-Specific Code

When writing installer/file operations, ALWAYS consider all platforms:

```typescript
// WRONG - Windows only
execSync('reg query HKLM\\SOFTWARE\\...');

// CORRECT - Platform check
if (isWindows()) {
  execSync('reg query HKLM\\SOFTWARE\\...');
} else if (isLinux()) {
  // Use Proton registry or alternative
}
```

**Key Platform Files:**
- `src/main/utils/platform.ts` - Platform detection utilities
- `src/main/installer/platform.ts` - Platform-specific installer logic
- `src/main/installer/proton.ts` - Linux Proton/Wine integration

### 3. Database Operations

**Local SQLite is the source of truth for installed translations.**

- Always use `GamesRepository` for game data access
- Use worker thread for heavy operations (`db-worker-client.ts`)
- Migrations in `src/main/db/migrations.ts` - add new ones, never modify existing

```typescript
// CORRECT - Use repository pattern
const repo = GamesRepository.getInstance();
const game = repo.getGameById(gameId);

// WRONG - Direct SQL from renderer
// (Can't access SQLite from renderer anyway)
```

### 4. Error Handling Strategy

Custom error types carry semantic meaning for UI decisions:

```typescript
import {
  ManualSelectionError,  // Show folder picker
  NetworkError,          // Show retry option
  RateLimitError,        // Show rate limit message
  PausedSignal,          // Not an error - user paused download
} from './installer/errors';
```

### 5. Installation Cache

Track installed translations in `~/.lbk-launcher/installations/`:

```typescript
interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
  hasBackup?: boolean;
  protonPath?: string;           // For Linux Proton installations
  installedPlatform?: Platform;  // steam, epic, gog, etc.
  components?: {
    text: InstallationComponent;  // Required when components present
    voice?: InstallationComponent;
    achievements?: InstallationComponent;
  };
}
```

---

## Common Mistakes to Avoid

### ❌ Wrong: Importing Node.js modules in renderer
```typescript
// src/renderer/components/SomeComponent.tsx
import fs from 'fs'; // ERROR - fs not available in renderer
```

### ✅ Correct: Use IPC
```typescript
// src/renderer/components/SomeComponent.tsx
const games = await window.electronAPI.fetchGames({ searchQuery: 'witcher' });
```

---

### ❌ Wrong: Running .bat files on Linux without Proton
```typescript
spawn(batFilePath, []); // Will fail on Linux
```

### ✅ Correct: Use runProton for Windows executables on Linux
```typescript
if (isLinux()) {
  await runProton(protonPath, batFilePath, gamePath);
} else {
  spawn(batFilePath, [], { shell: true });
}
```

---

### ❌ Wrong: Hardcoding paths
```typescript
const dbPath = 'C:\\Users\\...\\lbk.db';
```

### ✅ Correct: Use Electron's app paths
```typescript
import { app } from 'electron';
const dbPath = path.join(app.getPath('userData'), 'lbk.db');
```

---

### ❌ Wrong: Forgetting to expose IPC handlers
```typescript
// Added handler in main, but forgot preload!
ipcMain.handle('new-feature', () => {...});
// Renderer can't call it without contextBridge exposure
```

### ✅ Correct: Complete IPC chain
```typescript
// 1. src/main/ipc/feature.ts
ipcMain.handle('new-feature', () => {...});

// 2. src/shared/types.ts - add to ElectronAPI interface
interface ElectronAPI {
  newFeature: () => Promise<Result>;
}

// 3. src/preload/index.ts - expose via contextBridge
newFeature: () => ipcRenderer.invoke('new-feature'),
```

---

## File Organization Patterns

### React Components
```
src/renderer/components/
├── Feature/
│   ├── Feature.tsx       # Main component
│   ├── FeatureItem.tsx   # Sub-component
│   ├── useFeature.ts     # Feature-specific hook
│   └── index.ts          # Re-exports
```

### Main Process Modules
```
src/main/
├── installer/
│   ├── index.ts          # Re-exports
│   ├── download.ts       # Download logic
│   ├── archive.ts        # Archive extraction
│   └── platform.ts       # Platform-specific code
```

---

## Testing Considerations

### E2E Tests (Playwright)
- Tests run against **packaged app** (`release/` directory)
- Use CDP debugging port 19222
- Helper in `e2e/helpers/launch.ts`

```typescript
// E2E test structure
import { test, expect } from '@playwright/test';
import { launchApp, type AppInstance } from '../helpers/launch';

test('should install translation', async () => {
  const app = await launchApp();
  // Test logic
  await app.close();
});
```

---

## Dependencies to Know

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | Local SQLite database |
| `got` | HTTP client for downloads |
| `node-7z` | Archive extraction |
| `fast-vdf` | Steam VDF file parsing |
| `framer-motion` | Animations |
| `zustand` | State management |
| `@tanstack/react-query` | Async state/caching |
| `electron-updater` | Auto-updates |
| `mixpanel-browser` | Analytics |
| `@sentry/electron` | Error tracking |

---

## Debugging Tips

### Enable Logging
Console logs appear in:
- **Main process**: Terminal where `pnpm dev` runs
- **Renderer**: DevTools console (Ctrl+Shift+I)

### Log Prefixes
```typescript
console.log('[Installer] Installing...'); // Module prefix
console.log('[Database] Query failed:', error);
console.log('[GameDetector] Found Steam games:', count);
```

### Check IPC Communication
```typescript
// In main process
console.log('[IPC] install-translation called with:', game.id);
```

---

## Performance Guidelines

1. **Debounce search queries** - User types fast, don't query on every keystroke
2. **Use worker thread for DB** - Heavy queries block main thread
3. **Lazy load components** - Large lists should virtualize
4. **Cache game detection** - Don't re-scan Steam library on every render
5. **Stream large downloads** - Don't buffer entire file in memory

---

## Quick Commands

```bash
# Development
pnpm dev              # Start with hot reload
pnpm type-check       # TypeScript validation
pnpm lint             # ESLint
pnpm format           # Biome formatter

# Building
pnpm build            # Compile TypeScript
pnpm dist:win         # Package for Windows
pnpm dist:mac         # Package for macOS
pnpm dist:linux       # Package for Linux

# Testing
pnpm test:e2e         # Playwright E2E tests

# Utilities
pnpm find-unused      # Knip - find dead code
pnpm types:generate   # Regenerate Supabase types
```

---

## When Modifying Code

### Before Making Changes
1. Check which process the code runs in (main/preload/renderer)
2. Consider all three platforms (Windows/macOS/Linux)
3. Check if IPC handler changes need preload updates
4. Run `pnpm type-check` to catch type errors early

### After Making Changes
1. Run `pnpm lint` and `pnpm format`
2. Test on at least one platform
3. Check console for errors in both processes
4. For installer changes, test full install/uninstall cycle

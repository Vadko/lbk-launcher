# Claude Code Instructions for LBK Launcher

## Project Summary

LBK Launcher is an Electron + React desktop application for installing Ukrainian game localizations. Key aspects:

- **Electron 39+** with three processes (main, preload, renderer)
- **React 19** with Zustand state management
- **better-sqlite3** for local database with Supabase sync
- **Cross-platform**: Windows, macOS, Linux (including Steam Deck)

## Architecture Quick Reference

```
Renderer (React) → Preload (contextBridge) → Main (Node.js)
     ↓                                            ↓
  Zustand                                    SQLite + Supabase
```

## Critical Constraints

### Process Isolation

| Can Use | Main | Preload | Renderer |
|---------|------|---------|----------|
| `fs`, `child_process` | ✅ | ❌ | ❌ |
| `ipcRenderer` | ❌ | ✅ | ❌ |
| `window.electronAPI` | ❌ | ❌ | ✅ |
| React, DOM | ❌ | ❌ | ✅ |

### IPC Chain for New Features

1. **Main**: `ipcMain.handle('channel', handler)` in `src/main/ipc/`
2. **Types**: Add to `ElectronAPI` in `src/shared/types.ts`
3. **Preload**: Expose via `contextBridge` in `src/preload/index.ts`
4. **Renderer**: Call `window.electronAPI.method()`

### Platform Considerations

Always check platform for system operations:

```typescript
import { isWindows, isLinux, isMacOS } from './utils/platform';

// Windows: Registry, .bat with shell:true
// Linux: Proton for Windows exes, Flatpak paths
// macOS: Liquid Glass (26+), universal binary
```

## Code Style

- **TypeScript strict mode** - No `any`, null checks required
- **Biome** for formatting (not Prettier)
- **ESLint** for linting
- **Named exports** for components
- **`use*` prefix** for hooks and stores

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main entry |
| `src/main/installer.ts` | Installation orchestrator |
| `src/main/installer/platform.ts` | Platform-specific install |
| `src/main/installer/proton.ts` | Linux Proton integration |
| `src/main/game-detector/index.ts` | Game detection entry |
| `src/main/db/database.ts` | SQLite singleton |
| `src/preload/index.ts` | Context bridge |
| `src/renderer/App.tsx` | React root |
| `src/renderer/store/useStore.ts` | Main Zustand store |
| `src/shared/types.ts` | Shared type definitions |

## Common Tasks

### Add IPC Handler
```typescript
// 1. src/main/ipc/feature.ts
ipcMain.handle('new-action', async (_, args) => result);

// 2. src/shared/types.ts
interface ElectronAPI { newAction: (args) => Promise<Result>; }

// 3. src/preload/index.ts
newAction: (args) => ipcRenderer.invoke('new-action', args),
```

### Add Zustand State
```typescript
// src/renderer/store/useFeatureStore.ts
export const useFeatureStore = create<Store>((set) => ({
  value: null,
  setValue: (value) => set({ value }),
}));
```

### Platform-Specific Code
```typescript
if (isWindows()) {
  spawn(file, [], { shell: true }); // .bat support
} else if (isLinux()) {
  await runProton(protonPath, file, gamePath);
}
```

## Testing

```bash
pnpm type-check  # TypeScript validation
pnpm lint        # ESLint
pnpm format      # Biome
pnpm test:e2e    # Playwright (needs built app)
```

## Error Classes

Located in `src/main/installer/errors.ts`:
- `ManualSelectionError` - Game path needs manual selection
- `NetworkError` - Network failed (can retry)
- `RateLimitError` - API rate limited
- `PausedSignal` - Download paused (not error)

## Localization Context

This app handles Ukrainian game localizations. Detection keywords:
- `українізатор`, `українською`, `localization`, `ukrainizator`

## Quick Commands

```bash
pnpm dev          # Development with hot reload
pnpm build        # Compile TypeScript
pnpm dist:win     # Package for Windows
pnpm dist:mac     # Package for macOS  
pnpm dist:linux   # Package for Linux
pnpm find-unused  # Knip - find dead code
```

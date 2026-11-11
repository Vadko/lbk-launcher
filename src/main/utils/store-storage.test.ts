import { isDeepStrictEqual } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Watch = (next: unknown, previous: unknown) => void;

const fake = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  watches: new Map<string, Watch[]>(),
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      fake.handlers.set(channel, handler);
    },
  },
}));

vi.mock('electron-store', () => ({
  default: class {
    get(key: string) {
      return fake.data.get(key);
    }
    // conf calls onDidChange only for a value that changed
    set(key: string, value: unknown) {
      const previous = fake.data.get(key);
      fake.data.set(key, value);
      if (isDeepStrictEqual(previous, value)) {
        return;
      }
      for (const watch of fake.watches.get(key) ?? []) {
        watch(value, previous);
      }
    }
    onDidChange(key: string, watch: Watch) {
      fake.watches.set(key, [...(fake.watches.get(key) ?? []), watch]);
      return () => undefined;
    }
  },
}));

// The renderer's zustand persist writes go through this handler
const write = (key: string, state: object) =>
  fake.handlers.get('store-storage:set')?.(
    null,
    key,
    JSON.stringify({ state, version: 1 })
  );

async function load() {
  vi.resetModules();
  fake.data.clear();
  fake.watches.clear();
  fake.handlers.clear();
  const { appEvents } = await import('@/main/app-events');
  const { setupStoreStorageHandlers } = await import('./store-storage');
  setupStoreStorageHandlers();
  return appEvents;
}

let appEvents: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  appEvents = await load();
});

describe('the settings events', () => {
  it.each<[string, object | null, object, number]>([
    [
      'turns the AI filter on',
      { hideAiTranslations: false },
      { hideAiTranslations: true },
      1,
    ],
    [
      'turns the AI filter off',
      { hideAiTranslations: true },
      { hideAiTranslations: false },
      1,
    ],
    [
      'changes another setting',
      { hideAiTranslations: true, uiSoundsEnabled: true },
      { hideAiTranslations: true, uiSoundsEnabled: false },
      0,
    ],
    ['writes the default first', null, { hideAiTranslations: false }, 0],
    ['writes the filter on first', null, { hideAiTranslations: true }, 1],
  ])(
    'emits hide-ai-changed as often as a write that %s needs',
    (_label, before, after, times) => {
      if (before) {
        write('lbk-settings', before);
      }
      const changed = vi.fn();
      appEvents.on('hide-ai-changed', changed);

      write('lbk-settings', after);

      expect(changed).toHaveBeenCalledTimes(times);
    }
  );

  it.each<[string, object | null, object, number]>([
    ['switches the language', { language: 'uk' }, { language: 'en' }, 1],
    [
      'changes another setting',
      { language: 'en', uiSoundsEnabled: true },
      { language: 'en', uiSoundsEnabled: false },
      0,
    ],
    ['writes the default first', null, { language: 'uk' }, 0],
    [
      'writes a first settings envelope without a language',
      null,
      { uiSoundsEnabled: true },
      0,
    ],
    ['writes a non-default language first', null, { language: 'be' }, 1],
    [
      'stores an unknown language over a known one',
      { language: 'en' },
      { language: 'xx' },
      1,
    ],
  ])(
    'emits language-changed as often as a write that %s needs',
    (_label, before, after, times) => {
      if (before) {
        write('lbk-settings', before);
      }
      const changed = vi.fn();
      appEvents.on('language-changed', changed);

      write('lbk-settings', after);

      expect(changed).toHaveBeenCalledTimes(times);
    }
  );

  it('emits workshop-installs-changed for every write that changes the Workshop installs', () => {
    const changed = vi.fn();
    appEvents.on('workshop-installs-changed', changed);

    write('workshop-installs-storage', { installedAt: { a: 1 } });
    write('workshop-installs-storage', { installedAt: { a: 1 } });
    write('workshop-installs-storage', { installedAt: {} });

    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe('readLanguage', () => {
  it.each<[string, object | null, string]>([
    ['nothing stored as uk', null, 'uk'],
    ['a stored be as be', { language: 'be' }, 'be'],
    ['a stored en as en', { language: 'en' }, 'en'],
    ['an unknown language as uk', { language: 'xx' }, 'uk'],
    ['a settings envelope without one as uk', { uiSoundsEnabled: true }, 'uk'],
  ])('reads %s', async (_label, state, expected) => {
    const { readLanguage } = await import('./store-storage');
    if (state) {
      write('lbk-settings', state);
    }

    expect(readLanguage()).toBe(expected);
  });
});

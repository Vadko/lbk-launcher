import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  listeners: [] as Array<() => void>,
}));

vi.mock('@/main/utils/store-storage', () => ({
  readRendererSetting: (field: string, fallback: unknown) =>
    field in settings.values ? settings.values[field] : fallback,
  onRendererSettingsChanged: (listener: () => void) => settings.listeners.push(listener),
}));

function load() {
  vi.resetModules();
  return import('./triggers');
}

const writeSettings = (values: Record<string, unknown>) => {
  settings.values = values;
  for (const listener of settings.listeners) {
    listener();
  }
};

beforeEach(() => {
  settings.values = { hideAiTranslations: false };
  settings.listeners = [];
});

describe('setting', () => {
  it('fires only when its own field changes', async () => {
    const { setting } = await load();
    const fire = vi.fn();
    setting('hideAiTranslations')(fire);

    writeSettings({ hideAiTranslations: false, animationsEnabled: false });
    writeSettings({ hideAiTranslations: true, animationsEnabled: false });
    writeSettings({ hideAiTranslations: true, animationsEnabled: true });

    expect(fire).toHaveBeenCalledOnce();
  });
});

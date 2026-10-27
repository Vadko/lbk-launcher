import { describe, expect, it, vi } from 'vitest';

const saved = new Map<string, string>([['__migration-v1-done', '1']]);
const storeStorage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
  removeItem: (key: string) => saved.delete(key),
};
vi.stubGlobal('window', { storeStorage });
vi.mock('./useSubscriptionsStore', () => ({
  useSubscriptionsStore: { getState: () => ({}) },
}));

const { useSettingsStore } = await import('./useSettingsStore');

const persisted = (): Record<string, unknown> =>
  JSON.parse(saved.get('lbk-settings') ?? '{}').state ?? {};

describe('useSettingsStore review lever hint', () => {
  it('saves the hint as seen once the lever is first hovered', () => {
    useSettingsStore.setState({ reviewLeverHintSeen: false });
    expect(persisted().reviewLeverHintSeen).toBe(false);

    useSettingsStore.getState().markReviewLeverHintSeen();

    expect(useSettingsStore.getState().reviewLeverHintSeen).toBe(true);
    expect(persisted().reviewLeverHintSeen).toBe(true);
  });

  it('reads the seen hint back on the next start', async () => {
    useSettingsStore.setState({ reviewLeverHintSeen: false });
    saved.set(
      'lbk-settings',
      JSON.stringify({ state: { reviewLeverHintSeen: true }, version: 0 })
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().reviewLeverHintSeen).toBe(true);
  });
});

import { en } from '@lbk/i18n/en';
import { pl } from '@lbk/i18n/pl';
import { uk } from '@lbk/i18n/uk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage, t } from '@/shared/i18n/i18n';
import { DEFAULT_LANGUAGE, type Language } from '@/shared/i18n/languages';

const mocks = vi.hoisted(() => ({
  stored: new Map<string, unknown>(),
  invoke: vi.fn(),
}));

vi.mock('@/main/game-detector/steam', () => ({ getCurrentSteamAccountId: () => '42' }));
vi.mock('@/main/utils/steam-bridge', () => ({
  ensureSteamBridge: () => Promise.resolve({ invoke: mocks.invoke }),
}));
vi.mock('@/main/utils/store-storage', () => ({
  readSteamAccountValue: (key: string, accountId: string) =>
    mocks.stored.get(`${key}/${accountId}`),
  writeSteamAccountValue: (key: string, accountId: string, value: unknown) => {
    mocks.stored.set(`${key}/${accountId}`, value);
  },
}));

const { syncTranslatedGamesCollection } = await import('@/main/utils/steam-collections');

const RECORD = 'steam-collection/42';
const ukName = uk.steamCollection.name;
const enName = en.steamCollection.name;
const plName = pl.steamCollection.name;

function answer(created: boolean, collectionId: string | null) {
  return { created, collectionId, total: 1, added: created ? 1 : 0, removed: 0 };
}

beforeEach(() => {
  mocks.stored.clear();
  mocks.invoke.mockReset();
});

afterEach(() => changeLanguage(DEFAULT_LANGUAGE));

describe('syncTranslatedGamesCollection', () => {
  it('reads the uk name with lng while another language is active', async () => {
    await changeLanguage('en');
    expect([t('steamCollection.name'), t('steamCollection.name', { lng: 'uk' })]).toEqual(
      [enName, ukName]
    );
    expect(ukName).not.toBe(enName);
  });

  it.each<{
    label: string;
    language: Language;
    record: unknown;
    reply: ReturnType<typeof answer>;
    sent: { name: string; recordedId: string | null };
    saved: unknown;
  }>([
    {
      label: 'no record: current-language name, recorded on create',
      language: 'en',
      record: undefined,
      reply: answer(true, 'new-id'),
      sent: { name: enName, recordedId: null },
      saved: { id: 'new-id', name: enName },
    },
    {
      label: 'record with name: that name after a switch',
      language: 'pl',
      record: { id: 'old-id', name: enName },
      reply: answer(false, 'old-id'),
      sent: { name: enName, recordedId: 'old-id' },
      saved: { id: 'old-id', name: enName },
    },
    {
      label: 'legacy record without name: uk name, migrated to a named record',
      language: 'en',
      record: 'legacy-id',
      reply: answer(false, 'legacy-id'),
      sent: { name: ukName, recordedId: 'legacy-id' },
      saved: { id: 'legacy-id', name: ukName },
    },
    {
      label: 'malformed record: current-language name',
      language: 'pl',
      record: { id: 7 },
      reply: answer(true, 'fresh-id'),
      sent: { name: plName, recordedId: null },
      saved: { id: 'fresh-id', name: plName },
    },
    {
      label: 'same-named foreign collection: record left as it was',
      language: 'en',
      record: undefined,
      reply: answer(false, null),
      sent: { name: enName, recordedId: null },
      saved: undefined,
    },
  ])('$label', async ({ language, record, reply, sent, saved }) => {
    await changeLanguage(language);
    if (record !== undefined) {
      mocks.stored.set(RECORD, record);
    }
    mocks.invoke.mockResolvedValue(reply);

    await expect(syncTranslatedGamesCollection([10])).resolves.toEqual({
      ok: true,
      total: 1,
    });
    expect(mocks.invoke).toHaveBeenCalledWith('syncCollection', {
      ...sent,
      appIds: [10],
    });
    expect(mocks.stored.get(RECORD)).toEqual(saved);
  });
});

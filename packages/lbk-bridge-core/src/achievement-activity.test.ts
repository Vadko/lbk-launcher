import { describe, expect, it } from 'vitest';
import { createActivityTranslator } from './achievement-activity';
import type { AchText } from './achievement-text';
import { steamBetaAchievements as fixture } from './fixtures/steam-beta-achievements';

const GAME = 1912410;
const WITCH = 'COMPLETE_DEFEAT_THE_WANDERING_WITCH_QUEST';
const strings: Record<string, Record<string, AchText>> = {
  [GAME]: { [WITCH]: { name: 'LBK: відьма', desc: 'LBK: опис' } },
  '42': { UPGRADE_A_TALISMAN_TO_LEVEL_3: { name: 'LBK: талісман' } },
};
const lookup = (appid: unknown, id: unknown): AchText | undefined =>
  strings[String(appid)]?.[String(id)];

type Rec = Record<string, unknown>;
type MapCache = [number, [string, Rec][]][];
const parse = (text: string): MapCache => JSON.parse(text);
const json = JSON.stringify(fixture.achievementMap.data);
const records = (): [string, Rec][] => parse(json)[0][1];
const steamName = (i: number): unknown => records()[i][1].strName;

describe('achievement map cache', () => {
  it('translates by the inner app id and restores Steam strings before a save', () => {
    const t = createActivityTranslator(lookup);
    const translated = t.mapJson(json, false);
    const [[appid, recs]] = parse(translated);
    expect(appid).toBe(GAME);
    expect(recs[0][1]).toMatchObject({
      strID: WITCH,
      strName: 'LBK: відьма',
      strDescription: 'LBK: опис',
      flAchieved: records()[0][1].flAchieved,
    });
    expect(recs[1][1].strName).toBe(steamName(1));

    expect(t.mapJson(translated, true)).toBe(json);
  });

  it('uses the app id inside the map, not the app that owns the cache entry', () => {
    const t = createActivityTranslator(lookup);
    const other = JSON.stringify([[42, records()]]);
    const [[, recs]] = parse(t.mapJson(other, false));
    expect(recs.map(([, r]) => r.strName)).toEqual([steamName(0), 'LBK: талісман']);
  });

  it('restores what it wrote after the translation changed or went away', () => {
    let current: Record<string, Record<string, AchText>> = strings;
    const t = createActivityTranslator(
      (appid, id) => current[String(appid)]?.[String(id)]
    );
    const v1 = t.mapJson(json, false);
    current = { [GAME]: { [WITCH]: { name: 'LBK: v2' } } };
    const v2 = t.mapJson(v1, false);
    expect(parse(v2)[0][1][0][1].strName).toBe('LBK: v2');
    current = {};
    expect(t.mapJson(v1, true)).toBe(json);
    expect(t.mapJson(v2, true)).toBe(json);
  });

  it('reverts only the text it wrote', () => {
    const t = createActivityTranslator((_appid, id) =>
      id === WITCH ? { name: 'LBK: відьма' } : undefined
    );
    t.mapJson(json, false);
    const renamed = records();
    renamed[0][1].strName = 'Steam renamed it';
    const steamJson = JSON.stringify([[GAME, renamed]]);
    expect(t.mapJson(steamJson, true)).toBe(steamJson);
  });

  it('returns the same string when there is nothing to change', () => {
    const t = createActivityTranslator(() => undefined);
    expect(t.mapJson(json, false)).toBe(json);
    expect(t.mapJson('not json', false)).toBe('not json');
    expect(t.mapJson('{}', false)).toBe('{}');
  });
});

describe('activity store', () => {
  function makeStore() {
    const recs = new Map(records());
    const card: { gameid: string; m_rgAchievements: Rec[] } = {
      gameid: String(GAME),
      m_rgAchievements: [{ ...recs.get(WITCH), rtUnlocked: 1, bAchieved: true }],
    };
    const activity = {
      m_AchievementMap: new Map([[GAME, recs]]),
      m_mapActivityByDay: new Map([
        [1, { m_mapAchievementsByUser: new Map([[7, card]]) }],
      ]),
    };
    return { store: { m_mapAppActivity: new Map([[GAME, activity]]) }, recs, card };
  }

  it('patches loaded maps and the cards copied from them, and reverts both', () => {
    const t = createActivityTranslator(lookup);
    const { store, recs, card } = makeStore();
    const original = recs.get(WITCH)?.strName;

    t.patchStore(store, new Set([String(GAME)]), false);
    expect(recs.get(WITCH)?.strName).toBe('LBK: відьма');
    expect(card.m_rgAchievements[0].strDescription).toBe('LBK: опис');

    t.patchStore(store, new Set([String(GAME)]), true);
    expect(recs.get(WITCH)?.strName).toBe(original);
    expect(card.m_rgAchievements[0].strName).toBe(original);
  });

  it('skips apps outside the set', () => {
    const t = createActivityTranslator(lookup);
    const { store, recs } = makeStore();
    const original = recs.get(WITCH)?.strName;
    t.patchStore(store, new Set(['42']), false);
    expect(recs.get(WITCH)?.strName).toBe(original);
  });

  it('patches a map Steam just built from the server', () => {
    const t = createActivityTranslator(lookup);
    const recs = new Map(records());
    t.patchMap(recs, GAME);
    expect(recs.get(WITCH)?.strName).toBe('LBK: відьма');
  });
});

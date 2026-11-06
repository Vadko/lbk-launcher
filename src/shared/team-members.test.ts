import { describe, expect, it } from 'vitest';
import { teamMembers } from './team-members';

describe('teamMembers', () => {
  it.each([
    ['one team', 'LBK', ['LBK']],
    ['a comma list', 'LBK, Raccoon Team', ['LBK', 'Raccoon Team']],
    ['spaces and empty parts', ' LBK ,, Raccoon Team , ', ['LBK', 'Raccoon Team']],
    ['an empty team', '', []],
    ['no team', null, []],
  ])('splits %s', (_, team, expected) => {
    expect(teamMembers(team)).toEqual(expected);
  });
});

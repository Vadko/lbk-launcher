import { describe, expect, it } from 'vitest';
import { parseBottlePath } from './crossover';

describe('parseBottlePath', () => {
  it.each([
    [
      'one folder',
      '[CrossOver]\n"BottlePath" = "/Volumes/Games/Bottles"\n',
      ['/Volumes/Games/Bottles'],
    ],
    ['a colon-separated list', '[CrossOver]\n"BottlePath" = "/a:/b"\n', ['/a', '/b']],
    ['no CrossOver section', '[Other]\n"BottlePath" = "/a"\n', []],
    ['an empty value', '[CrossOver]\n"BottlePath" = ""\n', []],
    ['another key of the section', '[CrossOver]\n"Menu" = "1"\n', []],
  ])('%s', (_label, conf, dirs) => {
    expect(parseBottlePath(conf)).toEqual(dirs);
  });
});

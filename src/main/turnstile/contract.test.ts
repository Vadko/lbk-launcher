import { describe, expect, it } from 'vitest';
import { CAPTCHA_CHANNELS } from '../../shared/captcha-channels';
import { PAGE_MESSAGES } from './contract';

const ID = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const { ready, unavailable, resolve, reject } = CAPTCHA_CHANNELS;

describe('PAGE_MESSAGES', () => {
  it.each([
    ['ready', ready, [], { type: 'ready' }],
    [
      'unavailable',
      unavailable,
      ['script_error'],
      { type: 'unavailable', code: 'script_error' },
    ],
    [
      'resolve',
      resolve,
      [ID, 'x'.repeat(2048)],
      { type: 'resolve', requestId: ID, token: 'x'.repeat(2048) },
    ],
    ['reject', reject, [ID, '300030'], { type: 'reject', requestId: ID, code: '300030' }],
  ] as const)('reads %s', (_label, channel, args, message) => {
    expect(PAGE_MESSAGES[channel].safeParse(args)).toEqual({
      success: true,
      data: message,
    });
  });

  it.each([
    ['ready with an argument', ready, ['x']],
    ['unavailable without a code', unavailable, []],
    ['a token that is not a string', resolve, [ID, 42]],
    ['a code that is an object', reject, [ID, { code: 1 }]],
    ['an extra argument', reject, [ID, 'timeout', 'more']],
  ] as const)('refuses %s', (_label, channel, args) => {
    expect(PAGE_MESSAGES[channel].safeParse(args).success).toBe(false);
  });
});

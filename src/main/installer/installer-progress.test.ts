/* eslint-disable no-restricted-syntax -- real UXM-CLI and install.bat output lines are Ukrainian */
import { once } from 'events';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { parseInstallerProgress, readInstallerLines } from './installer-progress';

describe('parseInstallerProgress', () => {
  it.each([
    [
      'percent with padding',
      '[ 85%] Розпакування sd\\sd (5624/8650)...',
      { message: 'Розпакування sd\\sd (5624/8650)...', progress: 85, phase: 'install' },
    ],
    [
      'zero percent',
      '[  0%] Підготовка до розпакування...',
      { message: 'Підготовка до розпакування...', progress: 0, phase: 'install' },
    ],
    [
      'full percent',
      '[100%] Патч завершено! (замін: 34)',
      { message: 'Патч завершено! (замін: 34)', progress: 100, phase: 'install' },
    ],
    [
      'over 100 is capped',
      '[150%] done',
      { message: 'done', progress: 100, phase: 'install' },
    ],
    [
      'step line',
      '[1/2] Розпакування архівів гри...',
      { message: '[1/2] Розпакування архівів гри...', phase: 'install' },
    ],
    [
      'surrounding whitespace',
      '  [ 5%] Завантаження Data0...\r',
      { message: 'Завантаження Data0...', progress: 5, phase: 'install' },
    ],
  ])('%s', (_label, line, expected) => {
    expect(parseInstallerProgress(line)).toEqual(expected);
  });

  it.each([
    ['plain text', 'Гра: eldenring.exe'],
    ['percent without text', '[ 50%]'],
    ['percent not at the start', 'done [ 50%] text'],
    ['bracketed word', '[INFO] something'],
    ['empty', ''],
    ['pause prompt', 'Press any key to continue . . .'],
  ])('ignores %s', (_label, line) => {
    expect(parseInstallerProgress(line)).toBeNull();
  });
});

describe('readInstallerLines', () => {
  it('joins a UTF-8 character split across chunks and skips blank lines', async () => {
    const stream = new PassThrough();
    const lines: string[] = [];
    readInstallerLines(stream, (line) => lines.push(line));

    const bytes = Buffer.from('[ 1%] Розпакування\r\n\r\n[2/2] Патч exe...\n', 'utf8');
    const splitInsideLetter = bytes.indexOf(Buffer.from('Р', 'utf8')) + 1;
    stream.write(bytes.subarray(0, splitInsideLetter));
    stream.write(bytes.subarray(splitInsideLetter));
    stream.end('Усі операції завершено.');
    await once(stream, 'end');
    await new Promise((resolve) => setImmediate(resolve));

    expect(lines).toEqual([
      '[ 1%] Розпакування',
      '[2/2] Патч exe...',
      'Усі операції завершено.',
    ]);
  });
});

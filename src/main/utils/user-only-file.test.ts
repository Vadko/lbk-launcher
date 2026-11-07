import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  windows: true,
  refuseRename: false,
  // What each icacls run saw: the file it locked, its content then, and whether the final name existed.
  locked: [] as { file: string; content: string; finalName: string | null }[],
  finalName: '',
}));

vi.mock('./platform', () => ({ isWindows: () => fake.windows }));
vi.mock('./host-exec', () => ({ system32: (name: string) => name }));
vi.mock('node:child_process', () => ({
  execFileSync: (_cmd: string, args: string[]) => {
    const read = (file: string) =>
      fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    fake.locked.push({
      file: args[0],
      content: fs.readFileSync(args[0], 'utf8'),
      finalName: read(fake.finalName),
    });
  },
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    renameSync: (from: fs.PathLike, to: fs.PathLike) => {
      if (fake.refuseRename) {
        throw Object.assign(new Error('EPERM: operation not permitted'), {
          code: 'EPERM',
        });
      }
      actual.renameSync(from, to);
    },
  };
});

const { currentUserOnlyIcaclsArgs, writeUserOnlyFile } = await import('./user-only-file');

describe('writeUserOnlyFile', () => {
  let root: string;
  const tmp = () => `${fake.finalName}.lbk.tmp`;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-user-only-'));
    fake.finalName = path.join(root, 'bridge.json');
    fake.windows = true;
    fake.refuseRename = false;
    fake.locked = [];
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each<[string, string | null, boolean, { file: 'tmp' | 'final'; content: string }[]]>(
    [
      ['a first write', null, false, [{ file: 'tmp', content: '' }]],
      ['a rewrite', 'old', false, [{ file: 'tmp', content: '' }]],
      [
        'a file Steam holds open',
        'old',
        true,
        [
          { file: 'tmp', content: '' },
          { file: 'final', content: 'old' },
        ],
      ],
    ]
  )(
    'locks %s down before it holds the secret',
    (_case, existing, refuseRename, locks) => {
      if (existing !== null) {
        fs.writeFileSync(fake.finalName, existing);
      }
      fake.refuseRename = refuseRename;

      writeUserOnlyFile(fake.finalName, 'secret');

      expect(fake.locked).toEqual(
        locks.map(({ file, content }) => ({
          file: file === 'tmp' ? tmp() : fake.finalName,
          content,
          finalName: existing,
        }))
      );
      expect(fs.readFileSync(fake.finalName, 'utf8')).toBe('secret');
      expect(fs.existsSync(tmp())).toBe(false);
    }
  );

  it('gives up without a final file when the rename fails', () => {
    fake.refuseRename = true;
    expect(() => writeUserOnlyFile(fake.finalName, 'secret')).toThrow('EPERM');
    expect(fs.existsSync(fake.finalName)).toBe(false);
    expect(fs.existsSync(tmp())).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('writes 0600 without icacls elsewhere', () => {
    fake.windows = false;
    writeUserOnlyFile(fake.finalName, 'secret');
    expect(fake.locked).toEqual([]);
    expect(fs.statSync(fake.finalName).mode & 0o777).toBe(0o600);
  });
});

describe('currentUserOnlyIcaclsArgs', () => {
  it.each<[string, NodeJS.ProcessEnv, string[]]>([
    [
      'a domain account',
      { USERNAME: 'vadko', USERDOMAIN: 'PC' },
      ['C:\\Steam\\bridge.json', '/inheritance:r', '/grant:r', 'PC\\vadko:F'],
    ],
    [
      'the OS user name without env',
      {},
      ['C:\\Steam\\bridge.json', '/inheritance:r', '/grant:r', 'vadko:F'],
    ],
  ])('drops inherited access and grants only %s', (_case, env, args) => {
    expect(currentUserOnlyIcaclsArgs('C:\\Steam\\bridge.json', env, 'vadko')).toEqual(
      args
    );
  });
});

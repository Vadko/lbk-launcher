import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

interface FakeDb {
  file: string;
  closed: boolean;
}

const { opened } = vi.hoisted(() => ({ opened: [] as FakeDb[] }));

vi.mock('better-sqlite3', () => ({
  default: class {
    closed = false;
    constructor(readonly file: string) {
      opened.push(this);
    }
    prepare() {
      return { all: () => [{ name: 'Gwent' }] };
    }
    close() {
      this.closed = true;
    }
  },
}));
vi.mock('../utils/platform', () => ({ isLinux: () => true }));

const { getLutrisGogLibrary } = await import('./lutris');

let home: string;
const nativeDb = () => path.join(home, '.local/share/lutris/pga.db');
const flatpakDb = () => path.join(home, '.var/app/net.lutris.Lutris/data/lutris/pga.db');

function touch(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-lutris-'));
  vi.stubEnv('HOME', home);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

it('reuses one readonly handle and closes it once the DB moves or disappears', () => {
  touch(nativeDb());
  expect(getLutrisGogLibrary()).toEqual(['Gwent']);
  expect(getLutrisGogLibrary()).toEqual(['Gwent']);
  expect(opened).toEqual([{ file: nativeDb(), closed: false }]);

  fs.rmSync(nativeDb());
  touch(flatpakDb());
  expect(getLutrisGogLibrary()).toEqual(['Gwent']);
  expect(opened).toEqual([
    { file: nativeDb(), closed: true },
    { file: flatpakDb(), closed: false },
  ]);

  fs.rmSync(flatpakDb());
  expect(getLutrisGogLibrary()).toEqual([]);
  expect(opened[1].closed).toBe(true);
});

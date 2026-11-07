import { describe, expect, it, vi } from 'vitest';
import type { SteamProcesses } from './process-info';

const listing = vi.hoisted(() => ({ processes: null as SteamProcesses | null }));

vi.mock('./snapshot', () => ({
  steamProcesses: () => Promise.resolve(listing.processes),
}));

const {
  findSteamPids,
  isSteamRunning,
  isSteamStopped,
  listSteamPids,
  probeSteamRunning,
} = await import('./lifecycle');

const steam = { pid: 10, args: null };
const helper = { pid: 11, args: null };

describe('Steam process reads', () => {
  it.each([
    [
      'a failed listing',
      null,
      { find: [], list: null, probe: null, running: true, stopped: false },
    ],
    [
      'no Steam',
      { steam: [], webhelpers: [] },
      { find: [], list: [], probe: false, running: false, stopped: true },
    ],
    [
      'helpers outliving Steam',
      { steam: [], webhelpers: [helper] },
      { find: [], list: [], probe: false, running: false, stopped: false },
    ],
    [
      'a running Steam',
      { steam: [steam], webhelpers: [helper] },
      { find: [10], list: [10], probe: true, running: true, stopped: false },
    ],
  ])('read %s', async (_label, processes, expected) => {
    listing.processes = processes;
    expect({
      find: await findSteamPids(),
      list: await listSteamPids(),
      probe: await probeSteamRunning(),
      running: await isSteamRunning(),
      stopped: await isSteamStopped(),
    }).toEqual(expected);
  });
});

import { A, D } from '@mobily/ts-belt';
import type { FacetRow } from './types';

export interface OptionCount {
  count: number;
  adds: boolean;
}

interface OptionCheck<K> {
  option: K;
  check: (row: FacetRow) => boolean;
}

export const optionChecks = <K>(
  options: readonly K[],
  matches: (row: FacetRow, only: K[]) => boolean
) =>
  A.map(options, (option) => {
    const only = [option];
    return { option, check: (row: FacetRow) => matches(row, only) };
  });

export class GameCounter<K> {
  readonly counts = new Map<K, number>();
  private readonly lastGame = new Map<K, number>();

  add(key: K, game: number): void {
    if (this.lastGame.get(key) === game) {
      return;
    }
    this.lastGame.set(key, game);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  addAll(keys: readonly K[], game: number): void {
    for (const key of keys) {
      this.add(key, game);
    }
  }

  addMatching(checks: readonly OptionCheck<K>[], row: FacetRow, game: number): void {
    for (const { option, check } of checks) {
      if (check(row)) {
        this.add(option, game);
      }
    }
  }

  get(key: K): number {
    return this.counts.get(key) ?? 0;
  }
}

export const countsFor = <K extends string>(
  keys: readonly K[],
  counter: GameCounter<K>
) =>
  D.fromPairs(A.map(keys, (key) => [key, counter.get(key)] as const)) as Record<
    K,
    number
  >;

// Once an OR group has a pick, each of its other options counts only the games it would add
export const optionCounts = <K>(
  keys: Iterable<K>,
  picked: readonly K[],
  listed: GameCounter<K>,
  added: GameCounter<K>
) =>
  new Map(
    A.map(Array.from(keys), (key) => {
      const adds = picked.length > 0 && !picked.includes(key);
      return [key, { count: (adds ? added : listed).get(key), adds }] as const;
    })
  );

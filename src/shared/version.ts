import { coerce, compare } from 'semver';

const ZERO = '0.0.0';

// Loose on input (`v3.1.10`, `1.1`, prereleases); anything unparseable counts as 0.0.0, i.e. outdated.
export function compareVersions(a: string, b: string): number {
  return compare(
    coerce(a, { includePrerelease: true }) ?? ZERO,
    coerce(b, { includePrerelease: true }) ?? ZERO
  );
}

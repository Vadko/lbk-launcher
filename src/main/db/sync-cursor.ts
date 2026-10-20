// A row committed late carries a timestamp older than rows already seen, so each catch-up re-reads the last minute
const OVERLAP_MS = 60_000;

export function rewind(cursor: string): string {
  return new Date(Date.parse(cursor) - OVERLAP_MS).toISOString();
}

export function latest(
  cursor: string | null,
  timestamps: readonly string[]
): string | null {
  return timestamps.reduce<string | null>(
    (max, value) => (max === null || Date.parse(value) > Date.parse(max) ? value : max),
    cursor
  );
}

// PostgREST has no row comparison, so the (column, tie) > (value, tieValue) cursor is spelled out for .or()
export function afterCursor(
  column: string,
  value: string,
  tie: string,
  tieValue: string | number
): string {
  return `${column}.gt."${value}",and(${column}.eq."${value}",${tie}.gt."${tieValue}")`;
}

// Each page starts after the last row of the previous one, so rows changing mid-run cannot shift a page
export async function* keysetPages<T>(
  fetchPage: (last: T | undefined) => Promise<T[]>,
  isLastPage: (page: T[]) => boolean,
  last?: T
): AsyncGenerator<T[]> {
  const page = await fetchPage(last);
  yield page;
  if (page.length > 0 && !isLastPage(page)) {
    yield* keysetPages(fetchPage, isLastPage, page.at(-1));
  }
}

export async function collectPages<T>(pages: AsyncIterable<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for await (const page of pages) {
    rows.push(...page);
  }
  return rows;
}

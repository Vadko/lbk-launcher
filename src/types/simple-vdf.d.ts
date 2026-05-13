declare module 'simple-vdf' {
  // VDF is schema-less — every node could be a string leaf or a nested record.
  // Forcing a recursive type makes every property access require narrowing,
  // which buys nothing because callers already do their own runtime checks.
  // Matches @node-steam/vdf's permissive declaration.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export function parse(text: string): any;
  export function stringify(obj: unknown, pretty?: boolean): string;
  export function dump(obj: unknown, pretty?: boolean): string;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

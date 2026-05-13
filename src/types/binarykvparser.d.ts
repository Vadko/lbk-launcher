declare module 'binarykvparser' {
  // Steam's binary KeyValues format is schema-less. Callers narrow downstream.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export function parse(buffer: Buffer | Uint8Array, offset?: number): any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

declare module 'binarykvparser' {
  // A 64-bit value, as an instance of the bundled long@3, which ships no types.
  export interface KvLong {
    low: number;
    high: number;
    unsigned: boolean;
  }

  // Objects whose keys are 0..n-1 come back as arrays.
  export type KvValue = string | number | KvLong | KvObject | KvValue[];

  export interface KvObject {
    [key: string]: KvValue;
  }

  export function parse(buffer: Buffer, offset?: number): KvObject;
}

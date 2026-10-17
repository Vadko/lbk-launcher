declare module 'binarykvparser' {
  // 64-bit values come back as `long` instances; objects whose keys are 0..n-1 come back as arrays.
  export type KvValue = string | number | KvObject | KvValue[];

  export interface KvObject {
    [key: string]: KvValue;
  }

  export function parse(buffer: Buffer, offset?: number): KvObject;
}

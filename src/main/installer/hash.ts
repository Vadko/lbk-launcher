import fs from 'fs';
import { createHash } from 'crypto';

/**
 * Verify file hash - supports both new fingerprint hash and legacy full SHA-256
 * For files ≤100MB: full SHA-256 hash
 * For files >100MB: try fingerprint first, fallback to full SHA-256 for backward compatibility
 */
export async function verifyFileHash(
  filePath: string,
  expectedHash: string
): Promise<boolean> {
  const FULL_HASH_LIMIT = 100 * 1024 * 1024; // 100MB
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Small files - always use full SHA-256
    if (fileSize <= FULL_HASH_LIMIT) {
      console.log(
        `[Hash] Small file (${(fileSize / 1024 / 1024).toFixed(1)}MB), using full SHA-256`
      );
      const actualHash = await calculateFullHash(filePath);
      console.log(`[Hash] Expected: ${expectedHash}`);
      console.log(`[Hash] Actual:   ${actualHash}`);
      return actualHash === expectedHash;
    }

    // Large files - try fingerprint hash first (new format)
    console.log(
      `[Hash] Large file (${(fileSize / 1024 / 1024).toFixed(1)}MB), trying fingerprint hash first`
    );
    const fingerprintHash = await calculateFingerprintHash(
      filePath,
      fileSize,
      CHUNK_SIZE
    );
    console.log(`[Hash] Expected:    ${expectedHash}`);
    console.log(`[Hash] Fingerprint: ${fingerprintHash}`);

    if (fingerprintHash === expectedHash) {
      console.log(`[Hash] ✓ Fingerprint hash matched`);
      return true;
    }

    // Fallback to full SHA-256 for backward compatibility with old hashes
    console.log(`[Hash] Fingerprint mismatch, trying full SHA-256 (legacy)...`);
    const fullHash = await calculateFullHash(filePath);
    console.log(`[Hash] Full SHA-256: ${fullHash}`);

    if (fullHash === expectedHash) {
      console.log(`[Hash] ✓ Full SHA-256 hash matched (legacy)`);
      return true;
    }

    console.log(`[Hash] ✗ No hash matched`);
    return false;
  } catch (error) {
    console.error('[Hash] Error verifying file hash:', error);
    return false;
  }
}

/**
 * Calculate full SHA-256 hash using streaming
 */
async function calculateFullHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Calculate fingerprint hash for large files
 * Hash of: first 10MB + last 10MB + file size (as 8-byte little-endian)
 */
async function calculateFingerprintHash(
  filePath: string,
  fileSize: number,
  chunkSize: number
): Promise<string> {
  const fd = fs.openSync(filePath, 'r');

  try {
    // Read first chunk
    const firstChunk = Buffer.alloc(chunkSize);
    fs.readSync(fd, firstChunk, 0, chunkSize, 0);

    // Read last chunk
    const lastChunk = Buffer.alloc(chunkSize);
    fs.readSync(fd, lastChunk, 0, chunkSize, fileSize - chunkSize);

    // Create size buffer (8 bytes, little-endian, like browser BigUint64)
    const sizeBuffer = Buffer.alloc(8);
    sizeBuffer.writeBigUInt64LE(BigInt(fileSize), 0);

    // Combine and hash
    const combined = Buffer.concat([firstChunk, lastChunk, sizeBuffer]);
    const hash = createHash('sha256');
    hash.update(combined);
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

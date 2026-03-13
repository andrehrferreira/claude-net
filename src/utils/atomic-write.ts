import { writeFile, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Write a file atomically using temp file + rename.
 * Safe on Windows and Linux — prevents partial writes and corruption.
 */
export async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = join(dirname(filePath), `.tmp-${randomBytes(6).toString('hex')}`);
  try {
    await writeFile(tmpPath, data, 'utf-8');
    await rename(tmpPath, filePath);
  } catch (err) {
    try { await unlink(tmpPath); } catch { /* ignore cleanup errors */ }
    throw err;
  }
}

/**
 * Write a JSON object atomically.
 */
export async function atomicWriteJSON(filePath: string, data: unknown): Promise<void> {
  await atomicWrite(filePath, JSON.stringify(data, null, 2) + '\n');
}

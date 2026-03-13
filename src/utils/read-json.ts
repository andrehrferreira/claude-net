import { readFile } from 'node:fs/promises';

/**
 * Read and parse a JSON file. Returns null if file doesn't exist or is invalid.
 */
export async function readJSON<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

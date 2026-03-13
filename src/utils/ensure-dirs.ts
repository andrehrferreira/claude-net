import { mkdir } from 'node:fs/promises';
import { allDirs } from './paths.js';

let initialized = false;

export async function ensureDirs(): Promise<void> {
  if (initialized) return;
  await Promise.all(allDirs.map((dir) => mkdir(dir, { recursive: true })));
  initialized = true;
}

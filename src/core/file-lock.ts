import { join } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { readJSON } from '../utils/read-json.js';
import { ensureDirs } from '../utils/ensure-dirs.js';

export interface LockInfo {
  filePath: string;
  agentId: string;
  acquiredAt: string;
  operation: string;
}

const LOCK_TIMEOUT_MS = 300_000; // 5 minutes

function hashPath(filePath: string): string {
  return createHash('md5').update(filePath.toLowerCase()).digest('hex');
}

function lockFile(filePath: string): string {
  return join(paths.locks, `${hashPath(filePath)}.lock`);
}

export async function acquireLock(
  filePath: string,
  agentId: string,
  operation: string = 'edit',
): Promise<{ acquired: boolean; holder?: LockInfo }> {
  await ensureDirs();
  const lf = lockFile(filePath);
  const existing = await readJSON<LockInfo>(lf);

  if (existing) {
    // Check if lock is stale
    const age = Date.now() - new Date(existing.acquiredAt).getTime();
    if (age < LOCK_TIMEOUT_MS && existing.agentId !== agentId) {
      return { acquired: false, holder: existing };
    }
    // Stale or same agent — overwrite
  }

  const lock: LockInfo = {
    filePath,
    agentId,
    acquiredAt: new Date().toISOString(),
    operation,
  };
  await atomicWriteJSON(lf, lock);
  return { acquired: true };
}

export async function releaseLock(filePath: string, agentId: string): Promise<void> {
  const lf = lockFile(filePath);
  const existing = await readJSON<LockInfo>(lf);
  if (existing && existing.agentId === agentId) {
    try { await unlink(lf); } catch { /* ignore */ }
  }
}

export async function releaseLocksByAgent(agentId: string): Promise<number> {
  await ensureDirs();
  let released = 0;
  let files: string[];
  try {
    files = await readdir(paths.locks);
  } catch {
    return 0;
  }

  for (const file of files) {
    if (!file.endsWith('.lock')) continue;
    const lock = await readJSON<LockInfo>(join(paths.locks, file));
    if (lock && lock.agentId === agentId) {
      try { await unlink(join(paths.locks, file)); released++; } catch { /* ignore */ }
    }
  }
  return released;
}

export async function checkLock(filePath: string): Promise<LockInfo | null> {
  const lf = lockFile(filePath);
  const lock = await readJSON<LockInfo>(lf);
  if (!lock) return null;

  const age = Date.now() - new Date(lock.acquiredAt).getTime();
  if (age >= LOCK_TIMEOUT_MS) {
    // Stale — clean up
    try { await unlink(lf); } catch { /* ignore */ }
    return null;
  }
  return lock;
}

export async function listLocks(): Promise<LockInfo[]> {
  await ensureDirs();
  let files: string[];
  try {
    files = await readdir(paths.locks);
  } catch {
    return [];
  }

  const locks: LockInfo[] = [];
  for (const file of files) {
    if (!file.endsWith('.lock')) continue;
    const lock = await readJSON<LockInfo>(join(paths.locks, file));
    if (lock) {
      const age = Date.now() - new Date(lock.acquiredAt).getTime();
      if (age < LOCK_TIMEOUT_MS) {
        locks.push(lock);
      }
    }
  }
  return locks;
}

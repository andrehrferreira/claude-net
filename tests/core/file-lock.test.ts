import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const tempDir = { value: '' };

vi.mock('../../src/utils/paths.js', async () => {
  return {
    get paths() {
      return {
        root: tempDir.value,
        agents: join(tempDir.value, 'agents'),
        locks: join(tempDir.value, 'locks'),
        errors: join(tempDir.value, 'errors'),
        messages: join(tempDir.value, 'messages'),
        history: join(tempDir.value, 'history'),
        config: join(tempDir.value, 'config.json'),
      };
    },
    get allDirs() {
      return [
        tempDir.value,
        join(tempDir.value, 'agents'),
        join(tempDir.value, 'locks'),
        join(tempDir.value, 'errors'),
        join(tempDir.value, 'messages'),
        join(tempDir.value, 'history'),
      ];
    },
  };
});

vi.mock('../../src/utils/ensure-dirs.js', async () => {
  const { mkdir } = await import('node:fs/promises');
  return {
    ensureDirs: async () => {
      const { allDirs } = await import('../../src/utils/paths.js');
      await Promise.all(allDirs.map((dir: string) => mkdir(dir, { recursive: true })));
    },
  };
});

const {
  acquireLock,
  releaseLock,
  releaseLocksByAgent,
  checkLock,
  listLocks,
} = await import('../../src/core/file-lock.js');

describe('file-lock', () => {
  beforeEach(async () => {
    tempDir.value = await mkdtemp(join(tmpdir(), 'claude-net-lock-'));
  });

  afterEach(async () => {
    await rm(tempDir.value, { recursive: true, force: true });
  });

  describe('acquireLock', () => {
    it('should acquire a lock on an unlocked file', async () => {
      const result = await acquireLock('/src/app.ts', 'agent-1');
      expect(result.acquired).toBe(true);
      expect(result.holder).toBeUndefined();
    });

    it('should block when another agent holds the lock', async () => {
      await acquireLock('/src/app.ts', 'agent-1');
      const result = await acquireLock('/src/app.ts', 'agent-2');
      expect(result.acquired).toBe(false);
      expect(result.holder).toBeDefined();
      expect(result.holder!.agentId).toBe('agent-1');
    });

    it('should allow the same agent to re-acquire', async () => {
      await acquireLock('/src/app.ts', 'agent-1');
      const result = await acquireLock('/src/app.ts', 'agent-1');
      expect(result.acquired).toBe(true);
    });

    it('should store the operation type', async () => {
      await acquireLock('/src/app.ts', 'agent-1', 'write');
      const lock = await checkLock('/src/app.ts');
      expect(lock!.operation).toBe('write');
    });

    it('should use edit as default operation', async () => {
      await acquireLock('/src/app.ts', 'agent-1');
      const lock = await checkLock('/src/app.ts');
      expect(lock!.operation).toBe('edit');
    });
  });

  describe('releaseLock', () => {
    it('should release a lock held by the agent', async () => {
      await acquireLock('/src/app.ts', 'agent-1');
      await releaseLock('/src/app.ts', 'agent-1');
      const lock = await checkLock('/src/app.ts');
      expect(lock).toBeNull();
    });

    it('should not release a lock held by another agent', async () => {
      await acquireLock('/src/app.ts', 'agent-1');
      await releaseLock('/src/app.ts', 'agent-2');
      const lock = await checkLock('/src/app.ts');
      expect(lock).not.toBeNull();
      expect(lock!.agentId).toBe('agent-1');
    });

    it('should not throw for non-existent lock', async () => {
      await expect(releaseLock('/no-lock.ts', 'agent-1')).resolves.not.toThrow();
    });
  });

  describe('releaseLocksByAgent', () => {
    it('should release all locks held by an agent', async () => {
      await acquireLock('/file1.ts', 'agent-1');
      await acquireLock('/file2.ts', 'agent-1');
      await acquireLock('/file3.ts', 'agent-2');

      const released = await releaseLocksByAgent('agent-1');
      expect(released).toBe(2);

      expect(await checkLock('/file1.ts')).toBeNull();
      expect(await checkLock('/file2.ts')).toBeNull();
      expect(await checkLock('/file3.ts')).not.toBeNull();
    });

    it('should return 0 when agent has no locks', async () => {
      const released = await releaseLocksByAgent('agent-none');
      expect(released).toBe(0);
    });
  });

  describe('checkLock', () => {
    it('should return null for unlocked file', async () => {
      const lock = await checkLock('/not-locked.ts');
      expect(lock).toBeNull();
    });

    it('should return lock info for locked file', async () => {
      await acquireLock('/src/app.ts', 'agent-1', 'edit');
      const lock = await checkLock('/src/app.ts');
      expect(lock).not.toBeNull();
      expect(lock!.agentId).toBe('agent-1');
      expect(lock!.filePath).toBe('/src/app.ts');
      expect(lock!.operation).toBe('edit');
    });

    it('should clean up stale locks and return null', async () => {
      await acquireLock('/src/stale.ts', 'agent-1');
      // Manually set acquiredAt to 10 minutes ago
      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const { createHash } = await import('node:crypto');
      const hash = createHash('md5').update('/src/stale.ts'.toLowerCase()).digest('hex');
      const lockFile = join(paths.locks, `${hash}.lock`);
      const lock = await readJSON<any>(lockFile);
      lock.acquiredAt = new Date(Date.now() - 600_000).toISOString();
      await atomicWriteJSON(lockFile, lock);

      const result = await checkLock('/src/stale.ts');
      expect(result).toBeNull();
    });
  });

  describe('listLocks', () => {
    it('should return empty array when no locks', async () => {
      const locks = await listLocks();
      expect(locks).toEqual([]);
    });

    it('should list all active locks', async () => {
      await acquireLock('/file1.ts', 'agent-1');
      await acquireLock('/file2.ts', 'agent-2');
      const locks = await listLocks();
      expect(locks.length).toBe(2);
    });
  });
});

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
  saveBuildError,
  saveTestError,
  getLastBuildError,
  getLastTestError,
  listErrors,
  listErrorsByAgent,
  clearOldErrors,
} = await import('../../src/core/error-store.js');

describe('error-store', () => {
  beforeEach(async () => {
    tempDir.value = await mkdtemp(join(tmpdir(), 'claude-net-errors-'));
  });

  afterEach(async () => {
    await rm(tempDir.value, { recursive: true, force: true });
  });

  describe('saveBuildError', () => {
    it('should save a build error', async () => {
      await saveBuildError('agent-1', 'npm run build', 1, 'stdout', 'error');
      const errors = await listErrors();
      expect(errors.length).toBe(1);
      expect(errors[0]).toMatchObject({
        agentId: 'agent-1',
        command: 'npm run build',
        exitCode: 1,
      });
    });

    it('should save multiple build errors', async () => {
      await saveBuildError('agent-1', 'npm run build', 1, 'out', 'err');
      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      await saveBuildError('agent-2', 'tsc', 1, 'out', 'err');
      const errors = await listErrors();
      expect(errors.length).toBe(2);
    });
  });

  describe('saveTestError', () => {
    it('should save a test error', async () => {
      await saveTestError('agent-1', 'npm test', 3, 10, 'output');
      const errors = await listErrors();
      expect(errors.length).toBe(1);
      expect(errors[0]).toMatchObject({
        agentId: 'agent-1',
        command: 'npm test',
        failedTests: 3,
        totalTests: 10,
      });
    });
  });

  describe('getLastBuildError', () => {
    it('should return null when no build errors', async () => {
      const error = await getLastBuildError();
      expect(error).toBeNull();
    });

    it('should return the most recent build error', async () => {
      await saveBuildError('agent-1', 'cmd1', 1, 'out', 'err');
      await new Promise((r) => setTimeout(r, 10));
      await saveBuildError('agent-2', 'cmd2', 1, 'out', 'err');

      const error = await getLastBuildError();
      expect(error!.command).toBe('cmd2');
      expect(error!.agentId).toBe('agent-2');
    });

    it('should ignore test errors', async () => {
      await saveTestError('agent-1', 'npm test', 1, 5, 'out');
      const error = await getLastBuildError();
      expect(error).toBeNull();
    });
  });

  describe('getLastTestError', () => {
    it('should return null when no test errors', async () => {
      const error = await getLastTestError();
      expect(error).toBeNull();
    });

    it('should return the most recent test error', async () => {
      await saveTestError('agent-1', 'cmd1', 1, 5, 'out');
      await new Promise((r) => setTimeout(r, 10));
      await saveTestError('agent-2', 'cmd2', 2, 10, 'out');

      const error = await getLastTestError();
      expect(error!.command).toBe('cmd2');
      expect(error!.agentId).toBe('agent-2');
    });

    it('should ignore build errors', async () => {
      await saveBuildError('agent-1', 'npm build', 1, 'out', 'err');
      const error = await getLastTestError();
      expect(error).toBeNull();
    });
  });

  describe('listErrors', () => {
    it('should list errors sorted by timestamp descending', async () => {
      await saveBuildError('agent-1', 'cmd1', 1, 'o', 'e');
      await new Promise((r) => setTimeout(r, 10));
      await saveBuildError('agent-2', 'cmd2', 1, 'o', 'e');

      const errors = await listErrors();
      expect(errors.length).toBe(2);
      expect(errors[0].command).toBe('cmd2');
      expect(errors[1].command).toBe('cmd1');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await saveBuildError('agent-1', `cmd${i}`, 1, 'o', 'e');
        await new Promise((r) => setTimeout(r, 10));
      }
      const errors = await listErrors(2);
      expect(errors.length).toBe(2);
    });
  });

  describe('listErrorsByAgent', () => {
    it('should list errors for a specific agent', async () => {
      await saveBuildError('agent-1', 'cmd1', 1, 'o', 'e');
      await saveBuildError('agent-2', 'cmd2', 1, 'o', 'e');
      await saveBuildError('agent-1', 'cmd3', 1, 'o', 'e');

      const errors = await listErrorsByAgent('agent-1');
      expect(errors.length).toBe(2);
      expect(errors.every((e) => e.agentId === 'agent-1')).toBe(true);
    });

    it('should return empty array for unknown agent', async () => {
      await saveBuildError('agent-1', 'cmd1', 1, 'o', 'e');
      const errors = await listErrorsByAgent('agent-unknown');
      expect(errors).toEqual([]);
    });
  });

  describe('clearOldErrors', () => {
    it('should not delete recent errors', async () => {
      await saveBuildError('agent-1', 'cmd', 1, 'o', 'e');
      const removed = await clearOldErrors(7);
      expect(removed).toBe(0);
      const errors = await listErrors();
      expect(errors.length).toBe(1);
    });

    it('should delete errors older than cutoff', async () => {
      await saveBuildError('agent-1', 'cmd1', 1, 'o', 'e');
      // Manually set timestamp to 8 days ago
      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const fs = await import('node:fs/promises');
      const files = await fs.readdir(paths.errors);
      for (const file of files) {
        const error = await readJSON<any>(join(paths.errors, file));
        if (error) {
          error.timestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
          await atomicWriteJSON(join(paths.errors, file), error);
        }
      }

      const removed = await clearOldErrors(7);
      expect(removed).toBe(1);
      const errors = await listErrors();
      expect(errors.length).toBe(0);
    });
  });
});

const { recordEvent, getSessionHistory, searchHistory } = await import(
  '../../src/core/history.js'
);

describe('history', () => {
  beforeEach(async () => {
    tempDir.value = await mkdtemp(join(tmpdir(), 'claude-net-history-'));
  });

  afterEach(async () => {
    await rm(tempDir.value, { recursive: true, force: true });
  });

  describe('recordEvent', () => {
    it('should record an event', async () => {
      await recordEvent({
        timestamp: new Date().toISOString(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        event: 'tool_executed',
        tool: 'Edit',
      });

      const history = await getSessionHistory('agent-1', 'session-1');
      expect(history.length).toBe(1);
      expect(history[0].tool).toBe('Edit');
    });
  });

  describe('getSessionHistory', () => {
    it('should return empty array for non-existent session', async () => {
      const history = await getSessionHistory('agent-1', 'session-1');
      expect(history).toEqual([]);
    });

    it('should return all events in a session', async () => {
      const now = new Date().toISOString();
      await recordEvent({
        timestamp: now,
        agentId: 'agent-1',
        sessionId: 'session-1',
        event: 'event1',
      });
      await recordEvent({
        timestamp: now,
        agentId: 'agent-1',
        sessionId: 'session-1',
        event: 'event2',
      });

      const history = await getSessionHistory('agent-1', 'session-1');
      expect(history.length).toBe(2);
      expect(history[0].event).toBe('event1');
      expect(history[1].event).toBe('event2');
    });
  });

  describe('searchHistory', () => {
    it('should search events by tool name', async () => {
      const now = new Date().toISOString();
      await recordEvent({
        timestamp: now,
        agentId: 'agent-1',
        sessionId: 'session-1',
        event: 'tool_executed',
        tool: 'Edit',
      });
      await recordEvent({
        timestamp: now,
        agentId: 'agent-1',
        sessionId: 'session-2',
        event: 'tool_executed',
        tool: 'Bash',
      });

      const results = await searchHistory('agent-1', 'Edit');
      expect(results.length).toBe(1);
      expect(results[0].tool).toBe('Edit');
    });
  });
});

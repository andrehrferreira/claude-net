import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Mock paths before importing the module
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

// Reset ensureDirs state between tests
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
  registerAgent,
  deregisterAgent,
  updateAgent,
  heartbeat,
  getAgent,
  listAgents,
  listActiveAgents,
  cleanupStaleAgents,
} = await import('../../src/core/agent-registry.js');

describe('agent-registry', () => {
  beforeEach(async () => {
    tempDir.value = await mkdtemp(join(tmpdir(), 'claude-net-reg-'));
  });

  afterEach(async () => {
    await rm(tempDir.value, { recursive: true, force: true });
  });

  describe('registerAgent', () => {
    it('should create an agent file', async () => {
      const agent = await registerAgent('test-1', 'sess-1', '/project');
      expect(agent.id).toBe('test-1');
      expect(agent.sessionId).toBe('sess-1');
      expect(agent.project).toBe('/project');
      expect(agent.status).toBe('idle');
      expect(agent.filesInUse).toEqual([]);
      expect(agent.currentTask).toBe('');
      expect(agent.pid).toBe(process.pid);
    });

    it('should persist the agent to disk', async () => {
      await registerAgent('test-2', 'sess-2', '/proj');
      const retrieved = await getAgent('test-2');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('test-2');
    });

    it('should set startedAt and lastHeartbeat', async () => {
      const agent = await registerAgent('test-3', 'sess-3', '/proj');
      expect(agent.startedAt).toBeTruthy();
      expect(agent.lastHeartbeat).toBeTruthy();
      expect(new Date(agent.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('deregisterAgent', () => {
    it('should remove the agent file', async () => {
      await registerAgent('rm-1', 'sess-1', '/proj');
      await deregisterAgent('rm-1');
      const agent = await getAgent('rm-1');
      expect(agent).toBeNull();
    });

    it('should not throw for non-existent agent', async () => {
      await expect(deregisterAgent('nope')).resolves.not.toThrow();
    });
  });

  describe('updateAgent', () => {
    it('should update status and task', async () => {
      await registerAgent('upd-1', 'sess-1', '/proj');
      const updated = await updateAgent('upd-1', {
        status: 'editing',
        currentTask: 'Fixing bug #42',
        filesInUse: ['src/app.ts'],
      });
      expect(updated!.status).toBe('editing');
      expect(updated!.currentTask).toBe('Fixing bug #42');
      expect(updated!.filesInUse).toEqual(['src/app.ts']);
    });

    it('should update heartbeat on each update', async () => {
      const agent = await registerAgent('upd-2', 'sess-1', '/proj');
      const oldHeartbeat = agent.lastHeartbeat;
      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10));
      const updated = await updateAgent('upd-2', { status: 'building' });
      expect(new Date(updated!.lastHeartbeat).getTime()).toBeGreaterThanOrEqual(
        new Date(oldHeartbeat).getTime(),
      );
    });

    it('should return null for non-existent agent', async () => {
      const result = await updateAgent('nope', { status: 'idle' });
      expect(result).toBeNull();
    });

    it('should preserve fields not in the update', async () => {
      await registerAgent('upd-3', 'sess-1', '/proj');
      await updateAgent('upd-3', { currentTask: 'Task A' });
      const agent = await getAgent('upd-3');
      expect(agent!.currentTask).toBe('Task A');
      expect(agent!.project).toBe('/proj');
      expect(agent!.sessionId).toBe('sess-1');
    });
  });

  describe('heartbeat', () => {
    it('should update lastHeartbeat timestamp', async () => {
      const agent = await registerAgent('hb-1', 'sess-1', '/proj');
      const before = new Date(agent.lastHeartbeat).getTime();
      await new Promise((r) => setTimeout(r, 10));
      await heartbeat('hb-1');
      const after = await getAgent('hb-1');
      expect(new Date(after!.lastHeartbeat).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('should not throw for non-existent agent', async () => {
      await expect(heartbeat('nope')).resolves.not.toThrow();
    });
  });

  describe('listAgents', () => {
    it('should return empty array when no agents exist', async () => {
      const agents = await listAgents();
      expect(agents).toEqual([]);
    });

    it('should list all registered agents', async () => {
      await registerAgent('list-1', 'sess-1', '/proj');
      await registerAgent('list-2', 'sess-2', '/proj');
      const agents = await listAgents();
      expect(agents.length).toBe(2);
      const ids = agents.map((a) => a.id).sort();
      expect(ids).toEqual(['list-1', 'list-2']);
    });
  });

  describe('listActiveAgents', () => {
    it('should return only agents with recent heartbeat', async () => {
      await registerAgent('active-1', 'sess-1', '/proj');
      const agents = await listActiveAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe('active-1');
    });

    it('should exclude stale agents', async () => {
      await registerAgent('stale-1', 'sess-1', '/proj');
      // Manually set heartbeat to 60s ago
      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const agentFile = join(paths.agents, 'stale-1.json');
      const agent = await readJSON<any>(agentFile);
      agent.lastHeartbeat = new Date(Date.now() - 60_000).toISOString();
      await atomicWriteJSON(agentFile, agent);

      const active = await listActiveAgents();
      expect(active.length).toBe(0);
    });
  });

  describe('cleanupStaleAgents', () => {
    it('should remove stale agents and return their IDs', async () => {
      await registerAgent('clean-1', 'sess-1', '/proj');
      // Make it stale
      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const agentFile = join(paths.agents, 'clean-1.json');
      const agent = await readJSON<any>(agentFile);
      agent.lastHeartbeat = new Date(Date.now() - 60_000).toISOString();
      await atomicWriteJSON(agentFile, agent);

      const removed = await cleanupStaleAgents();
      expect(removed).toEqual(['clean-1']);
      expect(await getAgent('clean-1')).toBeNull();
    });

    it('should not remove active agents', async () => {
      await registerAgent('keep-1', 'sess-1', '/proj');
      const removed = await cleanupStaleAgents();
      expect(removed).toEqual([]);
      expect(await getAgent('keep-1')).not.toBeNull();
    });

    it('should handle mixed active and stale agents', async () => {
      await registerAgent('mixed-active', 'sess-1', '/proj');
      await registerAgent('mixed-stale', 'sess-2', '/proj');

      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const staleFile = join(paths.agents, 'mixed-stale.json');
      const agent = await readJSON<any>(staleFile);
      agent.lastHeartbeat = new Date(Date.now() - 60_000).toISOString();
      await atomicWriteJSON(staleFile, agent);

      const removed = await cleanupStaleAgents();
      expect(removed).toEqual(['mixed-stale']);
      expect(await getAgent('mixed-active')).not.toBeNull();
      expect(await getAgent('mixed-stale')).toBeNull();
    });
  });
});

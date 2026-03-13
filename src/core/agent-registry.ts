import { join } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { readJSON } from '../utils/read-json.js';
import { ensureDirs } from '../utils/ensure-dirs.js';

export type AgentStatus = 'idle' | 'editing' | 'building' | 'testing' | 'reading';

export interface AgentInfo {
  id: string;
  pid: number;
  sessionId: string;
  project: string;
  currentTask: string;
  filesInUse: string[];
  lastHeartbeat: string;
  status: AgentStatus;
  startedAt: string;
}

const STALE_THRESHOLD_MS = 30_000;

function agentFile(agentId: string): string {
  return join(paths.agents, `${agentId}.json`);
}

export async function registerAgent(
  agentId: string,
  sessionId: string,
  project: string,
): Promise<AgentInfo> {
  await ensureDirs();
  const now = new Date().toISOString();
  const agent: AgentInfo = {
    id: agentId,
    pid: process.pid,
    sessionId,
    project,
    currentTask: '',
    filesInUse: [],
    lastHeartbeat: now,
    status: 'idle',
    startedAt: now,
  };
  await atomicWriteJSON(agentFile(agentId), agent);
  return agent;
}

export async function deregisterAgent(agentId: string): Promise<void> {
  try {
    await unlink(agentFile(agentId));
  } catch { /* already gone */ }
}

export async function updateAgent(
  agentId: string,
  updates: Partial<Pick<AgentInfo, 'currentTask' | 'filesInUse' | 'status'>>,
): Promise<AgentInfo | null> {
  const agent = await readJSON<AgentInfo>(agentFile(agentId));
  if (!agent) return null;

  const updated: AgentInfo = {
    ...agent,
    ...updates,
    lastHeartbeat: new Date().toISOString(),
  };
  await atomicWriteJSON(agentFile(agentId), updated);
  return updated;
}

export async function heartbeat(agentId: string): Promise<void> {
  const agent = await readJSON<AgentInfo>(agentFile(agentId));
  if (!agent) return;
  agent.lastHeartbeat = new Date().toISOString();
  await atomicWriteJSON(agentFile(agentId), agent);
}

export async function getAgent(agentId: string): Promise<AgentInfo | null> {
  return readJSON<AgentInfo>(agentFile(agentId));
}

export async function listAgents(): Promise<AgentInfo[]> {
  await ensureDirs();
  let files: string[];
  try {
    files = await readdir(paths.agents);
  } catch {
    return [];
  }

  const agents: AgentInfo[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const agent = await readJSON<AgentInfo>(join(paths.agents, file));
    if (agent) agents.push(agent);
  }
  return agents;
}

export async function listActiveAgents(): Promise<AgentInfo[]> {
  const all = await listAgents();
  const now = Date.now();
  return all.filter(
    (a) => now - new Date(a.lastHeartbeat).getTime() < STALE_THRESHOLD_MS,
  );
}

export async function cleanupStaleAgents(): Promise<string[]> {
  const all = await listAgents();
  const now = Date.now();
  const removed: string[] = [];

  for (const agent of all) {
    if (now - new Date(agent.lastHeartbeat).getTime() >= STALE_THRESHOLD_MS) {
      await deregisterAgent(agent.id);
      removed.push(agent.id);
    }
  }
  return removed;
}

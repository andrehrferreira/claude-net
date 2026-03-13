import { readStdinJSON, type SessionEndInput } from './stdin.js';
import { deregisterAgent } from '../core/agent-registry.js';
import { readJSON } from '../utils/read-json.js';
import { paths } from '../utils/paths.js';
import { unlink } from 'node:fs/promises';
import { releaseLocksByAgent } from '../core/file-lock.js';

interface SessionState {
  agentId: string;
  sessionId: string;
}

async function main(): Promise<void> {
  const input = await readStdinJSON<SessionEndInput>();

  const stateFile = paths.root + `/session-${input.session_id}.json`;
  const state = await readJSON<SessionState>(stateFile);
  if (!state) return;

  // Release all locks held by this agent
  await releaseLocksByAgent(state.agentId);

  // Deregister from the network
  await deregisterAgent(state.agentId);

  // Clean up session state file
  try { await unlink(stateFile); } catch { /* ignore */ }
}

main().catch(() => process.exit(0));

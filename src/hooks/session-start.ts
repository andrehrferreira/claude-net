import { readStdinJSON, type SessionStartInput } from './stdin.js';
import { generateAgentId } from '../utils/agent-id.js';
import { registerAgent } from '../core/agent-registry.js';
import { ensureDirs } from '../utils/ensure-dirs.js';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { readJSON } from '../utils/read-json.js';
import { listActiveAgents, cleanupStaleAgents } from '../core/agent-registry.js';

interface SessionState {
  agentId: string;
  sessionId: string;
}

async function main(): Promise<void> {
  const input = await readStdinJSON<SessionStartInput>();
  await ensureDirs();

  // Cleanup stale agents from crashed sessions
  await cleanupStaleAgents();

  // Generate agent ID and register
  const agentId = generateAgentId();
  await registerAgent(agentId, input.session_id, input.cwd);

  // Save session state for other hooks to read
  const stateFile = paths.root + `/session-${input.session_id}.json`;
  await atomicWriteJSON(stateFile, { agentId, sessionId: input.session_id } satisfies SessionState);

  // Build context about the network
  const activeAgents = await listActiveAgents();
  const otherAgents = activeAgents.filter((a) => a.id !== agentId);

  const lines: string[] = [];
  lines.push(`[claude-net] Agent ${agentId} registered.`);

  if (otherAgents.length > 0) {
    lines.push(`[claude-net] ${otherAgents.length} other agent(s) active:`);
    for (const a of otherAgents) {
      const taskInfo = a.currentTask ? ` — ${a.currentTask}` : '';
      const filesInfo = a.filesInUse.length > 0 ? ` [files: ${a.filesInUse.join(', ')}]` : '';
      lines.push(`  - ${a.id} (${a.status})${taskInfo}${filesInfo}`);
    }
    lines.push('[claude-net] Coordinate with other agents to avoid conflicts.');
  } else {
    lines.push('[claude-net] No other agents active.');
  }

  // Output context for Claude via stdout (SessionStart adds stdout as context)
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  };
  process.stdout.write(JSON.stringify(output));
}

main().catch(() => process.exit(0));

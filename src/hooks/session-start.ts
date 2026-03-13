import { readStdinJSON, type SessionStartInput } from './stdin.js';
import { generateAgentId } from '../utils/agent-id.js';
import { registerAgent } from '../core/agent-registry.js';
import { ensureDirs } from '../utils/ensure-dirs.js';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { listActiveAgents, cleanupStaleAgents } from '../core/agent-registry.js';
import { getLastSessionState } from '../core/history.js';
import { getLastBuildError, getLastTestError } from '../core/error-store.js';

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

  // Check for recent build/test errors
  const lastBuildError = await getLastBuildError();
  const lastTestError = await getLastTestError();

  if (lastBuildError || lastTestError) {
    lines.push('[claude-net] ⚠️ Recent errors found:');
    if (lastBuildError) {
      lines.push(`  - Build error from ${lastBuildError.agentId}: ${lastBuildError.command}`);
    }
    if (lastTestError) {
      lines.push(
        `  - Test error from ${lastTestError.agentId}: ${lastTestError.failedTests}/${lastTestError.totalTests} failed`,
      );
    }
    lines.push('[claude-net] Review errors before running build/test again.');
  }

  // Check for recovery: last session state
  const lastSessionState = await getLastSessionState(agentId, 10);
  if (lastSessionState.length > 0) {
    lines.push(`[claude-net] 📋 Last session had ${lastSessionState.length} action(s).`);
  }

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

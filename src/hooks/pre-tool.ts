import { readStdinJSON, type PreToolUseInput } from './stdin.js';
import { readJSON } from '../utils/read-json.js';
import { paths } from '../utils/paths.js';
import { acquireLock, checkLock } from '../core/file-lock.js';
import { updateAgent, listActiveAgents } from '../core/agent-registry.js';

interface SessionState {
  agentId: string;
  sessionId: string;
}

function extractFilePath(input: PreToolUseInput): string | null {
  const ti = input.tool_input;
  if (typeof ti.file_path === 'string') return ti.file_path;
  return null;
}

function isBuildCommand(command: string): boolean {
  const patterns = [
    /\bnpm run build\b/, /\byarn build\b/, /\bpnpm build\b/,
    /\btsc\b/, /\bvite build\b/, /\bwebpack\b/, /\besbuild\b/,
    /\bnpx tsc\b/, /\bnpm run compile\b/,
  ];
  return patterns.some((p) => p.test(command));
}

function isTestCommand(command: string): boolean {
  const patterns = [
    /\bnpm test\b/, /\bnpm run test\b/, /\byarn test\b/, /\bpnpm test\b/,
    /\bvitest\b/, /\bjest\b/, /\bmocha\b/, /\bpytest\b/,
    /\bnpx vitest\b/, /\bnpx jest\b/,
  ];
  return patterns.some((p) => p.test(command));
}

async function main(): Promise<void> {
  const input = await readStdinJSON<PreToolUseInput>();

  const stateFile = paths.root + `/session-${input.session_id}.json`;
  const state = await readJSON<SessionState>(stateFile);
  if (!state) {
    process.exit(0);
    return;
  }

  const agentId = state.agentId;

  // File edit/write conflict detection
  if (input.tool_name === 'Edit' || input.tool_name === 'Write') {
    const filePath = extractFilePath(input);
    if (filePath) {
      const result = await acquireLock(filePath, agentId, input.tool_name.toLowerCase());
      if (!result.acquired && result.holder) {
        const output = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
              `[claude-net] File locked by agent ${result.holder.agentId} ` +
              `(${result.holder.operation} since ${result.holder.acquiredAt}). ` +
              `Wait or work on a different file.`,
          },
        };
        process.stdout.write(JSON.stringify(output));
        return;
      }
      // Update agent's filesInUse
      await updateAgent(agentId, {
        status: 'editing',
        filesInUse: [filePath],
      });
    }
  }

  // Build/test mutex
  if (input.tool_name === 'Bash') {
    const command = (input.tool_input.command as string) || '';

    if (isBuildCommand(command) || isTestCommand(command)) {
      const isBuild = isBuildCommand(command);
      const mutexType = isBuild ? 'building' : 'testing';

      const activeAgents = await listActiveAgents();
      const conflicting = activeAgents.find(
        (a) => a.id !== agentId && a.status === mutexType,
      );

      if (conflicting) {
        const output = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
              `[claude-net] Agent ${conflicting.id} is already ${mutexType}. ` +
              `Wait for it to finish before running ${isBuild ? 'build' : 'tests'}.`,
          },
        };
        process.stdout.write(JSON.stringify(output));
        return;
      }

      await updateAgent(agentId, { status: mutexType });
    }
  }

  // Allow the tool call
  process.exit(0);
}

main().catch(() => process.exit(0));

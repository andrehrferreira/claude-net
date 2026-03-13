import { readStdinJSON, type PostToolUseInput } from './stdin.js';
import { readJSON } from '../utils/read-json.js';
import { paths } from '../utils/paths.js';
import { updateAgent } from '../core/agent-registry.js';
import { releaseLock } from '../core/file-lock.js';

interface SessionState {
  agentId: string;
  sessionId: string;
}

function isBuildCommand(command: string): boolean {
  const patterns = [
    /\bnpm run build\b/, /\byarn build\b/, /\bpnpm build\b/,
    /\btsc\b/, /\bvite build\b/, /\bwebpack\b/, /\besbuild\b/,
  ];
  return patterns.some((p) => p.test(command));
}

function isTestCommand(command: string): boolean {
  const patterns = [
    /\bnpm test\b/, /\bnpm run test\b/, /\byarn test\b/, /\bpnpm test\b/,
    /\bvitest\b/, /\bjest\b/, /\bmocha\b/, /\bpytest\b/,
  ];
  return patterns.some((p) => p.test(command));
}

async function main(): Promise<void> {
  const input = await readStdinJSON<PostToolUseInput>();

  const stateFile = paths.root + `/session-${input.session_id}.json`;
  const state = await readJSON<SessionState>(stateFile);
  if (!state) {
    process.exit(0);
    return;
  }

  const agentId = state.agentId;

  // Release file lock after edit/write completes
  if (input.tool_name === 'Edit' || input.tool_name === 'Write') {
    const filePath = input.tool_input.file_path as string | undefined;
    if (filePath) {
      await releaseLock(filePath, agentId);
    }
  }

  // Reset status after build/test completes
  if (input.tool_name === 'Bash') {
    const command = (input.tool_input.command as string) || '';
    if (isBuildCommand(command) || isTestCommand(command)) {
      await updateAgent(agentId, { status: 'idle' });
    }
  }

  // Update agent status back to idle if it was editing
  if (input.tool_name === 'Edit' || input.tool_name === 'Write') {
    await updateAgent(agentId, { status: 'idle', filesInUse: [] });
  }

  process.exit(0);
}

main().catch(() => process.exit(0));

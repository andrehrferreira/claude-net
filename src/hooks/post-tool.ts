import { readStdinJSON, type PostToolUseInput } from './stdin.js';
import { readJSON } from '../utils/read-json.js';
import { paths } from '../utils/paths.js';
import { updateAgent } from '../core/agent-registry.js';
import { releaseLock } from '../core/file-lock.js';
import { recordEvent } from '../core/history.js';
import { saveBuildError, saveTestError } from '../core/error-store.js';

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

  // Record all actions in history
  await recordEvent({
    timestamp: new Date().toISOString(),
    agentId,
    sessionId: input.session_id,
    event: 'tool_executed',
    tool: input.tool_name,
    toolInput: input.tool_input,
    result: input.tool_output?.slice(0, 500), // Truncate long outputs
  });

  // Release file lock after edit/write completes
  if (input.tool_name === 'Edit' || input.tool_name === 'Write') {
    const filePath = input.tool_input.file_path as string | undefined;
    if (filePath) {
      await releaseLock(filePath, agentId);
    }
  }

  // Check for build/test errors and save them
  if (input.tool_name === 'Bash') {
    const command = (input.tool_input.command as string) || '';
    const output = input.tool_output || '';

    if (isBuildCommand(command)) {
      // Check for build failure indicators
      if (output.includes('error') || output.includes('failed') || output.includes('ERR!')) {
        await saveBuildError(agentId, command, 1, output, output);
      }
      await updateAgent(agentId, { status: 'idle' });
    } else if (isTestCommand(command)) {
      // Check for test failure indicators
      const failedMatch = output.match(/(\d+)\s+failed/i);
      const totalMatch = output.match(/(\d+)\s+(?:tests?|specs?)/i);
      if (failedMatch) {
        const failed = parseInt(failedMatch[1], 10);
        const total = totalMatch ? parseInt(totalMatch[1], 10) : failed;
        await saveTestError(agentId, command, failed, total, output);
      }
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

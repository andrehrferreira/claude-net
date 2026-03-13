import { Buffer } from 'node:buffer';

/**
 * Read all stdin as a string and parse as JSON.
 */
export async function readStdinJSON<T = unknown>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T;
}

export interface CommonHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PreToolUseInput extends CommonHookInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
}

export interface PostToolUseInput extends CommonHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  tool_output?: string;
}

export interface SessionStartInput extends CommonHookInput {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
  model: string;
}

export interface SessionEndInput extends CommonHookInput {
  hook_event_name: 'SessionEnd';
}

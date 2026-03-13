import { join } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_NET_DIR = join(homedir(), '.claude-net');

export const paths = {
  root: CLAUDE_NET_DIR,
  agents: join(CLAUDE_NET_DIR, 'agents'),
  locks: join(CLAUDE_NET_DIR, 'locks'),
  errors: join(CLAUDE_NET_DIR, 'errors'),
  messages: join(CLAUDE_NET_DIR, 'messages'),
  history: join(CLAUDE_NET_DIR, 'history'),
  config: join(CLAUDE_NET_DIR, 'config.json'),
} as const;

export const allDirs = [
  paths.root,
  paths.agents,
  paths.locks,
  paths.errors,
  paths.messages,
  paths.history,
] as const;

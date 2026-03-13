import { join } from 'node:path';
import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { paths } from '../utils/paths.js';
import { ensureDirs } from '../utils/ensure-dirs.js';

export interface HistoryEntry {
  timestamp: string;
  agentId: string;
  sessionId: string;
  event: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

async function getHistoryDir(agentId: string): Promise<string> {
  const dir = join(paths.history, agentId);
  await mkdir(dir, { recursive: true });
  return dir;
}

function getHistoryFile(agentId: string, sessionId: string): string {
  return join(paths.history, agentId, `${sessionId}.jsonl`);
}

export async function recordEvent(entry: HistoryEntry): Promise<void> {
  await ensureDirs();
  const dir = await getHistoryDir(entry.agentId);
  const file = getHistoryFile(entry.agentId, entry.sessionId);
  const line = JSON.stringify(entry) + '\n';
  await appendFile(file, line, 'utf-8');
}

export async function getSessionHistory(
  agentId: string,
  sessionId: string,
): Promise<HistoryEntry[]> {
  const file = getHistoryFile(agentId, sessionId);
  if (!existsSync(file)) return [];

  const content = await readFile(file, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as HistoryEntry;
      } catch {
        return null;
      }
    })
    .filter((entry) => entry !== null) as HistoryEntry[];
}

export async function getLastSessionState(agentId: string, limit: number = 100): Promise<HistoryEntry[]> {
  const dir = await getHistoryDir(agentId);
  let sessions: string[];
  try {
    const fs = await import('node:fs/promises');
    sessions = (await fs.readdir(dir))
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .reverse();
  } catch {
    return [];
  }

  const entries: HistoryEntry[] = [];

  for (const session of sessions.slice(0, 3)) {
    // Last 3 sessions
    const file = join(dir, session);
    try {
      const content = await readFile(file, 'utf-8');
      const sessionEntries = content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as HistoryEntry;
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null) as HistoryEntry[];
      entries.push(...sessionEntries);
    } catch { /* ignore */ }
  }

  return entries.slice(-limit);
}

export async function searchHistory(
  agentId: string,
  query: string,
  limit: number = 20,
): Promise<HistoryEntry[]> {
  const dir = await getHistoryDir(agentId);
  let sessions: string[];
  try {
    const fs = await import('node:fs/promises');
    sessions = (await fs.readdir(dir)).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }

  const matches: HistoryEntry[] = [];
  const lowerQuery = query.toLowerCase();

  for (const session of sessions) {
    const file = join(dir, session);
    try {
      const content = await readFile(file, 'utf-8');
      const entries = content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as HistoryEntry;
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null) as HistoryEntry[];

      for (const entry of entries) {
        if (
          entry.event.toLowerCase().includes(lowerQuery) ||
          entry.tool?.toLowerCase().includes(lowerQuery) ||
          JSON.stringify(entry.metadata).toLowerCase().includes(lowerQuery)
        ) {
          matches.push(entry);
          if (matches.length >= limit) return matches;
        }
      }
    } catch { /* ignore */ }
  }

  return matches;
}

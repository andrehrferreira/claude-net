import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { readJSON } from '../utils/read-json.js';
import { ensureDirs } from '../utils/ensure-dirs.js';

export interface Message {
  id: string;
  timestamp: string;
  from: string;
  to: string; // agent-id or "broadcast"
  subject: string;
  content: string;
  metadata?: Record<string, unknown>;
  read: boolean;
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function sendMessage(
  from: string,
  to: string,
  subject: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  await ensureDirs();

  const message: Message = {
    id: generateMessageId(),
    timestamp: new Date().toISOString(),
    from,
    to,
    subject,
    content,
    metadata,
    read: false,
  };

  const filename = `${message.timestamp.replace(/[:.]/g, '-')}-${message.id}.json`;
  await atomicWriteJSON(join(paths.messages, filename), message);
  return message.id;
}

export async function getInbox(agentId: string, unreadOnly: boolean = true): Promise<Message[]> {
  await ensureDirs();
  let files: string[];
  try {
    files = await readdir(paths.messages);
  } catch {
    return [];
  }

  const messages: Message[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const msg = await readJSON<Message>(join(paths.messages, file));
    if (msg && (msg.to === agentId || msg.to === 'broadcast')) {
      if (!unreadOnly || !msg.read) {
        messages.push(msg);
      }
    }
  }

  return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  let files: string[];
  try {
    files = await readdir(paths.messages);
  } catch {
    return;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const msg = await readJSON<Message>(join(paths.messages, file));
    if (msg && msg.id === messageId) {
      msg.read = true;
      await atomicWriteJSON(join(paths.messages, file), msg);
      return;
    }
  }
}

export async function listMessages(
  from?: string,
  to?: string,
  limit: number = 50,
): Promise<Message[]> {
  await ensureDirs();
  let files: string[];
  try {
    files = await readdir(paths.messages);
  } catch {
    return [];
  }

  const messages: Message[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const msg = await readJSON<Message>(join(paths.messages, file));
    if (!msg) continue;

    const fromMatch = !from || msg.from === from;
    const toMatch = !to || msg.to === to;
    if (fromMatch && toMatch) {
      messages.push(msg);
      if (messages.length >= limit) break;
    }
  }

  return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function broadcastMessage(
  from: string,
  subject: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  return sendMessage(from, 'broadcast', subject, content, metadata);
}

export async function clearOldMessages(days: number = 7): Promise<number> {
  await ensureDirs();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let files: string[];
  try {
    files = await readdir(paths.messages);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const msg = await readJSON<Message>(join(paths.messages, file));
    if (msg && new Date(msg.timestamp).getTime() < cutoff) {
      try {
        const { unlink } = await import('node:fs/promises');
        await unlink(join(paths.messages, file));
        removed++;
      } catch { /* ignore */ }
    }
  }
  return removed;
}

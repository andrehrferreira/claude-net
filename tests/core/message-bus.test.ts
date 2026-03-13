import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const tempDir = { value: '' };

vi.mock('../../src/utils/paths.js', async () => {
  return {
    get paths() {
      return {
        root: tempDir.value,
        agents: join(tempDir.value, 'agents'),
        locks: join(tempDir.value, 'locks'),
        errors: join(tempDir.value, 'errors'),
        messages: join(tempDir.value, 'messages'),
        history: join(tempDir.value, 'history'),
        config: join(tempDir.value, 'config.json'),
      };
    },
    get allDirs() {
      return [
        tempDir.value,
        join(tempDir.value, 'agents'),
        join(tempDir.value, 'locks'),
        join(tempDir.value, 'errors'),
        join(tempDir.value, 'messages'),
        join(tempDir.value, 'history'),
      ];
    },
  };
});

vi.mock('../../src/utils/ensure-dirs.js', async () => {
  const { mkdir } = await import('node:fs/promises');
  return {
    ensureDirs: async () => {
      const { allDirs } = await import('../../src/utils/paths.js');
      await Promise.all(allDirs.map((dir: string) => mkdir(dir, { recursive: true })));
    },
  };
});

const {
  sendMessage,
  getInbox,
  markMessageAsRead,
  listMessages,
  broadcastMessage,
  clearOldMessages,
} = await import('../../src/core/message-bus.js');

describe('message-bus', () => {
  beforeEach(async () => {
    tempDir.value = await mkdtemp(join(tmpdir(), 'claude-net-messages-'));
  });

  afterEach(async () => {
    await rm(tempDir.value, { recursive: true, force: true });
  });

  describe('sendMessage', () => {
    it('should send a message between agents', async () => {
      const msgId = await sendMessage('agent-1', 'agent-2', 'Hello', 'Hi there');
      expect(msgId).toBeDefined();
      expect(msgId).toMatch(/^msg-/);

      const inbox = await getInbox('agent-2');
      expect(inbox.length).toBe(1);
      expect(inbox[0].from).toBe('agent-1');
      expect(inbox[0].content).toBe('Hi there');
    });

    it('should include metadata if provided', async () => {
      await sendMessage('agent-1', 'agent-2', 'Test', 'Content', { priority: 'high' });
      const inbox = await getInbox('agent-2');
      expect(inbox[0].metadata).toEqual({ priority: 'high' });
    });

    it('should set read to false for new messages', async () => {
      await sendMessage('agent-1', 'agent-2', 'Test', 'Content');
      const inbox = await getInbox('agent-2', false); // Include unread
      expect(inbox[0].read).toBe(false);
    });
  });

  describe('getInbox', () => {
    it('should return empty inbox for agent with no messages', async () => {
      const inbox = await getInbox('agent-1');
      expect(inbox).toEqual([]);
    });

    it('should return only unread messages by default', async () => {
      await sendMessage('agent-1', 'agent-2', 'Msg1', 'Content');
      await sendMessage('agent-1', 'agent-2', 'Msg2', 'Content');

      let inbox = await getInbox('agent-2');
      expect(inbox.length).toBe(2);

      await markMessageAsRead(inbox[0].id);
      inbox = await getInbox('agent-2'); // Only unread
      expect(inbox.length).toBe(1);
    });

    it('should return all messages when unreadOnly=false', async () => {
      await sendMessage('agent-1', 'agent-2', 'Msg1', 'Content');
      await sendMessage('agent-1', 'agent-2', 'Msg2', 'Content');

      const inbox = await getInbox('agent-2', false);
      expect(inbox.length).toBe(2);
    });

    it('should include broadcast messages', async () => {
      await broadcastMessage('agent-1', 'Announcement', 'Everyone listen!');
      const inbox = await getInbox('agent-2');
      expect(inbox.length).toBe(1);
      expect(inbox[0].to).toBe('broadcast');
    });

    it('should sort messages by timestamp descending', async () => {
      const id1 = await sendMessage('agent-1', 'agent-2', 'First', 'Content');
      await new Promise((r) => setTimeout(r, 10));
      const id2 = await sendMessage('agent-1', 'agent-2', 'Second', 'Content');

      const inbox = await getInbox('agent-2', false);
      expect(inbox[0].id).toBe(id2); // Most recent first
      expect(inbox[1].id).toBe(id1);
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark a message as read', async () => {
      const msgId = await sendMessage('agent-1', 'agent-2', 'Test', 'Content');
      await markMessageAsRead(msgId);

      const inbox = await getInbox('agent-2'); // Only unread
      expect(inbox.length).toBe(0);

      const allMessages = await getInbox('agent-2', false);
      expect(allMessages[0].read).toBe(true);
    });

    it('should not throw for unknown message ID', async () => {
      await expect(markMessageAsRead('unknown-id')).resolves.not.toThrow();
    });
  });

  describe('listMessages', () => {
    it('should list all messages', async () => {
      await sendMessage('agent-1', 'agent-2', 'Msg1', 'Content');
      await sendMessage('agent-2', 'agent-1', 'Msg2', 'Content');

      const messages = await listMessages();
      expect(messages.length).toBe(2);
    });

    it('should filter by from agent', async () => {
      await sendMessage('agent-1', 'agent-2', 'From 1', 'Content');
      await sendMessage('agent-2', 'agent-1', 'From 2', 'Content');

      const messages = await listMessages('agent-1');
      expect(messages.length).toBe(1);
      expect(messages[0].from).toBe('agent-1');
    });

    it('should filter by to agent', async () => {
      await sendMessage('agent-1', 'agent-2', 'To 2', 'Content');
      await sendMessage('agent-1', 'agent-3', 'To 3', 'Content');

      const messages = await listMessages(undefined, 'agent-2');
      expect(messages.length).toBe(1);
      expect(messages[0].to).toBe('agent-2');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await sendMessage('agent-1', 'agent-2', `Msg${i}`, 'Content');
        await new Promise((r) => setTimeout(r, 10));
      }

      const messages = await listMessages(undefined, undefined, 2);
      expect(messages.length).toBe(2);
    });
  });

  describe('broadcastMessage', () => {
    it('should send message to broadcast', async () => {
      const msgId = await broadcastMessage('agent-1', 'Alert', 'Build failed!');
      expect(msgId).toBeDefined();

      const inbox2 = await getInbox('agent-2');
      const inbox3 = await getInbox('agent-3');
      expect(inbox2[0].to).toBe('broadcast');
      expect(inbox3[0].to).toBe('broadcast');
    });
  });

  describe('clearOldMessages', () => {
    it('should not delete recent messages', async () => {
      await sendMessage('agent-1', 'agent-2', 'Recent', 'Content');
      const removed = await clearOldMessages(7);
      expect(removed).toBe(0);

      const messages = await listMessages();
      expect(messages.length).toBe(1);
    });

    it('should delete old messages', async () => {
      await sendMessage('agent-1', 'agent-2', 'Old', 'Content');

      // Manually set timestamp to 8 days ago
      const { readJSON } = await import('../../src/utils/read-json.js');
      const { atomicWriteJSON } = await import('../../src/utils/atomic-write.js');
      const { paths } = await import('../../src/utils/paths.js');
      const fs = await import('node:fs/promises');
      const files = await fs.readdir(paths.messages);
      for (const file of files) {
        const msg = await readJSON<any>(join(paths.messages, file));
        if (msg) {
          msg.timestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
          await atomicWriteJSON(join(paths.messages, file), msg);
        }
      }

      const removed = await clearOldMessages(7);
      expect(removed).toBe(1);

      const messages = await listMessages();
      expect(messages.length).toBe(0);
    });
  });
});

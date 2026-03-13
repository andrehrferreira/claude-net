import { randomBytes } from 'node:crypto';

/**
 * Generate a unique agent ID combining PID, timestamp, and random bytes.
 * Format: {pid}-{timestamp}-{random6hex}
 */
export function generateAgentId(): string {
  const pid = process.pid;
  const ts = Date.now().toString(36);
  const rand = randomBytes(3).toString('hex');
  return `${pid}-${ts}-${rand}`;
}

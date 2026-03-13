import { describe, it, expect } from 'vitest';
import { generateAgentId } from '../../src/utils/agent-id.js';

describe('generateAgentId', () => {
  it('should return a string', () => {
    const id = generateAgentId();
    expect(typeof id).toBe('string');
  });

  it('should contain the current PID', () => {
    const id = generateAgentId();
    expect(id.startsWith(`${process.pid}-`)).toBe(true);
  });

  it('should have three parts separated by hyphens', () => {
    const id = generateAgentId();
    const parts = id.split('-');
    expect(parts.length).toBe(3);
  });

  it('should generate unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateAgentId()));
    expect(ids.size).toBe(100);
  });

  it('should have a 6-char hex random suffix', () => {
    const id = generateAgentId();
    const parts = id.split('-');
    const rand = parts[2];
    expect(rand).toMatch(/^[0-9a-f]{6}$/);
  });

  it('should have a base36 timestamp as the middle part', () => {
    const id = generateAgentId();
    const parts = id.split('-');
    const ts = parseInt(parts[1], 36);
    const now = Date.now();
    expect(ts).toBeGreaterThan(now - 5000);
    expect(ts).toBeLessThanOrEqual(now);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { atomicWrite, atomicWriteJSON } from '../../src/utils/atomic-write.js';

describe('atomicWrite', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'claude-net-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write a new file', async () => {
    const filePath = join(tempDir, 'test.txt');
    await atomicWrite(filePath, 'hello world');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should overwrite an existing file', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'old content');
    await atomicWrite(filePath, 'new content');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('new content');
  });

  it('should not leave temp files on success', async () => {
    const filePath = join(tempDir, 'test.txt');
    await atomicWrite(filePath, 'data');
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(tempDir);
    expect(files).toEqual(['test.txt']);
  });

  it('should throw if parent directory does not exist', async () => {
    const filePath = join(tempDir, 'nonexistent', 'test.txt');
    await expect(atomicWrite(filePath, 'data')).rejects.toThrow();
  });
});

describe('atomicWriteJSON', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'claude-net-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write valid JSON with trailing newline', async () => {
    const filePath = join(tempDir, 'test.json');
    const data = { name: 'test', value: 42 };
    await atomicWriteJSON(filePath, data);
    const content = await readFile(filePath, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
    expect(JSON.parse(content)).toEqual(data);
  });

  it('should handle arrays', async () => {
    const filePath = join(tempDir, 'test.json');
    const data = [1, 2, 3];
    await atomicWriteJSON(filePath, data);
    const content = await readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual(data);
  });

  it('should handle null', async () => {
    const filePath = join(tempDir, 'test.json');
    await atomicWriteJSON(filePath, null);
    const content = await readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toBeNull();
  });

  it('should pretty-print with 2-space indentation', async () => {
    const filePath = join(tempDir, 'test.json');
    await atomicWriteJSON(filePath, { a: 1 });
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('{\n  "a": 1\n}\n');
  });
});

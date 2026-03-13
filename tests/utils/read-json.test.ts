import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readJSON } from '../../src/utils/read-json.js';

describe('readJSON', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'claude-net-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should parse a valid JSON file', async () => {
    const filePath = join(tempDir, 'test.json');
    await writeFile(filePath, '{"key":"value"}');
    const result = await readJSON(filePath);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for non-existent file', async () => {
    const result = await readJSON(join(tempDir, 'nope.json'));
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', async () => {
    const filePath = join(tempDir, 'bad.json');
    await writeFile(filePath, 'not json{');
    const result = await readJSON(filePath);
    expect(result).toBeNull();
  });

  it('should handle arrays', async () => {
    const filePath = join(tempDir, 'arr.json');
    await writeFile(filePath, '[1,2,3]');
    const result = await readJSON<number[]>(filePath);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should handle empty object', async () => {
    const filePath = join(tempDir, 'empty.json');
    await writeFile(filePath, '{}');
    const result = await readJSON(filePath);
    expect(result).toEqual({});
  });
});

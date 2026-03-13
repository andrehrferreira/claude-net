import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { paths } from '../utils/paths.js';
import { atomicWriteJSON } from '../utils/atomic-write.js';
import { readJSON } from '../utils/read-json.js';
import { ensureDirs } from '../utils/ensure-dirs.js';

export interface BuildError {
  timestamp: string;
  agentId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface TestError {
  timestamp: string;
  agentId: string;
  command: string;
  failedTests: number;
  totalTests: number;
  output: string;
}

export type ErrorRecord = BuildError | TestError;

function isBuildError(e: ErrorRecord): e is BuildError {
  return 'exitCode' in e;
}

function isTestError(e: ErrorRecord): e is TestError {
  return 'failedTests' in e;
}

export async function saveBuildError(
  agentId: string,
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): Promise<void> {
  await ensureDirs();
  const timestamp = new Date().toISOString();
  const filename = `build-${timestamp.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
  const error: BuildError = { timestamp, agentId, command, exitCode, stdout, stderr };
  await atomicWriteJSON(join(paths.errors, filename), error);
}

export async function saveTestError(
  agentId: string,
  command: string,
  failedTests: number,
  totalTests: number,
  output: string,
): Promise<void> {
  await ensureDirs();
  const timestamp = new Date().toISOString();
  const filename = `test-${timestamp.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
  const error: TestError = { timestamp, agentId, command, failedTests, totalTests, output };
  await atomicWriteJSON(join(paths.errors, filename), error);
}

export async function getLastBuildError(): Promise<BuildError | null> {
  const all = await listErrors();
  const builds = all.filter(isBuildError).sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  return builds[0] || null;
}

export async function getLastTestError(): Promise<TestError | null> {
  const all = await listErrors();
  const tests = all.filter(isTestError).sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  return tests[0] || null;
}

export async function listErrors(limit: number = 50): Promise<ErrorRecord[]> {
  await ensureDirs();
  let files: string[];
  try {
    files = await readdir(paths.errors);
  } catch {
    return [];
  }

  const errors: ErrorRecord[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const error = await readJSON<ErrorRecord>(join(paths.errors, file));
    if (error) errors.push(error);
  }

  return errors
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function listErrorsByAgent(agentId: string, limit: number = 20): Promise<ErrorRecord[]> {
  const all = await listErrors();
  return all.filter((e) => e.agentId === agentId).slice(0, limit);
}

export async function clearOldErrors(days: number = 7): Promise<number> {
  await ensureDirs();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let files: string[];
  try {
    files = await readdir(paths.errors);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const error = await readJSON<ErrorRecord>(join(paths.errors, file));
    if (error && new Date(error.timestamp).getTime() < cutoff) {
      try {
        const { unlink } = await import('node:fs/promises');
        await unlink(join(paths.errors, file));
        removed++;
      } catch { /* ignore */ }
    }
  }
  return removed;
}

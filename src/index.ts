export { generateAgentId } from './utils/agent-id.js';
export { atomicWrite, atomicWriteJSON } from './utils/atomic-write.js';
export { readJSON } from './utils/read-json.js';
export { paths, allDirs } from './utils/paths.js';
export { ensureDirs } from './utils/ensure-dirs.js';
export {
  registerAgent,
  deregisterAgent,
  updateAgent,
  heartbeat,
  getAgent,
  listAgents,
  listActiveAgents,
  cleanupStaleAgents,
} from './core/agent-registry.js';
export type { AgentInfo, AgentStatus } from './core/agent-registry.js';
export {
  acquireLock,
  releaseLock,
  releaseLocksByAgent,
  checkLock,
  listLocks,
} from './core/file-lock.js';
export type { LockInfo } from './core/file-lock.js';

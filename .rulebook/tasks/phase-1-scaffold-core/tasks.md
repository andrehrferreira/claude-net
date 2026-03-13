## 1. Implementation
- [ ] 1.1 Create package.json with TypeScript, vitest, bin config
- [ ] 1.2 Create tsconfig.json (Node.js ESM, strict mode)
- [ ] 1.3 Create .claude-plugin/plugin.json manifest
- [ ] 1.4 Implement src/utils/atomic-write.ts (temp file + rename)
- [ ] 1.5 Implement src/utils/agent-id.ts (PID + timestamp + random)
- [ ] 1.6 Implement src/core/agent-registry.ts (register, deregister, heartbeat, list, cleanup)
- [ ] 1.7 Create ~/.claude-net/ directory structure constants

## 2. Testing
- [ ] 2.1 Unit tests for atomic-write (write, overwrite, concurrent writes)
- [ ] 2.2 Unit tests for agent-id (uniqueness, format)
- [ ] 2.3 Unit tests for agent-registry (register, deregister, heartbeat, stale cleanup, list)
- [ ] 2.4 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Add inline JSDoc to all exported functions

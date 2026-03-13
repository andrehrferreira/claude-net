## 1. Implementation
- [ ] 1.1 Create hooks/hooks.json configuration
- [ ] 1.2 Implement src/hooks/session-start.ts (register agent, set initial status)
- [ ] 1.3 Implement src/hooks/session-end.ts (deregister agent, cleanup locks)
- [ ] 1.4 Implement src/hooks/pre-tool.ts (parse stdin, detect file conflicts, exit codes)
- [ ] 1.5 Implement src/hooks/post-tool.ts (update agent status, log action)
- [ ] 1.6 Add shared stdin parser utility for hook input

## 2. Testing
- [ ] 2.1 Tests for session-start (agent registration, idempotency)
- [ ] 2.2 Tests for session-end (cleanup, graceful deregister)
- [ ] 2.3 Tests for pre-tool (conflict detection, allow/block exit codes)
- [ ] 2.4 Tests for post-tool (status update, action logging)
- [ ] 2.5 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Document hook input/output format

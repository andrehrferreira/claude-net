## 1. Implementation
- [ ] 1.1 Implement src/core/error-store.ts (save error, query recent, query by type)
- [ ] 1.2 Implement src/core/history.ts (append action, read session log, list sessions)
- [ ] 1.3 Update src/hooks/post-tool.ts to detect build/test failures and save to error-store
- [ ] 1.4 Update src/hooks/post-tool.ts to append every action to history
- [ ] 1.5 Update src/hooks/session-start.ts to check for recovery data from last session
- [ ] 1.6 Add error TTL / auto-cleanup for old errors (configurable, default 24h)

## 2. Testing
- [ ] 2.1 Tests for error-store (save, query, TTL expiry, type filtering)
- [ ] 2.2 Tests for history (append, read, session listing, JSONL format)
- [ ] 2.3 Tests for post-tool error detection (build fail, test fail, success)
- [ ] 2.4 Tests for session recovery flow
- [ ] 2.5 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Document error and history file formats

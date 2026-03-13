## 1. Implementation
- [ ] 1.1 Implement src/core/file-lock.ts (acquire, release, check, stale detection)
- [ ] 1.2 Implement src/core/conflict-detector.ts (same-file rule, build mutex, test mutex)
- [ ] 1.3 Update src/hooks/pre-tool.ts to use conflict-detector (exit 2 on conflict)
- [ ] 1.4 Auto-acquire locks in pre-tool, auto-release in post-tool
- [ ] 1.5 Handle stale locks from crashed agents (heartbeat-based expiry)

## 2. Testing
- [ ] 2.1 Tests for file-lock (acquire, release, stale detection, concurrent access)
- [ ] 2.2 Tests for conflict-detector (same file, build conflict, test conflict, no conflict)
- [ ] 2.3 Integration test: pre-tool blocks when conflict exists
- [ ] 2.4 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Document conflict rules and lock behavior

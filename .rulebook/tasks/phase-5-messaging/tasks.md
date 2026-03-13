## 1. Implementation
- [ ] 1.1 Implement src/core/message-bus.ts (send to agent, broadcast, read inbox, mark read)
- [ ] 1.2 Message format: { from, to, type, content, timestamp, read }
- [ ] 1.3 Create commands/net-status.md (slash command /claude-net:status)
- [ ] 1.4 Create commands/net-logs.md (slash command /claude-net:logs)
- [ ] 1.5 Create skills/coordinator/SKILL.md (coordination skill)
- [ ] 1.6 Create agents/coordinator.md (coordinator agent)
- [ ] 1.7 Integrate message checking into pre-tool hook (check inbox for warnings)
- [ ] 1.8 Persist all messages to ~/.claude-net/messages/ for analysis

## 2. Testing
- [ ] 2.1 Tests for message-bus (send, broadcast, inbox, mark-read, filtering)
- [ ] 2.2 Tests for message persistence (file format, retrieval)
- [ ] 2.3 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Document message protocol and formats
- [ ] 3.2 Document slash commands usage

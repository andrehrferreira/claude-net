## 1. Implementation
- [ ] 1.1 Implement src/cli.ts with minimal arg parsing (no commander dependency)
- [ ] 1.2 Create bin/claude-net.js shebang entry point
- [ ] 1.3 `install` command: copy plugin to ~/.claude/plugins/, create ~/.claude-net/
- [ ] 1.4 `uninstall` command: remove plugin from ~/.claude/plugins/
- [ ] 1.5 `status` command: list active agents with current task and status
- [ ] 1.6 `logs` command: show recent action history
- [ ] 1.7 `errors` command: show recent build/test errors
- [ ] 1.8 `messages` command: show inter-agent conversations
- [ ] 1.9 `clean` command: remove stale agents and expired locks
- [ ] 1.10 Add package.json "bin" field for npx support

## 2. Testing
- [ ] 2.1 Tests for CLI arg parsing
- [ ] 2.2 Tests for install/uninstall (mock filesystem)
- [ ] 2.3 Tests for status/logs/errors/messages output formatting
- [ ] 2.4 Tests for clean command
- [ ] 2.5 Verify coverage >= 95%

## 3. Documentation
- [ ] 3.1 Document all CLI commands with examples

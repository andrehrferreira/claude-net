# Proposal: phase-5-messaging

## Why
Agents need to communicate directly — e.g., "I'm refactoring auth.ts, don't touch it" or "build is broken, here's the error". Messages are persisted for analysis and learning across sessions.

## What Changes
- Implement src/core/message-bus.ts (send, inbox, broadcast, mark-read)
- Create commands/net-status.md (slash command to view network status)
- Create commands/net-logs.md (slash command to view logs/messages)
- Create skills/coordinator/SKILL.md (auto-invoked coordination skill)
- Create agents/coordinator.md (coordinator agent definition)

## Impact
- Affected specs: none
- Affected code: src/core/message-bus.ts, commands/, skills/, agents/
- Breaking change: NO
- User benefit: Agents coordinate proactively, conversations are logged for review

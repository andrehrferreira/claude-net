# /claude-net:net-status

**Slash Command** — Show the status of all active agents in the claude-net network.

## Usage

```
/claude-net:net-status
```

## Output

Displays:
- List of all active agents with their current status (idle, editing, building, testing)
- Current task being worked on (if any)
- Files in use
- Heartbeat timestamp
- Lock information for shared resources
- Recent errors (if any)

## Example

```
[claude-net] Network Status (3 agents)

Agent abc123 (idle)
  - Current task: Implementing auth middleware
  - Status: idle
  - Files: src/auth.ts
  - Last seen: 2026-03-13T11:00:00Z

Agent def456 (testing)
  - Current task: Unit tests for parser
  - Status: testing (npm test)
  - Files: tests/parser.test.ts
  - Last seen: 2026-03-13T10:59:45Z

Agent ghi789 (idle)
  - Current task: (none)
  - Status: idle
  - Last seen: 2026-03-13T10:58:30Z

[claude-net] Shared Resources:
  - Locks: 1 (src/auth.ts held by abc123)
  - Recent errors: build failed 2 min ago (agent def456)
```

## Implementation

This command:
1. Reads all active agent files from `~/.claude-net/agents/`
2. Filters out stale agents (heartbeat > 30s)
3. Reads active locks from `~/.claude-net/locks/`
4. Queries recent errors from `~/.claude-net/errors/`
5. Formats and displays the network status

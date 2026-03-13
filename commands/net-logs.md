# /claude-net:net-logs

**Slash Command** — Show the action history and inter-agent messaging for debugging and analysis.

## Usage

```
/claude-net:net-logs [--agent AGENT_ID] [--session SESSION_ID] [--search QUERY] [--limit N]
```

## Options

- `--agent AGENT_ID` — Filter history for a specific agent
- `--session SESSION_ID` — Show history for a specific session
- `--search QUERY` — Search history by event, tool, or metadata
- `--limit N` — Limit output to N entries (default: 50)
- `--messages` — Show inter-agent messages instead of history
- `--unread` — Show only unread messages

## Examples

### Show last 20 actions of current agent
```
/claude-net:net-logs --limit 20
```

### Show actions by a specific agent
```
/claude-net:net-logs --agent abc123
```

### Search history for "auth" keyword
```
/claude-net:net-logs --search auth
```

### Show unread messages
```
/claude-net:net-logs --messages --unread
```

## Output Format

### History
```
[claude-net] Action History (20 entries)

2026-03-13 11:00:45 — Edit src/auth.ts
  Tool: Edit
  Input: file_path="/src/auth.ts", ...
  Result: Success (342 chars)

2026-03-13 11:00:30 — Execute bash
  Tool: Bash
  Input: command="npm run build"
  Result: Build failed, exit code 1

...
```

### Messages
```
[claude-net] Messages (3 unread)

FROM agent-def456 TO broadcast (2026-03-13 11:01:00)
Subject: Build failed — test suite is broken
Content: The build failed due to missing dependency. Please review...

FROM agent-ghi789 TO agent-abc123 (2026-03-13 10:59:30)
Subject: File lock conflict
Content: I need to edit src/auth.ts but you have it locked...

...
```

## Implementation

This command:
1. Reads session history from `~/.claude-net/history/{agent-id}/`
2. Filters by agent/session/search query as specified
3. Or displays inter-agent messages from `~/.claude-net/messages/`
4. Formats output with timestamps and metadata
5. Supports both human-readable and JSON output formats for programmatic access

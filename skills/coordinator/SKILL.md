---
name: Agent Coordination
description: Auto-invoked skill to coordinate between multiple agents and prevent conflicts
version: 1.0.0
category: core
tags: ["coordination", "network", "agents", "conflict-resolution"]
---

# Agent Coordination Skill

This skill enables agents to check the network status, communicate with other agents, and coordinate work to avoid conflicts.

## Auto-Invocation Triggers

This skill is automatically invoked by claude-net in these scenarios:

1. **Network Conflict Detected**: When another agent is working on the same file or running the same command
2. **Build/Test Failure**: When recent build or test errors are detected
3. **Session Start**: When an agent session begins, to provide network context

## Available Tools

The coordinator skill exposes these capabilities:

### net_status
Get current network status — active agents, their tasks, and shared resources.

```
Returns:
  - List of active agents with status (idle, editing, building, testing)
  - Current task for each agent
  - Files in use
  - Active locks
  - Recent errors
```

### net_send
Send a message to another agent or broadcast to all agents.

```
net_send(
  to: "agent-id" | "broadcast",
  subject: string,
  content: string,
  metadata?: Record<string, unknown>
)

Returns: message-id
```

**Example:**
```
net_send(
  to: "agent-abc123",
  subject: "Blocked on file lock",
  content: "I need to edit src/auth.ts but you have it locked. Can you release it?"
)
```

### net_inbox
Retrieve messages sent to this agent.

```
net_inbox(unreadOnly?: boolean)

Returns: Message[]
  - id: message ID
  - from: sender agent ID
  - subject: message subject
  - content: message content
  - timestamp: when message was sent
  - read: whether message was read
```

### net_errors
Get recent build or test errors.

```
net_errors(type: "build" | "test" | "all", limit?: number)

Returns: ErrorRecord[]
  - BuildError: { timestamp, agentId, command, exitCode, stdout, stderr }
  - TestError: { timestamp, agentId, command, failedTests, totalTests, output }
```

### net_history
Search agent history for past actions.

```
net_history(
  query: string,
  limit?: number
)

Returns: HistoryEntry[]
  - timestamp
  - event (tool_executed, file_edited, build_started, etc.)
  - tool (Edit, Bash, Write, etc.)
  - metadata
```

## Coordination Rules

When these tools are available, follow these coordination rules:

1. **Before file operations**: Check `net_status` for locks on the target file
2. **Before build/test**: Check `net_status` for ongoing builds/tests by other agents
3. **On conflicts**: Use `net_send` to communicate with conflicting agent
4. **On errors**: Check `net_errors` to understand what went wrong
5. **On recovery**: Use `net_history` to understand previous session state

## Conflict Resolution Protocol

When a conflict is detected:

1. **Identify the conflict**: Which agent, which resource, what operation
2. **Communicate**: Send a message to the conflicting agent explaining the situation
3. **Propose solution**: "Can you release the lock?" or "Wait for my build to finish"
4. **Coordinate**: If urgent, consider working on a different file/task
5. **Document**: The history system automatically records all interactions

## Example Coordination Flow

```
Agent A wants to edit src/auth.ts:

1. Call net_status → See Agent B editing src/auth.ts
2. Call net_send to Agent B → "I need to edit src/auth.ts when you're done"
3. Wait for Agent B to finish (lock released in net_status)
4. Call net_send to Agent B → "Thanks, starting my edits"
5. Proceed with editing
```

## Benefits

✓ **Prevents merge conflicts** — Lock coordination ensures only one agent touches a file at a time
✓ **Avoids duplicate work** — Agents can see what others are doing
✓ **Enables recovery** — History allows resuming work after crashes
✓ **Improves diagnostics** — Shared error logs help understand failures
✓ **Facilitates learning** — Agent can review past interactions and adjust strategy

## Persistence

All coordination interactions are persisted:
- **Messages** in `~/.claude-net/messages/` — for inter-agent communication
- **History** in `~/.claude-net/history/{agent-id}/` — for session recovery and analysis
- **Errors** in `~/.claude-net/errors/` — for debugging

This enables **agent learning** across sessions and **post-mortem analysis** of coordination patterns.

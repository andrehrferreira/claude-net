# claude-net

[![npm version](https://img.shields.io/npm/v/claude-net?logo=npm&logoColor=white)](https://www.npmjs.com/package/claude-net)
[![npm downloads](https://img.shields.io/npm/dm/claude-net?logo=npm&logoColor=white)](https://www.npmjs.com/package/claude-net)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Tests](https://img.shields.io/github/actions/workflow/status/YOUR_ORG/claude-net/test.yml?label=tests&logo=github)](https://github.com/YOUR_ORG/claude-net/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/codecov/c/github/YOUR_ORG/claude-net?logo=codecov&logoColor=white)](https://codecov.io/gh/YOUR_ORG/claude-net)
[![Build](https://img.shields.io/github/actions/workflow/status/YOUR_ORG/claude-net/build.yml?label=build&logo=github)](https://github.com/YOUR_ORG/claude-net/actions/workflows/build.yml)

> A Claude Code plugin that creates a communication network between all VSCode tabs and agents, preventing conflicts and enabling coordination via file-based IPC.

---

## Why claude-net?

When using Claude Code with multiple VSCode tabs on the same project, agents frequently interfere with each other — editing the same files, running duplicate builds, competing for test execution. This leads to wasted time, broken state, and frustrating debugging.

**claude-net solves this by providing:**

- 🔒 **File Locking**: Prevents two agents from editing the same file simultaneously
- 🏗️ **Build/Test Mutex**: Only one agent can build or run tests at a time — others wait or skip
- 💬 **Inter-Agent Messaging**: Agents communicate to coordinate work and avoid conflicts
- 📋 **Shared Error Logs**: Build/test errors are shared across all agents — no duplicate failures
- 🔄 **Session Recovery**: Full action history enables recovery after crashes (blue screens, power loss)
- 🕵️ **Conflict Detection**: Automatic detection and blocking of conflicting operations via hooks
- 📊 **Network Status**: Real-time visibility into what every agent is doing

**How it works**: claude-net installs as a global Claude Code plugin with lifecycle hooks. Every agent registers on session start, updates status on every action, and checks for conflicts before editing files or running commands. All communication happens through JSON files in `~/.claude-net/` — no database, no server, no external dependencies.

## Quick Start

```bash
# Install the plugin globally (one-time setup)
npx claude-net install

# Check network status
npx claude-net status

# View recent errors shared across agents
npx claude-net errors

# Uninstall
npx claude-net uninstall
```

That's it. After installation, every Claude Code session automatically joins the network. No per-project configuration needed.

---

## Architecture

### How Agents Communicate

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  VSCode Tab 1│  │  VSCode Tab 2│  │  VSCode Tab 3│
│  Claude Agent│  │  Claude Agent│  │  Claude Agent│
│  + subagents │  │  + subagents │  │  + subagents │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │    ┌────────────┴────────────┐    │
       └────┤    ~/.claude-net/       ├────┘
            │                         │
            │  agents/    → registry  │
            │  locks/     → file locks│
            │  messages/  → inbox     │
            │  errors/    → shared log│
            │  history/   → recovery  │
            └─────────────────────────┘
```

All state is stored as JSON files in `~/.claude-net/`. Each agent reads and writes atomically (temp file + rename) to prevent corruption on Windows and Linux.

### Plugin Integration

claude-net integrates with Claude Code through **hooks** — the plugin's primary mechanism:

| Hook | Trigger | What it does |
|------|---------|-------------|
| `SessionStart` | Agent session begins | Registers agent in the network, checks for recovery data |
| `SessionEnd` | Agent session ends | Deregisters agent, releases all locks, saves final state |
| `PreToolUse` | Before Edit/Bash/Write | Checks for file conflicts and build/test mutex — blocks if conflict (exit 2) |
| `PostToolUse` | After any tool execution | Updates agent status, logs action to history, saves errors if build/test failed |

### Agent Lifecycle

```
1. Session starts → hook registers agent with unique ID
2. Agent works → every tool call updates status via hooks
3. Before editing → pre-hook checks: is another agent on this file?
4. Before building → pre-hook checks: is another agent already building?
5. After failure → post-hook saves error to shared store
6. Session ends → hook deregisters, cleans up locks
7. Agent crashes → other agents detect stale heartbeat (>30s), clean up
```

---

## Shared State Directory

```
~/.claude-net/
├── agents/{id}.json             # Active agents + heartbeat
├── locks/{file-hash}.lock       # Active file locks
├── errors/{timestamp}.json      # Build/test errors (shared)
├── messages/{timestamp}.json    # Inter-agent messages
├── history/{agent-id}/          # Session history (JSONL per session)
└── config.json                  # Global configuration
```

### Agent Registration

Each agent writes a status file with heartbeat:

```json
{
  "id": "a1b2c3",
  "pid": 12345,
  "project": "/path/to/project",
  "currentTask": "Implementing auth middleware",
  "filesInUse": ["src/auth.ts", "src/middleware.ts"],
  "lastHeartbeat": "2026-03-13T10:00:00.000Z",
  "status": "editing"
}
```

Agents with `lastHeartbeat` older than 30 seconds are considered dead and cleaned up automatically.

---

## Features

### File Locking

When an agent starts editing a file, a lock is acquired automatically via the `PreToolUse` hook. If another agent tries to edit the same file, the hook blocks the action (exit code 2) and informs the agent about the conflict.

```
Agent A: Edit src/auth.ts → Lock acquired ✅
Agent B: Edit src/auth.ts → BLOCKED ❌ "File locked by Agent A (implementing auth)"
Agent A: Done editing    → Lock released
Agent B: Edit src/auth.ts → Lock acquired ✅
```

### Build/Test Mutex

Only one agent can run `npm run build`, `npm test`, or similar commands at a time. The `PreToolUse` hook detects build/test commands in Bash tool calls and enforces mutual exclusion.

If a recent build or test failed, the error is available to all agents via the shared error store — preventing duplicate failed runs.

### Inter-Agent Messaging

Agents can send messages to each other or broadcast to all:

```json
{
  "from": "agent-a1b2c3",
  "to": "broadcast",
  "type": "warning",
  "content": "Refactoring auth module — avoid src/auth/ until I'm done",
  "timestamp": "2026-03-13T10:05:00.000Z"
}
```

Messages are persisted in `~/.claude-net/messages/` for analysis and learning across sessions.

### Shared Error Store

When a build or test fails, the error output is saved to `~/.claude-net/errors/` with metadata:

```json
{
  "type": "build",
  "command": "npm run build",
  "exitCode": 1,
  "output": "src/auth.ts(42,5): error TS2345: ...",
  "project": "/path/to/project",
  "agent": "agent-a1b2c3",
  "timestamp": "2026-03-13T10:10:00.000Z"
}
```

Other agents check this store before running the same command, avoiding duplicate failures.

### Session Recovery

Every action is logged to `~/.claude-net/history/{agent-id}/{session}.jsonl` as append-only JSONL. After a crash (blue screen, power loss, closed tabs), a new session can read the last session's history and resume from where it stopped.

---

## CLI Commands

```bash
# Installation
npx claude-net install           # Install plugin globally to ~/.claude/plugins/
npx claude-net uninstall         # Remove plugin and clean up

# Monitoring
npx claude-net status            # List all active agents with current tasks
npx claude-net logs              # View recent action history across agents
npx claude-net errors            # Show recent build/test errors
npx claude-net messages          # View inter-agent conversations

# Maintenance
npx claude-net clean             # Remove stale agents and expired locks
```

### Example Output: `npx claude-net status`

```
┌─────────┬──────────┬─────────────────────────────┬──────────┬─────────┐
│ Agent   │ Project  │ Current Task                │ Status   │ Uptime  │
├─────────┼──────────┼─────────────────────────────┼──────────┼─────────┤
│ a1b2c3  │ my-app   │ Implementing auth middleware │ editing  │ 12m     │
│ d4e5f6  │ my-app   │ Writing unit tests           │ testing  │ 8m      │
│ g7h8i9  │ api-svc  │ Fixing CORS issue            │ idle     │ 3m      │
└─────────┴──────────┴─────────────────────────────┴──────────┴─────────┘
```

---

## Slash Commands

After installation, two slash commands are available inside Claude Code:

| Command | Description |
|---------|-------------|
| `/claude-net:status` | Show network status — active agents, locks, recent errors |
| `/claude-net:logs` | Show recent action logs and inter-agent messages |

---

## Plugin Structure

```
claude-net/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── hooks/
│   └── hooks.json               # Lifecycle hooks configuration
├── commands/
│   ├── net-status.md            # /claude-net:status slash command
│   └── net-logs.md              # /claude-net:logs slash command
├── skills/
│   └── coordinator/
│       └── SKILL.md             # Auto-invoked coordination skill
├── agents/
│   └── coordinator.md           # Coordinator agent definition
├── src/
│   ├── cli.ts                   # CLI entry point
│   ├── hooks/
│   │   ├── pre-tool.ts          # Conflict detection before actions
│   │   ├── post-tool.ts         # Activity logging after actions
│   │   ├── session-start.ts     # Agent registration
│   │   └── session-end.ts       # Agent deregistration
│   ├── core/
│   │   ├── agent-registry.ts    # Agent lifecycle management
│   │   ├── file-lock.ts         # File locking with stale detection
│   │   ├── message-bus.ts       # Inter-agent messaging
│   │   ├── error-store.ts       # Shared build/test error logs
│   │   ├── history.ts           # Session history for recovery
│   │   └── conflict-detector.ts # Conflict detection rules
│   └── utils/
│       ├── atomic-write.ts      # Safe file writes (temp + rename)
│       └── agent-id.ts          # Unique agent ID generation
├── tests/
├── package.json
├── tsconfig.json
└── bin/
    └── claude-net.js            # npx entry point
```

---

## Configuration

Global configuration lives in `~/.claude-net/config.json`:

```json
{
  "heartbeatStaleThreshold": 30000,
  "errorTTL": 86400000,
  "maxMessageAge": 604800000,
  "lockTimeout": 300000
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `heartbeatStaleThreshold` | 30s | Time before an agent is considered dead |
| `errorTTL` | 24h | How long errors are kept in the store |
| `maxMessageAge` | 7d | How long messages are retained |
| `lockTimeout` | 5min | Auto-release locks after this duration |

---

## How It Differs from MCP

| Aspect | MCP Server | Claude Code Plugin |
|--------|------------|-------------------|
| Scope | Per-project (`.mcp.json`) | Global (all projects, all tabs) |
| Integration | Tools exposed to the model | Hooks intercept tool execution |
| Setup | Configure per project | Install once, works everywhere |
| Communication | Model calls tools explicitly | Automatic via lifecycle hooks |

claude-net is a **plugin** because it needs to work across all projects and tabs without per-project configuration. Hooks provide automatic, transparent integration — agents don't need to explicitly call coordination tools.

---

## Requirements

- **Node.js**: 20+
- **Claude Code**: Latest version with plugin support
- **OS**: Windows, macOS, Linux

## Contributing

Contributions welcome! This project uses TypeScript with vitest for testing.

```bash
npm install
npm test
npm run build
npm run type-check
npm run lint
```

Coverage threshold: 95%.

## License

MIT

---

**Links**: [Issues](https://github.com/YOUR_ORG/claude-net/issues) • [Discussions](https://github.com/YOUR_ORG/claude-net/discussions)

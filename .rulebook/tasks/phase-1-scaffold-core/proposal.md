# Proposal: phase-1-scaffold-core

## Why
Set up the project foundation: package.json, tsconfig, plugin manifest, and core modules (atomic-write, agent-id, agent-registry) that all other phases depend on.

## What Changes
- Create package.json with TypeScript, vitest, and bin config for npx
- Create tsconfig.json for Node.js ESM target
- Create .claude-plugin/plugin.json manifest
- Implement src/utils/atomic-write.ts (temp file + rename, Windows-safe)
- Implement src/utils/agent-id.ts (unique ID: PID + timestamp + random)
- Implement src/core/agent-registry.ts (register, deregister, heartbeat, list, cleanup stale agents)

## Impact
- Affected specs: none (new project)
- Affected code: new files only
- Breaking change: NO
- User benefit: Foundation for the entire plugin — no functionality exposed yet

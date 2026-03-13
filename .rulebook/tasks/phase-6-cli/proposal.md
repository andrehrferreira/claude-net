# Proposal: phase-6-cli

## Why
Users need a simple `npx claude-net install` to set up the plugin globally. CLI also provides management commands for monitoring and debugging the agent network.

## What Changes
- Implement src/cli.ts (minimal arg parsing, no heavy dependencies)
- Create bin/claude-net.js entry point
- Commands: install, uninstall, status, logs, errors, messages, clean
- Install copies plugin to ~/.claude/plugins/ and creates ~/.claude-net/

## Impact
- Affected specs: none
- Affected code: src/cli.ts, bin/claude-net.js, package.json bin field
- Breaking change: NO
- User benefit: One-command install, easy monitoring and management

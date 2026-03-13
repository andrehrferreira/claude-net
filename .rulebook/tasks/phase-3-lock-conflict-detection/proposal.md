# Proposal: phase-3-lock-conflict-detection

## Why
Prevent two agents from editing the same file or running build/test simultaneously. File locks provide mutual exclusion, conflict detector applies rules to decide when to block.

## What Changes
- Implement src/core/file-lock.ts (acquire/release lock, stale lock detection via heartbeat)
- Implement src/core/conflict-detector.ts (rules: same file edit, simultaneous build, simultaneous test)
- Update PreToolUse hook to use conflict-detector and block with exit 2

## Impact
- Affected specs: none
- Affected code: src/core/file-lock.ts, src/core/conflict-detector.ts, src/hooks/pre-tool.ts
- Breaking change: NO
- User benefit: Agents stop stepping on each other's files and competing for build/test

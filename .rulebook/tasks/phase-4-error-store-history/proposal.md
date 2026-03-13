# Proposal: phase-4-error-store-history

## Why
Share build/test errors across agents so they don't repeat failed operations. Session history enables recovery after crashes (e.g., blue screen) so agents can resume from where they stopped.

## What Changes
- Implement src/core/error-store.ts (save/query build and test errors with timestamps)
- Implement src/core/history.ts (append-only JSONL log per agent session)
- Update PostToolUse to save errors when build/test fails
- Update SessionStart to check last session state for recovery

## Impact
- Affected specs: none
- Affected code: src/core/error-store.ts, src/core/history.ts, src/hooks/post-tool.ts, src/hooks/session-start.ts
- Breaking change: NO
- User benefit: No duplicate failed builds, session recovery after crashes

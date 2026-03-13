# Proposal: phase-2-basic-hooks

## Why
Hooks are the primary integration point with Claude Code. SessionStart/End manage agent lifecycle automatically, PreToolUse detects conflicts before actions, PostToolUse logs activity.

## What Changes
- Create hooks/hooks.json with SessionStart, SessionEnd, PreToolUse, PostToolUse
- Implement src/hooks/session-start.ts (register agent in network)
- Implement src/hooks/session-end.ts (deregister agent)
- Implement src/hooks/pre-tool.ts (read stdin JSON, detect same-file conflict, exit 0 or 2)
- Implement src/hooks/post-tool.ts (log action to agent status)

## Impact
- Affected specs: none
- Affected code: new hook files + hooks.json
- Breaking change: NO
- User benefit: Agents auto-register and basic conflict detection starts working

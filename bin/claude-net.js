#!/usr/bin/env node

// Simple shim to load the compiled CLI
require('../dist/cli.js').main?.().catch(() => process.exit(1));

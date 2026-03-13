#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = pathToFileURL(join(__dirname, '../dist/cli.js')).href;

// Simple shim to load the compiled CLI
import(cliPath)
  .then((mod) => {
    if (mod.main) return mod.main();
    process.exit(1);
  })
  .catch((err) => {
    console.error('[ERROR]', err.message || err);
    process.exit(1);
  });

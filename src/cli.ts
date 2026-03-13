import { resolve } from 'node:path';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { listActiveAgents } from './core/agent-registry.js';
import { listLocks } from './core/file-lock.js';
import { listErrors } from './core/error-store.js';
import { listMessages } from './core/message-bus.js';
import { ensureDirs } from './utils/ensure-dirs.js';

const PLUGIN_HOME = resolve(homedir(), '.claude', 'plugins');
const PLUGIN_DIR = resolve(PLUGIN_HOME, 'claude-net');

async function status(): Promise<void> {
  await ensureDirs();
  const agents = await listActiveAgents();
  const locks = await listLocks();
  const errors = await listErrors(10);
  const messages = await listMessages(undefined, undefined, 10);

  console.log('\n[claude-net] Network Status\n');

  if (agents.length === 0) {
    console.log('  No active agents.\n');
  } else {
    console.log(`  Agents (${agents.length}):`);
    for (const agent of agents) {
      const task = agent.currentTask ? ` — ${agent.currentTask}` : '';
      const files = agent.filesInUse.length > 0 ? ` [files: ${agent.filesInUse.join(', ')}]` : '';
      console.log(`    • ${agent.id} (${agent.status})${task}${files}`);
    }
    console.log();
  }

  if (locks.length > 0) {
    console.log(`  Locks (${locks.length}):`);
    for (const lock of locks) {
      console.log(`    • ${lock.filePath} (${lock.agentId})`);
    }
    console.log();
  }

  if (errors.length > 0) {
    const buildErrors = errors.filter((e) => 'exitCode' in e);
    const testErrors = errors.filter((e) => 'failedTests' in e);
    if (buildErrors.length > 0) {
      console.log(`  Recent Build Errors (${buildErrors.length}):`);
      for (const err of buildErrors.slice(0, 3)) {
        console.log(`    • ${err.timestamp}: ${err.command} (${err.agentId})`);
      }
      console.log();
    }
    if (testErrors.length > 0) {
      console.log(`  Recent Test Errors (${testErrors.length}):`);
      for (const err of testErrors.slice(0, 3)) {
        console.log(`    • ${err.timestamp}: ${err.failedTests}/${err.totalTests} failed (${err.agentId})`);
      }
      console.log();
    }
  }

  if (messages.length > 0) {
    const unread = messages.filter((m) => !m.read);
    console.log(
      `  Messages: ${unread.length} unread of ${messages.length} total`,
    );
    console.log();
  }
}

async function logs(args: string[]): Promise<void> {
  const limit = parseInt(args[args.indexOf('--limit') + 1] ?? '20', 10);
  await ensureDirs();

  const messages = await listMessages(undefined, undefined, limit);
  if (messages.length === 0) {
    console.log('\n[claude-net] No messages.\n');
    return;
  }

  console.log(`\n[claude-net] Messages (${messages.length})\n`);
  for (const msg of messages) {
    const status = msg.read ? '✓' : '●';
    console.log(`${status} [${msg.timestamp}] ${msg.from} → ${msg.to}`);
    console.log(`  ${msg.subject}`);
    if (msg.content.length > 100) {
      console.log(`  ${msg.content.slice(0, 100)}...`);
    } else {
      console.log(`  ${msg.content}`);
    }
    console.log();
  }
}

async function errors_cmd(args: string[]): Promise<void> {
  const limit = parseInt(args[args.indexOf('--limit') + 1] ?? '10', 10);
  await ensureDirs();

  const errors = await listErrors(limit);
  if (errors.length === 0) {
    console.log('\n[claude-net] No errors.\n');
    return;
  }

  console.log(`\n[claude-net] Errors (${errors.length})\n`);
  for (const err of errors) {
    const type = 'exitCode' in err ? 'BUILD' : 'TEST';
    console.log(`[${err.timestamp}] ${type} — ${err.agentId}`);
    console.log(`  Command: ${err.command}`);
    if ('exitCode' in err) {
      console.log(`  Exit code: ${err.exitCode}`);
    } else {
      console.log(`  Failed: ${err.failedTests}/${err.totalTests}`);
    }
    console.log();
  }
}

async function clean(): Promise<void> {
  const { cleanupStaleAgents } = await import('./core/agent-registry.js');
  await ensureDirs();
  const cleaned = await cleanupStaleAgents();
  console.log(`\n[claude-net] Cleaned ${cleaned} stale agent(s).\n`);
}

async function install(): Promise<void> {
  try {
    mkdirSync(PLUGIN_HOME, { recursive: true });

    // Copy plugin files from dist to ~/.claude/plugins/claude-net/
    const distDir = resolve(process.cwd(), 'dist');

    if (!existsSync(distDir)) {
      console.error('[ERROR] dist/ directory not found. Run `npm run build` first.');
      process.exit(1);
    }

    // Create plugin directory
    mkdirSync(PLUGIN_DIR, { recursive: true });

    // Copy compiled files
    console.log(`[claude-net] Installing plugin to ${PLUGIN_DIR}...`);

    // Copy plugin manifest
    const manifestSrc = resolve(process.cwd(), '.claude-plugin', 'plugin.json');
    const manifestDest = resolve(PLUGIN_DIR, 'plugin.json');
    if (existsSync(manifestSrc)) {
      copyFileSync(manifestSrc, manifestDest);
      console.log('  ✓ Copied plugin.json');
    }

    // Copy hooks
    const hooksSrc = resolve(process.cwd(), 'hooks', 'hooks.json');
    const hooksDest = resolve(PLUGIN_DIR, 'hooks.json');
    if (existsSync(hooksSrc)) {
      copyFileSync(hooksSrc, hooksDest);
      console.log('  ✓ Copied hooks.json');
    }

    // Copy compiled hooks and core modules
    const copyDir = (src: string, dest: string): void => {
      mkdirSync(dest, { recursive: true });
      const { readdirSync } = require('fs');
      const { copyFileSync: copy } = require('fs');
      for (const file of readdirSync(src)) {
        copy(resolve(src, file), resolve(dest, file));
      }
    };

    copyDir(resolve(distDir, 'hooks'), resolve(PLUGIN_DIR, 'hooks'));
    copyDir(resolve(distDir, 'core'), resolve(PLUGIN_DIR, 'core'));
    copyDir(resolve(distDir, 'utils'), resolve(PLUGIN_DIR, 'utils'));
    console.log('  ✓ Copied compiled modules');

    // Register in Claude settings
    const claudeConfigPath = resolve(homedir(), '.claude', 'settings.json');
    let config: any = {};
    if (existsSync(claudeConfigPath)) {
      const content = require('fs').readFileSync(claudeConfigPath, 'utf-8');
      config = JSON.parse(content);
    }

    config.plugins = config.plugins || [];
    if (!config.plugins.includes('claude-net')) {
      config.plugins.push('claude-net');
    }

    mkdirSync(resolve(homedir(), '.claude'), { recursive: true });
    require('fs').writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Registered in ~/.claude/settings.json');

    // Create ~/.claude-net/ if not exists
    await ensureDirs();
    console.log('  ✓ Created ~/.claude-net/ directory');

    console.log('\n[claude-net] ✓ Installation complete!\n');
  } catch (error) {
    console.error('[ERROR]', (error as Error).message);
    process.exit(1);
  }
}

async function uninstall(): Promise<void> {
  const { rmSync } = require('fs');
  try {
    if (existsSync(PLUGIN_DIR)) {
      rmSync(PLUGIN_DIR, { recursive: true, force: true });
      console.log(`[claude-net] ✓ Removed plugin from ${PLUGIN_DIR}`);
    }

    // Remove from Claude settings
    const claudeConfigPath = resolve(homedir(), '.claude', 'settings.json');
    if (existsSync(claudeConfigPath)) {
      const content = require('fs').readFileSync(claudeConfigPath, 'utf-8');
      const config = JSON.parse(content);
      config.plugins = (config.plugins || []).filter((p: string) => p !== 'claude-net');
      require('fs').writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
      console.log('[claude-net] ✓ Unregistered from ~/.claude/settings.json');
    }

    console.log('\n[claude-net] ✓ Uninstall complete!\n');
  } catch (error) {
    console.error('[ERROR]', (error as Error).message);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'install':
      await install();
      break;
    case 'uninstall':
      await uninstall();
      break;
    case 'status':
      await status();
      break;
    case 'logs':
      await logs(args);
      break;
    case 'errors':
      await errors_cmd(args);
      break;
    case 'messages':
      await logs(args);
      break;
    case 'clean':
      await clean();
      break;
    case '--help':
    case '-h':
    case 'help':
      console.log(`
[claude-net] - Agent Coordination Network for Claude Code

Usage: npx claude-net <command> [options]

Commands:
  install          Install plugin globally
  uninstall        Remove plugin
  status           Show network status
  logs             Show inter-agent messages
  errors           Show recent build/test errors
  messages         Alias for logs
  clean            Clean up stale agents
  help             Show this help message
`);
      break;
    default:
      console.error(`[ERROR] Unknown command: ${command}`);
      console.log('Try: npx claude-net help');
      process.exit(1);
  }
}

main().catch(() => process.exit(1));

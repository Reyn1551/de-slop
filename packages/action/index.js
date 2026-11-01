const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { dirname, join } = require('node:path');

const actionRoot = dirname(__dirname);
const repoRoot = dirname(actionRoot);
const coreDist = join(repoRoot, 'packages/core/dist/index.js');

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(coreDist)) {
  if (!existsSync(join(repoRoot, 'node_modules'))) run('npm', ['ci'], repoRoot);
  run('npm', ['run', 'build'], repoRoot);
}

const command = process.env.INPUT_COMMAND || 'check';
const paths = (process.env.INPUT_PATHS || '.').split(/\s+/).filter(Boolean);
const strict = (process.env.INPUT_STRICT || 'false').toLowerCase() === 'true';
const cli = join(repoRoot, 'packages/cli/bin/de-slop.js');

run(process.execPath, [cli, command, ...paths, ...(strict ? ['--strict'] : [])], repoRoot);

import type { Ecosystem } from './types';

export interface InstallCommand {
  ecosystem: Ecosystem;
  packages: string[];
}

const NPM_INSTALL_PATTERN = /^(npm\s+(?:install|i)|yarn\s+add|pnpm\s+add)\s+(.+)$/;
const NPX_PATTERN = /^npx\s+(.+)$/;
const PIP_INSTALL_PATTERN = /^pip3?\s+install\s+(.+)$/;

const NPM_FLAG_PATTERN = /^-{1,2}[\w-]+/;
const PIP_FLAG_PATTERN = /^-{1,2}[\w-]+/;

function stripNpmVersion(specifier: string): string {
  if (specifier.startsWith('@')) {
    const secondAt = specifier.indexOf('@', 1);
    return secondAt === -1 ? specifier : specifier.slice(0, secondAt);
  }
  const at = specifier.indexOf('@');
  return at === -1 ? specifier : specifier.slice(0, at);
}

function stripPipVersion(specifier: string): string {
  return specifier.split(/[=<>!~[\s]/, 1)[0];
}

function parseNpmPackages(args: string): string[] {
  return args
    .split(/\s+/)
    .filter((token) => token.length > 0 && !NPM_FLAG_PATTERN.test(token))
    .map(stripNpmVersion)
    .filter((name) => name.length > 0);
}

function parsePipPackages(args: string): string[] {
  return args
    .split(/\s+/)
    .filter((token) => token.length > 0 && !PIP_FLAG_PATTERN.test(token))
    .map(stripPipVersion)
    .filter((name) => name.length > 0);
}

export function parseInstallCommand(cmd: string): InstallCommand | null {
  const trimmed = cmd.trim();

  const npmMatch = NPM_INSTALL_PATTERN.exec(trimmed);
  if (npmMatch) {
    const packages = parseNpmPackages(npmMatch[2]);
    return packages.length > 0 ? { ecosystem: 'npm', packages } : null;
  }

  const pipMatch = PIP_INSTALL_PATTERN.exec(trimmed);
  if (pipMatch) {
    const packages = parsePipPackages(pipMatch[1]);
    return packages.length > 0 ? { ecosystem: 'pypi', packages } : null;
  }

  const npxMatch = NPX_PATTERN.exec(trimmed);
  if (npxMatch) {
    const first = npxMatch[1].split(/\s+/).find((token) => !NPM_FLAG_PATTERN.test(token));
    if (!first) return null;
    const name = stripNpmVersion(first);
    return name.length > 0 ? { ecosystem: 'npm', packages: [name] } : null;
  }

  return null;
}

const BLOCKED_INSTALL_PATTERNS = [
  { pattern: /\bsudo\b/, reason: 'install with sudo — potential privilege escalation risk' },
  { pattern: /--unsafe-perm/, reason: '--unsafe-perm disables security checks during install' },
  { pattern: /--registry=/, reason: 'custom registry URL — verify trust before installing' },
  { pattern: /\bcurl\s+.*\|\s*(?:bash|sh)\b/, reason: 'curl pipe to shell — arbitrary code execution risk' },
  { pattern: /\bwget\s+.*-\s*(?:bash|sh)\b/, reason: 'wget pipe to shell — arbitrary code execution risk' },
];

export function checkInstallScript(installCommand: string): { verdict: 'allow' | 'block' | 'warn'; reason?: string } {
  const trimmed = installCommand.trim();

  for (const { pattern, reason } of BLOCKED_INSTALL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { verdict: 'block', reason };
    }
  }

  return { verdict: 'allow' };
}

import { findTyposquat } from '../package-gate/typosquat';
import type { McpFinding, McpRuleFn, McpServerEntry } from './types';

// Server names an on-path attacker can rewrite before the model reads them.
const PLAINTEXT_HOST = /^http:\/\//i;
const LOOPBACK = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

// A remote MCP server is reached over the wire, so both the tool descriptions
// and every tool result are attacker-writable if the transport is plaintext.
// The MCP security guidance treats transport integrity as a prerequisite for
// trusting a tool description at all.
export const noPlaintextRemote: McpRuleFn = (context) => {
  const findings: McpFinding[] = [];

  for (const server of context.config.servers) {
    if (server.url === undefined) continue;
    if (!PLAINTEXT_HOST.test(server.url)) continue;
    if (LOOPBACK.test(server.url)) continue;

    const line = context.locator.lineOf(server.url);
    findings.push({
      severity: 'error',
      message: `MCP server "${server.name}" is reached over plain http — tool descriptions and results travel unencrypted, so anyone on the path can inject instructions the model will follow; use https`,
      line,
      column: 1,
    });
  }

  return findings;
};

const SECRET_NAME = /(?:api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|access[_-]?key)/i;
const ENV_REFERENCE = /^\$\{?[A-Za-z_][\w]*\}?$/;

// A literal secret in an MCP config gets committed with the config. Every
// server in the file receives it at launch, including one the developer
// installed to try out.
export const noLiteralSecretEnv: McpRuleFn = (context) => {
  const findings: McpFinding[] = [];

  for (const server of context.config.servers) {
    const env = server.env ?? {};
    for (const [key, value] of Object.entries(env)) {
      if (!SECRET_NAME.test(key)) continue;
      if (value.length < 8) continue;
      if (ENV_REFERENCE.test(value.trim())) continue;
      if (/^(?:your|changeme|placeholder|example|dummy|test|xxx)/i.test(value)) continue;

      const line = context.locator.lineOf(value);
      findings.push({
        severity: 'error',
        message: `MCP server "${server.name}" stores a literal secret in env.${key} — configs get committed and every server in the file receives it; reference the environment instead (${key}: "\${${key}}")`,
        line,
        column: 1,
      });
    }
  }

  return findings;
};

const LAUNCHERS: Record<string, true> = { npx: true, bunx: true, uvx: true, pnpx: true };
const PINNED = /@(?:\^|~)?\d|@latest|==/;

function launchedPackage(server: McpServerEntry): { launcher: string; name: string } | null {
  if (server.command === undefined) return null;
  const launcher = server.command.split(/[\\/]/).pop() ?? server.command;
  if (LAUNCHERS[launcher] !== true) return null;

  const args = server.args ?? [];
  const candidate = args.find((argument) => !argument.startsWith('-'));
  if (candidate === undefined) return null;
  return { launcher, name: candidate };
}

// `npx -y foo` resolves whatever the registry serves that day. A compromised
// publish reaches the developer's machine on the next launch with no diff to
// review. Pinning is the cheap fix.
export const noUnpinnedLauncher: McpRuleFn = (context) => {
  const findings: McpFinding[] = [];

  for (const server of context.config.servers) {
    const launched = launchedPackage(server);
    if (launched === null) continue;
    if (PINNED.test(launched.name)) continue;

    const line = context.locator.lineOf(launched.name);
    findings.push({
      severity: 'warning',
      message: `MCP server "${server.name}" launches ${launched.launcher} ${launched.name} with no version — every run installs whatever the registry serves; pin it (${launched.name}@^0.4.0)`,
      line,
      column: 1,
    });
  }

  return findings;
};

// The typosquat check from package-gate, applied to the package an MCP config
// launches. An agent that wrote the config from a hallucinated name produced
// exactly this file.
export const noTyposquatLauncher: McpRuleFn = (context) => {
  const findings: McpFinding[] = [];

  for (const server of context.config.servers) {
    const launched = launchedPackage(server);
    if (launched === null) continue;

    const match = findTyposquat(launched.name.replace(/@.*$/, ''), 'npm');
    if (match === null) continue;

    const line = context.locator.lineOf(launched.name);
    findings.push({
      severity: 'error',
      message: `MCP server "${server.name}" launches "${launched.name}", which is ${match.reason} — an agent may have written a hallucinated name the attacker pre-registered`,
      line,
      column: 1,
    });
  }

  return findings;
};

const DANGEROUS_TOOL = /(?:delete|remove|destroy|drop|truncate|write|edit|patch|exec|shell|run|install|deploy|push|publish|merge)/i;

// Auto-approval removes the human from the loop for the tools that change the
// machine. The MCP guidance asks for least privilege, and an approval list
// containing a write or exec tool is the opposite of that.
export const noAutoApproveDangerous: McpRuleFn = (context) => {
  const findings: McpFinding[] = [];

  for (const server of context.config.servers) {
    const approved = server.autoApprove ?? [];
    const risky = approved.filter((tool) => tool === '*' || DANGEROUS_TOOL.test(tool));
    if (risky.length === 0) continue;

    const line = context.locator.lineOf(risky[0]);
    findings.push({
      severity: 'warning',
      message: `MCP server "${server.name}" auto-approves ${risky.join(', ')} — a tool that writes, execs, or deploys runs without a human in the loop; approve read-only tools only`,
      line,
      column: 1,
    });
  }

  return findings;
};

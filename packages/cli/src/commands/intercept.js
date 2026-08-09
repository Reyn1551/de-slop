import { checkPackages, parseInstallCommand } from '@de-slop/core';
import { parseArgs } from '../args.js';

export const help = `de-slop intercept — check packages before install

Usage: de-slop intercept '<install command>'

Parses an npm/pip/yarn/pnpm install command, queries the registry for each
package, and blocks the install when any package is suspicious or missing.

Examples:
  de-slop intercept 'npm install lodash slopsquat-package'
  de-slop intercept 'pip3 install requests'

Options:
  --no-block      Report verdicts but exit 0 regardless
  --help          Show this help

Exit code is 1 when a package is not safe to install, 0 otherwise.
`;

export default async function intercept(argv) {
  const { positional, options } = parseArgs(argv);

  if (positional.length === 0) {
    console.error('de-slop intercept: missing install command');
    console.error(help);
    return 1;
  }

  const installCommand = positional.join(' ');
  const parsed = parseInstallCommand(installCommand);
  if (parsed === null) {
    console.error(`de-slop intercept: could not parse install command: ${installCommand}`);
    return 1;
  }

  const { ecosystem, packages } = parsed;
  const reports = await checkPackages(packages, ecosystem);

  let blocked = false;
  for (const report of reports) {
    const line = `${report.ecosystem} ${report.name}: ${report.verdict}`;
    if (report.reasons.length > 0) {
      console.log(`${line} — ${report.reasons.join('; ')}`);
    } else {
      console.log(line);
    }
    if (report.verdict === 'suspicious' || report.verdict === 'not-found') {
      blocked = true;
    }
  }

  if (blocked) {
    console.error(
      'de-slop intercept: install blocked — 1+ packages failed the supply-chain gate. Re-run with --no-block to bypass.'
    );
    return options.block === false ? 0 : 1;
  }

  console.log('de-slop intercept: all packages clear');
  return 0;
}

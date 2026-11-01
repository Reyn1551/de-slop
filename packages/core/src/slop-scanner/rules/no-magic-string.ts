import { ast, type Node, type SourceFile, type StringLiteral } from '../ts-api';
import type { Diagnostic, Rule, RuleContext } from '../types';

const URL_PATTERN = /^(https?|ftp):\/\//i;
const NUMBER_PATTERN = /^\d{4,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
// "package.json", "req.body", and "bun.lockb" all match DOMAIN_PATTERN. A real
// hostname ends in a TLD, so the suffix has to be in this list. Without it the
// rule reported every dotted identifier as a hardcoded domain.
const TOP_LEVEL_DOMAINS: Record<string, true> = {
  com: true, org: true, net: true, edu: true, gov: true, mil: true, int: true,
  io: true, dev: true, app: true, ai: true, co: true, sh: true, me: true, xyz: true,
  tech: true, cloud: true, info: true, biz: true, site: true, page: true, run: true,
  id: true, sg: true, my: true, th: true, vn: true, ph: true, jp: true, kr: true,
  cn: true, tw: true, hk: true, in: true, au: true, nz: true, uk: true, de: true,
  fr: true, nl: true, be: true, es: true, it: true, se: true, no: true, fi: true,
  dk: true, pl: true, cz: true, ch: true, at: true, ie: true, pt: true, gr: true,
  ru: true, ua: true, tr: true, il: true, ae: true, sa: true, za: true, ng: true,
  ke: true, eg: true, ma: true, br: true, ar: true, cl: true, mx: true, pe: true,
  ca: true, us: true,
};

function looksLikeDomain(value: string): boolean {
  if (!DOMAIN_PATTERN.test(value)) return false;
  const suffix = value.slice(value.lastIndexOf('.') + 1).toLowerCase();
  return TOP_LEVEL_DOMAINS[suffix] === true;
}
const ERROR_LIKE_PATTERN = /[\s.,;:!?()[\]{}]/;
// An MCP config's URLs are its payload, not magic values; mcp-guard reads them.
const CONFIG_FILE_PATTERN = /(config|constant)|(?:^|\/)\.?mcp[\w.-]*\.json$/i;
// Test fixtures hold URLs, ports, and ids on purpose. Flagging them trains
// people to ignore the rule, which is worse than not running it there.
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|tests?|fixtures?)\//i;

function inSkippedContext(node: StringLiteral): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ast.isImportDeclaration(parent) || ast.isExportDeclaration(parent)) return true;
  if (ast.isJsxAttribute(parent)) return true;
  if (ast.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ast.isCallExpression(parent)) {
    const expression = parent.expression;
    if (ast.isIdentifier(expression) && expression.text === 'require') return true;
  }
  return false;
}

function inConfigFile(context?: RuleContext): boolean {
  return !!context && CONFIG_FILE_PATTERN.test(context.filePath);
}

export const noMagicString: Rule = {
  id: 'no-magic-string',
  check(sourceFile, context) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    if (context && TEST_FILE_PATTERN.test(context.filePath)) return findings;

    function visit(node: Node): void {
      if (ast.isStringLiteral(node)) {
        const value = node.text;
        if (!inSkippedContext(node)) {
          let kind: string | undefined;
          if (URL_PATTERN.test(value) && !inConfigFile(context)) {
            kind = 'URL';
          } else if (EMAIL_PATTERN.test(value)) {
            kind = 'email address';
          } else if (looksLikeDomain(value)) {
            kind = 'domain name';
          } else if (NUMBER_PATTERN.test(value)) {
            kind = 'numeric magic value';
          } else if (value.length < 4 || ERROR_LIKE_PATTERN.test(value)) {
            kind = undefined;
          }
          if (kind) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'warning',
              message: `Hardcoded ${kind} string "${value}" looks like a magic value`,
              line: position.line + 1,
              column: position.character + 1,
            });
          }
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);

    return findings;
  },
};

import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const GENERIC_NAMES = new Set(['data', 'temp', 'tmp', 'result', 'res', 'item', 'thing', 'stuff', 'obj', 'object', 'value', 'val']);

function isGeneric(name: string): boolean {
  return GENERIC_NAMES.has(name) || /^(data|temp|result|item)\d*$/.test(name);
}

// `items.filter((value) => ...)` is the callback signature, not a naming
// choice. The name comes from the call site, so flagging it asked the author to
// fight the array method. A binding in real code still gets reported.
function isCallbackParameter(node: Node): boolean {
  const parameterList = node.parent;
  if (!parameterList || !ast.isArrowFunction(parameterList) && !ast.isFunctionExpression(parameterList)) return false;
  const call = parameterList.parent;
  return ast.isCallExpression(call) && call.arguments.some((argument) => argument.pos === parameterList.pos);
}

export const noGenericName: Rule = {
  id: 'no-generic-name',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const reported = new Set<string>();

    function report(name: string, node: Node): void {
      const key = `${name}:${node.getStart()}`;
      if (reported.has(key)) return;
      reported.add(key);
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      findings.push({
        severity: 'warning',
        message: `Generic identifier '${name}' — consider a name that describes the value`,
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: Node): void {
      if (ast.isVariableDeclaration(node)) {
        const nameNode = node.name;
        if (ast.isIdentifier(nameNode) && isGeneric(nameNode.text)) {
          report(nameNode.text, node);
        }
      } else if (ast.isParameterDeclaration(node)) {
        const nameNode = node.name;
        if (ast.isIdentifier(nameNode) && isGeneric(nameNode.text) && !isCallbackParameter(node)) {
          report(nameNode.text, node);
        }
      } else if (ast.isFunctionDeclaration(node) && node.name && isGeneric(node.name.text)) {
        report(node.name.text, node);
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};

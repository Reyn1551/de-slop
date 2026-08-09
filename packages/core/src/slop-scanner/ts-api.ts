import { createRequire } from 'node:module';
import type * as Ast from 'typescript/unstable/ast' with { 'resolution-mode': 'import' };
import type * as Fs from 'typescript/unstable/fs' with { 'resolution-mode': 'import' };
import type * as Sync from 'typescript/unstable/sync' with { 'resolution-mode': 'import' };

const localRequire = createRequire(__filename);

export const ast = localRequire('typescript/unstable/ast') as typeof Ast;
export const fs = localRequire('typescript/unstable/fs') as typeof Fs;
export const sync = localRequire('typescript/unstable/sync') as typeof Sync;

export type {
  ArrowFunction,
  Block,
  CallExpression,
  Expression,
  FunctionDeclaration,
  Identifier,
  Node,
  ParameterDeclaration,
  SourceFile,
  Statement,
  VariableDeclaration,
} from 'typescript/unstable/ast' with { 'resolution-mode': 'import' };

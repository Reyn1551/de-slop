import { createRequire } from 'node:module';
import type * as Ast from 'typescript/unstable/ast' with { 'resolution-mode': 'import' };
import type * as Fs from 'typescript/unstable/fs' with { 'resolution-mode': 'import' };
import type * as Sync from 'typescript/unstable/sync' with { 'resolution-mode': 'import' };

const require = createRequire(__filename);

export const ast = require('typescript/unstable/ast') as typeof Ast;
export const fs = require('typescript/unstable/fs') as typeof Fs;
export const sync = require('typescript/unstable/sync') as typeof Sync;

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

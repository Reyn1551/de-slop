import type { Ecosystem } from './types';

// Names an attacker registers to catch a typo or a hallucinated variant of a
// package the agent meant to install. The corpus is deliberately small: every
// entry is a name whose misspelling is worth money to an attacker.
const NPM_CORPUS = [
  'react', 'react-dom', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'koa', 'fastify',
  'lodash', 'underscore', 'ramda', 'axios', 'node-fetch', 'got', 'superagent', 'request',
  'typescript', 'ts-node', 'tsx', 'esbuild', 'vite', 'webpack', 'rollup', 'parcel', 'babel',
  'jest', 'vitest', 'mocha', 'chai', 'sinon', 'cypress', 'playwright', 'puppeteer',
  'eslint', 'prettier', 'stylelint', 'commitlint', 'husky', 'lint-staged',
  'dotenv', 'cross-env', 'rimraf', 'glob', 'globby', 'chokidar', 'fs-extra', 'graceful-fs',
  'chalk', 'kleur', 'picocolors', 'ora', 'listr', 'inquirer', 'prompts', 'commander', 'yargs',
  'zod', 'yup', 'joi', 'ajv', 'class-validator', 'superstruct',
  'prisma', 'sequelize', 'typeorm', 'mongoose', 'knex', 'pg', 'mysql', 'mysql2', 'sqlite3',
  'redis', 'ioredis', 'mongodb', 'elasticsearch',
  'jsonwebtoken', 'bcrypt', 'bcryptjs', 'passport', 'oauth', 'cookie', 'cookie-parser',
  'helmet', 'cors', 'compression', 'morgan', 'winston', 'pino', 'bunyan',
  'socket.io', 'ws', 'graphql', 'apollo-server', 'urql', 'trpc',
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'less', 'styled-components', 'emotion',
  'framer-motion', 'gsap', 'three', 'd3', 'chart.js', 'recharts',
  'zustand', 'redux', 'mobx', 'recoil', 'jotai', 'immer', 'nanoid', 'uuid', 'ulid',
  'date-fns', 'dayjs', 'moment', 'luxon', 'validator', 'semver', 'slugify',
  'sharp', 'jimp', 'pdfkit', 'exceljs', 'csv-parse', 'papaparse',
  'openai', 'anthropic', 'langchain', 'chromadb', 'pinecone',
  'form-data', 'multiparty', 'busboy', 'mime', 'content-type',
  'http-proxy', 'node-cron', 'nodemailer', 'twilio', 'stripe',
];

const PYPI_CORPUS = [
  'requests', 'httpx', 'aiohttp', 'urllib3', 'beautifulsoup4', 'lxml', 'scrapy', 'selenium',
  'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'plotly', 'scikit-learn', 'statsmodels',
  'torch', 'tensorflow', 'keras', 'transformers', 'datasets', 'tokenizers', 'accelerate',
  'openai', 'anthropic', 'langchain', 'llama-index', 'sentence-transformers',
  'flask', 'django', 'fastapi', 'starlette', 'uvicorn', 'gunicorn', 'celery', 'tornado',
  'pydantic', 'sqlalchemy', 'alembic', 'psycopg2', 'pymongo', 'redis', 'boto3', 'botocore',
  'pytest', 'nose', 'mock', 'coverage', 'tox', 'black', 'flake8', 'pylint', 'mypy', 'ruff',
  'poetry', 'pipenv', 'setuptools', 'wheel', 'twine', 'virtualenv',
  'cryptography', 'pyjwt', 'bcrypt', 'passlib', 'paramiko', 'pyopenssl', 'certifi',
  'click', 'typer', 'rich', 'tqdm', 'colorama', 'loguru', 'structlog',
  'pyyaml', 'toml', 'python-dotenv', 'marshmallow', 'jsonschema',
  'pillow', 'opencv-python', 'imageio', 'moviepy', 'pydub',
  'jupyter', 'notebook', 'ipython', 'nbformat',
];

const KNOWN_SAFE = [
  'preact', 'react-dom', 'react-router', 'react-router-dom', 'react-native', 'react-redux',
  'vue-router', 'vuex', 'pinia', 'nuxt-edge', 'next-auth', 'next-seo',
  'esbuild-register', 'ts-node-dev', 'typescript-eslint', 'eslint-config-prettier',
  'jest-environment-jsdom', 'vitest-canvas-mock',
  'pg-promise', 'mysql2', 'sqlite', 'redis-mock',
  'flask-cors', 'django-rest-framework', 'fastapi-users',
  'pytest-asyncio', 'pytest-cov', 'pytest-mock',
  'numpy-financial', 'pandas-datareader',
];

const CORPUS: Record<Ecosystem, string[]> = {
  npm: NPM_CORPUS,
  pypi: PYPI_CORPUS,
};

const KNOWN_SAFE_SET = new Set(KNOWN_SAFE);

export interface TyposquatMatch {
  name: string;
  target: string;
  distance: number;
  reason: string;
}

export function normalizePackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, '')
    .replace(/[._-]/g, '');
}

/** Optimal-string-alignment distance, which treats a transposition as one edit. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
      if (
        row > 1 &&
        column > 1 &&
        a[row - 1] === b[column - 2] &&
        a[row - 2] === b[column - 1]
      ) {
        matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + 1);
      }
    }
  }

  return matrix[rows - 1][columns - 1];
}

const MINIMUM_LENGTH = 4;

export function findTyposquat(name: string, ecosystem: Ecosystem = 'npm'): TyposquatMatch | null {
  const corpus = CORPUS[ecosystem];
  const lower = name.toLowerCase();
  if (lower.length < MINIMUM_LENGTH) return null;
  if (corpus.includes(lower)) return null;
  if (KNOWN_SAFE_SET.has(lower)) return null;

  const normalized = normalizePackageName(lower);

  for (const target of corpus) {
    if (target === lower) continue;

    const targetNormalized = normalizePackageName(target);
    if (normalized === targetNormalized) {
      return {
        name,
        target,
        distance: 0,
        reason: `normalizes to "${target}" once separators and scope are stripped`,
      };
    }

    const distance = editDistance(normalized, targetNormalized);
    if (distance === 0) continue;

    const budget = targetNormalized.length >= 8 ? 2 : 1;
    if (distance <= budget && Math.abs(normalized.length - targetNormalized.length) <= budget) {
      return {
        name,
        target,
        distance,
        reason: `edit distance ${distance} from "${target}"`,
      };
    }
  }

  return null;
}

export function corpusSize(ecosystem: Ecosystem): number {
  return CORPUS[ecosystem].length;
}

export const GITHUB_ACTION_WORKFLOW = `name: de-slop

on:
  pull_request:
  push:
    branches: [main]

jobs:
  deslop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx de-slop check . --lock
`;

export const MCP_CONFIG_CURSOR = `{
  "mcpServers": {
    "de-slop": {
      "command": "npx",
      "args": ["-y", "de-slop", "mcp"],
      "env": {}
    }
  }
}
`;

export const MCP_CONFIG_CLAUDE = `{
  "mcpServers": {
    "de-slop": {
      "command": "npx",
      "args": ["-y", "de-slop", "mcp"]
    }
  }
}
`;

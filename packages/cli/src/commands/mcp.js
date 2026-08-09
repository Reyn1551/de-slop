export const help = `de-slop mcp — start the de-slop MCP server

Usage: de-slop mcp

Starts the @de-slop/mcp-server over stdio for use by MCP clients
(Cursor, Claude Code, etc.).

The server package must be built first (npm run build) and must export a
startMcpServer() function (or a default export).
`;

export default async function mcp() {
  let mod;
  try {
    mod = await import('@de-slop/mcp-server');
  } catch (err) {
    console.error(`de-slop mcp: cannot load @de-slop/mcp-server — ${err.message}`);
    console.error('Build it first with "npm run build" and make sure it exports startMcpServer().');
    return 1;
  }

  const start = mod.default ?? mod.startMcpServer ?? mod.startServer;
  if (typeof start !== 'function') {
    console.error('de-slop mcp: @de-slop/mcp-server does not export a start function (expected default export or startMcpServer()).');
    return 1;
  }

  try {
    await start();
  } catch (err) {
    console.error(`de-slop mcp: ${err.message}`);
    return 1;
  }
  return 0;
}

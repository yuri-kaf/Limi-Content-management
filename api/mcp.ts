// Vercel function for /mcp (see vercel.json). Logic lives in server/mcp.
import { createMcpEndpoint } from '../server/mcp/server.js';

const handle = createMcpEndpoint();

export default { fetch: (request: Request) => handle(request) };

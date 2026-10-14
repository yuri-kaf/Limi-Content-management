// Vercel function for /oauth/register (see vercel.json). Logic lives in server/mcp.
import { createOAuth } from '../../server/mcp/oauth.js';

const oauth = createOAuth();

export default { fetch: (request: Request) => oauth.register(request) };

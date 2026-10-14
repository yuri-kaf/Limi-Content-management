// Vercel function for /oauth/token (see vercel.json). Logic lives in server/mcp.
import { createOAuth } from '../../server/mcp/oauth.js';

const oauth = createOAuth();

export default { fetch: (request: Request) => oauth.token(request) };

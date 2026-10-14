// Vercel function for /.well-known/oauth-protected-resource[/mcp] (see vercel.json).
import { protectedResourceMetadata } from '../../server/mcp/oauth.js';

export default { fetch: (request: Request) => protectedResourceMetadata(request) };

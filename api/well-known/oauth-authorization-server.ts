// Vercel function for /.well-known/oauth-authorization-server (see vercel.json).
import { authorizationServerMetadata } from '../../server/mcp/oauth.js';

export default { fetch: (request: Request) => authorizationServerMetadata(request) };

// @vitest-environment node
import { escapeHtml, renderErrorPage, renderSignInPage, type SignInFields } from './signInPage.js';

const FIELDS: SignInFields = {
  client_id: 'client-1',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  state: '"><script>alert(1)</script>',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
  response_type: 'code',
};

describe('escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('renderSignInPage', () => {
  it('asks for the email and password and says what Claude can do', async () => {
    const res = renderSignInPage({ fields: FIELDS });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>Connect Claude to Limi</h1>');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('It never deletes anything.');
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(html).toContain('<form method="post" action="/oauth/authorize">');
  });

  it('carries the request through hidden fields, escaped', async () => {
    const html = await renderSignInPage({ fields: FIELDS }).text();
    expect(html).toContain('name="state" value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain('name="redirect_uri" value="https://claude.ai/api/mcp/auth_callback"');
  });

  it('runs no script and has no inline event handlers', async () => {
    const html = await renderSignInPage({
      fields: FIELDS, email: '"><b>', error: '<img src=x onerror=alert(1)><i>bad</i>',
    }).text();
    expect(html).not.toMatch(/<script/i);
    // No tag carries an on…= attribute; the escaped text above is not a tag.
    expect(html).not.toMatch(/<[^>]*\son[a-z]+=/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('value="&quot;&gt;&lt;b&gt;"');
    expect(html).toContain('&lt;i&gt;bad&lt;/i&gt;');
  });

  it('says where the person will return, and nothing the client claims about itself', async () => {
    const html = await renderSignInPage({ fields: FIELDS }).text();
    expect(html).toContain('return to <strong>claude.ai</strong>');
    expect(html).not.toContain('Requested by');
    const local = await renderSignInPage({
      fields: { ...FIELDS, redirect_uri: 'http://localhost:33418/callback' },
    }).text();
    expect(local).toContain('return to <strong>Claude Code on this computer</strong>');
  });

  it('shows an error when there is one', async () => {
    const html = await renderSignInPage({ fields: FIELDS, error: 'Invalid email or password.' }).text();
    expect(html).toContain('<p class="error" role="alert">Invalid email or password.</p>');
  });

  it('can never be framed', () => {
    const res = renderSignInPage({ fields: FIELDS });
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses the light and dark tokens', async () => {
    const html = await renderSignInPage({ fields: FIELDS }).text();
    expect(html).toContain('--brand: #dc2626');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('--canvas: #191919');
  });
});

describe('renderErrorPage', () => {
  it('shows the message, escaped, with the same headers', async () => {
    const res = renderErrorPage(400, 'Bad <link>');
    expect(res.status).toBe(400);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.text()).toContain('<p>Bad &lt;link&gt;</p>');
  });
});

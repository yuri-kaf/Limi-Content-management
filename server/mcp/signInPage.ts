// The one page a person sees while connecting Claude: server-rendered, no
// script at all, in the app's light and dark colours (tailwind.config.js).

/** The OAuth request, carried through the form as hidden fields. */
export interface SignInFields {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  response_type: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// No script may run, the page may not be framed, and nothing but Google Fonts
// loads. form-action is left unset on purpose: Chrome applies it to the
// redirect after the POST, which would block the return to Claude.
const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Tokens from tailwind.config.js: canvas, tint, hairline, ink, brand, focus.
const STYLE = `
:root {
  color-scheme: light dark;
  --canvas: #ffffff; --tint: #f7f7f5; --hairline: #eae9e5;
  --ink: #37352f; --ink-soft: #52514c; --ink-faint: #6b6a65;
  --brand: #dc2626; --brand-hover: #b91c1c; --brand-text: #b91c1c; --brand-soft: #fdf2f2;
  --focus: #37352f;
}
@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #191919; --tint: #252525; --hairline: #333333;
    --ink: #e9e9e7; --ink-soft: #b4b4b0; --ink-faint: #999995;
    --brand-text: #f87171; --brand-soft: #2a1414;
    --focus: #e9e9e7;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px 16px; background: var(--tint); color: var(--ink);
  font: 15px/1.5 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
}
main {
  width: 100%; max-width: 400px; background: var(--canvas);
  border: 1px solid var(--hairline); border-radius: 12px; padding: 32px 28px;
}
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
.mark {
  width: 32px; height: 32px; border-radius: 6px; background: var(--brand); color: #ffffff;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 17px;
}
.word { font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
h1 { font-size: 20px; line-height: 1.3; margin: 0 0 8px; font-weight: 600; }
p { margin: 0 0 16px; color: var(--ink-soft); }
.small { font-size: 13px; color: var(--ink-faint); }
label { display: block; font-size: 13px; font-weight: 500; margin: 16px 0 6px; }
input[type=email], input[type=password] {
  width: 100%; min-height: 44px; padding: 10px 12px; font: inherit; color: var(--ink);
  background: var(--canvas); border: 1px solid var(--hairline); border-radius: 6px;
}
input:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
button {
  width: 100%; min-height: 44px; margin-top: 24px; border: 0; border-radius: 6px; cursor: pointer;
  background: var(--brand); color: #ffffff; font: inherit; font-weight: 600;
}
button:hover { background: var(--brand-hover); }
.error {
  margin: 16px 0 0; padding: 10px 12px; border-radius: 6px;
  background: var(--brand-soft); color: var(--brand-text); font-size: 14px;
}
`;

function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="brand"><span class="mark" aria-hidden="true">L</span><span class="word">limi</span></div>
${body}
</main>
</body>
</html>`;
  return new Response(html, { status, headers: HEADERS });
}

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Where signing in sends the person, named from the redirect itself. The
 * client_name a client registers is its own claim, so the page never shows it.
 */
export function returnLabel(redirectUri: string): string {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === 'http:' && LOOPBACK.includes(url.hostname)) return 'Claude Code on this computer';
    return url.hostname;
  } catch {
    return 'Claude';
  }
}

export function renderSignInPage({
  fields,
  email = '',
  error = '',
}: {
  fields: SignInFields;
  email?: string;
  error?: string;
}): Response {
  const hidden = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join('\n');
  const body = `<h1>Connect Claude to Limi</h1>
<p>Sign in with your Limi email and password. Claude will see the clients, posts, campaigns and ideas you can see, and, after asking you, can add posts, comments and ideas, move posts and record reviews. It never deletes anything.</p>
<p class="small">After you sign in, you’ll return to <strong>${escapeHtml(returnLabel(fields.redirect_uri))}</strong>.</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/oauth/authorize">
${hidden}
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in and connect</button>
</form>`;
  return page('Connect Claude to Limi', body, 200);
}

export function renderErrorPage(status: number, message: string): Response {
  return page('Limi', `<h1>Can't connect</h1>\n<p>${escapeHtml(message)}</p>`, status);
}

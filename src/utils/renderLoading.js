/**
 * Renders the loading/redirect screen with a server-controlled redirect URL baked in.
 *
 * The template uses the placeholder token __NEXT_URL__ which is replaced here
 * before the HTML is sent to the browser.  This means the redirect target is
 * NEVER read from a client-supplied query parameter — eliminating open-redirect
 * and XSS vectors entirely.
 *
 * @param {string} nextUrl  The URL to redirect to.
 *                          Must be a server-constructed value (Discord or Roblox OAuth URL,
 *                          or a same-origin path).
 * @param {'discord'|'roblox'} _type  Unused — kept for call-site compatibility.
 * @returns {string} Full HTML page ready to send via res.send()
 */

const fs   = require('fs');
const path = require('path');

// Read the template once at startup and cache it.
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'views', 'loading.html');

let TEMPLATE;
try {
  TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (err) {
  throw new Error(
    `[renderLoading] Could not read loading template at "${TEMPLATE_PATH}": ${err.message}`
  );
}

function renderLoading(nextUrl, _type) {
  // JSON.stringify safely escapes all characters that could break out of a JS
  // string literal (quotes, backslashes, control characters, etc.).
  return TEMPLATE
    .replace('__NEXT_URL__', JSON.stringify(nextUrl));
}

module.exports = { renderLoading };

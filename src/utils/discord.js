/**
 * Discord API helpers for the Linked Roles / Role Connections flow.
 *
 * Key endpoints used:
 *   POST /oauth2/token               – exchange code or refresh token
 *   GET  /users/@me                  – get the authenticated user's profile
 *   PUT  /users/@me/applications/:id/role-connection  – push user metadata
 *   PUT  /applications/:id/role-connections/metadata  – register metadata schema
 */

const axios = require('axios');

const BASE = 'https://discord.com/api/v10';

// ── OAuth token exchange ───────────────────────────────────────────────────────

/**
 * Exchange an authorization code for an access + refresh token pair.
 * @param {string} code
 * @param {string} redirectUri  Must exactly match what was sent in the authorize URL.
 */
async function getDiscordTokens(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const { data } = await axios.post(`${BASE}/oauth2/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

/**
 * Use a refresh token to obtain a new access token without re-prompting the user.
 * @param {string} refreshToken
 */
async function refreshDiscordToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const { data } = await axios.post(`${BASE}/oauth2/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

// ── User info ─────────────────────────────────────────────────────────────────

/**
 * Fetch the Discord user object for the given access token.
 * @param {string} accessToken
 */
async function getDiscordUser(accessToken) {
  const { data } = await axios.get(`${BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

// ── Role Connections (Linked Roles) ───────────────────────────────────────────

/**
 * Push verified metadata to Discord for a specific user.
 * This is what actually triggers the Linked Role grant / check.
 *
 * @param {string} accessToken      User's Bearer token (must have role_connections.write scope)
 * @param {string} platformName     Display name of the external platform, e.g. "Roblox"
 * @param {string} platformUsername The user's username on that platform
 * @param {object} metadata         Key/value pairs matching the registered metadata schema
 */
async function updateRoleConnection(accessToken, platformName, platformUsername, metadata) {
  const { data } = await axios.put(
    `${BASE}/users/@me/applications/${process.env.DISCORD_CLIENT_ID}/role-connection`,
    { platform_name: platformName, platform_username: platformUsername, metadata },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

// ── Metadata schema registration (run once via scripts/register.js) ───────────

/**
 * Register the application's role-connection metadata schema with Discord.
 * Must be called at least once before the bot can push user metadata.
 *
 * Metadata types:
 *   6 = BOOLEAN_EQUAL  (used here — "verified is equal to true")
 *
 * Run with:  npm run register
 */
async function registerMetadata() {
  const schema = [
    {
      key: 'verified',
      name: 'Roblox Verified',
      description: 'Has linked a Roblox account',
      type: 6, // BOOLEAN_EQUAL
    },
  ];

  const { data } = await axios.put(
    `${BASE}/applications/${process.env.DISCORD_CLIENT_ID}/role-connections/metadata`,
    schema,
    {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
}

module.exports = {
  getDiscordTokens,
  refreshDiscordToken,
  getDiscordUser,
  updateRoleConnection,
  registerMetadata,
};

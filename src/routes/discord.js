/**
 * Discord OAuth routes.
 *
 * GET /discord/verify   – kick off the Discord OAuth flow
 * GET /discord/callback – handle the code returned by Discord
 *
 * After a successful Discord auth we redirect the user through the loading
 * screen and then on to Roblox OAuth.
 *
 * Scopes requested: identify email role_connections.write
 *   - identify           : read the user's ID and username
 *   - email              : read the user's verified email address (required)
 *   - role_connections.write : push metadata for the Linked Role check
 *
 * The Discord access/refresh tokens and email are carried forward in the
 * short-lived Roblox state entry and are NOT written to users.json until
 * Roblox verification succeeds in /roblox/callback.
 */

const crypto = require('crypto');
const express = require('express');
const { getDiscordTokens, getDiscordUser } = require('../utils/discord');
const { saveState, getState, deleteState } = require('../storage');
const { renderLoading } = require('../utils/renderLoading');

const router = express.Router();

// ── Step 1: Start Discord OAuth ───────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const state = crypto.randomUUID();
  saveState(state, { type: 'discord_oauth' });

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email role_connections.write',
    state,
  });

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params}`;

  // Render loading screen with the Discord OAuth URL baked in server-side.
  // The URL is never read from a client-supplied query parameter.
  res.send(renderLoading(discordAuthUrl, 'discord'));
});

// ── Step 2: Discord OAuth callback ────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(
      `/error.html?message=${encodeURIComponent('Discord authorization was denied.')}`
    );
  }

  if (!code || !state) {
    return res.redirect('/error.html?message=Missing+callback+parameters');
  }

  // Validate and consume the Discord CSRF state token (single-use).
  const discordStateData = getState(state);
  if (!discordStateData || discordStateData.type !== 'discord_oauth') {
    return res.redirect('/error.html?message=Invalid+or+expired+session.+Please+start+over.');
  }
  deleteState(state);

  try {
    // Exchange the one-time code for a long-lived access + refresh token pair
    const tokens = await getDiscordTokens(code, process.env.DISCORD_REDIRECT_URI);
    const discordUser = await getDiscordUser(tokens.access_token);

    // A verified email address is required — reject unverified or missing emails.
    // discordUser.verified is a boolean from Discord's API; check strictly.
    if (!discordUser.email || discordUser.verified !== true) {
      return res.redirect(
        `/error.html?message=${encodeURIComponent('A verified Discord email address is required to complete verification.')}`
      );
    }

    // Carry the tokens and email forward in the Roblox state entry.
    // Nothing is written to users.json yet — email is only stored once
    // Roblox verification succeeds in /roblox/callback.
    const robloxState = crypto.randomUUID();
    saveState(robloxState, {
      type: 'roblox_oauth',
      discordId: discordUser.id,
      discordEmail: discordUser.email,
      discordAccessToken: tokens.access_token,
      discordRefreshToken: tokens.refresh_token,
      // Store as an absolute timestamp so we can check expiry later
      discordTokenExpiry: Date.now() + tokens.expires_in * 1000,
    });

    const robloxParams = new URLSearchParams({
      client_id: process.env.ROBLOX_CLIENT_ID,
      redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile',
      state: robloxState,
    });

    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?${robloxParams}`;

    // Render loading screen with the Roblox OAuth URL baked in server-side.
    res.send(renderLoading(robloxAuthUrl, 'roblox'));
  } catch (err) {
    console.error('[discord/callback]', err?.response?.data ?? err.message);
    res.redirect('/error.html?message=Failed+to+authenticate+with+Discord');
  }
});

module.exports = router;

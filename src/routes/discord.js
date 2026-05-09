/**
 * Discord OAuth routes.
 *
 * GET /discord/verify   – kick off the Discord OAuth flow
 * GET /discord/callback – handle the code returned by Discord
 *
 * After a successful Discord auth we redirect the user through the loading
 * screen and then on to Roblox OAuth.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDiscordTokens, getDiscordUser } = require('../utils/discord');
const { saveUser, saveState } = require('../storage');

const router = express.Router();

// ── Step 1: Start Discord OAuth ───────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const state = uuidv4();
  saveState(state, { type: 'discord_oauth' });

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify role_connections.write',
    state,
  });

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params}`;

  // Show animated loading screen, then forward to Discord
  res.redirect(`/loading.html?next=${encodeURIComponent(discordAuthUrl)}&type=discord`);
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

  try {
    // Exchange the one-time code for a long-lived access + refresh token pair
    const tokens = await getDiscordTokens(code, process.env.DISCORD_REDIRECT_URI);
    const discordUser = await getDiscordUser(tokens.access_token);

    // Persist the Discord token set keyed by user ID
    saveUser(discordUser.id, {
      discordUsername: discordUser.username,
      discordAvatar: discordUser.avatar,
      discordAccessToken: tokens.access_token,
      discordRefreshToken: tokens.refresh_token,
      // Store as an absolute timestamp so we can check expiry later
      discordTokenExpiry: Date.now() + tokens.expires_in * 1000,
    });

    // Generate a fresh state for the Roblox OAuth leg, carrying the Discord ID forward
    const robloxState = uuidv4();
    saveState(robloxState, { type: 'roblox_oauth', discordId: discordUser.id });

    const robloxParams = new URLSearchParams({
      client_id: process.env.ROBLOX_CLIENT_ID,
      redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile',
      state: robloxState,
    });

    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?${robloxParams}`;

    // Show loading screen again while we transition to Roblox OAuth
    res.redirect(`/loading.html?next=${encodeURIComponent(robloxAuthUrl)}&type=roblox`);
  } catch (err) {
    console.error('[discord/callback]', err?.response?.data ?? err.message);
    res.redirect('/error.html?message=Failed+to+authenticate+with+Discord');
  }
});

module.exports = router;

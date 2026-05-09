/**
 * Roblox OAuth callback route.
 *
 * GET /roblox/callback – receives the code from Roblox, fetches user info,
 *                        then pushes verified metadata to Discord.
 *
 * This is the final step of the Linked Roles flow.  After this handler
 * completes Discord will automatically evaluate the metadata and grant (or
 * deny) any Linked Role whose requirements match.
 *
 * The Discord tokens and email address are read from the short-lived state
 * entry created in /discord/callback.  The Roblox access token is used once
 * to fetch identity via /userinfo and is never stored.
 */

const express = require('express');
const { getRobloxTokens, getRobloxUser } = require('../utils/roblox');
const { updateRoleConnection, refreshDiscordToken } = require('../utils/discord');
const { getState, deleteState, getUser, saveUser } = require('../storage');

const router = express.Router();

// Refresh the Discord token if it expires within this many milliseconds.
const TOKEN_REFRESH_BUFFER_MS = 60_000;

// ── Step 3: Roblox OAuth callback → update Discord metadata ──────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(
      `/error.html?message=${encodeURIComponent('Roblox authorization was denied.')}`
    );
  }

  if (!code || !state) {
    return res.redirect('/error.html?message=Missing+callback+parameters');
  }

  // Validate and consume the state token
  const stateData = getState(state);
  if (!stateData || stateData.type !== 'roblox_oauth') {
    return res.redirect('/error.html?message=Invalid+or+expired+session.+Please+start+over.');
  }

  const {
    discordId,
    discordEmail,
    discordAccessToken,
    discordRefreshToken,
    discordTokenExpiry,
  } = stateData;
  deleteState(state); // single-use

  try {
    // Exchange the Roblox code for tokens.
    // The access token is used only for the /userinfo call below and is not stored.
    const robloxTokens = await getRobloxTokens(code, process.env.ROBLOX_REDIRECT_URI);
    const robloxUser = await getRobloxUser(robloxTokens.access_token);
    // robloxTokens.access_token is intentionally discarded after this point.

    // Resolve username — Roblox returns these fields via OIDC userinfo
    const robloxUsername = robloxUser.preferred_username ?? robloxUser.name ?? 'Unknown';

    // Resolve the Discord access token, refreshing silently if it is about to expire.
    // Refreshed tokens are kept in local scope only — not written to storage.
    let accessToken = discordAccessToken;
    if (Date.now() >= discordTokenExpiry - TOKEN_REFRESH_BUFFER_MS) {
      const refreshed = await refreshDiscordToken(discordRefreshToken);
      accessToken = refreshed.access_token;
    }

    // Push metadata to Discord — this is what triggers the Linked Role check.
    // Discord's BOOLEAN_EQUAL type expects the string "1" for true.
    const DISCORD_BOOLEAN_TRUE = '1';
    await updateRoleConnection(
      accessToken,
      'Roblox',       // platform_name (shown in Discord profile)
      robloxUsername, // platform_username
      { verified: DISCORD_BOOLEAN_TRUE }
    );

    // Persist the final verified record.  Email and Roblox identity are written
    // only after the role-connection push succeeds.  Existing alts are preserved
    // so that re-verification does not clear staff documentation.
    const existing = getUser(discordId);
    saveUser(discordId, {
      discordEmail,
      robloxUserId: robloxUser.sub,
      robloxUsername,
      verifiedAt: new Date().toISOString(),
      alts: existing?.alts ?? [],
    });

    res.redirect('/success.html');
  } catch (err) {
    console.error('[roblox/callback]', err?.response?.data ?? err.message);
    res.redirect('/error.html?message=Failed+to+verify+your+Roblox+account');
  }
});

module.exports = router;

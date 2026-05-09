/**
 * Roblox OAuth callback route.
 *
 * GET /roblox/callback – receives the code from Roblox, fetches user info,
 *                        then pushes verified metadata to Discord.
 *
 * This is the final step of the Linked Roles flow.  After this handler
 * completes Discord will automatically evaluate the metadata and grant (or
 * deny) any Linked Role whose requirements match.
 */

const express = require('express');
const { getRobloxTokens, getRobloxUser } = require('../utils/roblox');
const { updateRoleConnection, refreshDiscordToken } = require('../utils/discord');
const { getState, deleteState, getUser, saveUser } = require('../storage');

const router = express.Router();

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

  const { discordId } = stateData;
  deleteState(state); // single-use

  try {
    // Exchange the Roblox code for tokens
    const robloxTokens = await getRobloxTokens(code, process.env.ROBLOX_REDIRECT_URI);
    const robloxUser = await getRobloxUser(robloxTokens.access_token);

    // Resolve username — Roblox returns these fields via OIDC userinfo
    const robloxUsername = robloxUser.preferred_username ?? robloxUser.name ?? 'Unknown';

    // Persist Roblox identity alongside the existing Discord record
    saveUser(discordId, {
      robloxId: robloxUser.sub,
      robloxUsername,
      robloxDisplayName: robloxUser.name ?? robloxUsername,
      verifiedAt: new Date().toISOString(),
    });

    // Retrieve stored Discord tokens, refreshing if necessary
    let userData = getUser(discordId);
    if (!userData?.discordAccessToken) {
      return res.redirect(
        '/error.html?message=Discord+session+expired.+Please+start+over.'
      );
    }

    let accessToken = userData.discordAccessToken;

    // Proactively refresh if the token expires within the next 60 seconds
    if (Date.now() >= userData.discordTokenExpiry - 60_000) {
      const refreshed = await refreshDiscordToken(userData.discordRefreshToken);
      saveUser(discordId, {
        discordAccessToken: refreshed.access_token,
        discordRefreshToken: refreshed.refresh_token,
        discordTokenExpiry: Date.now() + refreshed.expires_in * 1000,
      });
      accessToken = refreshed.access_token;
    }

    // Push metadata to Discord — this is what triggers the Linked Role check.
    // Discord's BOOLEAN_EQUAL type expects the string "1" for true.
    const DISCORD_BOOLEAN_TRUE = '1';
    await updateRoleConnection(
      accessToken,
      'Roblox',              // platform_name (shown in Discord profile)
      robloxUsername,        // platform_username
      { verified: DISCORD_BOOLEAN_TRUE }
    );

    res.redirect('/success.html');
  } catch (err) {
    console.error('[roblox/callback]', err?.response?.data ?? err.message);
    res.redirect('/error.html?message=Failed+to+verify+your+Roblox+account');
  }
});

module.exports = router;

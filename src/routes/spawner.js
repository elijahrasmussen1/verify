/**
 * Spawner admin routes — Discord-ID-gated panel for sending game commands.
 *
 * GET /spawner           – gate: start Discord OAuth if not authed, else serve the panel
 * GET /spawner/callback  – OAuth return: check Discord ID, set session, redirect
 *
 * Only Discord user ID 1182265710248996874 is allowed through.
 * All others are bounced back to /.
 */

const crypto  = require('crypto');
const express = require('express');
const path    = require('path');
const { getDiscordTokens, getDiscordUser } = require('../utils/discord');
const { saveState, getState, deleteState } = require('../storage');
const { renderLoading } = require('../utils/renderLoading');

const router = express.Router();

const ALLOWED_ID       = '1182265710248996874';
const SESSION_KEY      = 'spawnerAuthed';
const SPAWNER_HTML     = path.join(__dirname, '..', '..', 'public', 'spawner.html');

// ── GET /spawner ──────────────────────────────────────────────────────────────
// If the session is already marked as authed, serve the panel directly.
// Otherwise kick off a Discord OAuth flow scoped to `identify` only.
router.get('/', (req, res) => {
  if (req.session[SESSION_KEY] === true) {
    return res.sendFile(SPAWNER_HTML);
  }

  const state = crypto.randomUUID();
  saveState(state, { type: 'spawner_oauth' });

  const redirectUri = `${process.env.BASE_URL}/spawner/callback`;

  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'identify',
    state,
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params}`;
  res.send(renderLoading(authUrl, 'discord'));
});

// ── GET /spawner/callback ─────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/');
  }

  if (!code || !state) {
    return res.redirect('/');
  }

  const stateData = getState(state);
  if (!stateData || stateData.type !== 'spawner_oauth') {
    return res.redirect('/');
  }
  deleteState(state);

  try {
    const redirectUri = `${process.env.BASE_URL}/spawner/callback`;
    const tokens      = await getDiscordTokens(code, redirectUri);
    const user        = await getDiscordUser(tokens.access_token);

    if (user.id !== ALLOWED_ID) {
      return res.redirect('/');
    }

    req.session[SESSION_KEY] = true;
    res.redirect('/spawner');
  } catch (err) {
    console.error('[spawner/callback]', err?.response?.data ?? err.message);
    res.redirect('/');
  }
});

module.exports = router;

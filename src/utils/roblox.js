/**
 * Roblox OAuth 2.0 helpers.
 *
 * Endpoints:
 *   POST https://apis.roblox.com/oauth/v1/token     – exchange code for tokens
 *   GET  https://apis.roblox.com/oauth/v1/userinfo  – fetch user profile
 *
 * Scopes requested: profile
 *
 * Useful fields returned by /userinfo:
 *   sub                – Roblox user ID (string)
 *   preferred_username – Roblox username
 *   name               – Roblox display name
 *   picture            – headshot image URL
 */

const axios = require('axios');

const ROBLOX_BASE = 'https://apis.roblox.com/oauth/v1';

/**
 * Exchange an authorization code for Roblox OAuth tokens.
 * @param {string} code
 * @param {string} redirectUri  Must exactly match the redirect URI in your Roblox app settings.
 */
async function getRobloxTokens(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.ROBLOX_CLIENT_ID,
    client_secret: process.env.ROBLOX_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const { data } = await axios.post(`${ROBLOX_BASE}/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

/**
 * Fetch the authenticated Roblox user's profile.
 * @param {string} accessToken
 */
async function getRobloxUser(accessToken) {
  const { data } = await axios.get(`${ROBLOX_BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

module.exports = { getRobloxTokens, getRobloxUser };

# AquaForge Verify

Discord **Linked Roles** verification bridge for **Roblox** — built for *Survive Water for Brainrots*.

Users connect their Roblox account to Discord. The backend verifies the link and pushes metadata to Discord, which then automatically grants a **Linked Role** to verified members — no slash commands involved.

---

## How it works (full flow)

```
User
 │
 ├─1─► GET /discord/verify
 │       Generate OAuth state, redirect through loading screen
 │       → Discord OAuth2 (scopes: identify + role_connections.write)
 │
 ├─2─► GET /discord/callback  (Discord redirects here)
 │       Exchange code → access + refresh tokens
 │       Store Discord tokens keyed by Discord user ID
 │       Generate Roblox OAuth state (carrying Discord ID)
 │       Redirect through loading screen
 │       → Roblox OAuth2 (scopes: openid + profile)
 │
 ├─3─► GET /roblox/callback  (Roblox redirects here)
 │       Validate state → recover Discord user ID
 │       Exchange code → Roblox access token
 │       GET /userinfo → Roblox username + user ID
 │       Refresh Discord token if needed
 │       PUT /users/@me/applications/:id/role-connection
 │         { platform_name: "Roblox", platform_username: "...", metadata: { verified: "1" } }
 │
 └─4─► /success.html
         Discord evaluates metadata against the Linked Role requirements
         → Role granted automatically ✓
```

### Why two loading screens?

The loading page (`views/loading.html`) appears **twice** during the flow:

1. **Before Discord OAuth** — rendered by `GET /discord/verify` while the browser is about to leave your site.
2. **After Discord, before Roblox OAuth** — rendered by `GET /discord/callback` to smooth the transition between the two providers.

The redirect target URL is **injected server-side** by `src/utils/renderLoading.js` using `JSON.stringify`, so it is never read from a client-supplied query parameter. This eliminates open-redirect and XSS risk from the loading screen.

---

## Folder structure

```
verify/
├── index.js                  Express entry point / landing page
├── package.json
├── .env.example              Copy → .env and fill in your secrets
├── .gitignore
│
├── src/
│   ├── storage.js            JSON-file storage (users + OAuth states)
│   ├── routes/
│   │   ├── discord.js        GET /discord/verify + /discord/callback
│   │   └── roblox.js         GET /roblox/callback
│   └── utils/
│       ├── discord.js        Discord API helpers + metadata registration
│       └── roblox.js         Roblox OAuth helpers
│
├── scripts/
│   └── register.js           One-shot metadata schema registration CLI
│
├── public/
│   ├── loading.html          Animated water loading/redirect screen
│   ├── success.html          Post-verification success page
│   └── error.html            Error page
│
└── data/                     Auto-created; holds users.json + states.json
    └── .gitkeep
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | `node --version` |
| A Discord Application | [discord.com/developers](https://discord.com/developers/applications) |
| A Roblox OAuth Application | [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) |
| ngrok (local testing) | [ngrok.com](https://ngrok.com) — free tier works |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

| Variable | Where to find it |
|---|---|
| `DISCORD_CLIENT_ID` | Discord app → General Information |
| `DISCORD_CLIENT_SECRET` | Discord app → OAuth2 |
| `DISCORD_BOT_TOKEN` | Discord app → Bot → Reset Token |
| `DISCORD_REDIRECT_URI` | Must match exactly what you add in Discord app → OAuth2 → Redirects |
| `ROBLOX_CLIENT_ID` | Roblox dashboard → Credentials |
| `ROBLOX_CLIENT_SECRET` | Roblox dashboard → Credentials |
| `ROBLOX_REDIRECT_URI` | Must match your Roblox app's allowed redirect URIs |
| `SESSION_SECRET` | Any long random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BASE_URL` | Your public URL (ngrok URL for local testing) |

### 3. Configure your Discord application

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. **OAuth2 → Redirects** — add `http://localhost:3000/discord/callback` (or your ngrok URL).
2. **Bot** — make sure the bot is added to your server.
3. **Linked Roles** — this is configured *after* step 4 below.

### 4. Register the metadata schema (run once)

```bash
npm run register
```

This calls Discord's API to register the `verified` (boolean) metadata field for your application. Only needs to be run once (or again if you change the schema).

You should see:

```
✅ Metadata registered successfully!
[{ "key": "verified", "name": "Roblox Verified", ... }]
```

### 5. Set up the Linked Role in Discord

1. Go to **Server Settings → Linked Roles**.
2. Create a new Linked Role (e.g. "Verified").
3. Select your application and set the requirement: **"Roblox Verified is equal to True"**.
4. Assign this Linked Role to a Discord role in your server.

### 6. Configure your Roblox OAuth application

In the [Roblox Creator Dashboard](https://create.roblox.com/dashboard/credentials):

1. Create a new OAuth 2.0 application.
2. Add `http://localhost:3000/roblox/callback` (or your ngrok URL) as an allowed redirect URI.
3. Enable scopes: `openid`, `profile`.
4. Copy the Client ID and Secret into `.env`.

### 7. Start the server

```bash
npm start
```

Visit `http://localhost:3000` → click **Connect with Discord** → follow the flow.

---

## Local testing with ngrok

```bash
# In a separate terminal
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL and:

- Update `BASE_URL` in `.env`
- Update `DISCORD_REDIRECT_URI` to `https://xxxx.ngrok.io/discord/callback`
- Update `ROBLOX_REDIRECT_URI` to `https://xxxx.ngrok.io/roblox/callback`
- Add the ngrok URL as a redirect in both the Discord and Roblox dashboards
- Restart the server (`npm start`)

---

## Production notes

- Set `cookie.secure = true` in `index.js` when running behind HTTPS.
- Rotate `SESSION_SECRET` via environment variable — never commit it.
- The `data/` directory holds user tokens in plain JSON. For a public deployment, consider encrypting token values at rest or migrating to MongoDB.
- Re-run `npm run register` any time you change the metadata schema.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `redirect_uri mismatch` | The URI in `.env` doesn't match what's registered in the Discord / Roblox dashboard exactly (including protocol and trailing slashes). |
| `Invalid or expired session` | More than 15 minutes elapsed between the Discord callback and the Roblox callback. Refresh and try again. |
| Role not appearing | Metadata was pushed but Discord takes up to ~1 minute to evaluate it. Also check that the Linked Role requirement is set to "Roblox Verified is equal to True". |
| `Failed to verify Discord account` | Check that `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_SECRET` are correct. |
| `npm run register` fails | Ensure `DISCORD_BOT_TOKEN` is for a bot (not a user token) and the bot belongs to your application. |
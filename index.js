require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const discordRoutes = require('./src/routes/discord');
const robloxRoutes = require('./src/routes/roblox');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aquaforge-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true when serving over HTTPS in production
      httpOnly: true,
      maxAge: 1000 * 60 * 15, // 15 minutes
    },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/discord', discordRoutes);
app.use('/roblox', robloxRoutes);

// Landing page — entry point for the user
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AquaForge — Verify</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #07111e; color: #e0eaf5;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: center; }
    .card { text-align: center; padding: 48px 40px; max-width: 420px; width: 90%; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 26px; font-weight: 700; color: #c8dff0; margin-bottom: 6px; }
    p { font-size: 14px; color: #5a8aa8; margin-bottom: 32px; line-height: 1.6; }
    a.btn { display: inline-block; background: #5865F2; color: #fff;
      padding: 13px 28px; border-radius: 8px; text-decoration: none;
      font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
      transition: opacity .2s; }
    a.btn:hover { opacity: .85; }
    .note { margin-top: 20px; font-size: 11px; color: #3d5c70; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">💧</div>
    <h1>AquaForge Verify</h1>
    <p>Link your Roblox account to Discord to unlock the<br><strong>Verified</strong> Linked Role in our server.</p>
    <a class="btn" href="/discord/verify">Connect with Discord</a>
    <div class="note">An AquaForge Dev will NEVER ask for your password.</div>
  </div>
</body>
</html>`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌊 AquaForge Verify running → http://localhost:${PORT}\n`);
});

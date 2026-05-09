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

// Fail fast if SESSION_SECRET is not configured in production.
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production without a secure session secret.');
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aquaforge-dev-secret-do-not-use-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Enable the Secure flag automatically in production (HTTPS required).
      // For local development leave it off so http://localhost still works.
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 15, // 15 minutes
    },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/discord', discordRoutes);
app.use('/roblox', robloxRoutes);

// Entry point — immediately start the Discord OAuth flow (loading screen → Discord auth).
app.get('/', (_req, res) => {
  res.redirect('/discord/verify');
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌊 AquaForge Verify running → http://localhost:${PORT}\n`);
});

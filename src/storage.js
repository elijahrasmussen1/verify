/**
 * Simple JSON-file storage for user records and ephemeral OAuth states.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  data/users.json   – keyed by Discord user ID           │
 * │  data/states.json  – keyed by random state string       │
 * └─────────────────────────────────────────────────────────┘
 *
 * For production consider encrypting the token values at rest.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATES_FILE = path.join(DATA_DIR, 'states.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(file) {
  ensureDir();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function write(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── User storage ──────────────────────────────────────────────────────────────

/**
 * Retrieve a user record by Discord ID, or null if not found.
 * @param {string} discordId
 */
function getUser(discordId) {
  return read(USERS_FILE)[discordId] ?? null;
}

/**
 * Upsert fields into a user record keyed by Discord ID.
 * @param {string} discordId
 * @param {object} fields
 */
function saveUser(discordId, fields) {
  const users = read(USERS_FILE);
  users[discordId] = {
    ...users[discordId],
    ...fields,
    discordId,
    updatedAt: new Date().toISOString(),
  };
  write(USERS_FILE, users);
  return users[discordId];
}

// ── OAuth state storage (short-lived) ─────────────────────────────────────────

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Persist an OAuth state value alongside arbitrary metadata.
 * @param {string} state  UUID generated per-flow
 * @param {object} data   Metadata to attach (e.g. discordId, type)
 */
function saveState(state, data) {
  const states = read(STATES_FILE);
  const now = Date.now();

  // Prune stale states to keep the file tidy
  for (const [key, val] of Object.entries(states)) {
    if (now - val.createdAt > STATE_TTL_MS) delete states[key];
  }

  states[state] = { ...data, createdAt: now };
  write(STATES_FILE, states);
}

/**
 * Look up a state entry. Returns null if not found or expired.
 * @param {string} state
 */
function getState(state) {
  const entry = read(STATES_FILE)[state];
  if (!entry) return null;
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    deleteState(state);
    return null;
  }
  return entry;
}

/**
 * Remove a state entry (call after it has been consumed).
 * @param {string} state
 */
function deleteState(state) {
  const states = read(STATES_FILE);
  delete states[state];
  write(STATES_FILE, states);
}

module.exports = { getUser, saveUser, saveState, getState, deleteState };

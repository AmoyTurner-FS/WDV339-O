require("dotenv").config();
const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;

const db = new sqlite3.Database(path.join(__dirname, "data.db"));
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id TEXT UNIQUE,
      display_name TEXT,
      email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
});

function upsertUser(u) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      `
      INSERT INTO users (spotify_id, display_name, email, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(spotify_id) DO UPDATE SET
        display_name=excluded.display_name,
        email=excluded.email,
        access_token=excluded.access_token,
        refresh_token=excluded.refresh_token,
        expires_at=excluded.expires_at,
        updated_at=excluded.updated_at
      `,
      [
        u.spotify_id,
        u.display_name || null,
        u.email || null,
        u.access_token,
        u.refresh_token,
        u.expires_at,
        now,
        now,
      ],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getUserBySpotifyId(spotifyId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM users WHERE spotify_id = ?`,
      [spotifyId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

async function refreshAccessTokenForUser(spotifyId) {
  const u = await getUserBySpotifyId(spotifyId);
  if (!u || !u.refresh_token) throw new Error("No refresh token available");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: u.refresh_token,
  });
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const r = await axios.post(
    "https://accounts.spotify.com/api/token",
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  const newAccess = r.data.access_token;
  const expiresIn = r.data.expires_in || 3600;
  const newExpiresAt = Date.now() + expiresIn * 1000;
  await upsertUser({
    spotify_id: u.spotify_id,
    display_name: u.display_name,
    email: u.email,
    access_token: newAccess,
    refresh_token: r.data.refresh_token || u.refresh_token,
    expires_at: newExpiresAt,
  });
  return { access_token: newAccess, expires_at: newExpiresAt };
}

function tokenIsExpired(dbRow) {
  if (!dbRow || !dbRow.expires_at) return true;
  return Date.now() + TOKEN_REFRESH_BUFFER_MS >= dbRow.expires_at;
}

async function ensureValidSpotifyToken(req, res, next) {
  try {
    const spotifyId = req.user && req.user.sub;
    if (!spotifyId)
      return res.status(401).json({ error: "Missing user in token" });
    const u = await getUserBySpotifyId(spotifyId);
    if (!u) return res.status(404).json({ error: "User not found" });
    if (tokenIsExpired(u)) {
      try {
        const refreshed = await refreshAccessTokenForUser(spotifyId);
        req.spotifyAccessToken = refreshed.access_token;
      } catch (err) {
        return res
          .status(401)
          .json({
            error: "Cannot refresh Spotify token",
            details: err?.message || err,
          });
      }
    } else {
      req.spotifyAccessToken = u.access_token;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true, port: PORT, envLoaded: !!process.env.PORT });
});

app.get("/login", (req, res) => {
  const scope = ["user-read-email", "user-read-private"].join(" ");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state: "xyz",
    show_dialog: "true",
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    });

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      "base64"
    );

    const tokenResp = await axios.post(
      "https://accounts.spotify.com/api/token",
      tokenParams.toString(),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResp.data;
    const meResp = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const me = meResp.data;
    const expires_at = Date.now() + expires_in * 1000;

    await upsertUser({
      spotify_id: me.id,
      display_name: me.display_name,
      email: me.email,
      access_token,
      refresh_token,
      expires_at,
    });

    const token = jwt.sign({ sub: me.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Authenticated with Spotify",
      jwt: token,
      user: {
        spotify_id: me.id,
        display_name: me.display_name,
        email: me.email,
      },
    });
  } catch (err) {
    const msg = err?.response?.data || err.message;
    res.status(500).json({ error: "Callback failed", details: msg });
  }
});

app.post("/refresh_token", requireAuth, async (req, res) => {
  try {
    const u = await getUserBySpotifyId(req.user.sub);
    if (!u || !u.refresh_token)
      return res.status(400).json({ error: "No refresh token on file" });

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: u.refresh_token,
    });
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      "base64"
    );

    const r = await axios.post(
      "https://accounts.spotify.com/api/token",
      params.toString(),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const newAccess = r.data.access_token;
    const newExpiresAt = Date.now() + r.data.expires_in * 1000;

    await upsertUser({
      spotify_id: u.spotify_id,
      display_name: u.display_name,
      email: u.email,
      access_token: newAccess,
      refresh_token: u.refresh_token,
      expires_at: newExpiresAt,
    });

    res.json({ access_token: newAccess, expires_at: newExpiresAt });
  } catch (err) {
    const msg = err?.response?.data || err.message;
    res.status(500).json({ error: "Refresh failed", details: msg });
  }
});

app.get("/me", requireAuth, async (req, res) => {
  const u = await getUserBySpotifyId(req.user.sub);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json({
    spotify_id: u.spotify_id,
    display_name: u.display_name,
    email: u.email,
    expires_at: u.expires_at,
  });
});

app.get("/auth/status", requireAuth, async (req, res) => {
  try {
    const spotifyId = req.user.sub;
    const u = await getUserBySpotifyId(spotifyId);
    if (!u) return res.json({ needsAuth: true, reason: "no-user" });
    const needsAuth = tokenIsExpired(u);
    res.json({ needsAuth, expires_at: u.expires_at || null });
  } catch (err) {
    res
      .status(500)
      .json({ error: "status-check-failed", details: err.message || err });
  }
});

app.get(
  "/spotify/playlists",
  requireAuth,
  ensureValidSpotifyToken,
  async (req, res) => {
    try {
      const access = req.spotifyAccessToken;
      const r = await axios.get("https://api.spotify.com/v1/me/playlists", {
        headers: { Authorization: `Bearer ${access}` },
      });
      res.json(r.data);
    } catch (err) {
      const details = err?.response?.data || err.message;
      res.status(500).json({ error: "failed-fetch-playlists", details });
    }
  }
);

app.get(
  "/spotify/search",
  requireAuth,
  ensureValidSpotifyToken,
  async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing query q" });
    try {
      const access = req.spotifyAccessToken;
      const params = new URLSearchParams({ q, type: "track", limit: "10" });
      const r = await axios.get(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${access}` },
        }
      );
      res.json(r.data);
    } catch (err) {
      const details = err?.response?.data || err.message;
      res.status(500).json({ error: "search-failed", details });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

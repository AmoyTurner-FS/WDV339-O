require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://127.0.0.1:5173" }));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI || "http://127.0.0.1:3000/callback";
const JWT_SECRET = process.env.JWT_SECRET || "mysupersecretkey";

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  return await res.json();
}

async function refreshAccessUsingRefreshToken(refresh_token) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  return await res.json();
}

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

async function getValidAccessTokenFromJwt(jwtToken) {
  try {
    const decoded = jwt.verify(jwtToken, JWT_SECRET);

    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${decoded.access_token}` },
    });
    if (res.status === 200) {
      return { access_token: decoded.access_token, jwt: jwtToken }; // token valid
    }
    // token invalid/expired -> try refresh
    const refreshData = await refreshAccessUsingRefreshToken(
      decoded.refresh_token
    );
    if (refreshData.access_token) {
      // create new jwt with refreshed tokens
      const newPayload = {
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token || decoded.refresh_token,
      };
      const newJwt = signJwt(newPayload);
      return { access_token: refreshData.access_token, jwt: newJwt };
    }
    // refresh failed
    return { error: "refresh_failed" };
  } catch (err) {
    return { error: "invalid_jwt" };
  }
}

// ROUTES

// /login -> redirect to Spotify's authorize page
app.get("/login", (req, res) => {
  const scope = [
    "user-read-email",
    "user-read-private",
    "playlist-read-private",
  ].join(" ");
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

// /callback -> exchange code, sign JWT, return JSON (or redirect to frontend)
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "missing_code" });

    const tokenData = await exchangeCodeForToken(code);
    if (!tokenData || !tokenData.access_token) {
      return res
        .status(500)
        .json({ error: "token_exchange_failed", details: tokenData });
    }

    const access_token = tokenData.access_token;
    const refresh_token = tokenData.refresh_token;

    // sign jwt including access & refresh tokens
    const payload = { access_token, refresh_token };
    const myJwt = signJwt(payload);

    // fetch basic user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = await profileRes.json();
    const user = {
      spotify_id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
    };

    if (process.env.FRONTEND_URL) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/callback?jwt=${encodeURIComponent(myJwt)}`
      );
    }

    // Otherwise return JSON
    return res.json({
      message: "Authenticated with Spotify",
      jwt: myJwt,
      user,
    });
  } catch (err) {
    console.error("callback error", err);
    return res
      .status(500)
      .json({ error: "server_error", details: err.message });
  }
});

app.get("/auth/status", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.json({ needsAuth: true });

    try {
      jwt.verify(token, JWT_SECRET);
      return res.json({ needsAuth: false });
    } catch (err) {
      return res.json({ needsAuth: true });
    }
  } catch (err) {
    return res.status(500).json({ error: "status_error" });
  }
});

app.get("/spotify/me", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "missing_token" });

  const ok = await getValidAccessTokenFromJwt(token);
  if (ok.error) return res.status(401).json({ error: ok.error });

  const r = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${ok.access_token}` },
  });
  const data = await r.json();
  return res.json({ jwt: ok.jwt, profile: data });
});

// /spotify/playlists
app.get("/spotify/playlists", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "missing_token" });

  const ok = await getValidAccessTokenFromJwt(token);
  if (ok.error) return res.status(401).json({ error: ok.error });

  const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${ok.access_token}` },
  });
  const data = await r.json();
  return res.json({ jwt: ok.jwt, playlists: data });
});

// /spotify/search?q=your+query
app.get("/spotify/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "missing_q" });

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "missing_token" });

  const ok = await getValidAccessTokenFromJwt(token);
  if (ok.error) return res.status(401).json({ error: ok.error });

  // search multiple types: album,artist,track,playlist
  const params = new URLSearchParams({
    q,
    type: "album,artist,track,playlist",
    limit: 10,
  });
  const r = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${ok.access_token}` },
    }
  );
  const data = await r.json();

  return res.json({
    jwt: ok.jwt,
    albums: data.albums || null,
    artists: data.artists || null,
    tracks: data.tracks || null,
    playlists: data.playlists || null,
  });
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://127.0.0.1:${PORT}`)
);

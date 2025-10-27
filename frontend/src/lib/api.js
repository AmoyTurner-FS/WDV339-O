const BASE = "http://127.0.0.1:3000";

async function fetchWithJwt(url, jwt) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json();

  if (data && data.jwt && data.jwt !== jwt) {
    localStorage.setItem("jwt", data.jwt);
  }
  return data;
}

export async function getAuthStatus(jwt) {
  const res = await fetch(`${BASE}/auth/status`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return res.json();
}

export async function getPlaylists(jwt) {
  return fetchWithJwt(`${BASE}/spotify/playlists`, jwt);
}

export async function getProfile(jwt) {
  return fetchWithJwt(`${BASE}/spotify/me`, jwt);
}

export async function searchSpotify(jwt, q) {
  const url = new URL(`${BASE}/spotify/search`);
  url.searchParams.append("q", q);
  return fetchWithJwt(url.toString(), jwt);
}

export const API_BASE = BASE;

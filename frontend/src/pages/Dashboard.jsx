import React, { useEffect, useState } from "react";
import { getProfile, getPlaylists, searchSpotify } from "../lib/api";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState({
    albums: null,
    artists: null,
    tracks: null,
    playlists: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return;
    getProfile(jwt)
      .then((d) => {
        if (d && d.profile) setProfile(d.profile);
        else if (d && d.spotify_id) setProfile(d);
      })
      .catch(() => {});
    getPlaylists(localStorage.getItem("jwt"))
      .then((d) => {
        if (d && d.playlists) setPlaylists(d.playlists);
        else if (d && d.items) setPlaylists(d);
      })
      .catch(() => {});
  }, []);

  async function doSearch(e) {
    e?.preventDefault();
    if (!q) return;
    setLoading(true);
    const jwt = localStorage.getItem("jwt");
    try {
      const data = await searchSpotify(jwt, q);
      setResults({
        albums: data.albums,
        artists: data.artists,
        tracks: data.tracks,
        playlists: data.playlists,
      });
    } catch (err) {
      console.error(err);
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  }

  function renderAlbumItem(a) {
    return (
      <li key={a.id} style={{ marginBottom: 10 }}>
        <a href={a.external_urls?.spotify} target="_blank" rel="noreferrer">
          {a.name}
        </a>
        <br />
        <small>
          {a.artists?.map((x) => x.name).join(", ")} • {a.release_date}
        </small>
      </li>
    );
  }
  function renderArtistItem(a) {
    return (
      <li key={a.id} style={{ marginBottom: 10 }}>
        <a href={a.external_urls?.spotify} target="_blank" rel="noreferrer">
          {a.name}
        </a>
        <br />
        <small>Followers: {a.followers?.total ?? "n/a"}</small>
      </li>
    );
  }
  function renderTrackItem(t) {
    return (
      <li key={t.id} style={{ marginBottom: 10 }}>
        <a href={t.external_urls?.spotify} target="_blank" rel="noreferrer">
          {t.name}
        </a>
        <div style={{ fontSize: 12, color: "#666" }}>
          {t.artists?.map((x) => x.name).join(", ")} •{" "}
          {(t.duration_ms / 1000 / 60).toFixed(2)} min
        </div>
      </li>
    );
  }

  if (!localStorage.getItem("jwt")) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 18 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2>My Spotify App</h2>
          {profile && (
            <div style={{ fontSize: 13 }}>
              Signed in as{" "}
              <strong>{profile.display_name || profile.email}</strong>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={() => {
              localStorage.removeItem("jwt");
              window.location.href = "/login";
            }}
            style={{ padding: "6px 10px" }}
          >
            Logout
          </button>
        </div>
      </header>

      <section style={{ marginTop: 18 }}>
        <form onSubmit={doSearch}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs, artists, playlists..."
            style={{ padding: 8, width: "60%" }}
          />
          <button type="submit" style={{ marginLeft: 8, padding: "8px 12px" }}>
            Search
          </button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          marginTop: 18,
        }}
      >
        <div>
          <h3>Albums</h3>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {results.albums?.items?.length ? (
              results.albums.items.map(renderAlbumItem)
            ) : (
              <li>No albums</li>
            )}
          </ul>
        </div>

        <div>
          <h3>Artists</h3>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {results.artists?.items?.length ? (
              results.artists.items.map(renderArtistItem)
            ) : (
              <li>No artists</li>
            )}
          </ul>
        </div>

        <div>
          <h3>Tracks</h3>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {results.tracks?.items?.length ? (
              results.tracks.items.map(renderTrackItem)
            ) : (
              <li>No tracks</li>
            )}
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>Your Playlists</h3>
        <ul>
          {playlists?.items?.length ? (
            playlists.items.map((pl) => (
              <li key={pl.id}>
                <a
                  href={pl.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pl.name}
                </a>{" "}
                — {pl.tracks.total} tracks
              </li>
            ))
          ) : (
            <li>No playlists found</li>
          )}
        </ul>
      </section>
    </div>
  );
}

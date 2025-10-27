import React from "react";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "http://127.0.0.1:3000/login";
  };

  return (
    <div style={{ padding: 30, fontFamily: "system-ui" }}>
      <h1>Login</h1>
      <p>Click to authorize your Spotify account.</p>
      <button
        onClick={handleLogin}
        style={{
          padding: "10px 18px",
          background: "#1DB954",
          color: "#fff",
          border: "none",
          borderRadius: 8,
        }}
      >
        Log in with Spotify
      </button>
      <p style={{ marginTop: 12, color: "#666" }}>
        After allowing access you will be redirected back automatically.
      </p>
    </div>
  );
}

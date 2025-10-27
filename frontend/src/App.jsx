import React, { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { getAuthStatus } from "./lib/api";

export default function App() {
  const nav = useNavigate();

  useEffect(() => {
    async function check() {
      const token = localStorage.getItem("jwt");
      if (!token) {
        nav("/login");
        return;
      }
      try {
        const status = await getAuthStatus(token);
        if (status.needsAuth) {
          localStorage.removeItem("jwt");
          nav("/login");
        }
      } catch (err) {
        localStorage.removeItem("jwt");
        nav("/login");
      }
    }
    check();
  }, [nav]);

  return (
    <div className="container">
      <header>
        <h1>WDV339 Spotify App</h1>
        <div className="user-controls">
          <button
            onClick={() => {
              localStorage.removeItem("jwt");
              navToLogin();
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function navToLogin() {
  window.location.href = "/login";
}

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Callback() {
  const nav = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jwt = params.get("jwt");
    if (jwt) {
      localStorage.setItem("jwt", jwt);
      nav("/dashboard");
    } else {
      nav("/login");
    }
  }, [nav]);

  return <div style={{ padding: 20 }}>Authenticating... redirecting.</div>;
}

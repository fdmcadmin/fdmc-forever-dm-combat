import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Suppress OBR SDK "not ready" errors during startup race condition.
// These fire when the SDK tries to send messages before the OBR handshake
// completes — typically within the first 500ms in restricted browsers.
// They are non-fatal: OBR.isAvailable guards in the app handle the real state.
const _origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("Unable to send message: not ready") || msg.includes("not ready")) return;
  _origConsoleError(...args);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

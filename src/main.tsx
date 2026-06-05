import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import App from "./App";
import "./styles.css";

function mount() {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// OBR.onReady ensures the SDK handshake with the OBR parent window is
// complete before React mounts and any OBR calls fire.
if (OBR.isAvailable) {
  OBR.onReady(mount);
} else {
  mount();
}

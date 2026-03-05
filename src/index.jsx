import React from "react";
import ReactDOM from "react-dom/client";
import { App, ErrorBoundary } from "./components/App.jsx";

try {
  if (!document.getElementById("root")) {
    console.error("[Porra] No se encontró el elemento #root");
    document.body.innerHTML = '<div style="padding:20px;color:red;background:white;">Error: No se encontró el elemento #root</div>';
  } else {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
    console.info("[Porra] Aplicación renderizada correctamente");
  }
} catch (error) {
  console.error("[Porra] Error al renderizar:", error);
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    rootEl.innerHTML = `<div style="padding:20px;color:red;background:white;font-family:monospace;">
      <h2>Error al cargar la aplicación</h2>
      <p>${esc(error.message)}</p>
      <pre>${esc(error.stack)}</pre>
      <p>Por favor, abre la consola del navegador (F12) para más detalles.</p>
    </div>`;
  }
}

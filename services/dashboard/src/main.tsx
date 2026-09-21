import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const MIN_SPLASH_MS = 1500;
const bootStart = performance.now();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

requestAnimationFrame(() => {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  const remaining = Math.max(0, MIN_SPLASH_MS - (performance.now() - bootStart));
  window.setTimeout(() => {
    splash.setAttribute("data-hidden", "");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  }, remaining);
});

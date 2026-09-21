import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

requestAnimationFrame(() => {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  splash.setAttribute("data-hidden", "");
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
});

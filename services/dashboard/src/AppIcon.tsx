import { useEffect, useState } from "react";

const FALLBACK_COLORS = ["#8b7cff", "#38bdf8", "#f59e0b", "#fb7185", "#34d399", "#a78bfa", "#f472b6", "#60a5fa"];

// App Store artwork URLs end in "<w>x<h>bb.<ext>"; ask for a small rendition.
export const smallIconUrl = (url: string) => url.replace(/\/\d+x\d+bb\.(\w+)$/, "/100x100bb.$1");

const colorFor = (app: string) => FALLBACK_COLORS[[...app].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FALLBACK_COLORS.length];

export function AppIcon({ app, url, size = 20 }: { app: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) };
  if (url && !failed) {
    return <img className="app-icon" src={smallIconUrl(url)} alt="" style={style} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return <span className="app-icon app-icon-fallback" style={{ ...style, background: colorFor(app) }} aria-hidden="true">{app.trim().charAt(0).toUpperCase() || "?"}</span>;
}

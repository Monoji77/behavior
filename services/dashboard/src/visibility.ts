// Keep older API responses and already connected live streams from rendering
// entries that are excluded from the dashboard.
const testIdentifier = /(^|[-_\s])(test|diagnostic|verification)([-_\s]|$)/i;

export function isVisibleIdentifier(value: string | null): boolean {
  return value == null || (!testIdentifier.test(value) && !value.trim().toLowerCase().startsWith("shortcut-check-"));
}

// A lightweight fingerprint keeps personal exclusion names out of shipped assets.
const excludedAppFingerprints: ReadonlySet<string> = new Set(["d0ed1c25"]);

export function appFingerprint(app: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(app.trim().toLowerCase())) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function isExcludedApp(app: string | null, excluded: ReadonlySet<string> = excludedAppFingerprints): boolean {
  return app != null && excluded.has(appFingerprint(app));
}

export function isVisibleApp(app: string | null): boolean {
  return !isExcludedApp(app) && isVisibleIdentifier(app);
}

export function isVisibleActivity(event: { app: string | null; deviceId: string | null }): boolean {
  return isVisibleApp(event.app) && isVisibleIdentifier(event.deviceId);
}

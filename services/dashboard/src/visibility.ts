// Keep older API responses and already connected live streams from rendering
// entries that are excluded from the dashboard.
const testIdentifier = /(^|[-_\s])(test|diagnostic|verification)([-_\s]|$)/i;

export function isVisibleIdentifier(value: string | null): boolean {
  return value == null || (!testIdentifier.test(value) && !value.trim().toLowerCase().startsWith("shortcut-check-"));
}

export function isVisibleApp(app: string | null): boolean {
  return app == null || (app.trim().toLowerCase() !== "grindr" && isVisibleIdentifier(app));
}

export function isVisibleActivity(event: { app: string | null; deviceId: string | null }): boolean {
  return isVisibleApp(event.app) && isVisibleIdentifier(event.deviceId);
}

const origin = "https://behavior-dashboard.taildcd567.ts.net";

export default async function dashboardProxy(request, context) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const target = new URL(request.url);
  target.protocol = "https:";
  target.host = new URL(origin).host;

  // Forward only the browser headers the read-only dashboard needs. In
  // particular, never trust a visitor-provided forwarding header as the
  // dashboard uses it for per-visitor API limits.
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "if-none-match", "if-modified-since", "range"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (context.ip) headers.set("x-forwarded-for", context.ip);

  // Returning the upstream Response preserves its body stream, including the
  // dashboard's long-lived /api/v1/live Server-Sent Events connection.
  return fetch(new Request(target, { method: request.method, headers, redirect: "manual" }));
}

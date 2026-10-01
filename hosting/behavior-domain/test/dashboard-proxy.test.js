import assert from "node:assert/strict";
import { test } from "node:test";
import dashboardProxy from "../netlify/edge-functions/dashboard-proxy.js";

test("proxies the dashboard path and query while preserving the SSE stream", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: first\n\n"));
      controller.close();
    },
  });
  const upstreamResponse = new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
  globalThis.fetch = async (request) => {
    upstreamRequest = request;
    return upstreamResponse;
  };

  try {
    const request = new Request("https://behavior.chrisyong-portfolio.com/api/v1/live?day=2026-10-01", {
      headers: { accept: "text/event-stream", "x-forwarded-for": "spoofed" },
    });
    const response = await dashboardProxy(request, { ip: "203.0.113.7" });

    assert.equal(upstreamRequest.url, "https://behavior-dashboard.taildcd567.ts.net/api/v1/live?day=2026-10-01");
    assert.equal(upstreamRequest.headers.get("accept"), "text/event-stream");
    assert.equal(upstreamRequest.headers.get("x-forwarded-for"), "203.0.113.7");
    assert.strictEqual(response, upstreamResponse);
    assert.equal(await response.text(), "data: first\n\n");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects write methods before contacting the origin", async () => {
  const response = await dashboardProxy(
    new Request("https://behavior.chrisyong-portfolio.com/api/v1/live", { method: "POST" }),
    { ip: "203.0.113.7" },
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

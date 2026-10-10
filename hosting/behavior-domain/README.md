# Custom dashboard domain

This small Netlify site serves the public production dashboard at
`https://behavior.chrisyong-portfolio.com/`. Its edge function fetches the
existing Tailscale Funnel URL and passes the response stream through. The
Tailscale hostname remains the origin and a rollback URL. Staging continues at
its private `chris.taildcd567.ts.net` address.

The edge function is used because the dashboard's `/api/v1/live` endpoint is a
long-lived Server-Sent Events stream. A standard Netlify proxy rewrite has a
short request timeout and cannot safely carry that stream.

## Stage and verify

1. In Netlify, create a **separate** site from this GitHub repository. Set its
   base directory to `hosting/behavior-domain` and publish directory to
   `public`. Deploy the PR as a Deploy Preview before making any DNS changes.
   Do not attach the portfolio's apex or `www` domain to this site.
2. On the preview URL, check `/healthz`, the main dashboard, chart/API data,
   assets, and `/api/v1/live` while a new event arrives. Keep the SSE connection
   open for more than a minute to confirm it streams without a proxy timeout.
3. Run `node --test hosting/behavior-domain/test/*.test.js` from the repository
   root. The PR check runs this automatically.

## Activate after staging approval

1. Publish the tested commit to the separate Netlify site. Add
   `behavior.chrisyong-portfolio.com` as that site's custom domain. Keep DNS
   hosted at Porkbun.
2. In Porkbun DNS, create an explicit `CNAME` for host `behavior` pointing to
   **that Netlify site's actual** `<site-name>.netlify.app` hostname. The
   existing `*` parking CNAME does not need to be deleted. Do not point this
   record directly at the `ts.net` hostname: its TLS certificate would not
   cover the custom domain.
3. Wait for Netlify to issue an HTTPS certificate. Verify DNS resolves to the
   Netlify site and `https://behavior.chrisyong-portfolio.com/healthz` returns
   `ok`. Then test the full dashboard and live event stream at the new URL.
4. Update public links to the new URL only after those checks pass. Keep the
   Funnel address available during the transition.

To roll back the domain, remove the explicit `behavior` CNAME in Porkbun; the
wildcard parking record will resume serving that name. The production dashboard
remains reachable at its `ts.net` URL throughout.

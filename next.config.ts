import path from "path";
import type { NextConfig } from "next";

// Content-Security-Policy: only allow scripts/styles/connections from this
// origin plus the two external services the browser actually talks to -
// Supabase (auth + database REST calls) and Vercel's analytics beacon.
// Anthropic is never called from the browser, so it doesn't need to appear
// here (see src/lib/anthropic.ts).
const csp = [
  "default-src 'self'",
  "script-src 'self' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // Forces HTTPS for two years, including subdomains, once served over
  // HTTPS - prevents protocol-downgrade and cookie-theft attacks. Has no
  // effect over plain HTTP (e.g. localhost dev), so it's safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stops browsers from guessing ("sniffing") a response's content type,
  // which can turn an upload or API response into executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Blocks this site from being embedded in an <iframe> on another site,
  // the standard defense against clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Limits how much of this site's URL leaks as a Referer header when a
  // user clicks a link to another site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app doesn't use the camera, mic, or geolocation - explicitly say so.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

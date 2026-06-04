import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 * Ref: Engineering Standards §3 (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
 *
 * The Content-Security-Policy is intentionally conservative for the Phase 1
 * foundation and is tightened (nonce-based scripts) during Phase 10 hardening.
 * `connect-src` permits Supabase REST/Realtime (https + wss) so the SDK works.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      // Next.js injects inline styles; dev/fast-refresh requires eval.
      "style-src 'self' 'unsafe-inline'",
      process.env.NODE_ENV === 'development'
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Force any accidental http subresource to https in production.
      ...(process.env.NODE_ENV === 'production'
        ? ['upgrade-insecure-requests']
        : []),
    ].join('; '),
  },
];

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // In development only, let Server Actions (e.g. the login action) through
  // when reached via the VS Code dev tunnel. The tunnel rewrites the `Origin`
  // header to the local target (`localhost:3000`) but sets `x-forwarded-host`
  // to the public tunnel domain, so Next's CSRF check sees a mismatch and
  // compares its allow-list against the ORIGIN — which is localhost, not the
  // tunnel host. We therefore allow `localhost:3000` (the rewritten origin),
  // and also `**.devtunnels.ms` for tunnel clients that forward the real
  // origin. Never applied in production. (If you run dev on another port,
  // update the localhost entry to match.)
  ...(isDev
    ? {
        experimental: {
          serverActions: {
            allowedOrigins: ['localhost:3000', '**.devtunnels.ms'],
          },
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

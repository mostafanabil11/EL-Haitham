import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // The browser only ever talks to this origin; /api/* is forwarded to the
  // Nest backend server-side.
  //
  // This is the decision that makes server-side auth possible. Calling the API
  // on its own domain would put the session cookie on *that* domain, where a
  // React Server Component running on this one cannot read it — so every
  // protected page would have to render empty and then fetch in the browser,
  // which is exactly the client-rendered behaviour that makes the incumbent
  // invisible to Google and to WhatsApp link previews.
  //
  // Proxying keeps the cookie first-party, so it also stays SameSite=Lax
  // rather than needing None, and no CORS preflight happens at all.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

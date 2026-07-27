import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Static-first site; Keystatic admin routes run on-demand via the Cloudflare adapter.
export default defineConfig({
  // Canonical site URL — drives every canonical/OG/JSON-LD URL.
  // REAL domain (registered at Porkbun 2026-07-26): pfclams.com. `pfclamsandcrabs.com` was a wrong
  // guess from an earlier session and was never bought — do not reintroduce it.
  // The raw static homepage is public/index.html and does NOT read this value; its canonical is
  // swapped by _marketing/go-live-swap.ps1 at go-live.
  site: 'https://pfclams.com',
  // Keystatic (and the React runtime it needs) are DEV-ONLY. Fable audit 2026-07-27 (H3):
  // pfclams.com/keystatic served a live admin shell + a 2.77 MB React bundle on a client domain,
  // and it is what caused the `MessageChannel is not defined` deploy wall. Editing happens locally
  // or through the repo; production ships no admin surface.
  // Set PF_KEYSTATIC=1 to build with the editor (local content editing only).
  integrations: [
    ...(process.env.PF_KEYSTATIC === '1' || process.env.NODE_ENV !== 'production'
      ? [react(), keystatic()]
      : []),
    sitemap({ filter: (page) => !page.includes('/keystatic') }),
  ],
  adapter: cloudflare({ imageService: 'compile' }),
});

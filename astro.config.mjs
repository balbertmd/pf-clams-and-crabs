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
  integrations: [react(), keystatic(), sitemap({ filter: (page) => !page.includes('/keystatic') })],
  adapter: cloudflare({ imageService: 'compile' }),
});

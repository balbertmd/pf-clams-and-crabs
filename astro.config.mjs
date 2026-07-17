import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Static-first site; Keystatic admin routes run on-demand via the Cloudflare adapter.
export default defineConfig({
  // Canonical site URL — drives every canonical/OG/JSON-LD URL. Target domain pfclamsandcrabs.com is NOT yet registered as of 2026-07-04 (purchase = Albert's step, confirmed still pending); until it goes live the deployed static homepage canonical stays pf-clams-and-crabs.pages.dev.
  site: 'https://pfclamsandcrabs.com',
  integrations: [react(), keystatic(), sitemap({ filter: (page) => !page.includes('/keystatic') })],
  adapter: cloudflare({ imageService: 'compile' }),
});

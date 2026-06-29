import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Static-first site; Keystatic admin routes run on-demand via the Cloudflare adapter.
export default defineConfig({
  // Canonical site URL — drives every canonical/OG/JSON-LD URL. Live domain (registered at Porkbun, DNS on Cloudflare).
  site: 'https://pfclamsandcrabs.com',
  integrations: [react(), keystatic(), sitemap({ filter: (page) => !page.includes('/keystatic') })],
  adapter: cloudflare({ imageService: 'compile' }),
});

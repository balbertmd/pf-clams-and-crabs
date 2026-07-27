import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Prerendered at build time -> dist/gallery.json. The static homepage fetches
// this to render the "From the dock" gallery, so Keystatic edits show after a
// rebuild + deploy. Falls back to a built-in list on the homepage if missing.
export const GET: APIRoute = async () => {
  // `cls` carries the bento span (b-wide / b-tall). Fable audit 2026-07-27 (M2): this map used to
  // drop it, so ~200ms after first paint the runtime overwrite flattened Albert's approved layout
  // — visitors never saw the composition for more than a moment.
  let out: Array<{ file: string; caption: string; cls: string }> = [];
  try {
    const all = await getCollection('galleryPhotos');
    out = all
      .filter((e: any) => (e.data.section || 'home') === 'home' && e.data.image)
      .sort((a: any, b: any) => (a.data.order || 0) - (b.data.order || 0))
      .map((e: any) => ({
        file: e.data.image as string,
        caption: e.data.caption || '',
        cls: (e.data.cls as string) || '',
      }));
  } catch {
    out = [];
  }
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json' },
  });
};

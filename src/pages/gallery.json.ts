import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Prerendered at build time -> dist/gallery.json. The static homepage fetches
// this to render the "From the dock" gallery, so Keystatic edits show after a
// rebuild + deploy. Falls back to a built-in list on the homepage if missing.
export const GET: APIRoute = async () => {
  let out: Array<{ file: string; caption: string }> = [];
  try {
    const all = await getCollection('galleryPhotos');
    out = all
      .filter((e: any) => (e.data.section || 'home') === 'home' && e.data.image)
      .sort((a: any, b: any) => (a.data.order || 0) - (b.data.order || 0))
      .map((e: any) => ({ file: e.data.image as string, caption: e.data.caption || '' }));
  } catch {
    out = [];
  }
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json' },
  });
};

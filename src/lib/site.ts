import { getEntry } from 'astro:content';

// Ensure a social/external URL is absolute. Editors sometimes paste a URL
// without the scheme (e.g. "www.youtube.com/@x"), which the browser treats as a
// RELATIVE path and breaks the link. Prefix https:// unless it's already a full
// URL, a mailto:/tel: link, or a root-relative path.
function absoluteUrl(u?: string | null): string {
  if (!u) return '#';
  const t = String(u).trim();
  if (!t) return '#';
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(t)) return t;
  return 'https://' + t.replace(/^\/+/, '');
}

export async function getSite() {
  const e = await getEntry('settings', 'site');
  if (!e) throw new Error('Missing src/content/settings/site.json');
  const data: any = { ...e.data };
  if (Array.isArray(data.socials)) {
    data.socials = data.socials.map((s: any) => ({ ...s, url: absoluteUrl(s.url) }));
  }
  return data;
}

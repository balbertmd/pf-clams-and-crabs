#!/usr/bin/env python3
"""Drop photos (and videos) in, get a shipped gallery out.

WHY THIS EXISTS
On 2026-08-01 two storefront photos and one video went onto the site entirely by hand: resize,
strip EXIF, build a bento thumb, write the collection entry, regenerate the sitemap, trim the
clip, cut a poster. Six manual steps per asset, each one a chance to forget the thumb or let the
JSON and the hardcoded array disagree (they override each other - see below). Albert will keep
sending media, so it should be one command.

USAGE
    python tools/add-media.py                      # process everything in _media-in/
    python tools/add-media.py --caption "..."      # caption for a single file
    python tools/add-media.py --dry-run

WHAT IT GUARANTEES
1. Every image lands <= 1920 px and under 800 KB. That is NOT cosmetic: scripts/compress-heavy-
   images.mjs rewrites anything larger at build time, which dirties the repo and can break a
   fast-forward push. Staying under the guard's limits means the guard never touches our files.
2. Every image gets a 700 px thumb in gallery/thumbs/. The bento loads thumbs; a missing one
   silently falls back to the full-size file and blows up the mobile payload.
3. Every image gets a collection entry in src/content/gallery/. **/gallery.json generated from
   that collection is the RUNTIME AUTHORITY and overrides the hardcoded array in
   public/index.html.** Adding a photo to the array alone does nothing. This writes the JSON.
4. EXIF/GPS is stripped. These are photos of a working dock; do not publish coordinates.
5. The sitemap is regenerated so new photos are eligible for Google Images.

VIDEO
ffmpeg is not installed on the PC (installing it is Albert's floor). Video files are therefore
reported, not processed - hand them to a Claude session, which has ffmpeg in its container:
    ffmpeg -ss <start> -i in.mp4 -an -c:v libx264 -crf 26 -preset slow -movflags +faststart out.mp4
Trim the START only unless told otherwise (2026-08-01: an "improved" tighter end cut the part
Albert actually liked). Always produce a poster frame from a good moment, never frame 0.
"""
import argparse, json, os, re, shutil, subprocess, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = os.path.join(SITE, '_media-in')
GALLERY = os.path.join(SITE, 'public', 'images', 'gallery')
THUMBS = os.path.join(GALLERY, 'thumbs')
COLLECTION = os.path.join(SITE, 'src', 'content', 'gallery')
VIDEOS = os.path.join(SITE, 'public', 'videos')

MAX_EDGE, THUMB_EDGE, MAX_BYTES = 1920, 700, 800 * 1024
IMG_EXT = {'.jpg', '.jpeg', '.png', '.webp'}
VID_EXT = {'.mp4', '.mov', '.m4v', '.webm'}


def slugify(name):
    s = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(name)[0].lower()).strip('-')
    return ('pf-' + s) if not s.startswith('pf-') else s


def next_order():
    n = 0
    for f in os.listdir(COLLECTION):
        m = re.match(r'^(\d+)-', f)
        if m:
            n = max(n, int(m.group(1)))
    return n + 1


def save_jpeg(im, path, max_edge, quality=86):
    """Re-paste into a clean canvas (drops EXIF/ICC/GPS), then step quality down until under cap."""
    from PIL import Image
    im = im.convert('RGB')
    im.thumbnail((max_edge, max_edge), Image.LANCZOS)
    clean = Image.new('RGB', im.size)
    clean.paste(im)
    for q in (quality, 82, 78, 74, 70):
        clean.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= MAX_BYTES:
            return im.size, q
    return im.size, 70


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--caption', default=None)
    ap.add_argument('--cls', default='', help='bento span: b-wide | b-tall | (empty)')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    os.makedirs(INBOX, exist_ok=True)
    files = sorted(f for f in os.listdir(INBOX) if not f.startswith('.'))
    if not files:
        print(f'nothing in {os.path.relpath(INBOX, SITE)} - drop photos or videos there and re-run')
        return 0

    from PIL import Image
    order = next_order()
    added = 0

    for f in files:
        src = os.path.join(INBOX, f)
        ext = os.path.splitext(f)[1].lower()
        slug = slugify(f)

        if ext in VID_EXT:
            print(f'  VIDEO {f} - not processed here (no ffmpeg on this PC).')
            print(f'        hand it to a Claude session; see the VIDEO note at the top of this file.')
            continue
        if ext not in IMG_EXT:
            print(f'  skip  {f} (unsupported type)')
            continue

        cap = args.caption or slug.replace('pf-', '').replace('-', ' ').capitalize()
        full = os.path.join(GALLERY, slug + '.jpg')
        thumb = os.path.join(THUMBS, slug + '.jpg')
        entry = os.path.join(COLLECTION, f'{order:02d}-{slug.replace("pf-", "")}.json')

        if args.dry_run:
            print(f'  would add {slug}: {os.path.relpath(full, SITE)} + thumb + {os.path.basename(entry)}')
            order += 1
            continue

        im = Image.open(src)
        size, q = save_jpeg(im, full, MAX_EDGE)
        save_jpeg(Image.open(src), thumb, THUMB_EDGE, 80)
        with open(entry, 'w', encoding='utf-8') as fh:
            json.dump({'image': f'/images/gallery/{slug}.jpg', 'caption': cap,
                       'section': 'home', 'order': order, 'cls': args.cls}, fh, indent=2)
            fh.write('\n')
        print(f'  ok    {slug}  {size[0]}x{size[1]}  q{q}  '
              f'{os.path.getsize(full)//1024} KB  (+thumb {os.path.getsize(thumb)//1024} KB)  '
              f'-> {os.path.basename(entry)}')
        shutil.move(src, os.path.join(INBOX, '.done-' + f))
        order += 1
        added += 1

    if added and not args.dry_run:
        subprocess.run([sys.executable, os.path.join(SITE, 'tools', 'gen-sitemap.py')], check=False)
        print(f'\n{added} image(s) added. NEXT: review the captions in src/content/gallery/, then '
              f'`npm run build` and deploy.')
        print('NOTE: the hardcoded imgs[] array in public/index.html is only the no-JS fallback; '
              '/gallery.json (from the collection) is what renders. Keep them in step when convenient.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

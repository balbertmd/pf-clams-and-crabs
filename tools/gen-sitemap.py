#!/usr/bin/env python3
"""Generate public/sitemap.xml from the gallery content collection.

Fable audit 2026-07-27 (M5/M9): the photo list used to be restated BY HAND inside
_marketing/go-live-swap.ps1 - a third copy of a list that already exists twice. The captions
drifted from the live ones on 11 of 16 images, and the generator lived outside git on one PC.
This reads the collection, so there is exactly one source of truth for the gallery.

Usage:  python tools/gen-sitemap.py [--date YYYY-MM-DD]
"""
import json, glob, os, sys, datetime
from xml.sax.saxutils import escape

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "https://pfclams.com"
OG = DOMAIN + "/images/og-pfclams.jpg"

date = datetime.date.today().isoformat()
if "--date" in sys.argv:
    date = sys.argv[sys.argv.index("--date") + 1]

items = []
for f in glob.glob(os.path.join(SITE, "src", "content", "gallery", "*.json")):
    d = json.load(open(f, encoding="utf-8"))
    if (d.get("section") or "home") == "home" and d.get("image"):
        items.append(d)
items.sort(key=lambda d: d.get("order", 0))

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    "  <url>",
    "    <loc>" + DOMAIN + "/</loc>",
    "    <lastmod>" + date + "</lastmod>",
    "    <changefreq>weekly</changefreq>",
    "    <priority>1.0</priority>",
    "    <image:image>",
    "      <image:loc>" + OG + "</image:loc>",
    "      <image:title>Paul's boat loaded with baskets of Cape May County clams</image:title>",
    "    </image:image>",
]
for d in items:
    lines += [
        "    <image:image>",
        "      <image:loc>" + DOMAIN + d["image"] + "</image:loc>",
        "      <image:title>" + escape(d.get("caption", "")) + "</image:title>",
        "    </image:image>",
    ]
lines += ["  </url>", "</urlset>", ""]

out = os.path.join(SITE, "public", "sitemap.xml")
open(out, "w", encoding="utf-8").write("\n".join(lines))
print("sitemap.xml written: 1 url, " + str(len(items) + 1) + " images, lastmod " + date)

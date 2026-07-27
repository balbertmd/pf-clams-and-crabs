# PF go-live: swap every pages.dev reference to the real domain, emit sitemap + robots.
# Run AFTER the domain exists and the Cloudflare Pages custom domain is attached.
#   powershell -NoProfile -ExecutionPolicy Bypass -File "<this file>" -Domain pfclams.com
# Then: npm run build  ->  wrangler pages deploy dist --project-name=pf-clams-and-crabs --branch=main
# Reversible: re-run with -Domain pf-clams-and-crabs.pages.dev to go back.
param(
  [Parameter(Mandatory=$true)][string]$Domain
)
$ErrorActionPreference = 'Stop'
$site   = Split-Path $PSScriptRoot -Parent   # repo root, wherever it is cloned
$index  = Join-Path $site 'public\index.html'
$old    = 'https://pf-clams-and-crabs.pages.dev'
$new    = "https://$Domain"

# --- 1. index.html: canonical, og:image, og:url, LocalBusiness image + url ---
# UTF-8 in/out with NO BOM - the 2026-06-30 mojibake lesson. Never use Get-Content -Raw here.
$html = [System.IO.File]::ReadAllText($index, [System.Text.Encoding]::UTF8)
$before = ([regex]::Matches($html, [regex]::Escape($old))).Count
$html = $html.Replace($old, $new)
[System.IO.File]::WriteAllText($index, $html, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("index.html: replaced {0} occurrences of {1} -> {2}" -f $before, $old, $new)

# --- 2. static sitemap.xml (Astro's @astrojs/sitemap emits nothing: the homepage is public/index.html) ---
$today = (Get-Date).ToString('yyyy-MM-dd')

# The gallery list lives in ONE place: src/content/gallery/*.json. This used to restate it
# by hand here, and the captions drifted from the live ones on 11 of 16 images.
# Fable audit 2026-07-27 (M5/M9).
python (Join-Path $site 'tools\gen-sitemap.py')
if ($LASTEXITCODE -ne 0) { throw 'gen-sitemap.py failed' }
Write-Output "public\sitemap.xml written from the gallery collection"

# --- 3. robots.txt pointing at the real sitemap ---
$robots = @"
User-agent: *
Allow: /
Disallow: /keystatic
Disallow: /dock-admin

Sitemap: $new/sitemap.xml
"@
[System.IO.File]::WriteAllText((Join-Path $site 'public\robots.txt'), $robots, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "public\robots.txt written"

# --- 4. astro.config site already = https://pfclamsandcrabs.com; report if it disagrees ---
$cfg = [System.IO.File]::ReadAllText((Join-Path $site 'astro.config.mjs'), [System.Text.Encoding]::UTF8)
if ($cfg -notmatch [regex]::Escape($Domain)) {
  Write-Output ("WARNING: astro.config.mjs 'site' does not mention {0} - check it by hand" -f $Domain)
} else {
  Write-Output "astro.config.mjs site matches - OK"
}

Write-Output ""
Write-Output "NEXT: cd site; npm run build; then deploy config-less from a space-free cwd:"
Write-Output "  wrangler pages deploy dist --project-name=pf-clams-and-crabs --branch=main"

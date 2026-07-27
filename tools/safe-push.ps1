# safe-push.ps1 - the ONLY sanctioned way to push this repo.
#
# Fable audit 2026-07-27 (M9): the old _prep/push.ps1 was an ungated `git add -A` run at two
# repo roots. This repo is PUBLIC. One stray copy of Paul's 37 MB logo master, a review-media
# folder, or an audit zip landing in the tree would have been published on the next push, with
# nothing in the way. This script refuses instead.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\safe-push.ps1 -Message "what changed"

param(
  [Parameter(Mandatory = $true)][string]$Message,
  [int]$MaxFileMB = 8
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# Paths that must never reach a public repo, whatever the extension.
$forbidden = @(
  'logo-master-4x', 'logo-master-2x', 'Upscaled-', '01-PHOTOS-ORIGINALS',
  'OneDrive', '_to_delete', 'audit-snapshot', '.env', '.dev.vars'
)

git add -A
$staged = git diff --cached --name-only | Where-Object { $_ }
if (-not $staged) { Write-Output 'nothing staged - stopping.'; exit 0 }

$blocked = @()
foreach ($f in $staged) {
  foreach ($pat in $forbidden) {
    if ($f -like "*$pat*") { $blocked += "$f  (matches '$pat')" }
  }
  if (Test-Path $f) {
    $mb = (Get-Item $f).Length / 1MB
    if ($mb -gt $MaxFileMB) { $blocked += ("{0}  ({1:N1} MB > {2} MB cap)" -f $f, $mb, $MaxFileMB) }
  }
}

if ($blocked.Count -gt 0) {
  git reset | Out-Null
  Write-Output 'REFUSED - these would have been published on a PUBLIC repo:'
  $blocked | ForEach-Object { Write-Output "  $_" }
  Write-Output ''
  Write-Output 'Nothing was staged. Move the file out of the repo (raw assets belong in the'
  Write-Output 'OneDrive asset library), or pass -MaxFileMB if the size is genuinely intended.'
  exit 1
}

Write-Output ("staged {0} file(s), all within policy" -f $staged.Count)
git commit -m $Message | Out-String
git push 2>&1 | Select-Object -Last 1 | Out-String
git log --oneline -1 | Out-String

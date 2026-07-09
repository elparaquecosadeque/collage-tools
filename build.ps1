# build.ps1 – compile split-image into a standalone Windows executable
#
# Output (dist\ folder):
#   split-image.exe    – self-contained Node.js bundle (caxa)
#   split-image.cmd    – launcher that sets the browsers path automatically
#   browsers\          – Chromium runtime for Playwright
#
# Usage after build:
#   dist\split-image.cmd [--blocks 2-7] [--dir <path>]
# Or add dist\ to your PATH and just type: split-image

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
Set-Location $root

function Banner($msg) {
  Write-Host ""
  Write-Host "  [$msg]" -ForegroundColor Cyan
}

function Ensure-Command($cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "  '$cmd' not found. Install Node.js (https://nodejs.org) and re-run."
    exit 1
  }
}

Ensure-Command "node"
Ensure-Command "npm"

New-Item -ItemType Directory -Force -Path "$root\dist" | Out-Null

# ── 1. npm install ─────────────────────────────────────────────────────────────
Banner "1/3  Installing npm dependencies"
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }

# ── 2. Playwright Chromium → dist\browsers\ ───────────────────────────────────
Banner "2/3  Installing Chromium  →  dist\browsers\"
New-Item -ItemType Directory -Force -Path "$root\dist\browsers" | Out-Null
$env:PLAYWRIGHT_BROWSERS_PATH = "$root\dist\browsers"
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Write-Error "playwright install failed"; exit 1 }
Remove-Item Env:\PLAYWRIGHT_BROWSERS_PATH

# ── 3. Build .exe with caxa ───────────────────────────────────────────────────
# caxa packs Node.js + this project into a self-extracting exe.
# It uses the locally installed Node.js so there are no runtime version mismatches.
Banner "3/3  Building split-image.exe  (caxa)"
npx caxa `
  --input  . `
  --exclude dist `
  --exclude test-img `
  --exclude "*.ps1" `
  --output "$root\dist\split-image.exe" `
  -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/index.js"
if ($LASTEXITCODE -ne 0) { Write-Error "caxa build failed"; exit 1 }

# ── 4. Create the .cmd launcher ───────────────────────────────────────────────
# The .cmd sets PLAYWRIGHT_BROWSERS_PATH to the browsers\ folder next to itself,
# so the exe finds Chromium regardless of where the user runs it from.
$cmdContent = @'
@echo off
:: split-image launcher – sets browser path then calls the exe
set PLAYWRIGHT_BROWSERS_PATH=%~dp0browsers
"%~dp0split-image.exe" %*
'@
$cmdContent | Set-Content -Encoding ASCII "$root\dist\split-image.cmd"
Write-Host "  Created: dist\split-image.cmd"

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Files:"
Write-Host "    dist\split-image.cmd   <-- run this (or add dist\ to PATH)"
Write-Host "    dist\split-image.exe"
Write-Host "    dist\browsers\"
Write-Host ""
Write-Host "  Usage:"
Write-Host "    split-image [--blocks 2-7] [--dir <path-to-your-png>]"
Write-Host ""
Write-Host "  Examples:"
Write-Host "    split-image"
Write-Host "    split-image --blocks 4"
Write-Host "    split-image --blocks 3 --dir C:\Images"
Write-Host ""
Write-Host "  Note: keep dist\browsers\ in the same folder as split-image.cmd"
Write-Host ""

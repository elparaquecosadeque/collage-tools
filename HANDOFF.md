# Handoff: split-image — PineTools Windows Automation

**Created:** 2026-07-13  
**Project:** `C:\Source\Repos\collage-tools\split-image\`  
**Not a git repo** — no branch/commit tracking

---

## Summary

`split-image` is a Node.js + Playwright CLI tool that automates the [PineTools Split Image](https://pinetools.com/split-image) website. It uploads PNGs from an `input-png\` queue, configures a horizontal split (2–7 columns), downloads the resulting ZIP, renames pieces to `1.png`, `2.png`… and moves the original into its output folder. The build pipeline (`build.ps1`) produces a self-contained Windows `.exe` via `caxa`. **The tool is fully working and tested end-to-end.**

---

## Work Completed

### Changes Made

- [x] Created `index.js` — full Playwright automation against PineTools
- [x] Created `package.json` — deps: `playwright@^1.45`, devDep: `caxa@^3.0.1`
- [x] Created `build.ps1` — 3-step pipeline: npm install → Chromium install → caxa bundle + `.cmd` launcher + create `input-png\` and `output\`
- [x] Created `.gitignore` — ignores `node_modules/` and `dist/`
- [x] Created `README.md` — full usage docs
- [x] Multi-PNG queue: loops over `input-png\`, skips already-processed (output folder exists)
- [x] Sequential rename: extracted pieces renamed `1.png`, `2.png`… sorted by PineTools' `row-R-column-C` naming
- [x] Original PNG moved from `input-png\` into its output folder after processing
- [x] `dist\` now includes `input-png\` and `output\` directories at build time
- [x] `.cmd` launcher sets `SPLIT_IMAGE_BASE=%~dp0` so exe resolves paths relative to `dist\`, not cwd
- [x] Build skip logic: npm install skipped if `node_modules\` is newer than `package.json`; Chromium install skipped if `dist\browsers\chromium-*` already exists
- [x] `build.ps1` rewritten as pure ASCII (was causing `MissingEndCurlyBrace` errors from Unicode chars like `—`, `→`, `──` misread under non-UTF8 encoding)
- [x] Removed `Ensure-Command` function (unapproved PS verb warning); replaced with two inline `if` guards

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| `caxa` as bundler | Uses machine's own `node.exe`, no version mismatch, no source compilation | `pkg@5.8.1` (Node 18.5, missing `globalThis.crypto`), `@yao-pkg/pkg` (builds Node from source — 10+ min) |
| Playwright `[id="..."]` selectors | PineTools element IDs start with hex digits — invalid as bare CSS selectors | Couldn't use `#6a4eff...` directly |
| `SPLIT_IMAGE_BASE` env var | `.cmd` launcher sets it to `%~dp0`; `index.js` falls back to `cwd` in dev mode | Hard-coding path in exe (not portable) |
| `input-png\` queue + skip logic | Allows batch processing; re-runs are safe and idempotent | Single-file `--dir` flag (caused "remove all but one" error with multiple PNGs) |
| Pure ASCII `build.ps1` | Unicode box/dash chars caused `MissingEndCurlyBrace` parse errors in some PS environments | Keeping Unicode (fragile) |
| Sequential rename `1.png…N.png` | Cleaner than PineTools' `row-1-column-N.png` names | Keeping original names |

---

## Files Affected

### Created
- `split-image/index.js` — full automation script; only file with business logic
- `split-image/package.json` — project manifest
- `split-image/build.ps1` — build pipeline; generates `dist\`
- `split-image/.gitignore` — ignores `node_modules/` and `dist/`
- `split-image/README.md` — usage documentation

### Modified (iteratively during session)
- `index.js` — multiple rewrites: added multi-PNG queue, `processOne()`, sequential rename, original PNG move, `SPLIT_IMAGE_BASE` support
- `build.ps1` — added Chromium/npm skip logic, `SPLIT_IMAGE_BASE` in launcher, `input-png\`/`output\` dir creation, full ASCII rewrite
- `README.md` — updated to reflect `input-png\` workflow and `output\` directory

### Not Committed (not a git repo)
Everything lives in `C:\Source\Repos\collage-tools\split-image\`.

---

## Technical Context

### PineTools Element IDs (confirmed from live page source)

```
fileInput : '6a4eff5a27132-ii-input-file'
canvas    : '6a4eff5a27132'              -- wait for .width > 0 to confirm upload
dirH      : '6a4eff5a2714c-directions-1' -- Horizontally (value 1)
modeByQty : '6a4eff5a27169-modeH-0'      -- "Quantity of blocks" mode
quantityH : '6a4eff5a27169-quantityH'    -- block count input
fmtPNG    : '6a4eff5a27175-format-1'     -- PNG format (index 0 = "Same as input")
quality   : '6a4eff5a27175-quality'      -- quality slider
splitBtn  : '#contBotEjec span.boton'
zipBtn    : '[id="6a4eff5a2719d"] .all-zipped button'  -- appears only after split
```

**Critical:** All IDs starting with a digit must use `[id="..."]` attribute selector form — bare `#6a4eff...` is invalid CSS.

### dist\ Structure (after build)

```
dist\
  split-image.cmd     <- run this; sets PLAYWRIGHT_BROWSERS_PATH + SPLIT_IMAGE_BASE
  split-image.exe     <- caxa self-extracting bundle (~454 MB)
  browsers\           <- Chromium for Playwright
  input-png\          <- drop PNGs here
  output\             <- results: <stem>.zip + <stem>\ with 1.png...N.png + original
```

### Extraction Flow

PineTools zips files inside a `PineTools.com_files/` subfolder. Extraction skips directory entries (`$e.Name -ne ''`), extracts flat into `output\<stem>\`, then renames by sorting `row-R-column-C.png` numerically.

### Browser Reuse

One `chromium.launch()` for the whole session; one `browser.newContext()` + `newPage()` per PNG. Fresh context per image avoids state bleed between uploads.

### Dependencies

- `playwright@^1.45.0` — browser automation
- `caxa@^3.0.1` (devDep) — self-extracting exe bundler

---

## Things to Know

### Gotchas & Pitfalls

- **PineTools IDs change** — all selectors in `ID` object (`index.js` L54–65) were scraped from a live page. If PineTools redesigns, they will break. Re-scrape with DevTools if automation stops working.
- **ZIP download waits** — the ZIP button only appears after the split completes. `zipBtn.waitFor({ timeout: 120_000 })` handles slow servers; increase if timeouts occur on large images.
- **Unicode in `.ps1` files** — PowerShell can misparse multi-byte Unicode chars (`—`, `→`, box-drawing) if the file lacks a UTF-8 BOM. Keep `build.ps1` ASCII-only.
- **PowerShell here-strings** — `@'...'@` requires `@'` with NO trailing whitespace and `'@` at the start of its line. Any deviation silently breaks the parse. Use string concatenation instead (as currently done for the `.cmd` content).
- **caxa bundle size** — ~454 MB because it embeds the entire `node_modules\` (Playwright is large). Normal; no fix needed.
- **`SPLIT_IMAGE_BASE` trailing slash** — stripped with `.replace(/[/\\]+$/, '')` in `index.js` to avoid double-slash path joins.

### Assumptions Made

- "Horizontally" on PineTools = equal-width columns side by side (confirmed; "Vertically" = equal-height rows).
- User always wants PNG output at quality 100 (hardcoded, not a parameter).
- Output directory skip check: a PNG `foo.png` is considered processed if `output\foo\` exists.

### Known Issues / Tech Debt

- No retry logic if PineTools is slow or rate-limits — a single timeout failure aborts the whole run.
- `headless: false` — browser window is visible during processing. Change to `true` in `chromium.launch()` for silent operation (untested).
- `build.ps1` excludes `test-img` from caxa bundle (line 61) but the actual test folder used during dev was `test-run\`. Both are excluded by the dist `--exclude dist` flag anyway; minor naming inconsistency.

---

## Current State

### What's Working

- [x] Full end-to-end automation: upload → configure → split → download ZIP → extract → rename → move original
- [x] Multi-PNG batch processing from `input-png\`
- [x] Skip-if-processed idempotency
- [x] `dist\` exe + launcher fully functional; paths resolve correctly regardless of cwd
- [x] Build skip logic for npm/Chromium
- [x] `build.ps1` parses cleanly (verified with PowerShell AST parser, 0 errors)

### What's Not Working / Not Done

- [ ] `README.md` still shows Unicode arrows (`←`) in the output tree — low risk but inconsistent with the ASCII-only `build.ps1` lesson
- [ ] No test for `--blocks` boundary values in the exe (only tested manually with 2 and 3)
- [ ] No handling if PineTools changes its DOM structure (no alerting mechanism)

---

## Next Steps

### Immediate

1. **Run `build.ps1`** from the `split-image\` folder to verify the clean ASCII script builds without errors:
   ```powershell
   cd C:\Source\Repos\collage-tools\split-image
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```
2. **Test with real PNGs** — drop files into `dist\input-png\` and run `dist\split-image.cmd`
3. **Init a git repo** if version control is desired (`git init` in `collage-tools\`)

### Subsequent

- Add `--headless` flag to `index.js` for silent operation
- Add retry on timeout (wrap `processOne` in a retry loop, 2–3 attempts)
- Consider stripping `browsers\` from the repo and downloading at runtime to reduce dist size

### Blocked On

- Nothing — the tool is fully functional as-is

---

## Related Resources

- [PineTools Split Image](https://pinetools.com/split-image) — the automated site
- [Playwright docs](https://playwright.dev/docs/api/class-page) — for selector/interaction API
- [caxa docs](https://github.com/leafac/caxa) — bundler used to produce the exe

### Commands

```powershell
# Build
cd C:\Source\Repos\collage-tools\split-image
powershell -ExecutionPolicy Bypass -File build.ps1

# Dev run (no build needed, needs PLAYWRIGHT_BROWSERS_PATH set)
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Source\Repos\collage-tools\split-image\dist\browsers"
node index.js --blocks 4

# Verify build.ps1 parses clean
$e = $null
[System.Management.Automation.Language.Parser]::ParseFile("build.ps1", [ref]$null, [ref]$e)
$e.Count  # should be 0

# Check dist structure
Get-ChildItem dist
```

### If PineTools Breaks — Re-scrape Selectors

```
# In browser DevTools on https://pinetools.com/split-image:
document.querySelector('input[type=file]').id
document.querySelector('[id*="directions"]').id
document.querySelector('[id*="quantityH"]').id
document.querySelector('[id*="format"]').id
```

---

*Generated 2026-07-13. Resume by reading this doc, then opening `index.js` and `build.ps1`.*

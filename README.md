# split-image

Automates [PineTools Split Image](https://pinetools.com/split-image) from the terminal.

Uploads a PNG, configures the split options, downloads the result, and extracts the pieces — no manual browser interaction needed.

## Requirements

- [Node.js](https://nodejs.org) 18+
- Internet access (opens PineTools in a browser)

## Build

Run once from the `split-image\` folder:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

This produces a `dist\` folder:

```
dist\
  split-image.cmd    ← the command you run
  split-image.exe    ← bundled Node.js + script (caxa)
  browsers\          ← Chromium for Playwright
```

Add `dist\` to your `PATH`, or call `split-image.cmd` with a full path.

> **Keep `browsers\` in the same folder as `split-image.cmd`.** The launcher sets `PLAYWRIGHT_BROWSERS_PATH` automatically.

## Usage

1. Run `split-image.cmd` (or `node index.js`) from any working directory.  
   On first run it creates `input-png\` and `output\` next to the exe and exits.
2. Drop your PNGs into `input-png\`.
3. Re-run — every PNG without a matching output folder is processed.
   Results appear in `output\`.

```
split-image [--blocks N]
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--blocks` | `-b` | `6` | Columns to split into (2–7) |
| `--help` | `-h` | | Show help |

### Examples

```powershell
# Default 6 columns
split-image

# 4 columns
split-image --blocks 4
```

### Output

Given `input-png\banner.png`, the tool produces in `output\`:

```
output\
  banner.zip          ← downloaded archive (kept for reference)
  banner\
    1.png             ← leftmost column
    2.png
    ...
    6.png             ← rightmost column
    banner.png        ← original moved here after processing
```

PNGs already in an output folder are skipped on subsequent runs, so you can
add more files to `input-png\` and re-run without reprocessing old ones.

## Development

Run without building:

```powershell
cd split-image
node index.js --blocks 4
```

In dev mode `SPLIT_IMAGE_BASE` is not set, so it falls back to `cwd` — `input-png\` and `output\` are created there.

> Requires `PLAYWRIGHT_BROWSERS_PATH` to point at a Chromium install, or having run `build.ps1` at least once so `dist\browsers\` exists.

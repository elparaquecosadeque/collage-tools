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

Run from the directory that contains your PNG (or pass `--dir`):

```
split-image [--blocks N] [--dir PATH]
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--blocks` | `-b` | `6` | Number of columns to split into (2–7) |
| `--dir` | `-d` | cwd | Directory containing the PNG |
| `--help` | `-h` | | Show help |

### Examples

```powershell
# From the folder that has your PNG
cd C:\Images\MyProject
split-image

# 4 columns
split-image --blocks 4

# PNG is elsewhere
split-image --blocks 3 --dir C:\Images\MyProject
```

### Output

Given `banner.png`, the tool produces:

```
banner.zip          ← downloaded zip (kept for reference)
banner\
  row-1-column-1.png
  row-1-column-2.png
  ...
  row-1-column-6.png
```

## Development

Run without building:

```powershell
node index.js --blocks 4 --dir C:\Images\MyProject
```

> Requires `PLAYWRIGHT_BROWSERS_PATH` to point at a Chromium install, or having run `build.ps1` at least once so `dist\browsers\` exists.

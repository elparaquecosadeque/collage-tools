#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const path  = require('path');
const fs    = require('fs');
const { execSync } = require('child_process');

// ─────────────────────────────────────────────
// CLI argument parsing (no dependencies needed)
// ─────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  let blocks = 6;
  let dir    = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log([
        '',
        '  split-image  –  automate PineTools "Split image"',
        '',
        '  Usage:  split-image [--blocks N] [--dir PATH]',
        '',
        '  Options:',
        '    --blocks, -b  N     Number of blocks to split into (2-7, default 6)',
        '    --dir,    -d  PATH  Directory that contains the PNG (default: cwd)',
        '    --help,   -h        Show this help',
        '',
      ].join('\n'));
      process.exit(0);
    }
    if ((a === '--blocks' || a === '-b') && argv[i + 1]) {
      const n = parseInt(argv[++i], 10);
      if (isNaN(n) || n < 2 || n > 7) {
        console.error(`✖  --blocks must be an integer between 2 and 7 (got "${argv[i]}")`);
        process.exit(1);
      }
      blocks = n;
    } else if ((a === '--dir' || a === '-d') && argv[i + 1]) {
      dir = path.resolve(argv[++i]);
    }
  }
  return { blocks, dir };
}

// ─────────────────────────────────────────────
// PineTools element IDs (confirmed from page source)
// ─────────────────────────────────────────────
const ID = {
  fileInput  : '6a4eff5a27132-ii-input-file',
  canvas     : '6a4eff5a27132',
  dirH       : '6a4eff5a2714c-directions-1',   // "Horizontally"
  modeByQty  : '6a4eff5a27169-modeH-0',         // "Quantity of blocks (equal width)"
  quantityH  : '6a4eff5a27169-quantityH',
  fmtPNG     : '6a4eff5a27175-format-1',        // PNG
  quality    : '6a4eff5a27175-quality',
  // IDs starting with digits are invalid as CSS selectors; use [id="..."] form
  sel: (id) => `[id="${id}"]`,
  splitBtn   : '#contBotEjec span.boton',        // "Split image!" – contBotEjec starts with letter ✔
  zipBtn     : '[id="6a4eff5a2719d"] .all-zipped button',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function setRadio(page, id) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element not found: ${id}`);
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
}

function setInput(page, id, value) {
  return page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element not found: ${id}`);
    el.value = String(value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, value });
}

function step(label) { process.stdout.write(`  ${label.padEnd(28, '.')} `); }
function ok()        { console.log('✔'); }

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  const { blocks, dir } = parseArgs();

  // ── Find the single PNG in the directory ─────────────────────────
  if (!fs.existsSync(dir)) {
    console.error(`✖  Directory not found: ${dir}`);
    process.exit(1);
  }
  const pngs = fs.readdirSync(dir).filter(f => /\.png$/i.test(f));
  if (!pngs.length) {
    console.error(`✖  No PNG found in: ${dir}`);
    process.exit(1);
  }
  if (pngs.length > 1) {
    console.error(`✖  Multiple PNGs in ${dir}:\n     ${pngs.join('\n     ')}\n   Remove all but one.`);
    process.exit(1);
  }

  const pngFile = pngs[0];
  const pngPath = path.resolve(dir, pngFile);
  const stem    = path.basename(pngFile, path.extname(pngFile));
  const outDir  = process.cwd();

  console.log(`\n  PNG    : ${pngFile}`);
  console.log(`  Blocks : ${blocks}`);
  console.log(`  Output : ${outDir}\n`);

  // ── Launch browser ────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const page    = await context.newPage();

  try {
    // 1. Navigate
    step('Opening PineTools');
    await page.goto('https://pinetools.com/split-image', { waitUntil: 'domcontentloaded' });
    ok();

    // 2. Upload PNG
    step('Uploading image');
    await page.locator(ID.sel(ID.fileInput)).setInputFiles(pngPath);
    await page.waitForFunction(
      (id) => (document.getElementById(id) || {}).width > 0,
      ID.canvas,
      { timeout: 30_000 }
    );
    ok();

    // 3. Set options
    step('Setting options');
    await setRadio(page, ID.dirH);         // Horizontally
    await setRadio(page, ID.modeByQty);    // Quantity of blocks (equal width)
    await setInput(page, ID.quantityH, blocks);
    await setRadio(page, ID.fmtPNG);       // PNG format
    await setInput(page, ID.quality, 100); // Quality 100
    ok();

    // 4. Click "Split image!"
    step('Splitting');
    await page.click(ID.splitBtn);
    const zipBtn = page.locator(ID.zipBtn);
    await zipBtn.waitFor({ timeout: 120_000 });
    ok();

    // 5. Download zip
    step('Downloading zip');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      zipBtn.click(),
    ]);
    const zipPath = path.join(outDir, `${stem}.zip`);
    await download.saveAs(zipPath);
    ok();

    // 6. Extract zip  →  outDir/<stem>/
    step('Extracting');
    const extractDir = path.join(outDir, stem);
    fs.mkdirSync(extractDir, { recursive: true });

    // Flatten: skip any top-level subfolder created by PineTools (PineTools.com_files/)
    execSync(
      `powershell -NoProfile -Command ` +
      `"Add-Type -Assembly System.IO.Compression.FileSystem; ` +
      `$z=[IO.Compression.ZipFile]::OpenRead('${zipPath}'); ` +
      `foreach($e in $z.Entries){ ` +
      `  if($e.Name -ne ''){` +
      `    $dest='${extractDir.replace(/\\/g, '\\\\')}\\'+$e.Name; ` +
      `    [IO.Compression.ZipFileExtensions]::ExtractToFile($e,$dest,$true)` +
      `  }` +
      `}; $z.Dispose()"`,
      { stdio: 'pipe' }
    );

    const pieces = fs.readdirSync(extractDir).filter(f => /\.png$/i.test(f));
    console.log(`✔  (${pieces.length} images → ${stem}\\)`);

    console.log('\n  All done!\n');

  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(err => {
  console.error(`\n✖  ${err.message}`);
  process.exit(1);
});

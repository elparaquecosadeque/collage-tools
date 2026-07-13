#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  let blocks = 6;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log([
        '',
        '  split-image  –  automate PineTools "Split image"',
        '',
        '  Usage:  split-image [--blocks N]',
        '',
        '  Drop PNGs into the  input-png\\  folder next to where you run this.',
        '  Each PNG that has no matching output folder will be processed.',
        '',
        '  Options:',
        '    --blocks, -b  N   Columns to split into (2-7, default 6)',
        '    --help,   -h      Show this help',
        '',
        '  Output per image (e.g. photo.png):',
        '    photo\\           folder with 1.png … N.png  +  original photo.png',
        '    photo.zip        downloaded archive (kept for reference)',
        '',
      ].join('\n'));
      process.exit(0);
    }
    if ((a === '--blocks' || a === '-b') && argv[i + 1]) {
      const n = parseInt(argv[++i], 10);
      if (isNaN(n) || n < 2 || n > 7) {
        console.error(`✖  --blocks must be 2–7 (got "${argv[i]}")`);
        process.exit(1);
      }
      blocks = n;
    }
  }
  return { blocks };
}

// ─────────────────────────────────────────────
// PineTools element IDs (confirmed from page source)
// ─────────────────────────────────────────────
const ID = {
  fileInput: 'ii-input-file',
  dirH: 'directions-1',  // "Horizontally"
  modeByQty: 'modeH-0',        // "Quantity of blocks"
  quantityH: 'quantityH',
  fmtPNG: 'format-1',       // PNG
  quality: 'quality',
  sel: (id) => `[id$="${id}"]`,         // PineTools prefixes IDs with a page hash.
  splitBtn: '#contBotEjec span.boton',
  zipBtn: '.all-zipped button',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function setRadio(page, id) {
  return page.evaluate(({ id, selector }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${id}`);
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, selector: ID.sel(id) });
}

function setInput(page, id, value) {
  return page.evaluate(({ id, selector, value }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${id}`);
    el.value = String(value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, selector: ID.sel(id), value });
}

function step(label) { process.stdout.write(`    ${label.padEnd(26, '.')} `); }
function ok() { console.log('✔'); }

// ─────────────────────────────────────────────
// Process one PNG
// ─────────────────────────────────────────────
async function processOne(browser, pngFile, inputDir, blocks, outBase) {
  const pngPath = path.join(inputDir, pngFile);
  const stem = path.basename(pngFile, path.extname(pngFile));
  const outDir = path.join(outBase, stem);
  const zipPath = path.join(outBase, `${stem}.zip`);

  console.log(`\n  ▸ ${pngFile}`);

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    step('Opening PineTools');
    await page.goto('https://pinetools.com/split-image', { waitUntil: 'domcontentloaded' });
    await page.locator(ID.sel(ID.fileInput)).waitFor({ timeout: 30_000 });
    ok();

    step('Uploading image');
    await page.locator(ID.sel(ID.fileInput)).setInputFiles(pngPath);
    ok();

    step('Setting options');
    await setRadio(page, ID.dirH);
    await setRadio(page, ID.modeByQty);
    await setInput(page, ID.quantityH, blocks);
    await setRadio(page, ID.fmtPNG);
    await setInput(page, ID.quality, 100);
    ok();

    step('Splitting');
    await page.click(ID.splitBtn);
    const zipBtn = page.locator(ID.zipBtn);
    await zipBtn.waitFor({ timeout: 120_000 });
    ok();

    step('Downloading zip');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      zipBtn.click(),
    ]);
    await download.saveAs(zipPath);
    ok();

    // Extract, flatten PineTools subfolder, rename to 1.png 2.png …
    step('Extracting');
    fs.mkdirSync(outDir, { recursive: true });
    execSync(
      `powershell -NoProfile -Command ` +
      `"Add-Type -Assembly System.IO.Compression.FileSystem; ` +
      `$z=[IO.Compression.ZipFile]::OpenRead('${zipPath}'); ` +
      `foreach($e in $z.Entries){ ` +
      `  if($e.Name -ne ''){` +
      `    $dest='${outDir.replace(/\\/g, '\\\\')}\\'+$e.Name; ` +
      `    [IO.Compression.ZipFileExtensions]::ExtractToFile($e,$dest,$true)` +
      `  }` +
      `}; $z.Dispose()"`,
      { stdio: 'pipe' }
    );

    // Rename extracted PNGs to 1.png, 2.png, … (sorted by PineTools' row-R-column-C name)
    const pieces = fs.readdirSync(outDir)
      .filter(f => /\.png$/i.test(f))
      .sort((a, b) => {
        const col = f => parseInt((f.match(/column-(\d+)/i) || [0, 0])[1], 10);
        const row = f => parseInt((f.match(/row-(\d+)/i) || [0, 0])[1], 10);
        return row(a) - row(b) || col(a) - col(b);
      });

    pieces.forEach((f, i) => {
      fs.renameSync(path.join(outDir, f), path.join(outDir, `${i + 1}.png`));
    });

    // Move the original PNG into its output folder
    fs.renameSync(pngPath, path.join(outDir, pngFile));

    console.log(`✔  (${pieces.length} images → ${stem}\\)`);

  } finally {
    await context.close();
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  const { blocks } = parseArgs();
  // When run via the .cmd launcher, SPLIT_IMAGE_BASE points to dist\.
  // In dev mode (node index.js) it falls back to cwd so nothing breaks.
  const base = process.env.SPLIT_IMAGE_BASE
    ? process.env.SPLIT_IMAGE_BASE.replace(/[/\\]+$/, '')
    : process.cwd();
  const inputDir = path.join(base, 'input-png');
  const outBase = path.join(base, 'output');

  // Create input/output folders on first run
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outBase, { recursive: true });
    console.log(`\n  Created input-png\\ and output\\ — drop your PNGs in input-png\\ and re-run.\n`);
    process.exit(0);
  }
  fs.mkdirSync(outBase, { recursive: true });

  // Only process PNGs whose output folder doesn't exist yet
  const queue = fs.readdirSync(inputDir)
    .filter(f => /\.png$/i.test(f))
    .filter(f => !fs.existsSync(path.join(outBase, path.basename(f, path.extname(f)))));

  if (!queue.length) {
    const all = fs.readdirSync(inputDir).filter(f => /\.png$/i.test(f));
    if (all.length) {
      console.log(`\n  All ${all.length} PNG(s) in input-png\\ already processed.\n`);
    } else {
      console.log(`\n  input-png\\ is empty — drop PNGs there and re-run.\n`);
    }
    process.exit(0);
  }

  console.log(`\n  ${queue.length} PNG(s) to process  [blocks: ${blocks}]`);

  const browser = await chromium.launch({ headless: false });
  try {
    for (const f of queue) {
      await processOne(browser, f, inputDir, blocks, outBase);
    }
  } finally {
    await browser.close();
  }

  console.log('\n  All done!\n');
}

main().catch(err => {
  console.error(`\n✖  ${err.message}`);
  process.exit(1);
});


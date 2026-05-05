#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const FRAME    = path.join(ROOT, 'src', 'frame', 'frame.html');
const NODES_DIR = path.join(ROOT, 'src', 'nodes');
const VIZ_DIR   = path.join(ROOT, 'src', 'viz');
const OUT_DIR   = path.join(ROOT, 'dist');
const OUT_FILE  = path.join(OUT_DIR, 'workbench.html');

function collectJs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => ({
      file: path.join(dir, f),
      rel:  path.relative(ROOT, path.join(dir, f))
    }));
}

function build() {
  const shell = fs.readFileSync(FRAME, 'utf8');

  const sources = [
    ...collectJs(NODES_DIR),
    ...collectJs(VIZ_DIR)
  ];

  const pluginBlock = sources.map(({ file, rel }) => {
    const code = fs.readFileSync(file, 'utf8').trimEnd();
    return `/* --- ${rel} --- */\n${code}`;
  }).join('\n\n');

  const injected = shell.replace(
    '<!-- {{NODES}} -->',
    `<script>\n/* injected by compiler/build.js */\n\n${pluginBlock}\n</script>`
  );

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, injected, 'utf8');

  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`Built: dist/workbench.html  (${kb} KB, ${sources.length} plugin file(s))`);
  sources.forEach(({ rel }) => console.log('  +', rel));

  return { kb, pluginCount: sources.length, outFile: OUT_FILE };
}

// Only execute when run directly; require('./build') just gets the export.
if (require.main === module) {
  const result = build();

  if (process.argv.includes('--release')) {
    const relDir  = path.join(ROOT, 'releases');
    const relFile = path.join(relDir, 'workbench-latest.html');
    if (!fs.existsSync(relDir)) fs.mkdirSync(relDir, { recursive: true });
    fs.copyFileSync(result.outFile, relFile);
    console.log('→ Release copy written to releases/workbench-latest.html');
  }
}

module.exports = { build };

#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const FRAME         = path.join(ROOT, 'src', 'frame', 'frame.html');
const NODES_DIR     = path.join(ROOT, 'src', 'nodes');
const VIZ_DIR       = path.join(ROOT, 'src', 'viz');
const PLUGINS_DIR   = path.join(ROOT, 'src', 'plugins');
const VALIDATORS_DIR = path.join(ROOT, 'src', 'data', 'validators');
const OUT_DIR       = path.join(ROOT, 'dist');
const OUT_FILE      = path.join(OUT_DIR, 'workbench.html');

const VALIDATOR_NAME_MAP = {
  'cyp-tracks':    'CYP Tracks',
  'employee-type': 'Employee Type',
  'installations': 'Installations',
  'lms-uics':      'LMS UICs',
  'n-codes':       'N-Codes',
  'regions':       'Regions',
  'sec-domains':   'Sec Domains',
  'status':        'Status',
  'yes-no':        'Yes/No',
};

function humanizeValidatorKey(stem) {
  if (VALIDATOR_NAME_MAP[stem]) return VALIDATOR_NAME_MAP[stem];
  return stem.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildDefaultValidators() {
  if (!fs.existsSync(VALIDATORS_DIR)) return '{}';
  const obj = {};
  for (const f of fs.readdirSync(VALIDATORS_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    const stem = f.slice(0, -5);
    obj[humanizeValidatorKey(stem)] = JSON.parse(fs.readFileSync(path.join(VALIDATORS_DIR, f), 'utf8'));
  }
  return JSON.stringify(obj);
}

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

// Read each src/plugins/<category>/index.js manifest and collect the listed plugin files.
function collectPlugins(pluginsDir) {
  if (!fs.existsSync(pluginsDir)) return [];
  const results = [];
  for (const cat of fs.readdirSync(pluginsDir).sort()) {
    const catDir   = path.join(pluginsDir, cat);
    const manifest = path.join(catDir, 'index.js');
    if (!fs.statSync(catDir).isDirectory() || !fs.existsSync(manifest)) continue;
    const { plugins = [] } = require(manifest);
    for (const rel of plugins) {
      const file = path.resolve(catDir, rel);
      results.push({ file, rel: path.relative(ROOT, file) });
    }
  }
  return results;
}

function build() {
  const shell = fs.readFileSync(FRAME, 'utf8');

  const sources = [
    ...collectJs(NODES_DIR),
    ...collectJs(path.join(VIZ_DIR, 'canvas')),
    ...collectJs(path.join(VIZ_DIR, 'elements')),
    ...collectJs(path.join(VIZ_DIR, 'header')),
    ...collectPlugins(PLUGINS_DIR),
  ];

  const validatorsJson = buildDefaultValidators();

  const pluginBlock = sources.map(({ file, rel }) => {
    let code = fs.readFileSync(file, 'utf8').trimEnd();
    if (code.includes('/* {{DEFAULT_VALIDATORS}} */')) {
      code = code.replace('/* {{DEFAULT_VALIDATORS}} */', `const DEFAULT_VALIDATORS = ${validatorsJson};`);
    }
    // Wrap in IIFE for scope isolation between plugin files
    return `/* --- ${rel} --- */\n(function(){\n${code}\n})();`;
  }).join('\n\n');

  // Guard: any literal </script in the plugin block prematurely closes the HTML <script> element.
  // The HTML tokenizer is not JS-aware — it fires on </script even inside comments or strings.
  // Safe form in JS source: <\/script (backslash between < and /).
  const _unsafeClose = /<\/script/i;
  if (_unsafeClose.test(pluginBlock)) {
    const lines = pluginBlock.split('\n');
    console.error('\nBUILD ERROR: Unescaped </script found in compiled plugin block.');
    console.error('The HTML tokenizer will close the <script> block early, breaking the app.');
    console.error('Fix: replace </script with <\\/script in any string or comment in these locations:\n');
    lines.forEach((line, i) => {
      if (_unsafeClose.test(line)) {
        console.error(`  line ${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
    console.error('\nBuild aborted.\n');
    process.exit(1);
  }

  // IMPORTANT: use a function replacer, NOT a string replacer.
  // String.prototype.replace() interprets $' $` $& etc. as special patterns.
  // Plugin source code can contain '$' (e.g. currency strings) which would
  // corrupt the HTML output via the $' "insert-after-match" expansion.
  const injected = shell.replace(
    '<!-- {{NODES}} -->',
    () => `<script>\n/* injected by compiler/build.js */\n\n${pluginBlock}\n</script>`
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

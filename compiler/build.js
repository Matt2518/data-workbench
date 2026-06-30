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

const MERGE_DIR     = path.join(ROOT, 'src', 'merge');
const DESIGNER_SRC  = path.join(ROOT, 'designer', 'src');
const DESIGNER_OUT  = path.join(OUT_DIR, 'designer.html');

const V2_SRC        = path.join(ROOT, 'src', 'v2');
const V2_FRAME      = path.join(V2_SRC, 'frame', 'frame.html');
const V2_OUT        = path.join(OUT_DIR, 'dwb2.html');

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

function collectV2Recursive(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir).sort();
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectV2Recursive(full, ext));
    } else if (entry.endsWith(ext)) {
      results.push({ file: full, rel: path.relative(ROOT, full) });
    }
  }
  return results;
}

function guardStyleClose(block, label) {
  const _unsafeClose = /<\/style/i;
  if (_unsafeClose.test(block)) {
    const lines = block.split('\n');
    console.error(`\nBUILD ERROR: Unescaped </style found in compiled ${label} block.`);
    lines.forEach((line, i) => {
      if (_unsafeClose.test(line)) console.error(`  line ${i + 1}: ${line.trim().slice(0, 120)}`);
    });
    console.error('\nBuild aborted.\n');
    process.exit(1);
  }
}

function buildV2() {
  if (!fs.existsSync(V2_FRAME)) { console.error('Missing src/v2/frame/frame.html'); process.exit(1); }
  const shell = fs.readFileSync(V2_FRAME, 'utf8');

  const cssFiles = collectV2Recursive(V2_SRC, '.css');
  const jsFiles  = collectV2Recursive(V2_SRC, '.js');

  const cssBlock = cssFiles.map(({ file, rel }) => {
    return `/* --- ${rel} --- */\n${fs.readFileSync(file, 'utf8').trimEnd()}`;
  }).join('\n\n');

  const jsBlock = jsFiles.map(({ file, rel }) => {
    return `/* --- ${rel} --- */\n${fs.readFileSync(file, 'utf8').trimEnd()}`;
  }).join('\n\n');

  guardStyleClose(cssBlock, 'v2 styles');
  guardScriptClose(jsBlock, 'v2 scripts');

  let output = shell.replace(
    '<!-- {{STYLE}} -->',
    () => `<style>\n/* injected by compiler/build.js --v2 */\n\n${cssBlock}\n</style>`
  );
  output = output.replace(
    '<!-- {{SCRIPTS}} -->',
    () => `<script>\n/* injected by compiler/build.js --v2 */\n\n${jsBlock}\n</script>`
  );

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(V2_OUT, output, 'utf8');

  const kb = (fs.statSync(V2_OUT).size / 1024).toFixed(1);
  console.log(`Built: dist/dwb2.html  (${kb} KB, ${jsFiles.length} JS file(s), ${cssFiles.length} CSS file(s))`);
  jsFiles.forEach(({ rel }) => console.log('  +', rel));

  return { kb, jsCount: jsFiles.length, cssCount: cssFiles.length, outFile: V2_OUT };
}

function guardScriptClose(block, label) {
  const _unsafeClose = /<\/script/i;
  if (_unsafeClose.test(block)) {
    const lines = block.split('\n');
    console.error(`\nBUILD ERROR: Unescaped </script found in compiled ${label} block.`);
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
}

function build() {
  const shell = fs.readFileSync(FRAME, 'utf8');

  const sources = [
    ...collectJs(NODES_DIR),
    ...collectJs(path.join(VIZ_DIR, 'canvas')),
    ...collectJs(path.join(VIZ_DIR, 'elements')),
    ...collectJs(path.join(VIZ_DIR, 'header')),
    ...collectPlugins(PLUGINS_DIR),
    ...collectJs(MERGE_DIR),
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
  guardScriptClose(pluginBlock, 'DWB plugin');

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

// Designer source file order — defines execution order in the compiled output
const DESIGNER_FILES = ['state.js', 'canvas.js', 'properties.js', 'fields.js', 'assets.js', 'io.js', 'main.js'];

function buildDesigner() {
  const framePath = path.join(DESIGNER_SRC, 'frame.html');
  const cssPath   = path.join(DESIGNER_SRC, 'style.css');

  if (!fs.existsSync(framePath)) { console.error('Missing designer/src/frame.html'); process.exit(1); }
  if (!fs.existsSync(cssPath))   { console.error('Missing designer/src/style.css');  process.exit(1); }

  const shell = fs.readFileSync(framePath, 'utf8');
  const css   = fs.readFileSync(cssPath, 'utf8').trimEnd();

  const sources = DESIGNER_FILES.map(f => {
    const file = path.join(DESIGNER_SRC, f);
    const rel  = path.relative(ROOT, file);
    if (!fs.existsSync(file)) { console.error(`Missing designer source: ${file}`); process.exit(1); }
    return { file, rel };
  });

  const scriptBlock = sources.map(({ file, rel }) => {
    const code = fs.readFileSync(file, 'utf8').trimEnd();
    return `/* --- ${rel} --- */\n${code}`;
  }).join('\n\n');

  guardScriptClose(scriptBlock, 'designer');

  // Inject CSS
  let output = shell.replace('<!-- {{STYLE}} -->', () => css);

  // Inject JS
  output = output.replace(
    '<!-- {{SCRIPTS}} -->',
    () => `<script>\n/* injected by compiler/build.js --target=designer */\n\n${scriptBlock}\n</script>`
  );

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(DESIGNER_OUT, output, 'utf8');

  const kb = (fs.statSync(DESIGNER_OUT).size / 1024).toFixed(1);
  console.log(`Built: dist/designer.html  (${kb} KB, ${sources.length} source file(s))`);
  sources.forEach(({ rel }) => console.log('  +', rel));

  return { kb, sourceCount: sources.length, outFile: DESIGNER_OUT };
}

// Only execute when run directly; require('./build') just gets the export.
if (require.main === module) {
  const v2Only  = process.argv.includes('--v2');
  const targetArg = process.argv.find(a => a.startsWith('--target='));
  const target    = targetArg ? targetArg.split('=')[1] : null;

  if (v2Only) {
    buildV2();
  } else if (target === 'designer') {
    buildDesigner();
  } else if (target === 'dwb' || target === 'workbench') {
    const result = build();
    if (process.argv.includes('--release')) {
      const relDir  = path.join(ROOT, 'releases');
      const relFile = path.join(relDir, 'workbench-latest.html');
      if (!fs.existsSync(relDir)) fs.mkdirSync(relDir, { recursive: true });
      fs.copyFileSync(result.outFile, relFile);
      console.log('→ Release copy written to releases/workbench-latest.html');
    }
  } else if (!target) {
    // No flags — build all targets
    const result = build();
    if (process.argv.includes('--release')) {
      const relDir  = path.join(ROOT, 'releases');
      const relFile = path.join(relDir, 'workbench-latest.html');
      if (!fs.existsSync(relDir)) fs.mkdirSync(relDir, { recursive: true });
      fs.copyFileSync(result.outFile, relFile);
      console.log('→ Release copy written to releases/workbench-latest.html');
    }
    buildDesigner();
    buildV2();
  } else {
    console.error(`Unknown --target="${target}". Valid values: dwb, designer`);
    process.exit(1);
  }
}

module.exports = { build, buildDesigner, buildV2 };

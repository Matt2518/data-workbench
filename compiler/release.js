#!/usr/bin/env node
'use strict';
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const { build, buildDesigner } = require('./build');

const ROOT         = path.resolve(__dirname, '..');
const RELEASES_DIR = path.join(ROOT, 'releases');
const CHANGELOG    = path.join(RELEASES_DIR, 'CHANGELOG.md');

const VERSION_RE   = /^v\d+\.\d+$/;

function prependChangelog(version, dwb, designer) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = [
    `## [${version}] — ${today}`,
    `_Release notes: (edit this line before committing)_`,
    `- DWB build: ${dwb.kb} KB, ${dwb.pluginCount} plugin(s)`,
    `- Designer build: ${designer.kb} KB, ${designer.sourceCount} source file(s)`,
    ''
  ].join('\n');

  const existing = fs.existsSync(CHANGELOG)
    ? fs.readFileSync(CHANGELOG, 'utf8')
    : '# Changelog\n_Releases are tagged and committed here._\n';

  // Insert before the first existing ## section, or append if none yet.
  const firstSection = existing.indexOf('\n## ');
  const updated = firstSection >= 0
    ? existing.slice(0, firstSection + 1) + entry + '\n' + existing.slice(firstSection + 1)
    : existing.trimEnd() + '\n\n' + entry + '\n';

  fs.writeFileSync(CHANGELOG, updated, 'utf8');
}

function git(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function main() {
  const version = process.argv[2];

  if (!version || !VERSION_RE.test(version)) {
    console.error('');
    console.error('Error: version argument missing or malformed.');
    console.error('');
    console.error('Usage:   node compiler/release.js v0.3');
    console.error('Pattern: v[major].[minor]   e.g. v0.1  v1.0  v2.14');
    console.error('');
    process.exit(1);
  }

  // 1. Build both targets sequentially
  const dwb      = build();
  const designer = buildDesigner();

  // 2. Create releases/ directory
  if (!fs.existsSync(RELEASES_DIR)) fs.mkdirSync(RELEASES_DIR, { recursive: true });

  // 3. Copy versioned and latest for each target
  fs.copyFileSync(dwb.outFile,      path.join(RELEASES_DIR, `dwb-${version}.html`));
  fs.copyFileSync(dwb.outFile,      path.join(RELEASES_DIR, 'dwb-latest.html'));
  fs.copyFileSync(designer.outFile, path.join(RELEASES_DIR, `designer-${version}.html`));
  fs.copyFileSync(designer.outFile, path.join(RELEASES_DIR, 'designer-latest.html'));

  // 4. Update CHANGELOG.md
  prependChangelog(version, dwb, designer);

  // 5. Git: stage, commit, tag
  git(`git add releases/dwb-${version}.html releases/dwb-latest.html releases/designer-${version}.html releases/designer-latest.html releases/CHANGELOG.md`);
  git(`git commit -m "release: ${version}"`);
  git(`git tag ${version}`);

  // 6. Summary
  console.log('');
  console.log(`✓ DWB built: ${dwb.kb} KB`);
  console.log(`✓ Copied to releases/dwb-${version}.html`);
  console.log(`✓ Copied to releases/dwb-latest.html`);
  console.log(`✓ Designer built: ${designer.kb} KB`);
  console.log(`✓ Copied to releases/designer-${version}.html`);
  console.log(`✓ Copied to releases/designer-latest.html`);
  console.log(`✓ CHANGELOG.md updated`);
  console.log(`✓ Committed and tagged ${version}`);
  console.log(`→ Next: edit release notes in releases/CHANGELOG.md, then:`);
  console.log(`  git push && git push --tags`);
}

main();

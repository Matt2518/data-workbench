#!/usr/bin/env node
'use strict';
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const { build }     = require('./build');

const ROOT         = path.resolve(__dirname, '..');
const RELEASES_DIR = path.join(ROOT, 'releases');
const CHANGELOG    = path.join(RELEASES_DIR, 'CHANGELOG.md');
const OUT_FILE     = path.join(ROOT, 'dist', 'workbench.html');

const VERSION_RE   = /^v\d+\.\d+$/;

function prependChangelog(version, kb, pluginCount) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = [
    `## [${version}] — ${today}`,
    `_Release notes: (edit this line before committing)_`,
    `- Build: ${kb} KB, ${pluginCount} plugin(s)`,
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

  // 1. Build
  const { kb, pluginCount } = build();

  // 2. Create releases/ directory
  if (!fs.existsSync(RELEASES_DIR)) fs.mkdirSync(RELEASES_DIR, { recursive: true });

  // 3. Copy versioned and latest
  const versionedFile = path.join(RELEASES_DIR, `workbench-${version}.html`);
  const latestFile    = path.join(RELEASES_DIR, 'workbench-latest.html');
  fs.copyFileSync(OUT_FILE, versionedFile);
  fs.copyFileSync(OUT_FILE, latestFile);

  // 4. Update CHANGELOG.md
  prependChangelog(version, kb, pluginCount);

  // 5. Git: stage, commit, tag
  git('git add releases/');
  git(`git commit -m "release: ${version}"`);
  git(`git tag ${version}`);

  // 6. Summary
  console.log('');
  console.log(`✓ Built: ${kb} KB`);
  console.log(`✓ Copied to releases/workbench-${version}.html`);
  console.log(`✓ Copied to releases/workbench-latest.html`);
  console.log(`✓ CHANGELOG.md updated`);
  console.log(`✓ Committed and tagged ${version}`);
  console.log(`→ Next: edit release notes in releases/CHANGELOG.md, then:`);
  console.log(`  git push && git push --tags`);
}

main();

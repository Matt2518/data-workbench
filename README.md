# DataWorkbench

A self-contained, browser-based data pipeline and visualization workbench.

The deliverable is always a **single compiled HTML file** — no server, no install. Open `dist/workbench.html` in any browser.

## Structure

```
src/
  frame/     — shell HTML, layout, CSS, core engine
  nodes/     — pipeline node plugins (.js, compiled in)
  viz/       — ECharts visualization nodes (.js, compiled in)
compiler/    — build and release scripts
releases/    — versioned release artifacts (committed)
dist/        — compiled output (git-ignored)
SPEC.md      — authoritative design specification
```

## Development

```bash
# Edit source files in src/
# Then build:
node compiler/build.js

# Open result in browser (Windows):
start dist/workbench.html

# Build and also copy to releases/workbench-latest.html:
node compiler/build.js --release
```

Dev loop: edit → build → refresh browser → check console.

## Releasing

```bash
# Build, version, commit, and tag in one step:
node compiler/release.js v0.X

# Then edit the generated release notes:
# releases/CHANGELOG.md  ← add a human summary

# Publish:
git push && git push --tags
```

The compiled release is available at `releases/workbench-latest.html` and `releases/workbench-v0.X.html`.

## Git conventions

Commit prefixes: `feat:`, `fix:`, `refactor:`, `node:`, `viz:`, `style:`, `build:`, `release:`

`dist/` is git-ignored. `releases/` is committed and tagged.

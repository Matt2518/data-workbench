# DataWorkbench

A self-contained, browser-based data pipeline and visualization workbench.

The build output is always a **single compiled HTML file** (`dist/workbench.html`) with no external dependencies beyond CDN-loaded libraries.

## Structure

```
src/
  frame/     — shell HTML, layout, app chrome
  nodes/     — pipeline node plugins
  viz/       — ECharts visualization nodes
compiler/    — build script
dist/        — compiled output (git-ignored)
```

## Build

```bash
node compiler/build.js
```

Output: `dist/workbench.html`

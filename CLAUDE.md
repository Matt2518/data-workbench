# DWB — Claude Code Guidelines

## Build targets — CRITICAL

This repo builds THREE separate applications. Never cross-contaminate them.

| Target | Source | Output | Command |
|---|---|---|---|
| DWB v1.0 | `src/` | `dist/workbench.html` | `node compiler/build.js` |
| DWB v2.0 | `src/v2/` | `dist/dwb2.html` | `node compiler/build.js --v2` |
| Designer | `designer/src/` | `dist/designer.html` | `node compiler/build.js --designer` |

**Never modify `src/` or `dist/workbench.html`.** v1.0 is production and untouched.
**Never modify `designer/src/` unless the task explicitly says "Template Designer".**
**All v2.0 work goes in `src/v2/` only.**

After any change to v2.0 source, always run:
node compiler/build.js --v2
and confirm `dist/dwb2.html` is produced. Then run the full build to confirm
`dist/workbench.html` is unchanged at ~757 KB / 55 plugins.

## Global namespace — CRITICAL

All `src/v2/` files share one global scope in the compiled output.
Every function MUST use its module prefix or it will silently collide.

| File | Private prefix | Public namespace |
|---|---|---|
| schema.js | (none) | `window.DWBSchema.*` |
| state.js | `_sh` | `window.DWBShell.*` |
| pipeline-executor.js | `_pe` | `window.DWBPipeline.*` |
| pipeline-tab.js | `_pt` | `window.DWBPipelineTab.*` |
| topbar.js | `_tb` | `window.DWBTopbar.*` |
| io.js | `_io` | `window.DWBio.*` |
| core-nodes.js | `_cn` | `window.DWBNodes.*` |
| viz-tab.js | `_vt` | `window.DWBVizTab.*` |
| displays-tab.js | `_dt` | `window.DWBDisplaysTab.*` |
| dashboard.js | `_d` | `window.DWBDashboard.*` |
| report.js | `_r` | `window.DWBReport.*` |
| presentation.js | `_pres` | `window.DWBPresentation.*` |
| timeline.js | `_tl` | `window.DWBTimelines.*` |
| wizard.js | `_wz` | `window.DWBWizard.*` |
| formula.js | `_fm` | `window.DWBNodes.FORMULA` |
| regex.js | `_rx` | `window.DWBNodes.REGEX_*` |
| fuzzy-standardize.js | `_fs` | `window.DWBNodes.FUZZY_STANDARDIZE` |

No unprefixed helper functions. No exceptions.

## Architecture rules

- Vanilla JS only — no frameworks, no bundler, no npm packages in source
- No API calls — security posture requires fully offline operation
- CDN libraries loaded lazily at runtime (ECharts, PptxGenJS, jsPDF, html2canvas)
- Never mutate input rows in node `run()` functions — always return new arrays
- Pull model for tab coordination — no pub/sub, no event bus
- `DWBShell.markDirty()` called after every mutation to flow state
- ECharts instances must be disposed before re-render via `echarts.getInstanceByDom()`
- Collapse animations via `max-height`/`flex-basis`, never `display:none`

## Known past bugs — do not reintroduce

1. **Function name collision** — `_buildAddModalHTML` existed in both
   `displays-tab.js` and `report.js`, silently overwriting each other.
   Prefix every function. Check for duplicates before shipping.

2. **Displays tab crash** — `_dtBuildDisplayTypeModalHTML` accessed
   `.placements` before null-checking the active display. Always null-check
   `_dtActiveDisplay()` before property access.

3. **Viz assets not persisting** — mutations to `flow.visualizations` were
   not calling `markDirty()`. Every write to flow state needs `markDirty()`.

4. **Tab timing** — tabs mounted before pipeline resolved had empty snapshots.
   `switchTab()` runs pipeline first if snapshots are empty, mounts in `.then()`.

5. **ECharts sizing** — charts in hidden containers render at 0×0. Always call
   `resize()` after the container becomes visible.

## v2.0 remaining work

See the conversation history in Claude.ai for full design decisions.
Remaining items (in order):
1. Viz: LINE/PIE/STACKED_DIVERGING_BAR/WORD_CLOUD renderers + config UI
2. Viz: STAT_CARD (multi-line tokenized, variables pane, filtered/unfiltered scope)
3. Viz: QUOTES_BOARD, RICH_TEXT, AI_ASSIST
4. Pipeline: full configUI for all remaining nodes (~4-5 prompts)
5. Displays: markDirty coverage for placement mutations
6. Displays: Merge display (attach/replace template, binding UI, preview, PDF)
7. Shell: Export HTML from Dashboard (offline ECharts embedded)
8. Shell: Splash screen + 8-step live tour

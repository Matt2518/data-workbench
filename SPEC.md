# Data Workbench + Visualizer — Project Specification
**Version:** 1.1  
**Status:** Active  
**Coordination:** This chat (design decisions) + Claude Code (file execution)

---

## 1. Vision

A single, self-contained `dist/workbench.html` file that serves as a professional-grade offline data pipeline and visualization platform. No server, no install, no dependencies beyond what is bundled or loaded from CDN. Deployable by dropping the file into any folder and opening it in a browser.

The tool has two audiences:
- **Power users** who build and run multi-step data pipelines
- **Novice users** who load a CSV and immediately explore it visually

Both audiences are served by the same file, with the UI guiding each naturally to what they need.

---

## 2. Architecture

### 2.1 Delivery Model
- **Single compiled HTML file** (`dist/workbench.html`)
- **Modular source** under `src/` — compiled by `compiler/build.js`
- Source is the truth; `dist/` is the artifact
- CDN dependencies loaded at runtime (ECharts, PapaParse, PptxGenJS)

### 2.2 Source Structure
```
src/
  frame/
    frame.html          ← App shell, layout, CSS, core engine
  nodes/
    01_ingest.js        ← CSV file ingest node
    02_export_csv.js    ← CSV export node
    03_add_column.js
    04_rename_column.js
    05_drop_columns.js
    ... (additional nodes, alphabetically sorted = load order)
  viz/
    v01_bar.js          ← Vertical bar chart node
    v02_horizontal_bar.js
    v03_line.js
    v04_pie.js
    v05_scatter.js
    v06_wordcloud.js
    v07_likert_stacked.js
    v08_table_display.js
compiler/
  build.js              ← Node.js build script
dist/                   ← gitignored compiled output
  workbench.html
SPEC.md                 ← This file
README.md
.gitignore
```

### 2.3 Compiler
`compiler/build.js` is a plain Node.js script (no bundler required):
1. Reads `src/frame/frame.html`
2. Collects all `.js` files from `src/nodes/` then `src/viz/`, sorted alphabetically
3. Wraps collected JS in a single `<script>` block
4. Replaces `<!-- {{NODES}} -->` placeholder in frame with that script block
5. Writes result to `dist/workbench.html`
6. Logs file size and plugin count

**Build command:** `node compiler/build.js`  
**Watch mode (future):** `node compiler/build.js --watch`

---

## 3. Application Layout

### 3.1 Top Bar
- App title: "Data Workbench"
- **Mode toggle:** `[⚙ Pipeline] [📊 Visualize]` — switches between the two main modes
- **Active Dataset indicator:** shows name of currently promoted dataset (e.g., "Active: filtered_roster.csv · 1,204 rows")
- **Theme toggle:** Light / Dark (Navy Digital Standard palette for both)
- **Workflow controls:** Save / Load / Export workflow (localStorage + JSON file)

### 3.2 Pipeline Mode Layout
```
┌─────────────────────────────────┬──────────────────┐
│  Config Panel (collapsible)     │                  │
├─────────────────────────────────│  Pipeline Track  │
│  Data Inspector (main area)     │  (right sidebar) │
│  - VDP headers                  │                  │
│  - Scrollable data table        │                  │
├─────────────────────────────────┴──────────────────┤
│  Console (collapsible, bottom)                     │
└────────────────────────────────────────────────────┘
```

### 3.3 Viz Mode Layout
```
┌──────────────────────────────────────────────────┐
│  Viz Toolbar: [+ Add Chart] [Layout] [Export PPT]│
├──────────────┬───────────────────────────────────┤
│  Chart       │  Dashboard Grid                   │
│  Config      │  (resizable chart cards)          │
│  Panel       │                                   │
│  (left)      │                                   │
└──────────────┴───────────────────────────────────┘
```

---

## 4. Data Model

### 4.1 Internal Pipeline Format
Pipeline nodes pass data as:
```javascript
{
  headers: ["Col1", "Col2", ...],   // string array
  rows: [["val", "val", ...], ...]  // array of arrays
}
```
This format is efficient for pipeline operations (filter, sort, drop columns, etc.)

### 4.2 Active Dataset (Viz Layer)
The viz layer works with objects, not arrays. A helper converts on promotion:
```javascript
// Exposed on window.DWB
DWB.toObjects(data)  // → [{Col1: "val", Col2: "val"}, ...]
DWB.fromObjects(objArray, headers)  // → {headers, rows}
```
The **Active Dataset** is a named snapshot promoted from any pipeline node, or loaded directly from a CSV file in Viz mode. It is stored as:
```javascript
DWB.activeDataset = {
  name: "filtered_roster",     // display name
  data: { headers, rows },     // raw pipeline format
  objects: [{...}, ...],       // converted for viz use
  rowCount: 1204,
  promotedFrom: "node-id",     // null if loaded directly
  timestamp: Date
}
```

### 4.3 Stash Model
Stashes are a **named dictionary** of snapshots — multiple stashes live simultaneously, each independently addressable by name. This is not a stack; there is no implicit push/pop. Users give each stash a meaningful name and can accumulate as many as needed.

```javascript
DWB.stashes = {
  "roster_raw": {
    name: "roster_raw",
    data: { headers, rows },
    timestamp: Date,
    nodeId: "node-id"
  },
  "fy25_snapshot": {
    name: "fy25_snapshot",
    data: { headers, rows },
    timestamp: Date,
    nodeId: "node-id"
  }
  // ... any number of named stashes
}
```

Stash UI is exposed in the Pipeline Track sidebar:
- **Stash panel** (collapsible, bottom of sidebar): lists all named stashes with timestamp, allows restore or promote-to-active
- Stashing is done via the `STASH_SAVE` node (inline in pipeline) or a sidebar "Stash Here" button on any node

Nodes that accept a secondary input (Fuzzy Match, Left Join, Diff) can reference **any named stash** as their secondary input — selected via a dropdown in their config panel that lists all currently live stash names.

---

## 5. Plugin Node System

### 5.1 Registration API
```javascript
DWB.register('NODE_TYPE_KEY', {
  title: 'Human Name',
  icon: '📁',              // emoji or SVG string
  category: 'Input & Output',
  desc: 'Short description shown in tool picker.',
  implemented: true,
  defaultConfig: { ... },

  // Renders config UI into the config panel
  // node: the node instance, prevData: upstream {headers,rows} or null
  renderConfig: (node, prevData) => { ... },

  // Pure function: takes input, returns output
  // Must throw with a descriptive message on failure
  execute: (node, inputData) => {
    // inputData is {headers, rows} or null for source nodes
    // must set node.output = {headers, rows}
  }
});
```

### 5.2 Node Categories
| Category | Description |
|---|---|
| Input & Output | CSV ingest, export, stash operations |
| Column Operations | Add, rename, drop, reorder, split, merge columns |
| Row Operations | Filter, sort, deduplicate, slice, sample |
| Transform | Formula columns, type casting, string ops, date parsing |
| Reconciliation | Fuzzy match, left join, diff/compare |
| Aggregate | Group by + count/sum/avg, pivot |
| Visualization | Chart nodes (render in place or promote to Viz mode) |

### 5.3 Utility API (available to all plugins via `window.DWB`)
```javascript
DWB.parseCSV(text)                    // → {headers, rows}
DWB.generateOptions(headers, selected) // → HTML option string
DWB.toObjects(data)                   // → array of objects
DWB.fromObjects(arr, headers)         // → {headers, rows}
DWB.runFrom(nodeId)                   // re-execute from node
DWB.renderActiveNode()                // re-render config panel
DWB.getStash(name)                    // → stash data or null
DWB.setStash(name, data, nodeId)      // save stash
DWB.listStashes()                     // → array of stash names
DWB.log(message, isError)            // write to console
DWB.promoteToActive(name, data)       // set active dataset
```

---

## 6. Visualization System

### 6.1 The Pipeline ↔ Viz Bridge: PUSH_TO_VIZ Node

The connection between the pipeline and the viz dashboard is a dedicated **`PUSH_TO_VIZ`** node. It is:

- **Non-destructive** — data passes through unchanged, pipeline continues normally downstream
- **Insertable anywhere** in the pipeline, not just at the end
- **Named** — the user gives the promoted dataset a label (e.g., "pre-match snapshot", "final results")
- **Additive** — multiple `PUSH_TO_VIZ` nodes in one pipeline expose multiple named datasets to the viz layer

Example pipeline:
```
INGEST → FILTER → [PUSH_TO_VIZ: "pre-match"] → FUZZY_MATCH → FILTER → [PUSH_TO_VIZ: "final results"]
```
The Viz mode dataset picker then shows: `pre-match` and `final results` as selectable options.

The Viz dashboard's dataset picker (top of viz toolbar) lists all currently promoted datasets by name. Switching datasets re-renders all charts against the new data.

**Direct CSV → Viz shortcut:** When a user loads a CSV directly from Viz mode, the engine silently creates an `INGEST` node + a `PUSH_TO_VIZ` node in the background, promotes the dataset, and lands the user in Viz mode ready to add charts. If they switch to Pipeline mode, those two nodes are already there and editable.

### 6.2 Chart Configuration Model
Each dashboard chart is an independent config object:
```javascript
{
  id: "chart-uuid",
  type: "bar",              // matches registered viz type
  title: "Completions by Region",
  config: {
    xField: "Region",
    yField: "Count",
    colorField: null,
    sortBy: "value_desc",
    maxCategories: 20,
    // ... type-specific options
  },
  echartsOverride: {}       // advanced: raw ECharts option merge
}
```

### 6.3 Chart Types (V1)
| Key | Name | Notes |
|---|---|---|
| `bar` | Vertical Bar | Category + value |
| `bar_h` | Horizontal Bar | Category + value, supports long labels |
| `line` | Line Chart | Time series or ordered categories |
| `pie` | Pie / Donut | Category distribution |
| `scatter` | Scatter Plot | Two numeric fields |
| `wordcloud` | Word Cloud | Single text field, auto stop-words |
| `likert` | Likert Stacked Bar | Grouped diverging bars, survey data |
| `table` | Summary Table | Aggregated data as formatted table |

### 6.4 Dashboard Layout
- **Grid system:** 1, 2, or 3 columns (user toggle)
- Each chart card: draggable to reorder, resizable via handle
- Chart card actions: Edit config, Duplicate, Remove, Expand (full-width)
- **Presentation mode:** hides all chrome, charts fill screen, keyboard navigation between charts

### 6.5 ECharts Integration
- ECharts 5.x loaded from cdnjs CDN
- echarts-wordcloud extension loaded from cdnjs CDN
- Each chart owns its ECharts instance, stored in `chart._echartsInstance`
- Global resize observer calls `.resize()` on all instances
- Theme tokens (colors, text color) derived from CSS variables at render time so light/dark switch updates charts

---

## 7. Theming System

### 7.1 Design Language
- **Palette base:** US Navy Digital Standard
- **Dark mode default:** Navy midnight backgrounds, gold accents
- **Light mode:** Clean white/slate, navy headers
- **No Tailwind** — pure CSS custom properties only

### 7.2 CSS Variables
```css
:root {
  /* Navy Brand */
  --navy-midnight: #002244;
  --navy-sailor: #005EB8;
  --navy-gold: #C5B230;
  --navy-light: #EAF2FB;

  /* Semantic (swap for dark mode) */
  --bg-main: #f8fafc;
  --bg-surface: #ffffff;
  --bg-raised: #f1f5f9;
  --border: #e2e8f0;
  --border-strong: #94a3b8;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --text-faint: #94a3b8;

  /* Accent */
  --accent: var(--navy-sailor);
  --accent-light: var(--navy-light);
  --accent-gold: var(--navy-gold);

  /* Status */
  --success: #059669;
  --warning: #f59e0b;
  --danger: #dc2626;
  --info: #0ea5e9;

  /* Likert scale (for survey viz) */
  --likert-strong-pos: #1d4ed8;
  --likert-pos: #3b82f6;
  --likert-somewhat-pos: #93c5fd;
  --likert-neutral: #94a3b8;
  --likert-somewhat-neg: #fdba74;
  --likert-neg: #f97316;
  --likert-strong-neg: #c2410c;
}

[data-theme="dark"] {
  --bg-main: #0a1628;
  --bg-surface: #0f2040;
  --bg-raised: #1a3056;
  --border: #1e3a5f;
  --border-strong: #2d5a8e;
  --text-main: #e2eaf4;
  --text-muted: #7ea3c4;
  --text-faint: #4a7099;
}
```

### 7.3 Theme Toggle
- Toggle button in top bar: ☀️ / 🌙
- Sets `data-theme="dark"` on `<html>`
- Persisted to localStorage
- ECharts instances re-render on theme change (using CSS variable values at render time)

---

## 8. Workflow Persistence

### 8.1 What Gets Saved
A workflow file captures the pipeline *structure*, not the data:
```javascript
{
  version: "1.0",
  name: "My Workflow",
  nodes: [
    { id, type, customName, isStarred, config }
    // file data (fileData) is always stripped — user re-uploads
  ],
  stashNames: ["snapshot_a", "snapshot_b"]  // names only, not data
}
```

### 8.2 Storage Options
- **localStorage:** Quick save/load by name, persists across sessions
- **JSON file:** Export/import for portability and sharing

### 8.3 Dashboard Layouts
Viz mode dashboard configs are saved separately:
- localStorage key: `dwb_dashboards`
- Exportable as part of an extended workflow JSON (v1.1 feature)

---

## 9. PowerPoint Export

### 9.1 Library
PptxGenJS 3.x loaded from CDN.

### 9.2 Export Model
- Each dashboard chart card exports as one slide
- Chart canvas captured via `canvas.toDataURL('image/png')`
- Image placed on slide, title added as text
- Slide dimensions: 10" × 5.63" (widescreen 16:9)
- Navy gradient title bar option per slide

### 9.3 Export Options
- Export all charts
- Export selected charts
- Export active (currently expanded) chart only
- Filename prompt before download

---

## 10. Direct CSV → Viz Shortcut

When a user is in Viz mode with no active dataset, a prominent drop zone is shown. The flow:

1. User drops or selects a CSV file in Viz mode
2. Engine **silently** creates two pipeline nodes: `INGEST` (with the file loaded) + `PUSH_TO_VIZ` (named after the filename)
3. Pipeline executes in the background
4. Dataset is promoted and appears in the viz dataset picker
5. User sees an empty dashboard with an **"+ Add Chart"** prompt
6. If the user switches to Pipeline mode, those two nodes are already there, fully editable

This means there is **no separate "viz-only" code path** — everything goes through the pipeline engine. The simplicity is in the UI, not the architecture. The user is never aware of the nodes unless they choose to look.

---

## 11. Node Catalog (V1 Implementation Targets)

### Priority 1 — Core (build these first)
| Key | Title |
|---|---|
| `INGEST` | Ingest CSV |
| `EXPORT_CSV` | Export to CSV |
| `PUSH_TO_VIZ` | Push Dataset to Viz |
| `FILTER` | Filter Rows |
| `SORT` | Sort Rows |
| `DROP_COLS` | Drop Column(s) |
| `RENAME_COL` | Rename Column |
| `ADD_COL` | Add Column |
| `STASH_SAVE` | Save to Stash |
| `STASH_RESTORE` | Restore from Stash |

### Priority 2 — Power Features
| Key | Title |
|---|---|
| `FUZZY_MATCH` | Fuzzy Match (vs. stash) |
| `LEFT_JOIN` | Left Join (vs. stash) |
| `DEDUP` | Deduplicate Rows |
| `REORDER_COLS` | Reorder Columns |
| `FORMULA_COL` | Formula Column |
| `TYPE_CAST` | Cast Column Type |
| `SLICE` | Slice Rows |
| `GROUP_BY` | Group By + Aggregate |

### Priority 3 — Nice to Have V1
| Key | Title |
|---|---|
| `SPLIT_COL` | Split Column |
| `MERGE_COLS` | Merge Columns |
| `FIND_REPLACE` | Find & Replace |
| `PIVOT` | Pivot Table |
| `DIFF` | Diff vs. Stash |
| `SAMPLE` | Random Sample |

---

## 12. Build & Dev Workflow

```bash
# One-time setup
npm init -y         # if not done
# No npm packages required for core build

# Build
node compiler/build.js

# Open result
open dist/workbench.html   # macOS
start dist/workbench.html  # Windows
```

**Dev loop:**
1. Edit source files in `src/`
2. Run `node compiler/build.js`
3. Refresh `dist/workbench.html` in browser
4. Check console for errors

**Git discipline:**
- Commit source changes, not dist (dist is gitignored)
- Commit messages: `feat:`, `fix:`, `refactor:`, `node:`, `viz:`, `style:`
- Tag releases when dist is stable enough to share: `git tag v0.1`

---

## 13. Out of Scope (V1)

- DAG / non-linear pipeline execution (deferred — architecture allows it later)
- Real-time collaboration
- Server-side anything
- Mobile/touch optimization
- Undo/redo history
- Published/end-user export (the "slim app" idea — shelved for now)
- Claude API integration (copy-prompt pattern from visualizer is acceptable stopgap)

---

## 14. Open Questions / Decisions Log

| # | Question | Decision | Date |
|---|---|---|---|
| 1 | DAG vs linear pipeline? | Linear with stash for now; engine designed to support DAG later | Today |
| 2 | Data format internal? | `{headers, rows}` for pipeline, `toObjects()` helper for viz | Today |
| 3 | CSS framework? | None — pure CSS custom properties, no Tailwind | Today |
| 4 | Build tool? | Plain Node.js script, no bundler | Today |
| 5 | ECharts version? | 5.x from cdnjs | Today |
| 6 | Dark mode default? | Light default, dark available, last choice persisted | Today |
| 7 | dist/ in git? | No — gitignored; tag releases manually | Today |
| 8 | Stash model: stack or dictionary? | Named dictionary — multiple stashes live simultaneously, addressable by name | Today |
| 9 | Pipeline ↔ Viz bridge? | `PUSH_TO_VIZ` node — non-destructive, insertable anywhere, named, multiple allowed | Today |
| 10 | Direct CSV → Viz: bypass pipeline? | No — silently create INGEST + PUSH_TO_VIZ nodes; pipeline always runs | Today |
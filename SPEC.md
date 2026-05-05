# Data Workbench + Visualizer — Project Specification
**Version:** 2.0  
**Status:** Active  
**Coordination:** This chat (design decisions) + Claude Code (file execution)

---

## 1. Vision

A single, self-contained `dist/workbench.html` file that serves as a
professional-grade offline data pipeline and visualization platform. No
server, no install, no dependencies beyond what is bundled or loaded from
CDN. Deployable by dropping the file into any folder and opening it in a
browser.

**Core principle: No data ever leaves the browser.** No API calls, no
telemetry, no external data transmission of any kind. This is a deliberate
security design decision for enterprise environments.

The tool serves two distinct audiences with the same file:
- **Power users** — build multi-step data pipelines to clean, reformat,
  join, and validate CSV files, then export results
- **Novice users** — load a CSV and immediately build charts and briefings

Both audiences are guided naturally by the UI. Novices may never discover
the pipeline side. Power users may never touch the viz side. Both workflows
are first-class.

---

## 2. Architecture

### 2.1 Delivery Model
- **Single compiled HTML file** (`dist/workbench.html`)
- **Modular source** under `src/` — compiled by `compiler/build.js`
- Source is the truth; `dist/` is the build artifact
- CDN dependencies: ECharts 5.x, PapaParse 5.x, PptxGenJS 3.x, Quill.js
- No Tailwind, no bundler, no npm packages required for core build

### 2.2 Source Structure
```
src/
  frame/
    frame.html              <- App shell, layout, CSS, core engine
  nodes/                    <- Pipeline node plugins (alphabetical = load order)
    01_ingest.js
    02_push_to_viz.js
    03_stash_save.js
    04_stash_restore.js
    05_export_csv.js
    06_filter.js
    07_sort.js
    08_drop_columns.js
    09_rename_column.js
    10_add_column.js
    11_set_types.js
    ... (additional nodes as built)
  viz/
    elements/               <- Viz element plugins
      e01_bar_vertical.js
      e02_bar_horizontal.js
      e03_line.js
      e04_pie.js
      e05_scatter.js
      e06_likert_group.js
      e07_wordcloud.js
      e08_kpi_stat.js
      e09_record_counter.js
      e10_data_table.js
      e11_text_rich.js
      e12_divider.js
      e13_calendar_heatmap.js
      e14_calendar_monthly.js
      e15_speedometer.js
      e16_calendar_weekly.js
      e17_calendar_month_of_year.js
      e18_map_choropleth.js
      e19_map_points.js
    header/                 <- Header block element plugins
      h01_filter_dropdown.js
      h02_date_range_slider.js
      h03_kpi_header.js
      h04_record_bar.js
    canvas/
      canvas.js             <- Block/slot/element model, filter coordinator
      prompt_builder.js     <- AI prompt construction
  data/
    us_states.geojson.js    <- Bundled as JS const
    navy_locations.js       <- Built-in installation lookup table
    templates/              <- Built-in .dwbflow workflow templates
      blank.dwbflow.js
      csv_reformat.dwbflow.js
      join_workflow.dwbflow.js
      survey_brief.dwbflow.js
compiler/
  build.js                  <- Node.js build script (exports build())
  release.js                <- Release script (version, tag, changelog)
releases/
  workbench-latest.html     <- Always current stable build
  workbench-v0.x.html       <- Versioned snapshots
  CHANGELOG.md
dist/                       <- gitignored dev build output
  workbench.html
SPEC.md
README.md
.gitignore
```

### 2.3 Compiler
`compiler/build.js` is a plain Node.js script:
1. Reads `src/frame/frame.html`
2. Collects all `.js` files from `src/nodes/`, `src/viz/elements/`,
   `src/viz/header/`, `src/viz/canvas/`, `src/data/` in order,
   sorted alphabetically within each directory
3. Wraps collected JS in a single `<script>` block
4. Replaces `<!-- {{NODES}} -->` placeholder with that script block
5. Writes result to `dist/workbench.html`
6. Returns `{ kb, pluginCount, outFile }` for use by release.js

**Build command:** `node compiler/build.js`
**Release command:** `node compiler/release.js v0.x`
**Watch mode (future):** `node compiler/build.js --watch`

### 2.4 Release System
`compiler/release.js v0.x`:
1. Validates version argument (pattern: v[0-9]+.[0-9]+)
2. Calls build()
3. Copies to `releases/workbench-v0.x.html` and `releases/workbench-latest.html`
4. Prepends entry to `releases/CHANGELOG.md` (newest-first)
5. Stages, commits ("release: v0.x"), and tags
6. Prints push reminder: `git push && git push --tags`

---

## 3. Splash Screen and App Entry

On every load, before showing the main app, display a splash screen.

### 3.1 Unsaved Session Banner
If localStorage contains an auto-saved session, show at top of splash:

  "Unsaved session found from [time ago]"
  [Resume session]  [Discard and start fresh]

### 3.2 Primary Actions Layout
```
+-----------------------------------------------+
|          Data Workbench  v0.x                 |
|                                               |
|  [Open Workflow]        [New Workflow]        |
|                                               |
|           -- or start fresh --               |
|                                               |
|  [Pipeline Task]        [Explore Data]        |
|  Clean, join,           Load a CSV and        |
|  reformat CSVs          build charts          |
|                                               |
|    [ New here? Start with the tutorial ]      |
|                                               |
|  Recent workflows:                            |
|  . User Profile Reformat    2h ago    >       |
|  . Learning History Join    3d ago    >       |
|  . FY25 Completion Brief    1w ago    >       |
+-----------------------------------------------+
```

### 3.3 Entry Path Behaviors
- **Open Workflow** — file picker filtered to `.dwbflow`, restores
  full app state exactly as saved
- **New Workflow** — name/description/tags dialog, then pipeline mode
  with empty canvas
- **Pipeline Task** — straight to pipeline mode, INGEST node pre-added
  and selected, config panel open ready for CSV drop. Zero friction.
- **Explore Data** — straight to viz mode, CSV drop zone prominent.
  On file load: INGEST + PUSH_TO_VIZ created silently in background.
- **Guided Tutorial** — opens tutorial overlay (stateless, always
  available on splash, never auto-shown). State NOT saved.

### 3.4 Recent Workflows
- Populated from localStorage key `dwb_recent`
- Format: array of `{ name, path, timestamp }`
- If empty: "No recent workflows — open a .dwbflow file or start fresh"
- If localStorage was recently cleared: show warning indicator
- Each item: click to open directly

---

## 4. Application Layout

### 4.1 Top Bar (always visible)
- App title: "Data Workbench"
- **Mode toggle:** [Pipeline] [Visualize]
- **Active Dataset indicator:** "dataset_name . 1,204 rows"
  (gold when dataset loaded, muted when empty)
- **Theme toggle:** sun/moon emoji
- **Workflow controls:** Save / Open / Export (.dwbflow)
- **Unsaved indicator:** subtle dot when session not yet file-exported

### 4.2 Pipeline Mode Layout
```
+--------------------------------+------------------+
|  Config Panel (collapsible,    |                  |
|  resizable, scrollable)        |  Pipeline Track  |
+-- drag divider ----------------+  (right sidebar) |
|  Data Inspector                |                  |
|  (scrollable, VDP headers,     |                  |
|  sticky column headers)        |                  |
+--------------------------------+------------------+
|  Console (collapsible, minimized by default)      |
+---------------------------------------------------+
```

- Config and Inspector share full height with a draggable divider
- Default split: 35% config / 65% inspector
- Split ratio persisted to localStorage `dwb_split_ratio`
- Each panel scrolls independently
- Scroll-hint gradient (CSS ::after) at panel bottom when content overflows
- Minimum height per panel: 120px
- Draggable divider: mousedown + pointermove, clamps to minimums,
  saves to localStorage on mouseup

### 4.3 Viz Mode Layout
```
+-----------------------------------------------------+
|  Sticky Header Block (configurable header elements) |
+------------------+----------------------------------+
|  Element Config  |  Canvas (scrollable block stack) |
|  Sidebar (left,  |                                  |
|  context-aware)  |  [Block: 2-column]               |
|                  |  +-------------+-------------+   |
|                  |  | Element     | Element     |   |
|                  |  | Element     |             |   |
|                  |  | (stacked)   |             |   |
|                  |  +-------------+-------------+   |
|                  |  [+ Add Block]                   |
|                  |  [Block: 1-column]               |
|                  |  +-----------------------------+ |
|                  |  | Element                     | |
|                  |  +-----------------------------+ |
+------------------+----------------------------------+
```

- Sidebar is context-aware: shows config for selected element
- Filter bar appears below header block when filters are active

### 4.4 Presentation Mode
- Fullscreen toggle (button in viz toolbar, or F key)
- Hides all chrome: sidebar, top bar, block controls
- Renders canvas edge-to-edge
- Filter bar remains visible (active filters shown as chips)
- Keyboard nav: arrow keys between blocks, Escape exits

---

## 5. Data Model

### 5.1 Internal Pipeline Format
```javascript
{
  headers: ["Col1", "Col2", ...],
  rows: [["val", "val", ...], ...],
  columnTypes: ["text", "number", ...],  // optional, one per header
  columnTypeMeta: {                      // optional, only for likert columns
    [colIndex]: {
      scale: ["val1", "val2", ...],      // ordered negative to positive
      midpoint: "val3",                  // neutral value, may be null
      positiveEnd: "right",
      displayLabels: { "val1": "Display Name" }
    }
  }
}
```

All pass-through nodes must use `DWB.passthroughCopy(data)` to preserve
columnTypes and columnTypeMeta. Never pass object references between nodes.

### 5.2 Column Types
| Type | Detection Rule |
|---|---|
| `likert` | Unique values match a known Likert scale (case-insensitive) |
| `number` | >80% of non-empty values parse as finite float (strips $,%) |
| `date` | >80% parse as valid Date AND value length > 4 chars |
| `categorical` | uniqueCount <= 20 AND ratio <= 15% AND avg words <= 4 |
| `text` | Default fallback |

Detection priority: likert > number > date > categorical > text

Known Likert scales include (but are not limited to):
- strongly disagree / disagree / neutral / agree / strongly agree
- never / rarely / sometimes / often / always
- very dissatisfied / dissatisfied / neutral / satisfied / very satisfied
- not at all / barely / neutral / somewhat / strongly
- 1 / 2 / 3 / 4 / 5  and  1 / 2 / 3 / 4
- yes / no,  true / false,  complete / incomplete

### 5.3 Active Dataset
```javascript
DWB.activeDataset = {
  name: "dataset_name",
  data: { headers, rows, columnTypes, columnTypeMeta },
  objects: [{ Col1: "val", Col2: "val" }, ...],
  rowCount: 1204,
  columnTypes: [...],
  columnTypeMeta: { ... },
  promotedFrom: "node-id",   // null if loaded directly
  timestamp: Date
}
```

### 5.4 Multiple Promoted Datasets
All datasets promoted via PUSH_TO_VIZ are stored:
```javascript
DWB.promotedDatasets = {
  "pre_match": { ...dataset shape... },
  "final_results": { ...dataset shape... }
}
```
The viz dataset picker lists all promoted datasets by name.
Each element independently specifies which dataset it uses
(defaults to most recently promoted).

### 5.5 Stash Model
Named dictionary — multiple stashes live simultaneously:
```javascript
DWB.stashes = {
  "roster_raw": {
    name: "roster_raw",
    data: { headers, rows, columnTypes, columnTypeMeta },
    timestamp: Date,
    nodeId: "node-id"
  }
}
```
Nodes accepting secondary input (FUZZY_MATCH, LEFT_JOIN, DIFF, ANTI_JOIN)
reference stashes by name via a dropdown in their config panel.

---

## 6. Workflow Persistence

### 6.1 File Format: .dwbflow
Custom file extension. Underlying format is JSON.
```javascript
{
  "version": "2.0",
  "appVersion": "0.3",
  "name": "User Profile Reformat",
  "description": "Reformats LCMS export to new user upload format",
  "tags": ["LCMS", "user-management", "production"],
  "notes": "Run monthly after LCMS export. Re-upload source file each time.",
  "created": "2025-05-05T...",
  "modified": "2025-05-05T...",
  "appState": {
    "activeMode": "pipeline",
    "splitRatio": 0.35,
    "activeNodeId": "node-uuid"
  },
  "pipeline": {
    "nodes": [
      {
        "id": "node-uuid",
        "type": "INGEST",
        "customName": "LCMS Export",
        "isStarred": false,
        "config": {
          "fileName": "lcms_export.csv"
          // fileData ALWAYS stripped -- user re-uploads
        }
      }
    ],
    "stashNames": ["pre_join_snapshot"]  // names only, not data
  },
  "viz": {
    "blocks": [...],
    "headerElements": [...],
    "activeDatasetName": "final_output"
  },
  "columnTypeMeta": { ... }  // SET_TYPES overrides preserved
}
```

### 6.2 Storage Strategy
| Layer | Purpose | localStorage Key |
|---|---|---|
| `.dwbflow` file | Primary persistence | n/a (filesystem) |
| localStorage | Auto-save cache | `dwb_autosave` |
| localStorage | Recent workflows list | `dwb_recent` |
| localStorage | Theme preference | `dwb_theme` |
| localStorage | Panel split ratio | `dwb_split_ratio` |
| localStorage | Prompt templates | `dwb_prompt_templates` |

localStorage is convenience cache only. Enterprise browsers may clear it.
The .dwbflow file is the only reliable persistence.

### 6.3 Auto-save
- Silent auto-save to localStorage every 30 seconds
- Subtle pulsing indicator in top bar during auto-save
- On splash load: detect auto-save, offer Resume or Discard

### 6.4 Unsaved Indicator
Top bar shows a subtle dot when session not yet exported to .dwbflow.
After 5 pipeline runs without export, gentle toast notification:
"Consider saving a .dwbflow backup -- localStorage can be cleared."

### 6.5 Built-in Workflow Templates
Bundled as JS constants in `src/data/templates/`, available from New
Workflow dialog:
| Template | Nodes Pre-Built |
|---|---|
| Blank | Empty |
| CSV Reformat | INGEST, TRIM_WHITESPACE, CASE_NORMALIZE, REORDER_COLS, EXPORT_CSV |
| Join Workflow | INGEST, STASH_SAVE, INGEST, LEFT_JOIN, EXPORT_CSV |
| Survey Brief | INGEST, SET_TYPES, PUSH_TO_VIZ |

---

## 7. Plugin Node System

### 7.1 Registration API
```javascript
DWB.register('NODE_TYPE_KEY', {
  title: 'Human Name',
  icon: '...',                // emoji or SVG string
  category: 'Input & Output',
  desc: 'Short description shown in tool picker.',
  implemented: true,
  defaultConfig: { ... },

  // Renders config UI into config panel
  // node: node instance, prevData: upstream data or null
  renderConfig: (node, prevData) => { ... },

  // Pure function. Must set node.output. Must throw on failure.
  execute: (node, inputData) => {
    // inputData: {headers, rows, columnTypes, columnTypeMeta} or null
    // node.output must be set to {headers, rows, ...}
  }
});
```

### 7.2 Node Authoring Patterns

**Config change triggers:**
- Dropdowns (structural changes): `onchange -> DWB.runFrom(node.id)`
- Text inputs: `oninput -> DWB.updateConfig(node.id, key, value)` ONLY.
  Never call renderActiveNode() from oninput.
  Explicit "Apply" or "Run" button calls `DWB.runFrom(node.id)`.

**Source nodes:** INGEST, STASH_RESTORE ignore inputData entirely.
Document this clearly. Data flows from their output, not upstream.

**Pass-through copies:** Always use `DWB.passthroughCopy(data)`.
Never mutate or reference-pass data between nodes.

**Sidebar label:** If node sets `node.customName`, call
`DWB.renderTrack()` before `DWB.runFrom()`.

**File type guard:** Validate extension, warn via `DWB.log()`, no crash.

**Validation nodes:** Flag rows by adding a `_flag` column (PASS/FAIL +
message). Do not filter by default. Let user decide with FILTER downstream.

**Event delegation:** Use single parent listener with `e.target.dataset.idx`
for dynamic checkbox/input lists. Do not attach per-element listeners.

**DROP_COLS column index remapping:** When columns are removed, remap
columnTypeMeta indices to match the new column positions.

### 7.3 Utility API (window.DWB)
```javascript
// Data
DWB.parseCSV(text)                      // -> {headers, rows} via PapaParse RFC4180
DWB.passthroughCopy(data)               // -> deep copy preserving all fields
DWB.toObjects(data)                     // -> [{col: val}, ...]
DWB.fromObjects(arr, headers)           // -> {headers, rows}
DWB.generateOptions(headers, selected)  // -> HTML <option> string

// Type system
DWB.inferTypes(data)                    // -> string[] one per column
DWB.getColumnMeta(colIndex)             // -> {type, meta} from activeDataset
DWB.updateConfig(nodeId, key, value)    // update config without re-render

// Pipeline
DWB.runFrom(nodeId)                     // re-execute from node forward
DWB.renderActiveNode()                  // re-render config panel (structural only)
DWB.renderTrack()                       // re-render pipeline sidebar

// Stash
DWB.getStash(name)                      // -> stash object or null
DWB.setStash(name, data, nodeId)        // save named stash
DWB.listStashes()                       // -> string[] of names

// Viz bridge
DWB.promoteToActive(name, data)         // promote dataset, update top bar
DWB.promotedDatasets                    // all promoted datasets

// Logging
DWB.log(message, level)                 // level: 'info'|'success'|'warn'|'error'
```

### 7.4 Node Categories
| Category | Description |
|---|---|
| Input & Output | CSV ingest, export, stash, push to viz |
| Column Operations | Add, rename, drop, reorder, split, merge, type setting |
| Row Operations | Filter, sort, deduplicate, slice, sample |
| String Operations | Case, trim, find/replace, pad, extract, truncate |
| Date Operations | Format, parse, add, diff, extract, compare |
| Validation | Email, regex, list, range, flag duplicates/empty |
| Lookup & Mapping | Value map, categorize, fill down, coalesce |
| Reconciliation | Fuzzy match, joins, union, diff |
| Aggregate | Group by, pivot, unpivot, transpose |
| Analysis | Sentiment scoring (bundled lexicon, no API) |

### 7.5 Node Catalog

#### Currently Implemented (v0.2)
| Key | Title | Category |
|---|---|---|
| `INGEST` | Ingest CSV | Input & Output |
| `PUSH_TO_VIZ` | Push to Viz | Input & Output |
| `STASH_SAVE` | Save to Stash | Input & Output |
| `STASH_RESTORE` | Restore from Stash | Input & Output |
| `EXPORT_CSV` | Export to CSV | Input & Output |
| `FILTER` | Filter Rows | Row Operations |
| `SORT` | Sort Rows | Row Operations |
| `DROP_COLS` | Drop Column(s) | Column Operations |
| `RENAME_COL` | Rename Column | Column Operations |
| `ADD_COL` | Add Column | Column Operations |
| `SET_TYPES` | Set Column Types | Column Operations |

#### Priority 1 -- Build Next
| Key | Title | Category | Notes |
|---|---|---|---|
| `REORDER_COLS` | Reorder Columns | Column Operations | Drag or up/down buttons |
| `CASE_NORMALIZE` | Normalize Case | String Operations | UPPER/lower/Title/Sentence |
| `TRIM_WHITESPACE` | Trim Whitespace | String Operations | Leading/trailing/internal |
| `FIND_REPLACE` | Find and Replace | String Operations | Literal or regex |
| `DEDUP` | Deduplicate Rows | Row Operations | Exact or key-column based |
| `LEFT_JOIN` | Left Join | Reconciliation | One-to-many supported |
| `VALUE_MAP` | Value Map | Lookup & Mapping | Code to label replacement |
| `DATE_FORMAT` | Format Date | Date Operations | Convert between formats |
| `VALIDATE_EMAIL` | Validate Email | Validation | Flag invalid emails |
| `VALIDATE_LIST` | Validate Against List | Validation | Cross-ref allowed values |
| `FILL_DOWN` | Fill Down | Lookup & Mapping | Fill empty cells from above |

#### Priority 2
| Key | Title | Category |
|---|---|---|
| `SPLIT_COL` | Split Column | Column Operations |
| `MERGE_COLS` | Merge Columns | Column Operations |
| `DUPLICATE_COL` | Duplicate Column | Column Operations |
| `PAD_COLUMN` | Pad Column | String Operations |
| `EXTRACT_PATTERN` | Extract Pattern (Regex) | String Operations |
| `TRUNCATE` | Truncate | String Operations |
| `DATE_PARSE` | Parse Date | Date Operations |
| `DATE_ADD` | Date Add/Subtract | Date Operations |
| `DATE_DIFF` | Date Difference | Date Operations |
| `DATE_EXTRACT` | Extract Date Parts | Date Operations |
| `DATE_COMPARE` | Compare to Date | Date Operations |
| `VALIDATE_REGEX` | Validate Regex | Validation |
| `VALIDATE_RANGE` | Validate Numeric Range | Validation |
| `FLAG_DUPLICATES` | Flag Duplicates | Validation |
| `FLAG_EMPTY` | Flag Empty Cells | Validation |
| `CATEGORIZE` | Categorize / Bin | Lookup & Mapping |
| `COALESCE` | Coalesce Columns | Lookup & Mapping |
| `ADD_ROW_NUM` | Add Row Number | Row Operations |
| `SLICE` | Slice Rows | Row Operations |
| `SAMPLE` | Random Sample | Row Operations |
| `FORMULA_COL` | Formula Column | Column Operations |
| `TYPE_CAST` | Cast Column Type | Column Operations |
| `GROUP_BY` | Group By + Aggregate | Aggregate |
| `INNER_JOIN` | Inner Join | Reconciliation |
| `ANTI_JOIN` | Anti Join (Gap Analysis) | Reconciliation |
| `UNION` | Union / Stack | Reconciliation |
| `FUZZY_MATCH` | Fuzzy Match | Reconciliation |
| `DIFF` | Diff vs Stash | Reconciliation |

#### Priority 3
| Key | Title | Category | Notes |
|---|---|---|---|
| `PIVOT` | Pivot Table | Aggregate | Rows to columns |
| `UNPIVOT` | Unpivot | Aggregate | Columns to rows, Likert prep |
| `TRANSPOSE` | Transpose | Aggregate | Flip rows/columns |
| `FILL_TEMPLATE` | Fill Template | String Operations | Per-row text template |
| `SENTIMENT` | Sentiment Score | Analysis | Bundled lexicon only, no API |
| `VALIDATION_REPORT` | Validation Report | Validation | Summarize all _flag columns |
| `SPLIT_VALID` | Split Valid/Invalid | Validation | Route failures to stash |
| `LOOKUP_JOIN` | Inline Lookup Join | Lookup & Mapping | Paste small lookup table |

---

## 8. Viz Element System

### 8.1 Registration API
```javascript
DWB.registerElement('ELEMENT_KEY', {
  title: 'Horizontal Bar',
  icon: '...',
  category: 'Charts',
  desc: 'Category comparison with horizontal bars.',
  headerCompatible: false,  // true = usable in header block

  // Column type hints for smart picker suggestions
  columnAffinity: {
    primary: ['categorical', 'text'],
    value: ['number']
  },

  renderConfig: (element, dataset) => { ... },
  render: (element, dataset, filters) => { ... },
  onFilterChange: (element, dataset, filters) => { ... },
  onThemeChange: (element) => { ... },
  getPromptContext: (element, dataset, filters) => { ... },
  getEchartsInstance: (element) => { ... }  // null if not ECharts
});
```

### 8.2 Canvas Block Model (Three-Level Hierarchy)

**Block** > **Slot** > **Element**

- Block: layout container (1/2/3 columns)
- Slot: a column within a block, contains a vertical stack of elements
- Element: a single piece of content

Multiple elements can stack vertically in one slot (infographic style).

```javascript
{
  id: "block-uuid",
  layout: "2col",           // "1col" | "2col" | "3col"
  colRatios: [60, 40],      // percent widths, must sum to 100
  slots: [
    {
      id: "slot-uuid",
      elements: [
        {
          id: "element-uuid",
          type: "BAR_H",
          title: "Completions by Region",
          datasetName: "final_results",
          config: { ... },
          echartsOverride: { }
        },
        {
          id: "element-uuid-2",
          type: "TEXT_RICH",
          content: "<p>Insight text here</p>"
        }
      ]
    }
  ]
}
```

Column ratio presets: 100 / 50+50 / 60+40 / 70+30 / 33+33+33 / 50+25+25

### 8.3 Header Block
Singleton block, always rendered sticky at top of canvas.
Limited to ~100px height. Elements populate left-to-right.
Header elements apply globally via filter coordinator.

| Key | Title | Notes |
|---|---|---|
| `FILTER_DROPDOWN` | Filter Dropdown | Multi-select, any column |
| `DATE_RANGE_SLIDER` | Date Range Slider | Date-typed columns only |
| `KPI_HEADER` | KPI Stat | Computed from filtered data |
| `RECORD_BAR` | Record Counter Bar | "xxx of x,xxx records showing" |
| `TEXT_LABEL` | Static Text Label | Title or section label |

### 8.4 Filter Coordinator
```javascript
DWB.viz.filters = [
  { column: "Region", value: "East", source: "element-uuid" },
  { column: "Quarter", value: "Q3", source: "element-uuid-2" }
]
```

- Filters stack with AND logic
- Click value on filterable element: add filter
- Click same value again: remove filter
- Filter bar (below header block): active filters as dismissible chips
- All elements' onFilterChange called when coordinator state changes
- Elements re-render from full dataset applying current filters
- Filters NOT saved to .dwbflow (canvas always loads unfiltered)

### 8.5 Element Type Registry

#### Charts
| Key | Title | Filterable | Notes |
|---|---|---|---|
| `BAR_V` | Vertical Bar | Yes -- click bar | Category + value |
| `BAR_H` | Horizontal Bar | Yes -- click bar | Long label support |
| `LINE` | Line Chart | Yes -- click point | Time series or ordered |
| `PIE` | Pie / Donut | Yes -- click slice | |
| `SCATTER` | Scatter Plot | Yes -- click point | Two numeric fields |
| `LIKERT_GROUP` | Likert Group | Partial | Same scale always |
| `WORDCLOUD` | Word Cloud | Yes -- click word | |
| `SPEEDOMETER` | Gauge / Speedometer | No | ECharts gauge chart |

#### Calendar
| Key | Title | Notes |
|---|---|---|
| `CALENDAR_HEAT` | Calendar Heatmap | Date col + value/count |
| `CALENDAR_MONTH` | Calendar Monthly | Date + label + color col |
| `CALENDAR_WEEK` | Calendar Weekly | Week-over-week, value per day |
| `CALENDAR_MOY` | Month of Year | Seasonal pattern, multi-year agg |

#### Geo
| Key | Title | Notes |
|---|---|---|
| `MAP_CHOROPLETH` | Choropleth Map | ECharts GeoJSON, offline capable |
| `MAP_POINTS` | Point / Callout Map | Navy HQ lookup built-in |

#### Data
| Key | Title | Notes |
|---|---|---|
| `KPI_STAT` | KPI Stat | Aggregation + optional delta comparison |
| `RECORD_COUNTER` | Record Counter Bar | Always reflects filters |
| `DATA_TABLE` | Data Table | Column picker, keyword search + highlight |

#### Layout
| Key | Title | Notes |
|---|---|---|
| `TEXT_RICH` | Text / Insight | Quill.js rich text, AI paste-back target |
| `DIVIDER` | Divider | Visual separator |

### 8.6 Column Picker Pattern
Elements mapping data to visual structure use explicit column binding.
Pattern: **structure axis** (date/location) + **value axis** (numeric or
count) + **label/color axis** (categorical, optional).

**Data Table:** column multi-select (ordered), keyword search across
selected columns only.

**Calendar Heatmap:** date col (required) + value col (numeric or count)
+ aggregation (sum/avg/count).

**Calendar Monthly:** date col (required) + label col (optional text
shown on day cell) + color col (categorical, drives badge color).

**Calendar Weekly:** date col + value col (numeric) + group col
(optional, multiple series).

**Calendar Month of Year:** date col + value col + aggregation
(aggregates across all years for that month).

**Map Points:** point source (lat/long columns OR named Navy installation
lookup) + label col + value col + color thresholds + up to 3 callout fields.

### 8.7 KPI Element Config
- Column: numeric columns or "Record Count"
- Aggregation: Sum / Average / Min / Max / Count / Count Distinct
- Label, Format (number/percent/integer/currency), Decimal places
- Optional delta comparison:
  - vs. static target (user enters value)
  - vs. another column's aggregate
  - vs. same metric unfiltered (automatic checkbox)

Complexity beyond these aggregations belongs in the pipeline.
KPI elements display values -- they do not compute derived metrics.

### 8.8 ECharts Integration
- ECharts 5.x from cdnjs CDN
- echarts-wordcloud extension from cdnjs CDN
- Each chart element owns its ECharts instance
- Global ResizeObserver calls .resize() on all instances
- Theme tokens read from CSS variables at render time
- onThemeChange hook triggers re-render on light/dark switch

### 8.9 Geo Map Notes
- Default: ECharts built-in GeoJSON (offline, no tile server needed)
- US states GeoJSON bundled as JS const (src/data/us_states.geojson.js)
- Navy installations lookup in src/data/navy_locations.js
- Point/callout map: click a point to filter globally (filter coordinator)
- Optional Leaflet + OSM tiles for online environments (future)

---

## 9. AI Prompt Builder

### 9.1 Principles
- No API calls -- copy/paste only, human in the loop by design
- One copy button (no AI tool differentiation)
- Prompt requests HTML-structured response (Quill-compatible)
- Paste-back parses HTML into Quill editor with preview before insert

### 9.2 Two Prompt Levels

**Dataset-level:** Full dataset summary (shape, types, distributions)
+ current filter state + editable question section.

**Block/widget-level:** Widget aggregated data (what chart renders)
+ full dataset summary as background + filter state + 25 sample rows
from filtered dataset (random or stratified) + targeted question.

Token size is not a primary concern (enterprise AI subscription).

### 9.3 Prompt Modal
- Format preset dropdown (see 9.4) or Freeform textarea
- Generated prompt in editable textarea (user can modify before copy)
- [Copy Prompt] button
- Paste AI response area
- [Preview] shows how response will render in Quill
- [Insert into Block] commits to text element after user review

### 9.4 Format Presets
| Format | Structure |
|---|---|
| Executive Summary | Headline + narrative + recommendation |
| Bullet Points | Pure bulleted list |
| Gap Analysis | What is missing / needs attention |
| Trend Narrative | Change over time, direction, velocity |
| Talking Points | 3-5 leadership-ready bullets |
| Comparative | Side-by-side contrast of two groups |
| Freeform | User specifies format in textarea |

### 9.5 Prompt Output Format
Prompt instructs AI to respond using HTML tags Quill renders natively:
`<h2>` for headers, `<p>` for paragraphs, `<ul>/<li>` for bullets.
Context always uses aggregated summaries -- never raw row dumps except
for the 25 sample rows section.

### 9.6 Prompt Templates
User-defined templates saved to localStorage `dwb_prompt_templates`.
Built-in presets are hardcoded. Custom templates are user-created and
can be named, saved, and reused.

---

## 10. Rich Text (Quill.js)

- Library: Quill.js loaded from CDN
- Used in: TEXT_RICH canvas elements and AI paste-back preview
- Output format: HTML (renders in canvas, prints cleanly, PPTX export)
- Toolbar: bold, italic, underline, H2, H3, bullet list, numbered list,
  link. Nothing beyond what is needed for briefing text.
- Tokenized text (v1.1 future): {{Region}} resolves to current filter
  value, {{rowCount}} shows filtered count. Design text blocks with
  this in mind from the start.

---

## 11. Export System

### 11.1 Print to PDF
- @media print stylesheet hides chrome (sidebar, top bar, controls)
- Blocks render full-width
- Page breaks configurable per block
- Optional Navy header on each printed page
- User: File > Print > Save as PDF. No library required.

### 11.2 Standalone HTML Export
- Existing report export
- Embeds current canvas state as static HTML
- No pipeline data, no config UI -- view only

### 11.3 PowerPoint Export (PptxGenJS 3.x)
- One slide per chart element (or per block, configurable)
- Chart canvas captured via canvas.toDataURL('image/png')
- Text blocks: HTML to PptxGenJS text runs via converter utility
- Slide: 10" x 5.63" widescreen 16:9
- Optional Navy gradient title bar per slide
- Export options: all / selected / current block
- Captures current render state including active filters
- Filename prompt before download

---

## 12. Theming System

### 12.1 Design Language
- Palette: US Navy Digital Standard
- Light mode: white/slate, navy headers (default)
- Dark mode: navy midnight backgrounds, gold accents
- No Tailwind -- pure CSS custom properties only

### 12.2 CSS Variables
```css
:root {
  --navy-midnight: #002244;
  --navy-sailor:   #005EB8;
  --navy-gold:     #C5B230;
  --navy-light:    #EAF2FB;

  --bg-main:       #f8fafc;
  --bg-surface:    #ffffff;
  --bg-raised:     #f1f5f9;
  --border:        #e2e8f0;
  --border-strong: #94a3b8;
  --text-main:     #1e293b;
  --text-muted:    #64748b;
  --text-faint:    #94a3b8;

  --accent:        var(--navy-sailor);
  --accent-light:  var(--navy-light);
  --accent-gold:   var(--navy-gold);

  --success:  #059669;
  --warning:  #f59e0b;
  --danger:   #dc2626;
  --info:     #0ea5e9;

  --likert-strong-pos:   #1d4ed8;
  --likert-pos:          #3b82f6;
  --likert-somewhat-pos: #93c5fd;
  --likert-neutral:      #94a3b8;
  --likert-somewhat-neg: #fdba74;
  --likert-neg:          #f97316;
  --likert-strong-neg:   #c2410c;
}

[data-theme="dark"] {
  --bg-main:       #0a1628;
  --bg-surface:    #0f2040;
  --bg-raised:     #1a3056;
  --border:        #1e3a5f;
  --border-strong: #2d5a8e;
  --text-main:     #e2eaf4;
  --text-muted:    #7ea3c4;
  --text-faint:    #4a7099;
}
```

### 12.3 Theme Toggle
- Sun/moon in top bar
- Sets data-theme="dark" on html element
- Persisted to localStorage dwb_theme
- ECharts onThemeChange hook fires on all active elements

---

## 13. Build and Release Workflow

```bash
# Dev build
node compiler/build.js
open dist/workbench.html     # macOS
start dist/workbench.html    # Windows

# Release
node compiler/release.js v0.x
# Edit releases/CHANGELOG.md release notes line
git add releases/CHANGELOG.md
git commit --amend --no-edit
git push && git push --tags
```

Git discipline:
- Commit source, not dist/ (dist/ is gitignored)
- releases/ IS committed and tracked
- Commit prefixes: feat: / fix: / node: / viz: / style: / refactor: / release:
- Tag stable releases with git tag v0.x

---

## 14. Out of Scope (V1)

- DAG / non-linear pipeline (architecture supports it later)
- Real-time collaboration
- Server-side anything
- API calls of any kind (hard security constraint)
- Mobile / touch optimization
- Undo / redo history
- Tokenized text blocks (v1.1)
- Guided tutorial content (button present on splash, content TBD)
- Leaflet tile maps (future option for online environments)

---

## 15. Decisions Log

| # | Decision |
|---|---|
| 1 | DAG vs linear? Linear with stash; engine designed for DAG later |
| 2 | Data format? {headers, rows} + optional columnTypes/columnTypeMeta |
| 3 | CSS framework? None -- pure CSS custom properties |
| 4 | Build tool? Plain Node.js script, no bundler |
| 5 | ECharts version? 5.x from cdnjs |
| 6 | Dark mode default? Light default, persisted to localStorage |
| 7 | dist/ in git? No -- gitignored. releases/ IS committed. |
| 8 | Stash model? Named dictionary, not a stack |
| 9 | Pipeline-Viz bridge? PUSH_TO_VIZ node, non-destructive, named, multiple |
| 10 | Direct CSV to Viz bypass pipeline? No -- silent INGEST + PUSH_TO_VIZ |
| 11 | No API calls ever -- hard security constraint, all processing local |
| 12 | Copy/paste AI pattern -- human in the loop by design |
| 13 | Two AI prompt levels: dataset-level and block/widget-level |
| 14 | AI prompts: aggregated summaries + 25 sample rows (token size not concern) |
| 15 | Editable prompt modal with preview + edit before insert |
| 16 | Prompt templates saved to localStorage |
| 17 | One copy button -- no AI tool differentiation |
| 18 | Prompt requests HTML-structured response (Quill-compatible) |
| 19 | Paste-back parses HTML into Quill with preview before insert |
| 20 | PPTX export needs HTML to PptxGenJS text converter utility |
| 21 | Rich text editor: Quill.js via CDN |
| 22 | Viz layout: blocks > slots > elements (three-level hierarchy) |
| 23 | Slots can contain multiple stacked elements (infographic style) |
| 24 | Header block: singleton, sticky, limited height, left-to-right |
| 25 | Filter coordinator: global, additive AND logic, coordinator owns state |
| 26 | Filters NOT saved to .dwbflow (canvas loads unfiltered) |
| 27 | Multiple promoted datasets, each element picks its own source |
| 28 | KPI: sum/avg/min/max/count only -- complexity belongs in pipeline |
| 29 | Likert groups always share a scale within a grouping |
| 30 | Geo maps: ECharts GeoJSON default (offline); Leaflet optional future |
| 31 | Navy installation lookup bundled in src/data/navy_locations.js |
| 32 | Sentiment: bundled lexicon only (AFINN/VADER style), no API |
| 33 | Primary persistence: .dwbflow custom file extension |
| 34 | localStorage: convenience cache only, never primary store |
| 35 | Auto-save to localStorage every 30 seconds |
| 36 | .dwbflow saves pipeline + viz + activeMode + full UI state |
| 37 | Loading workflow restores exact app state |
| 38 | Splash screen on every load with open/new/pipeline/explore/tutorial |
| 39 | Pipeline Task path: pipeline mode, INGEST node pre-added |
| 40 | Explore Data path: viz mode, CSV drop zone, silent pipeline |
| 41 | Tutorial: always on splash, never auto-shown, stateless |
| 42 | Unsaved session banner on splash if localStorage has auto-save |
| 43 | Recent workflows list on splash from localStorage |
| 44 | Workflow tags + notes fields in .dwbflow |
| 45 | Built-in workflow templates bundled as JS constants |
| 46 | Validation nodes flag rows (add _flag col), do not filter by default |
| 47 | LEFT_JOIN explicitly supports one-to-many cardinality |
| 48 | Column picker: structure axis + value axis + label/color axis pattern |
| 49 | Data table: column picker + keyword search + cell highlight |
| 50 | Calendar elements: 4 types (heatmap/monthly/weekly/month-of-year) |
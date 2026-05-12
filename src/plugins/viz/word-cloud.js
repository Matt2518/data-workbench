'use strict';

// ─────────────────────── CONSTANTS ───────────────────────────────────────────

const _WC_STOPWORDS = new Set([
  'the', 'and', 'a', 'to', 'of', 'in', 'i', 'is', 'that', 'it', 'on', 'you', 'this',
  'for', 'but', 'with', 'are', 'have', 'be', 'was', 'as', 'they', 'not', 'we',
  'at', 'an', 'so', 'or', 'do', 'if', 'my', 'me', 'he', 'she', 'his', 'her', 'its',
  'our', 'their', 'been', 'had', 'has', 'will', 'would', 'could', 'should',
  'just', 'also', 'very', 'more', 'than', 'then', 'when', 'what', 'which',
  'who', 'how', 'all', 'some', 'there', 'from', 'by', 'about', 'up', 'out',
  'were', 'can', 'did', 'get', 'got', 'like', 'one', 'your', 'any', 'into',
  'over', 'after', 'before', 'those', 'these', 'them', 'him', 'no', 'yes',
  'use', 'used', 'using', 'make', 'made', 'making', 'well', 'really', 'much',
  'many', 'most', 'other', 'time', 'way', 'even', 'know', 'think', 'feel',
  'felt', 'go', 'going', 'went', 'come', 'came', 'see', 'saw', 'need', 'needs',
  'needed', 'want', 'wanted', 'give', 'given', 'take', 'taken', 'work',
  'worked', 'working', 'great', 'good', 'bad', 'new', 'old'
]);

const _WC_SENTIMENT = {
  outstanding: 3, excellent: 3, exceptional: 3, fantastic: 3,
  perfect: 3, brilliant: 3, superb: 3, loved: 3,
  great: 2, awesome: 2, amazing: 2, wonderful: 2, best: 2,
  valuable: 2, happy: 2, engaging: 2, enjoyed: 2, love: 2,
  informative: 2, inspiring: 2, thorough: 2, comprehensive: 2,
  good: 1, nice: 1, helpful: 1, useful: 1, effective: 1,
  clear: 1, solid: 1, improving: 1, like: 1, relevant: 1,
  applicable: 1, practical: 1, organized: 1, prepared: 1,
  knowledgeable: 1, professional: 1, interactive: 1,
  bad: -1, unclear: -1, confusing: -1, hard: -1,
  difficult: -1, slow: -1, issue: -1, lacking: -1,
  boring: -1, outdated: -1, rushed: -1, repetitive: -1,
  vague: -1, disorganized: -1, monotonous: -1,
  poor: -2, terrible: -2, awful: -2, horrible: -2,
  worst: -2, failed: -2, useless: -2, waste: -2,
  broken: -2, disappointing: -2, frustrating: -2,
  inadequate: -2, unacceptable: -2, irrelevant: -2,
  unprepared: -2, ineffective: -2,
  hate: -3, disgusting: -3, pathetic: -3, abysmal: -3, deplorable: -3
};

const _WC_SKIP_VALUES = new Set(['', 'n/a', 'na', 'none', 'null', '-']);

// ─────────────────────── COLOR ────────────────────────────────────────────────

function _wcGetWordColor(weight, theme) {
  const dark = theme === 'dark';
  if (weight >= 2)   return dark ? '#4ade80' : '#166534';
  if (weight === 1)  return dark ? '#86efac' : '#15803d';
  if (weight === 0)  return 'var(--text-muted)';
  if (weight === -1) return dark ? '#fca5a5' : '#9a3412';
  return dark ? '#f87171' : '#991b1b';
}

// ─────────────────────── TOKENIZER ───────────────────────────────────────────

function _wcTokenize(rows, sourceColIndex, minWordLength, extraStopwords) {
  const extra = new Set((extraStopwords || []).map(w => w.toLowerCase()));
  const freq  = new Map();

  for (const row of rows) {
    const text = String(row[sourceColIndex] ?? '').trim();
    if (_WC_SKIP_VALUES.has(text.toLowerCase())) continue;

    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

    for (const word of words) {
      if (!word) continue;
      if (word.length < minWordLength) continue;
      if (_WC_STOPWORDS.has(word)) continue;
      if (extra.has(word)) continue;
      if (!isNaN(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// ─────────────────────── GLOBAL HANDLERS ─────────────────────────────────────

DWB._wc_set = function (eid, key, val) {
  DWB.updateConfig_viz(eid, key, val);
  DWB.viz.renderElement(eid);
};

DWB._wc_addStopword = function (eid, word) {
  const found = DWB.viz.findElement(eid);
  if (!found) return;
  const cfg = found.element.config;
  const w = String(word).toLowerCase().trim();
  if (!w || _WC_STOPWORDS.has(w) || cfg.extraStopwords.includes(w)) return;
  cfg.extraStopwords.push(w);
  _wcRenderChips(eid, cfg);
  DWB.viz.renderElement(eid);
};

DWB._wc_removeStopword = function (eid, word) {
  const found = DWB.viz.findElement(eid);
  if (!found) return;
  const cfg = found.element.config;
  const idx = cfg.extraStopwords.indexOf(word);
  if (idx !== -1) cfg.extraStopwords.splice(idx, 1);
  _wcRenderChips(eid, cfg);
  DWB.viz.renderElement(eid);
};

// ─────────────────────── ELEMENT REGISTRATION ────────────────────────────────

DWB.registerElement('WORD_CLOUD', {
  title: 'Word Cloud',
  icon: '☁️',
  category: 'Survey Analysis',
  desc: 'Visualizes word frequency from free-text responses as a word cloud. Optionally colors words by individual sentiment using the built-in lexicon.',
  headerCompatible: false,
  columnAffinity: { primary: ['text', 'categorical'] },

  // ── Config panel ──────────────────────────────────────────────────────────

  renderConfig(element, dataset) {
    if (!dataset) {
      return '<div style="padding:12px;color:var(--text-faint);font-size:12px">No dataset available.</div>';
    }

    const cfg = element.config;
    _wcEnsureDefaults(cfg);
    const eid     = element.id;
    const headers = dataset.headers || [];

    // Section 1 — Source Column
    const colOpts = headers.map((h, i) =>
      `<option value="${i}"${cfg.sourceColIndex === i ? ' selected' : ''}>${_wcEsc(h)}</option>`
    ).join('');

    // Section 2 — Color Mode
    const sentChecked  = cfg.colorMode === 'sentiment' ? ' checked' : '';
    const themeChecked = cfg.colorMode === 'theme'     ? ' checked' : '';

    // Section 4 — Chips
    const chipsHtml = _wcChipsHtml(eid, cfg);

    return `
      <div class="dwb-config-group" style="padding:8px 12px">
        <label class="sidebar-label">Source Column</label>
        <select class="sidebar-input"
          onchange="DWB._wc_set('${eid}','sourceColIndex',parseInt(this.value))">
          ${colOpts}
        </select>
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Color Mode</label>
        <label class="sidebar-checkbox-item" style="margin-bottom:4px">
          <input type="radio" name="wc-colorMode-${eid}" value="sentiment"${sentChecked}
            onchange="DWB._wc_set('${eid}','colorMode','sentiment')">
          Sentiment (color by word positivity/negativity)
        </label>
        <label class="sidebar-checkbox-item">
          <input type="radio" name="wc-colorMode-${eid}" value="theme"${themeChecked}
            onchange="DWB._wc_set('${eid}','colorMode','theme')">
          Theme (use accent color palette)
        </label>
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Display Options</label>
        <label class="sidebar-label">Min Word Length</label>
        <input type="number" class="sidebar-input" min="2" max="8" value="${cfg.minWordLength}"
          oninput="DWB._wc_set('${eid}','minWordLength',Math.max(2,Math.min(8,parseInt(this.value)||3)))">
        <div style="font-size:11px;color:var(--text-faint);margin-top:-4px;margin-bottom:8px">Words shorter than this are excluded.</div>
        <label class="sidebar-label">Max Words</label>
        <input type="number" class="sidebar-input" min="10" max="200" value="${cfg.maxWords}"
          oninput="DWB._wc_set('${eid}','maxWords',Math.max(10,Math.min(200,parseInt(this.value)||50)))">
        <label class="sidebar-label">Title</label>
        <input type="text" class="sidebar-input"
          value="${_wcEsc(cfg.title)}"
          placeholder="Leave blank to use column name"
          oninput="DWB._wc_set('${eid}','title',this.value)">
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Extra Words to Exclude</label>
        <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px">Add domain-specific words to filter out (e.g. 'course', 'training', 'class').</div>
        <div id="wc-chips-${eid}" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${chipsHtml}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="wc-swInput-${eid}" class="sidebar-input"
            style="margin-bottom:0;flex:1"
            placeholder="Add word…"
            onkeydown="if(event.key==='Enter'){DWB._wc_addStopword('${eid}',this.value);this.value='';}">
          <button
            onclick="var i=document.getElementById('wc-swInput-${eid}');DWB._wc_addStopword('${eid}',i.value);i.value='';"
            style="padding:4px 8px;font-size:12px;border:1px solid var(--border);background:transparent;border-radius:4px;cursor:pointer;color:var(--text-main);font-family:inherit;white-space:nowrap">
            Add
          </button>
        </div>
      </div>`;
  },

  // ── Render ────────────────────────────────────────────────────────────────

  render(element, dataset, filters) {
    const container = document.getElementById('element-content-' + element.id);
    if (!container) return;

    if (!dataset || !dataset.rows || dataset.rows.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">No data available. Push a dataset from the pipeline.</div>';
      return;
    }
    if (!window.echarts) {
      container.innerHTML = '<div class="dwb-empty-state">ECharts not loaded.</div>';
      return;
    }

    // Defer render if container has no dimensions yet (common on workflow restore
    // before layout has completed).
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) {
      setTimeout(() => DWB.viz.renderElement(element.id), 100);
      return;
    }

    const cfg = element.config;
    _wcEnsureDefaults(cfg);

    const { sourceColIndex, colorMode, minWordLength, maxWords, extraStopwords, title } = cfg;
    const headers = dataset.headers || [];

    const words = _wcTokenize(dataset.rows, sourceColIndex, minWordLength, extraStopwords).slice(0, maxWords);

    const responseCount = dataset.rows.filter(r => {
      const v = String(r[sourceColIndex] ?? '').trim().toLowerCase();
      return !_WC_SKIP_VALUES.has(v);
    }).length;

    if (element._instance)  { element._instance.dispose();  element._instance  = null; }
    if (element._resizeObs) { element._resizeObs.disconnect(); element._resizeObs = null; }

    const colName     = headers[sourceColIndex] || '';
    const titleText   = title || colName;
    const currentTheme = document.body.dataset.theme === 'dark' ? 'dark' : 'light';

    const headerHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 0;flex-wrap:wrap">
        <div>
          <span style="font-size:14px;font-weight:700;color:var(--text-main)">${_wcEsc(titleText)}</span>
          <span style="font-size:11px;color:var(--text-faint);margin-left:6px">(Word Cloud)</span>
        </div>
        <span style="font-size:11px;color:var(--text-muted)">${words.length} words · ${responseCount} responses</span>
      </div>`;

    if (words.length === 0) {
      container.innerHTML = headerHtml +
        '<div style="text-align:center;color:var(--text-faint);font-size:13px;padding:24px">' +
        'No words found. Try lowering the minimum word length or adding fewer stopwords.' +
        '</div>';
      return;
    }

    const chartDiv = document.createElement('div');
    chartDiv.style.cssText = 'width:100%;height:400px';

    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.innerHTML = headerHtml;
    container.appendChild(chartDiv);

    const seriesData = words.map(w => ({
      name:  w.name,
      value: w.value,
      textStyle: {
        color: colorMode === 'sentiment'
          ? _wcGetWordColor(_WC_SENTIMENT[w.name] ?? 0, currentTheme)
          : null
      }
    }));

    const chart = echarts.init(chartDiv, null, { renderer: 'canvas' });
    element._instance = chart;

    try {
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          show: true,
          formatter: '{b}: {c} mentions'
        },
        series: [{
          type:            'wordCloud',
          shape:           'circle',
          sizeRange:       [14, 60],
          rotationRange:   [-45, 45],
          rotationStep:    45,
          gridSize:        8,
          drawOutOfBound:  false,
          layoutAnimation: true,
          data:            seriesData
        }]
      });
    } catch (e) {
      // wordCloud extension not yet registered (CDN timing on restore) — retry
      chart.dispose();
      element._instance = null;
      if (element._resizeObs) { element._resizeObs.disconnect(); element._resizeObs = null; }
      container.innerHTML = '<div class="dwb-empty-state">Loading…</div>';
      setTimeout(() => DWB.viz.renderElement(element.id), 200);
      return;
    }

    element._resizeObs = new ResizeObserver(() => {
      if (element._instance && !element._instance.isDisposed()) element._instance.resize();
    });
    element._resizeObs.observe(chartDiv);
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onFilterChange(element, dataset, filters) {
    this.render(element, dataset, filters);
  },

  onThemeChange(element) {
    const dataset = DWB.viz.getActiveDataset(element);
    this.render(element, dataset, DWB.viz.filters || []);
  },

  getPromptContext(element, dataset) {
    if (!dataset) return 'No data.';
    const cfg = element.config || {};
    const col = dataset.headers[cfg.sourceColIndex || 0] || '(unset)';
    return `Word Cloud: col=${col}, colorMode=${cfg.colorMode || 'sentiment'}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance(element) { return element._instance || null; }
});

// ─────────────────────── MODULE-PRIVATE HELPERS ───────────────────────────────

function _wcEnsureDefaults(cfg) {
  if (cfg.sourceColIndex    === undefined) cfg.sourceColIndex    = 0;
  if (cfg.sentimentColIndex === undefined) cfg.sentimentColIndex = -1;
  if (cfg.colorMode         === undefined) cfg.colorMode         = 'sentiment';
  if (cfg.minWordLength     === undefined) cfg.minWordLength     = 3;
  if (cfg.maxWords          === undefined) cfg.maxWords          = 50;
  if (!cfg.extraStopwords)                 cfg.extraStopwords    = [];
  if (cfg.title             === undefined) cfg.title             = '';
}

function _wcChipsHtml(eid, cfg) {
  if (!cfg.extraStopwords || cfg.extraStopwords.length === 0) return '';
  return cfg.extraStopwords.map(w =>
    `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--bg-raised);` +
    `border:1px solid var(--border);border-radius:12px;padding:2px 8px;font-size:11px;color:var(--text-main)">` +
    `${_wcEsc(w)}` +
    `<button onclick="DWB._wc_removeStopword('${eid}','${_wcEscJs(w)}')"` +
    ` style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:13px;` +
    `padding:0 0 0 2px;line-height:1;display:flex;align-items:center">×</button>` +
    `</span>`
  ).join('');
}

function _wcRenderChips(eid, cfg) {
  const el = document.getElementById('wc-chips-' + eid);
  if (el) el.innerHTML = _wcChipsHtml(eid, cfg);
}

function _wcEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _wcEscJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

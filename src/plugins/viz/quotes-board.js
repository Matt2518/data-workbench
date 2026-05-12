'use strict';

// ─────────────────────── CONSTANTS ───────────────────────────────────────────

const AUTO_FILTER_VALUES = new Set([
  '', 'n/a', 'na', 'none', 'null', '-', 'n/a', 'none', 'null'
]);

const SENTIMENT_COLORS = {
  positive: '#166534',
  negative: '#991b1b',
  neutral:  null
};

// ─────────────────────── GLOBAL HANDLERS ─────────────────────────────────────

// Column changes also re-render the sidebar (section 3 visibility depends on sentimentColIndex).
DWB._qb_setCol = function (eid, key, val) {
  const found = DWB.viz.findElement(eid);
  if (!found) return;
  found.element.config[key] = val;
  found.element.config.currentPage = 0;
  DWB.viz.renderSidebar(eid);
  DWB.viz.renderElement(eid);
};

// Simple config update — only re-renders the viz output.
DWB._qb_set = function (eid, key, val, resetPage) {
  DWB.updateConfig_viz(eid, key, val);
  if (resetPage) {
    const found = DWB.viz.findElement(eid);
    if (found) found.element.config.currentPage = 0;
  }
  DWB.viz.renderElement(eid);
};

// paginate toggle — re-renders sidebar (page size section shows/hides).
DWB._qb_togglePaginate = function (eid, checked) {
  const found = DWB.viz.findElement(eid);
  if (!found) return;
  found.element.config.paginate = checked;
  found.element.config.currentPage = 0;
  DWB.viz.renderSidebar(eid);
  DWB.viz.renderElement(eid);
};

// Neutral band update — patches sidebar hint text in place, avoids full sidebar re-render.
DWB._qb_updateNeutralBand = function (eid, value) {
  const v = Math.max(0, Math.min(1, parseFloat(value) || 0));
  DWB.updateConfig_viz(eid, 'neutralBand', v);
  const found = DWB.viz.findElement(eid);
  if (found) found.element.config.currentPage = 0;
  const hint = document.getElementById('qb-nb-hint-' + eid);
  if (hint) hint.textContent = `Responses with normalized score between -${v} and +${v} are classified as Neutral.`;
  DWB.viz.renderElement(eid);
};

// Sentiment filter multiselect.
DWB._qb_updateFilter = function (eid, selectEl) {
  const selected = Array.from(selectEl.selectedOptions).map(o => o.value);
  DWB.updateConfig_viz(eid, 'sentimentFilter', selected);
  const found = DWB.viz.findElement(eid);
  if (found) found.element.config.currentPage = 0;
  DWB.viz.renderElement(eid);
};

// Page navigation — updates cards area only, no full re-render.
DWB._qb_goToPage = function (eid, page) {
  const found = DWB.viz.findElement(eid);
  if (!found || !found.element._qbQuotes) return;
  found.element.config.currentPage = page;
  const cardsArea = document.getElementById('qb-cards-area-' + eid);
  if (cardsArea) cardsArea.innerHTML = _qbBuildCardsHtml(found.element, found.element._qbQuotes);
};

// ─────────────────────── ELEMENT REGISTRATION ────────────────────────────────

DWB.registerElement('QUOTES_BOARD', {
  title: 'Quotes / Text Board',
  icon: '💬',
  category: 'Survey Analysis',
  desc: 'Displays free-text survey responses as styled quote cards with optional sentiment-based coloring and filtering.',
  headerCompatible: false,
  columnAffinity: { primary: ['text', 'categorical'] },

  // ── Config panel ──────────────────────────────────────────────────────────

  renderConfig(element, dataset) {
    if (!dataset) {
      return '<div style="padding:12px;color:var(--text-faint);font-size:12px">No dataset available.</div>';
    }

    const cfg = element.config;
    _qbEnsureDefaults(cfg);

    const eid     = element.id;
    const headers = dataset.headers || [];

    // ── Section 1: Columns ────────────────────────────────────────────────

    const textColOpts = headers.map((h, i) =>
      `<option value="${i}"${cfg.textColIndex === i ? ' selected' : ''}>${_qbEscHtml(h)}</option>`
    ).join('');

    const sentColOpts =
      `<option value="-1"${cfg.sentimentColIndex === -1 ? ' selected' : ''}>-- None --</option>` +
      headers.map((h, i) =>
        `<option value="${i}"${cfg.sentimentColIndex === i ? ' selected' : ''}>${_qbEscHtml(h)}</option>`
      ).join('');

    // ── Section 3: Sentiment Settings (conditional) ───────────────────────

    const filterCats = ['positive', 'neutral', 'negative', 'unscored'];
    const filterOpts = filterCats.map(cat => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const sel   = cfg.sentimentFilter.includes(cat) ? ' selected' : '';
      return `<option value="${cat}"${sel}>${label}</option>`;
    }).join('');

    const sentimentSection = cfg.sentimentColIndex !== -1 ? `
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Sentiment Settings</label>
        <label class="sidebar-label">Neutral Band</label>
        <input type="number" class="sidebar-input" step="0.01" min="0" max="1"
          value="${cfg.neutralBand}"
          oninput="DWB._qb_updateNeutralBand('${eid}',this.value)">
        <div id="qb-nb-hint-${eid}"
             style="font-size:11px;color:var(--text-faint);margin-top:2px">
          Responses with normalized score between -${cfg.neutralBand} and +${cfg.neutralBand} are classified as Neutral.
        </div>
        <label class="sidebar-label" style="margin-top:8px">Sentiment Filter</label>
        <select multiple style="height:100px;width:100%"
          onchange="DWB._qb_updateFilter('${eid}',this)">
          ${filterOpts}
        </select>
        <div style="font-size:11px;color:var(--text-faint);margin-top:2px">
          Show only selected sentiment categories.
        </div>
      </div>` : '';

    // ── Section 4: Sort & Pagination ──────────────────────────────────────

    const sortOpts = [
      ['table',     'Table Order (default)'],
      ['sent_desc', 'Sentiment — High to Low'],
      ['sent_asc',  'Sentiment — Low to High'],
      ['random',    'Random']
    ].map(([v, l]) =>
      `<option value="${v}"${cfg.sortOrder === v ? ' selected' : ''}>${l}</option>`
    ).join('');

    const pageSizeOpts = [5, 10, 25, 50, -1].map(v => {
      const l = v === -1 ? 'All' : String(v);
      return `<option value="${v}"${cfg.pageSize === v ? ' selected' : ''}>${l}</option>`;
    }).join('');

    const pageSizeSection = cfg.paginate ? `
        <label class="sidebar-label" style="margin-top:8px">Page Size</label>
        <select class="sidebar-input"
          onchange="DWB._qb_set('${eid}','pageSize',parseInt(this.value),true)">
          ${pageSizeOpts}
        </select>` : '';

    return `
      <div class="dwb-config-group" style="padding:8px 12px">
        <label class="sidebar-label">Text Response Column</label>
        <select class="sidebar-input"
          onchange="DWB._qb_setCol('${eid}','textColIndex',parseInt(this.value))">
          ${textColOpts}
        </select>
        <label class="sidebar-label" style="margin-top:8px">Sentiment Score Column</label>
        <select class="sidebar-input"
          onchange="DWB._qb_setCol('${eid}','sentimentColIndex',parseInt(this.value))">
          ${sentColOpts}
        </select>
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Display</label>
        <label class="sidebar-label">Title</label>
        <input type="text" class="sidebar-input"
          value="${_qbEscHtml(cfg.title)}"
          placeholder="Leave blank to use column name"
          oninput="DWB._qb_set('${eid}','title',this.value,false)">
      </div>
      ${sentimentSection}
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Sort &amp; Pagination</label>
        <label class="sidebar-label">Sort Order</label>
        <select class="sidebar-input"
          onchange="DWB._qb_set('${eid}','sortOrder',this.value,true)">
          ${sortOpts}
        </select>
        <label class="sidebar-checkbox-item" style="margin-top:8px;margin-bottom:0">
          <input type="checkbox" ${cfg.paginate ? 'checked' : ''}
            onchange="DWB._qb_togglePaginate('${eid}',this.checked)">
          Pagination
        </label>
        ${pageSizeSection}
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

    const cfg     = element.config;
    _qbEnsureDefaults(cfg);

    const headers = dataset.headers || [];
    const textIdx = Math.min(cfg.textColIndex, headers.length - 1);
    const sentIdx = cfg.sentimentColIndex;

    // 1–2. Process all rows, build quote objects
    const allQuotes = [];
    for (const row of dataset.rows) {
      const rawText = String(row[textIdx] ?? '').trim();
      if (AUTO_FILTER_VALUES.has(rawText.toLowerCase())) continue;

      let rawScore = null;
      if (sentIdx !== -1) {
        const raw = row[sentIdx];
        if (raw !== null && raw !== undefined && raw !== '') {
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) rawScore = parsed;
        }
      }

      const wordCount       = rawText.split(/\s+/).filter(Boolean).length;
      const normalizedScore = (rawScore !== null && wordCount > 0) ? rawScore / wordCount : null;
      const category        = _qbClassifySentiment(normalizedScore, cfg.neutralBand);

      allQuotes.push({ text: rawText, rawScore, normalizedScore, category });
    }

    // 3. Compute overall sentiment from pre-filter, non-null scores
    let overallLabel    = null;
    let overallCategory = null;
    if (sentIdx !== -1) {
      const scored = allQuotes.filter(q => q.normalizedScore !== null);
      if (scored.length > 0) {
        const avg  = scored.reduce((s, q) => s + q.normalizedScore, 0) / scored.length;
        overallCategory = _qbClassifySentiment(avg, cfg.neutralBand);
        const sign      = avg >= 0 ? '+' : '';
        const catLabel  = overallCategory.charAt(0).toUpperCase() + overallCategory.slice(1);
        overallLabel = `Overall: ${catLabel} (${sign}${avg.toFixed(2)})`;
      }
    }

    // 4. Filter by sentimentFilter
    const filteredQuotes = allQuotes.filter(q => cfg.sentimentFilter.includes(q.category));

    // 5. Sort
    const sortedQuotes = _qbSort([...filteredQuotes], cfg.sortOrder);
    element._qbQuotes  = sortedQuotes;

    // ── Header row ────────────────────────────────────────────────────────

    const titleText = cfg.title || (headers[textIdx] || '');

    let overallHtml = '';
    if (overallLabel) {
      let overallStyle = 'color:var(--text-muted)';
      if (overallCategory === 'positive') overallStyle = `color:${SENTIMENT_COLORS.positive};font-weight:600`;
      else if (overallCategory === 'negative') overallStyle = `color:${SENTIMENT_COLORS.negative};font-weight:600`;
      overallHtml = `<span style="${overallStyle};font-size:12px">${_qbEscHtml(overallLabel)}</span>`;
    }

    const headerHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div>
          <span style="font-size:14px;font-weight:700;color:var(--text-main)">${_qbEscHtml(titleText)}</span>
          <span style="font-size:11px;color:var(--text-faint);margin-left:6px">(Text Quotes)</span>
        </div>
        ${overallHtml}
      </div>`;

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:12px">
        ${headerHtml}
        <div id="qb-cards-area-${element.id}">${_qbBuildCardsHtml(element, sortedQuotes)}</div>
      </div>`;
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
    const col = dataset.headers[cfg.textColIndex || 0] || '(unset)';
    return `Quotes Board: textCol=${col}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance() { return null; }
});

// ─────────────────────── MODULE-PRIVATE HELPERS ───────────────────────────────

function _qbEnsureDefaults(cfg) {
  if (cfg.textColIndex     === undefined) cfg.textColIndex     = 0;
  if (cfg.sentimentColIndex === undefined) cfg.sentimentColIndex = -1;
  if (cfg.title            === undefined) cfg.title            = '';
  if (cfg.neutralBand      === undefined) cfg.neutralBand      = 0.15;
  if (!cfg.sentimentFilter)               cfg.sentimentFilter  = ['positive', 'neutral', 'negative', 'unscored'];
  if (!cfg.sortOrder)                     cfg.sortOrder        = 'table';
  if (cfg.paginate         === undefined) cfg.paginate         = true;
  if (cfg.pageSize         === undefined) cfg.pageSize         = 10;
  if (cfg.currentPage      === undefined) cfg.currentPage      = 0;
}

function _qbClassifySentiment(normalizedScore, neutralBand) {
  if (normalizedScore === null) return 'unscored';
  if (normalizedScore > neutralBand) return 'positive';
  if (normalizedScore < -neutralBand) return 'negative';
  return 'neutral';
}

function _qbSort(quotes, sortOrder) {
  if (sortOrder === 'sent_desc') {
    quotes.sort((a, b) => {
      if (a.normalizedScore === null && b.normalizedScore === null) return 0;
      if (a.normalizedScore === null) return 1;
      if (b.normalizedScore === null) return -1;
      return b.normalizedScore - a.normalizedScore;
    });
  } else if (sortOrder === 'sent_asc') {
    quotes.sort((a, b) => {
      if (a.normalizedScore === null && b.normalizedScore === null) return 0;
      if (a.normalizedScore === null) return 1;
      if (b.normalizedScore === null) return -1;
      return a.normalizedScore - b.normalizedScore;
    });
  } else if (sortOrder === 'random') {
    for (let i = quotes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = quotes[i]; quotes[i] = quotes[j]; quotes[j] = tmp;
    }
  }
  // 'table': stable insertion order, no-op
  return quotes;
}

function _qbBuildCardsHtml(element, quotes) {
  const cfg      = element.config;
  const eid      = element.id;
  const paginate = cfg.paginate;
  const pageSize = cfg.pageSize;
  const page     = cfg.currentPage || 0;
  const total    = quotes.length;

  // Determine visible slice
  let visible = quotes;
  let start   = 0;
  let end     = total;
  if (paginate && pageSize !== -1 && total > 0) {
    start   = page * pageSize;
    end     = Math.min(start + pageSize, total);
    visible = quotes.slice(start, end);
  }

  if (visible.length === 0) {
    return '<div style="color:var(--text-faint);font-size:13px;padding:12px;text-align:center">No responses match the current filters.</div>';
  }

  const showScore = cfg.sentimentColIndex !== -1;

  const cardsHtml = visible.map(q => {
    let borderColor;
    if (q.category === 'positive')      borderColor = SENTIMENT_COLORS.positive;
    else if (q.category === 'negative') borderColor = SENTIMENT_COLORS.negative;
    else                                borderColor = 'var(--accent)';

    const scoreHtml = showScore && q.normalizedScore !== null
      ? `<div style="font-size:11px;color:var(--text-faint);margin-top:6px">Score: ${q.normalizedScore.toFixed(2)}</div>`
      : '';

    return `<div style="background:var(--bg-card,var(--bg-surface));border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid ${borderColor};padding:12px 14px">
      <div style="font-size:13px;color:var(--text-main);font-style:italic;line-height:1.5">“${_qbEscHtml(q.text)}”</div>
      ${scoreHtml}
    </div>`;
  }).join('');

  // Pagination controls
  let paginationHtml = '';
  if (paginate && pageSize !== -1 && total > pageSize) {
    const totalPages  = Math.ceil(total / pageSize);
    const prevDisabled = page <= 0                 ? ' disabled' : '';
    const nextDisabled = page >= totalPages - 1    ? ' disabled' : '';
    const btnStyle    = 'padding:4px 10px;font-size:12px;border:1px solid var(--border);background:transparent;border-radius:4px;cursor:pointer;color:var(--text-main);font-family:inherit';

    paginationHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">Showing ${start + 1}–${end} of ${total} responses</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button${prevDisabled} onclick="DWB._qb_goToPage('${eid}',${page - 1})" style="${btnStyle}">← Prev</button>
          <span style="font-size:12px;color:var(--text-muted)">Page ${page + 1} of ${totalPages}</span>
          <button${nextDisabled} onclick="DWB._qb_goToPage('${eid}',${page + 1})" style="${btnStyle}">Next →</button>
        </div>
      </div>`;
  }

  return `<div style="display:flex;flex-direction:column;gap:8px">${cardsHtml}</div>${paginationHtml}`;
}

function _qbEscHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

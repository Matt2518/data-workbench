'use strict';

// ─────────────────────── LIKERT TEMPLATES ────────────────────────────────────

const LIKERT_TEMPLATES = [
  {
    name: '5-Point Agreement',
    values: ['strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree'],
    roles:  ['negative', 'negative', 'neutral', 'positive', 'positive']
  },
  {
    name: '4-Point Agreement (no neutral)',
    values: ['strongly disagree', 'disagree', 'agree', 'strongly agree'],
    roles:  ['negative', 'negative', 'positive', 'positive']
  },
  {
    name: '4-Point Agreement (no strong disagree)',
    values: ['disagree', 'neutral', 'agree', 'strongly agree'],
    roles:  ['negative', 'neutral', 'positive', 'positive']
  },
  {
    name: 'Satisfaction',
    values: ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
    roles:  ['negative', 'negative', 'neutral', 'positive', 'positive']
  },
  {
    name: 'Frequency',
    values: ['never', 'rarely', 'sometimes', 'often', 'always'],
    roles:  ['negative', 'negative', 'neutral', 'positive', 'positive']
  },
  {
    name: 'Yes / No',
    values: ['no', 'yes'],
    roles:  ['negative', 'positive']
  }
];

// Returns best-matching template when ≥ 50 % of unique values appear in it,
// otherwise null.
function _sdbDetectTemplate(uniqueValues) {
  const norm = uniqueValues.map(v => String(v).toLowerCase().trim());
  let best = null, bestCount = 0;
  for (const t of LIKERT_TEMPLATES) {
    const count = norm.filter(v => t.values.includes(v)).length;
    if (count > bestCount) { bestCount = count; best = t; }
  }
  return (best && norm.length > 0 && bestCount / norm.length >= 0.5) ? best : null;
}

// ─────────────────── GLOBAL HELPERS (callable from inline handlers) ───────────

DWB._sdb_cbChange = function (elementId, colIndex, checked) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  cfg.questionCols = cfg.questionCols || [];
  if (checked) {
    if (!cfg.questionCols.includes(colIndex)) cfg.questionCols.push(colIndex);
  } else {
    cfg.questionCols = cfg.questionCols.filter(i => i !== colIndex);
  }
  DWB.viz.renderSidebar(elementId);
  DWB.viz.renderElement(elementId);
};

DWB._sdb_selAction = function (elementId, colIndex, action) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  cfg.questionCols = cfg.questionCols || [];
  const idx = cfg.questionCols.indexOf(colIndex);
  if (idx === -1) return;
  if (action === 'up' && idx > 0) {
    [cfg.questionCols[idx - 1], cfg.questionCols[idx]] = [cfg.questionCols[idx], cfg.questionCols[idx - 1]];
    DWB._sdb_renderSelList(elementId);
  } else if (action === 'down' && idx < cfg.questionCols.length - 1) {
    [cfg.questionCols[idx + 1], cfg.questionCols[idx]] = [cfg.questionCols[idx], cfg.questionCols[idx + 1]];
    DWB._sdb_renderSelList(elementId);
  } else if (action === 'remove') {
    cfg.questionCols.splice(idx, 1);
    DWB.viz.renderSidebar(elementId);
  }
  DWB.viz.renderElement(elementId);
};

DWB._sdb_renderSelList = function (elementId) {
  const container = document.getElementById('sdb-sellist-' + elementId);
  if (!container) return;
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const { element } = found;
  const dataset = DWB.viz.getActiveDataset(element);
  const headers = dataset ? dataset.headers : [];
  container.innerHTML = _sdbSelListHtml(element, headers);
};

DWB._sdb_updateDisplayName = function (elementId, colIdx, value) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  found.element.config.displayNames = found.element.config.displayNames || {};
  found.element.config.displayNames[colIdx] = value;
  DWB.viz.renderElement(elementId);
};

DWB._sdb_updateValueRole = function (elementId, val, role) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  found.element.config.valueRoles = found.element.config.valueRoles || {};
  // Store '' so that auto-detect won't override an explicit user choice.
  found.element.config.valueRoles[val] = role;
  DWB.viz.renderElement(elementId);
};

DWB._sdb_updateDisplayMode = function (elementId, mode) {
  DWB.updateConfig_viz(elementId, 'displayMode', mode);
  DWB.viz.renderElement(elementId);
};

DWB._sdb_toggleShowValues = function (elementId, checked) {
  DWB.updateConfig_viz(elementId, 'showValues', checked);
  DWB.viz.renderElement(elementId);
};

DWB._sdb_updateChartTitle = function (elementId, title) {
  DWB.updateConfig_viz(elementId, 'chartTitle', title);
  DWB.viz.renderElement(elementId);
};

// ─────────────────────── ELEMENT REGISTRATION ────────────────────────────────

DWB.registerElement('STACKED_DIVERGING_BAR', {
  title: 'Stacked Diverging Bar',
  icon: '📊',
  category: 'Survey Analysis',
  desc: 'Displays Likert-scale survey responses as a horizontally diverging stacked bar chart. Negative responses extend left, positive responses extend right, neutral centered.',
  headerCompatible: false,
  columnAffinity: { primary: ['categorical', 'text'] },

  // ── Config panel ─────────────────────────────────────────────────────────

  renderConfig(element, dataset) {
    if (!dataset) {
      return '<div style="padding:12px;color:var(--text-faint);font-size:12px">No dataset available.</div>';
    }

    const cfg = element.config;
    if (!cfg.questionCols)  cfg.questionCols  = [];
    if (!cfg.displayNames)  cfg.displayNames  = {};
    if (!cfg.valueRoles)    cfg.valueRoles    = {};

    const eid          = element.id;
    const headers      = dataset.headers || [];
    const questionCols = cfg.questionCols;
    const displayMode  = cfg.displayMode || 'count';
    const showValues   = cfg.showValues !== false;
    const chartTitle   = cfg.chartTitle || '';

    // ── Section 1: Question Columns ──────────────────────────────────────

    const checkboxList = headers.map((h, i) =>
      `<label style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:0.82rem;cursor:pointer">
        <input type="checkbox" data-eid="${eid}" data-col-index="${i}"
          ${questionCols.includes(i) ? 'checked' : ''}
          onchange="DWB._sdb_cbChange('${eid}',${i},this.checked)">
        ${_sdbEscHtml(h)}
      </label>`
    ).join('');

    // ── Section 2: Scale Configuration ───────────────────────────────────

    let scaleHtml;

    if (questionCols.length === 0) {
      scaleHtml = '<div style="color:var(--text-faint);font-size:12px">Select at least one question column.</div>';
    } else {
      // Collect unique values (first-occurrence, case-insensitive dedup)
      const seenNorm  = new Set();
      const uniqueVals = [];
      for (const ci of questionCols) {
        for (const row of dataset.rows) {
          const raw = row[ci];
          if (raw == null || raw === '') continue;
          const s    = String(raw);
          const norm = s.toLowerCase().trim();
          if (!seenNorm.has(norm)) { seenNorm.add(norm); uniqueVals.push(s); }
        }
      }

      // Auto-detect and populate roles for values not yet explicitly assigned
      const tmpl = _sdbDetectTemplate(uniqueVals);
      if (tmpl) {
        for (const val of uniqueVals) {
          if (_sdbHasRole(cfg.valueRoles, val)) continue;
          const ti = tmpl.values.indexOf(val.toLowerCase().trim());
          if (ti >= 0) cfg.valueRoles[val] = tmpl.roles[ti];
        }
      }

      const autoLine = tmpl
        ? `<div style="color:var(--text-faint);font-size:11px;margin-bottom:6px">Auto-detected: ${_sdbEscHtml(tmpl.name)}</div>`
        : '<div style="color:var(--text-faint);font-size:11px;margin-bottom:6px">No preset matched — assign roles manually.</div>';

      // Color map for chips
      const cs = getComputedStyle(document.documentElement);
      const CV = {
        negStrong: cs.getPropertyValue('--chart-negative-strong').trim() || '#e85d04',
        negLight:  cs.getPropertyValue('--chart-negative-light').trim()  || '#f4a261',
        neutral:   cs.getPropertyValue('--chart-neutral').trim()          || '#adb5bd',
        posLight:  cs.getPropertyValue('--chart-positive-light').trim()   || '#5b9bd5',
        posStrong: cs.getPropertyValue('--chart-positive-strong').trim()  || '#1a5fb4',
      };

      const negVals = uniqueVals.filter(v => _sdbGetRole(cfg.valueRoles, v) === 'negative');
      const posVals = uniqueVals.filter(v => _sdbGetRole(cfg.valueRoles, v) === 'positive');
      const negOrd  = _sdbScaleSort(negVals, tmpl);  // outermost first
      const posOrd  = _sdbScaleSort(posVals, tmpl);  // innermost first

      const ROLE_OPTS = ['negative', 'neutral', 'positive', 'exclude'];

      const rows = uniqueVals.map(val => {
        const role    = _sdbGetRole(cfg.valueRoles, val) || '';
        const chipClr = _sdbChipColor(val, role, negOrd, posOrd, CV);
        const opts    = ROLE_OPTS.map(r =>
          `<option value="${r}"${role === r ? ' selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
        ).join('');
        return `<tr>
          <td style="padding:3px 4px;font-size:12px">${_sdbEscHtml(val)}</td>
          <td style="padding:3px 4px">
            <div style="display:flex;align-items:center;gap:5px">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;
                           background:${chipClr};flex-shrink:0"></span>
              <select class="sidebar-input" style="margin-bottom:0;font-size:11px"
                onchange="DWB._sdb_updateValueRole('${eid}','${_sdbEscJs(val)}',this.value)">
                <option value="">— assign —</option>${opts}
              </select>
            </div>
          </td>
        </tr>`;
      }).join('');

      scaleHtml = autoLine + `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:3px 4px;font-size:11px;
                       color:var(--text-muted);font-weight:600">Response Value</th>
            <th style="text-align:left;padding:3px 4px;font-size:11px;
                       color:var(--text-muted);font-weight:600">Role</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    // ── Section 3: Display Options ────────────────────────────────────────

    const rn = `sdb_mode_${eid}`;  // unique radio group name

    return `
      <div class="dwb-config-group" style="padding:8px 12px">
        <label class="sidebar-label">Select Question Columns</label>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
          ${checkboxList}
        </div>
        <div id="sdb-sellist-${eid}">${_sdbSelListHtml(element, headers)}</div>
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Response Scale</label>
        ${scaleHtml}
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Display Options</label>
        <div style="display:flex;gap:16px;margin-bottom:8px;font-size:12px">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="${rn}" value="count"
              ${displayMode === 'count' ? 'checked' : ''}
              onchange="DWB._sdb_updateDisplayMode('${eid}','count')"> Show Counts
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="${rn}" value="percent"
              ${displayMode === 'percent' ? 'checked' : ''}
              onchange="DWB._sdb_updateDisplayMode('${eid}','percent')"> Show Percentages
          </label>
        </div>
        <label class="sidebar-checkbox-item" style="margin-bottom:8px">
          <input type="checkbox" ${showValues ? 'checked' : ''}
            onchange="DWB._sdb_toggleShowValues('${eid}',this.checked)">
          Show values inside bars
        </label>
        <label class="sidebar-label">Chart title</label>
        <input type="text" class="sidebar-input"
          value="${_sdbEscHtml(chartTitle)}" placeholder="(optional)"
          oninput="DWB._sdb_updateChartTitle('${eid}',this.value)">
      </div>`;
  },

  // ── Render ───────────────────────────────────────────────────────────────

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

    const cfg          = element.config || {};
    const questionCols = cfg.questionCols || [];

    if (questionCols.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">Select at least one question column in the config panel.</div>';
      return;
    }

    const displayMode  = cfg.displayMode  || 'count';
    const showValues   = cfg.showValues   !== false;
    const valueRoles   = cfg.valueRoles   || {};
    const displayNames = cfg.displayNames || {};

    // ── Collect unique values and per-column counts ───────────────────────

    const seenNorm   = new Set();
    const uniqueVals = [];
    const counts     = {};  // { canonicalVal: { colIdx: rawCount } }

    for (const ci of questionCols) {
      for (const row of dataset.rows) {
        const raw = row[ci];
        if (raw == null || raw === '') continue;
        const s    = String(raw);
        const norm = s.toLowerCase().trim();
        if (!seenNorm.has(norm)) {
          seenNorm.add(norm);
          uniqueVals.push(s);
          counts[s] = {};
        }
        // Find canonical casing for this norm and increment count
        const canon = uniqueVals.find(v => v.toLowerCase().trim() === norm);
        if (canon) counts[canon][ci] = (counts[canon][ci] || 0) + 1;
      }
    }

    // ── Group values by role ──────────────────────────────────────────────

    const negVals  = uniqueVals.filter(v => _sdbGetRole(valueRoles, v) === 'negative');
    const neutVals = uniqueVals.filter(v => _sdbGetRole(valueRoles, v) === 'neutral');
    const posVals  = uniqueVals.filter(v => _sdbGetRole(valueRoles, v) === 'positive');

    if (negVals.length + neutVals.length + posVals.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">Assign roles to response values in the config panel.</div>';
      return;
    }

    const tmpl   = _sdbDetectTemplate(uniqueVals);
    const negOrd = _sdbScaleSort(negVals, tmpl);  // outermost first
    const posOrd = _sdbScaleSort(posVals, tmpl);  // innermost first

    // ── Y-axis categories and per-question totals ─────────────────────────

    const yNames    = questionCols.map(ci => displayNames[ci] || dataset.headers[ci] || ('Col ' + ci));
    const rawTotals = questionCols.map(ci => {
      let sum = 0;
      for (const val of uniqueVals) {
        const role = _sdbGetRole(valueRoles, val);
        if (role && role !== 'exclude') sum += (counts[val] && counts[val][ci]) || 0;
      }
      return sum;
    });

    function getCount(val, ci) {
      return (counts[val] && counts[val][ci]) || 0;
    }
    function getDisp(val, ci, qi) {
      const c = getCount(val, ci);
      return (displayMode === 'percent' && rawTotals[qi] > 0) ? c / rawTotals[qi] : c;
    }

    // ── Theme colors ─────────────────────────────────────────────────────

    const cs = getComputedStyle(document.documentElement);
    const C  = {
      negStrong: cs.getPropertyValue('--chart-negative-strong').trim() || '#e85d04',
      negLight:  cs.getPropertyValue('--chart-negative-light').trim()  || '#f4a261',
      neutral:   cs.getPropertyValue('--chart-neutral').trim()          || '#adb5bd',
      posLight:  cs.getPropertyValue('--chart-positive-light').trim()   || '#5b9bd5',
      posStrong: cs.getPropertyValue('--chart-positive-strong').trim()  || '#1a5fb4',
      textMain:  cs.getPropertyValue('--text-main').trim()              || '#1e293b',
      textMuted: cs.getPropertyValue('--text-muted').trim()             || '#64748b',
      border:    cs.getPropertyValue('--border').trim()                 || '#e2e8f0',
      bgSurface: cs.getPropertyValue('--bg-surface').trim()             || '#ffffff',
    };

    function valColor(val) {
      const ni = negOrd.indexOf(val);
      if (ni >= 0) return ni === 0 ? C.negStrong : C.negLight;
      if (neutVals.includes(val)) return C.neutral;
      const pi = posOrd.indexOf(val);
      if (pi >= 0) return pi === posOrd.length - 1 ? C.posStrong : C.posLight;
      return C.textMuted;
    }

    // ── Label config ─────────────────────────────────────────────────────

    function makeLabel(suppressAlways) {
      if (!showValues || suppressAlways) return { show: false };
      return {
        show: true,
        position: 'inside',
        fontSize: 10,
        color: '#ffffff',
        formatter(params) {
          const abs = Math.abs(params.value || 0);
          const qi  = params.dataIndex;
          const tot = rawTotals[qi] || 1;
          if (displayMode === 'count'   && abs / tot < 0.05) return '';
          if (displayMode === 'percent' && abs        < 0.05) return '';
          if (displayMode === 'percent') return (abs * 100).toFixed(0) + '%';
          return Math.round(abs).toString();
        }
      };
    }

    // ── Symmetric axis extent ─────────────────────────────────────────────

    let maxExtent = 0;
    questionCols.forEach((ci, qi) => {
      let pos = 0, neg = 0;
      posVals.forEach(v  => { pos += getDisp(v, ci, qi); });
      negVals.forEach(v  => { neg += getDisp(v, ci, qi); });
      neutVals.forEach(v => { const h = getDisp(v, ci, qi) / 2; pos += h; neg += h; });
      maxExtent = Math.max(maxExtent, pos, neg);
    });
    maxExtent = (maxExtent * 1.1) || 1;

    // ── Build series ──────────────────────────────────────────────────────
    // ECharts stacks positive and negative values independently within a named
    // stack: the FIRST negative in the array is innermost (closest to 0), and
    // the FIRST positive is innermost.  To make neutral straddle zero, its left
    // half must be the very first negative pushed and its right half must be the
    // very first positive pushed.  Order:
    //   neutral-left → innermost-neg → … → outermost-neg
    //   neutral-right → innermost-pos → … → outermost-pos

    const series     = [];
    const legendData = [];

    // 1. Neutral left half FIRST — becomes innermost on the negative side (0 → -count/2)
    for (const val of neutVals) {
      series.push({
        type: 'bar', name: '__nl_' + val, stack: 'total', color: C.neutral,
        data:  questionCols.map((ci, qi) => -getDisp(val, ci, qi) / 2),
        label: { show: false },
        emphasis: { focus: 'series' }
      });
    }

    // 2. Negative series — strongest/outermost first (ECharts stacks negatives with first series outermost)
    for (const val of negOrd) {
      series.push({
        type: 'bar', name: val, stack: 'total', color: valColor(val),
        data:  questionCols.map((ci, qi) => -getDisp(val, ci, qi)),
        label: makeLabel(false),
        emphasis: { focus: 'series' }
      });
      legendData.push(val);
    }

    // 3. Neutral right half — becomes innermost on the positive side (0 → +count/2)
    for (const val of neutVals) {
      series.push({
        type: 'bar', name: val, stack: 'total', color: C.neutral,
        data:  questionCols.map((ci, qi) =>  getDisp(val, ci, qi) / 2),
        label: { show: false },
        emphasis: { focus: 'series' }
      });
      legendData.push(val);
    }

    // 4. Positive series (innermost first = posOrd as returned from _sdbScaleSort)
    for (const val of posOrd) {
      series.push({
        type: 'bar', name: val, stack: 'total', color: valColor(val),
        data:  questionCols.map((ci, qi) => getDisp(val, ci, qi)),
        label: makeLabel(false),
        emphasis: { focus: 'series' }
      });
      legendData.push(val);
    }

    // Zero line via markLine on the first series
    if (series.length > 0) {
      series[0].markLine = {
        silent: true, symbol: 'none',
        lineStyle: { color: C.textMuted, width: 1.5, type: 'solid' },
        data: [{ xAxis: 0 }],
        label: { show: false }
      };
    }

    // ── Tooltip ───────────────────────────────────────────────────────────

    const tooltip = {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: C.bgSurface,
      borderColor: C.border,
      textStyle: { color: C.textMain, fontSize: 12 },
      formatter(params) {
        if (!params || !params.length) return '';
        const questionName = params[0].axisValue;
        const qi  = yNames.indexOf(questionName);
        const tot = qi >= 0 ? rawTotals[qi] : 1;

        let html = `<div style="font-weight:600;margin-bottom:4px">${_sdbEscHtml(questionName)}</div>`;
        for (const p of params) {
          if (p.seriesName.startsWith('__nl_')) continue;  // skip neutral ghost series
          const abs = Math.abs(p.value || 0);
          if (abs === 0) continue;

          let rawCount, pctStr, dispVal;
          if (displayMode === 'percent') {
            rawCount = tot > 0 ? Math.round(abs * tot) : 0;
            pctStr   = (abs * 100).toFixed(1) + '%';
            dispVal  = pctStr;
          } else {
            rawCount = Math.round(abs);
            pctStr   = tot > 0 ? (rawCount / tot * 100).toFixed(1) + '%' : '0.0%';
            dispVal  = rawCount.toString();
          }
          const extraPct = displayMode === 'count'
            ? ` <span style="color:${C.textMuted}">(${pctStr})</span>` : '';

          html += `<div style="display:flex;align-items:center;gap:5px">
            ${p.marker}
            <span style="flex:1">${_sdbEscHtml(p.seriesName)}:</span>
            <span style="font-weight:600">${dispVal}</span>${extraPct}
          </div>`;
        }
        return html;
      }
    };

    // ── Init chart ────────────────────────────────────────────────────────

    if (element._instance)  { element._instance.dispose();  element._instance  = null; }
    if (element._resizeObs instanceof ResizeObserver) { element._resizeObs.disconnect(); }
    element._resizeObs = null;

    container.style.minHeight = Math.max(200, questionCols.length * 64 + 120) + 'px';

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    element._instance = chart;

    const titleText = cfg.chartTitle || '';
    const topPad    = titleText ? 44 : 12;

    chart.setOption({
      backgroundColor: 'transparent',
      ...(titleText ? {
        title: {
          text: titleText, left: 'center', top: 8,
          textStyle: { color: C.textMain, fontSize: 13, fontWeight: 600 }
        }
      } : {}),
      tooltip,
      legend: {
        data: legendData,
        bottom: 4, type: 'scroll', orient: 'horizontal',
        textStyle: { color: C.textMain, fontSize: 11 }
      },
      grid: { left: '180px', right: '2%', top: topPad, bottom: 56, containLabel: true },
      xAxis: {
        type: 'value',
        min: -maxExtent, max: maxExtent,
        axisLabel: {
          color: C.textMuted, fontSize: 10,
          formatter(v) {
            const abs = Math.abs(v);
            if (displayMode === 'percent') return (abs * 100).toFixed(0) + '%';
            return Math.round(abs).toString();
          }
        },
        axisLine: { lineStyle: { color: C.border } },
        splitLine: { lineStyle: { color: C.border, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: yNames,
        axisLabel: { color: C.textMain, fontSize: 11, width: 160, overflow: 'break', interval: 0 },
        axisLine: { lineStyle: { color: C.border } },
        splitLine: { show: false }
      },
      series
    });

    element._resizeObs = new ResizeObserver(() => {
      if (element._instance && !element._instance.isDisposed()) element._instance.resize();
    });
    element._resizeObs.observe(container);
  },

  // ── Lifecycle hooks ───────────────────────────────────────────────────────

  onFilterChange(element, dataset, filters) {
    this.render(element, dataset, filters);
  },

  onThemeChange(element) {
    const dataset = DWB.viz.getFilteredData(element.datasetName);
    this.render(element, dataset, DWB.viz.filters || []);
  },

  getPromptContext(element, dataset) {
    if (!dataset) return 'No data.';
    const cfg  = element.config || {};
    const cols = (cfg.questionCols || []).map(ci => dataset.headers[ci] || ci).join(', ');
    return `Stacked Diverging Bar: questions=[${cols}], mode=${cfg.displayMode || 'count'}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance(element) { return element._instance || null; }
});

// ─────────────────────── MODULE-PRIVATE UTILITIES ────────────────────────────

function _sdbSelListHtml(element, headers) {
  const cfg          = element.config;
  const questionCols = cfg.questionCols || [];
  if (questionCols.length === 0) return '';
  const eid = element.id;

  let html = `<div style="margin-top:8px">
    <div class="sidebar-label" style="margin-bottom:4px">Selected Questions (display order)</div>`;

  questionCols.forEach((ci, idx) => {
    const h       = _sdbEscHtml(headers[ci] || ('Col ' + ci));
    const isFirst = idx === 0;
    const isLast  = idx === questionCols.length - 1;
    const btnBase = 'padding:2px 6px;font-size:0.75rem;background:transparent;border:1px solid var(--border);border-radius:3px;cursor:pointer';
    html += `<div class="sdb-sel-row" data-col-index="${ci}"
        style="display:flex;align-items:center;gap:6px;padding:4px 6px;
               background:var(--surface);border:1px solid var(--border);
               border-radius:4px;margin-bottom:2px;">
        <span style="flex:1;font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;
                     white-space:nowrap" title="${h}">${h}</span>
        <button title="Move up" style="${btnBase}" ${isFirst ? 'disabled' : ''}
          onclick="DWB._sdb_selAction('${eid}',${ci},'up')">↑</button>
        <button title="Move down" style="${btnBase}" ${isLast ? 'disabled' : ''}
          onclick="DWB._sdb_selAction('${eid}',${ci},'down')">↓</button>
        <button title="Remove" style="${btnBase};color:var(--danger)"
          onclick="DWB._sdb_selAction('${eid}',${ci},'remove')">×</button>
      </div>
      <div style="padding:2px 6px 6px 6px">
        <input type="text" class="sidebar-input"
          placeholder="Display name (optional)"
          value="${_sdbEscHtml(cfg.displayNames[ci] || '')}"
          style="font-size:0.75rem;margin-bottom:0;color:var(--text-muted)"
          oninput="DWB._sdb_updateDisplayName('${eid}',${ci},this.value)">
      </div>`;
  });

  html += '</div>';
  return html;
}

function _sdbEscHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Escapes a value for use as a single-quoted JS argument inside a double-quoted
// HTML attribute (e.g. onchange="fn('${_sdbEscJs(val)}',...)").
function _sdbEscJs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')   // JS: backslash
    .replace(/'/g,  "\\'")    // JS: single quote
    .replace(/&/g,  '&amp;')  // HTML: ampersand (decoded by browser before JS runs)
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// Case-insensitive role lookup — returns the role string or null if not found.
function _sdbGetRole(valueRoles, val) {
  if (Object.prototype.hasOwnProperty.call(valueRoles, val)) return valueRoles[val] || null;
  const norm = String(val).toLowerCase().trim();
  for (const [k, r] of Object.entries(valueRoles)) {
    if (k.toLowerCase().trim() === norm) return r || null;
  }
  return null;
}

// Returns true if a role key exists for val (even if its value is '').
function _sdbHasRole(valueRoles, val) {
  if (Object.prototype.hasOwnProperty.call(valueRoles, val)) return true;
  const norm = String(val).toLowerCase().trim();
  return Object.keys(valueRoles).some(k => k.toLowerCase().trim() === norm);
}

// Sorts vals according to the template's value order (order-insensitive).
// Returns a new array; unmatched values are appended in original order.
function _sdbScaleSort(vals, tmpl) {
  if (!tmpl) return vals;
  return [...vals].sort((a, b) => {
    const ai = tmpl.values.indexOf(a.toLowerCase().trim());
    const bi = tmpl.values.indexOf(b.toLowerCase().trim());
    return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
  });
}

// Returns the appropriate chip color for a role-assignment preview in the
// config panel.  negOrd = outermost-first; posOrd = innermost-first.
function _sdbChipColor(val, role, negOrd, posOrd, CV) {
  if (role === 'negative') {
    const ni = negOrd.indexOf(val);
    return ni === 0 ? CV.negStrong : CV.negLight;
  }
  if (role === 'neutral')  return CV.neutral;
  if (role === 'positive') {
    const pi = posOrd.indexOf(val);
    return pi === posOrd.length - 1 ? CV.posStrong : CV.posLight;
  }
  return '#94a3b8';  // unassigned / exclude
}

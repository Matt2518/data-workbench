/* === DWBDashboard: dashboard display renderer === */

window.DWBDashboard = (function() {
  const _dLayouts = [
    { key: '1col',    label: '1 Col' },
    { key: '2col',    label: '2 Col' },
    { key: '3col',    label: '3 Col' },
    { key: '2col-6040', label: '60/40' },
    { key: '2col-7030', label: '70/30' }
  ];

  function _dActiveFilters(display) {
    return (display.filterContext && display.filterContext.activeFilters) || {};
  }

  function mount(container, display) {
    if (!container || !display) return;

    const cfg = display.config || {};
    const layout = cfg.layout || '2col';
    const filters = _dActiveFilters(display);
    const filterKeys = Object.keys(filters);

    container.innerHTML = `
      <div class="dash-root">
        <div class="dash-toolbar">
          <span class="dash-toolbar-label">${_dEsc(display.label)}</span>
          <div style="display:flex;gap:4px">
            ${_dLayouts.map(function(l) {
              return '<button class="dash-layout-btn' + (layout === l.key ? ' active' : '') + '" data-layout="' + l.key + '">' + l.label + '</button>';
            }).join('')}
          </div>
          <div class="flex-spacer"></div>
          <button class="tb-btn" id="dash-add-viz-btn">＋ Add Viz</button>
          <button class="tb-btn" id="dash-fullscreen-btn">⛶ Present</button>
        </div>
        <div class="dash-filter-bar${filterKeys.length ? '' : ' hidden'}" id="dash-filter-bar">
          <span class="dash-filter-label">Filters</span>
          ${filterKeys.map(function(k) {
            return '<span class="dash-filter-chip">' + _dEsc(k) + ': ' + _dEsc(String(filters[k])) + '<button class="dash-filter-chip-remove" data-filter-key="' + _dEsc(k) + '">✕</button></span>';
          }).join('')}
          <button class="dash-clear-filters">Clear all</button>
        </div>
        <div class="dash-canvas" id="dash-canvas">
          <div class="dash-grid layout-${layout}" id="dash-grid"></div>
        </div>
      </div>`;

    // Wire layout buttons
    container.querySelectorAll('.dash-layout-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        display.config = display.config || {};
        display.config.layout = btn.dataset.layout;
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        mount(container, display);
      });
    });

    // Wire add viz
    container.querySelector('#dash-add-viz-btn').addEventListener('click', function() {
      _dShowAddPlacementModal(container, display);
    });

    // Wire fullscreen
    container.querySelector('#dash-fullscreen-btn').addEventListener('click', function() {
      _dEnterFullscreen(display);
    });

    // Wire filter chip removes
    container.querySelectorAll('.dash-filter-chip-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (display.filterContext) delete display.filterContext.activeFilters[btn.dataset.filterKey];
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        mount(container, display);
      });
    });
    const clearBtn = container.querySelector('.dash-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      display.filterContext = { activeFilters: {} };
      if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
      mount(container, display);
    });

    _dRenderPlacements(display, container.querySelector('#dash-grid'), filters);
  }

  function _dRenderPlacements(display, grid, filters) {
    if (!grid) return;
    const placements = (display.placements || []);
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];

    if (placements.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1"><button class="dash-add-placement-btn" id="dash-first-add">＋ Add your first visualization</button></div>';
      const firstAdd = grid.querySelector('#dash-first-add');
      if (firstAdd) firstAdd.addEventListener('click', function() {
        _dShowAddPlacementModal(grid.closest('.dash-root').parentElement, display);
      });
      return;
    }

    placements.forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      const card = document.createElement('div');
      card.className = 'dash-placement';

      if (!viz) {
        card.innerHTML = '<div class="dash-placement-body" style="display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:12px">Visualization not found</div>';
        grid.appendChild(card);
        return;
      }

      const rows = _dGetFilteredRows(viz, snapshots, filters);
      const allRows = snapshots[viz.snapshotName] || [];

      card.innerHTML = `<div class="dash-placement-header">
        <span class="dash-placement-title">${_dEsc(viz.label)}</span>
        <button class="dash-fullscreen-btn" style="margin-left:auto" data-placement-id="${placement.id}" title="Remove">✕</button>
      </div>
      <div class="dash-placement-body" id="dash-pb-${placement.id}"></div>`;

      card.querySelector('.dash-fullscreen-btn').addEventListener('click', function() {
        display.placements = display.placements.filter(function(p) { return p.id !== placement.id; });
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        const gridEl = grid;
        _dRenderPlacements(display, gridEl, filters);
      });

      grid.appendChild(card);

      // Render viz into placement body
      const body = card.querySelector('#dash-pb-' + placement.id);
      if (body) {
        if (viz.type === 'AI_ASSIST') {
          _dRenderAiAssist(body, viz, rows);
        } else if (window.DWBVizTab) {
          window.DWBVizTab.renderViz(viz, rows, body, allRows);
        }
      }
    });
  }

  function _dGetFilteredRows(viz, snapshots, filters) {
    let rows = snapshots[viz.snapshotName] || [];
    if (!viz.linkToDisplayFilters) return rows;
    const filterKeys = Object.keys(filters);
    if (filterKeys.length === 0) return rows;
    return rows.filter(function(row) {
      return filterKeys.every(function(k) {
        return String(row[k] !== undefined ? row[k] : '') === String(filters[k]);
      });
    });
  }

  function _dShowAddPlacementModal(container, display) {
    const state = window.DWBState;
    const vizList = (state.flow && state.flow.visualizations) || [];

    if (vizList.length === 0) {
      alert('No visualizations exist yet. Create some in the Viz tab first.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';
    overlay.innerHTML = `<div class="modal" style="width:400px">
      <div class="modal-header">
        <span>Add to Dashboard</span>
        <button class="modal-close" id="dash-modal-close">✕</button>
      </div>
      <div style="padding:16px">
        <div class="form-row">
          <label>Select Visualization</label>
          <select id="dash-viz-select" style="width:100%">
            ${vizList.map(function(v) { return '<option value="' + _dEsc(v.id) + '">' + _dEsc(v.label) + ' (' + v.type + ')</option>'; }).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Column (for multi-column layouts)</label>
          <select id="dash-col-select" style="width:100%">
            <option value="1">Column 1</option>
            <option value="2">Column 2</option>
            <option value="3">Column 3</option>
          </select>
        </div>
        <button class="btn-primary" id="dash-add-confirm" style="width:100%;padding:8px;margin-top:8px">Add to Dashboard</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#dash-modal-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelector('#dash-add-confirm').addEventListener('click', function() {
      const vizId = overlay.querySelector('#dash-viz-select').value;
      const col   = parseInt(overlay.querySelector('#dash-col-select').value, 10) || 1;
      const placement = window.DWBSchema.createPlacement(vizId, 'DASHBOARD');
      placement.column = col;
      display.placements = display.placements || [];
      display.placements.push(placement);
      if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
      document.body.removeChild(overlay);
      // Re-mount
      window.DWBDisplaysTab && window.DWBDisplaysTab.mount();
    });
  }

  function _dEnterFullscreen(display) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:800;background:var(--bg-main);overflow:auto;padding:32px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Exit';
    closeBtn.style.cssText = 'position:fixed;top:12px;right:16px;padding:6px 14px;background:var(--navy-midnight);color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:801;font-size:12px';
    closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });

    const inner = document.createElement('div');
    const cfg = display.config || {};
    const layout = cfg.layout || '2col';
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];

    inner.className = 'dash-grid layout-' + layout;
    inner.style.cssText = 'gap:20px;max-width:1400px;margin:0 auto';

    (display.placements || []).forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      if (!viz) return;
      const rows = snapshots[viz.snapshotName] || [];
      const card = document.createElement('div');
      card.className = 'dash-placement';
      card.innerHTML = '<div class="dash-placement-header"><span class="dash-placement-title">' + _dEsc(viz.label) + '</span></div><div class="dash-placement-body" id="fs-pb-' + placement.id + '"></div>';
      inner.appendChild(card);
      overlay.appendChild(card);
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(inner);

    // Re-render placements into fullscreen
    (display.placements || []).forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      if (!viz) return;
      const rows = snapshots[viz.snapshotName] || [];
      const body = overlay.querySelector('#fs-pb-' + placement.id);
      if (body) {
        if (viz.type === 'AI_ASSIST') {
          _dRenderAiAssist(body, viz, rows);
        } else if (window.DWBVizTab) {
          window.DWBVizTab.renderViz(viz, rows, body);
        }
      }
    });

    document.body.appendChild(overlay);
  }

  // ── Shared chart palette ─────────────────────────────────────────────────────
  var _D_PALETTE = ['#005EB8','#C5B230','#059669','#dc2626','#f59e0b','#0ea5e9','#8b5cf6','#ec4899'];

  // Word-cloud CDN lazy-load promise (own cached promise, own failure state)
  var _dWcPromise = null;

  // ── Likert scale presets ─────────────────────────────────────────────────────
  var _LIKERT_SCALES = {
    '5point': ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'],
    '7point': ['Strongly Disagree','Disagree','Somewhat Disagree','Neutral','Somewhat Agree','Agree','Strongly Agree']
  };
  var _LIKERT_COLORS_5 = ['#1d4ed8','#3b82f6','#94a3b8','#f97316','#c2410c'];
  var _LIKERT_COLORS_7 = ['#1d4ed8','#3b82f6','#93c5fd','#94a3b8','#fdba74','#f97316','#c2410c'];

  // ── Utilities ─────────────────────────────────────────────────────────────────

  function _dMissingConfig(container, type) {
    container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px;text-align:center">⚙️ Configure ' + _dEsc(type) + ' in the config panel.</div>';
  }

  function _dDisposeDomCharts(container) {
    if (window.echarts) {
      container.querySelectorAll('.dash-block-chart').forEach(function(el) {
        var inst = window.echarts.getInstanceByDom(el);
        if (inst) inst.dispose();
      });
    }
  }

  // ── Single aggregation implementation ────────────────────────────────────────
  function _dAggregateRows(rows, categoryField, valueField, aggregation) {
    var groups = {};
    var counts = {};
    (rows || []).forEach(function(row) {
      var cat = row[categoryField] !== undefined ? String(row[categoryField]) : '(blank)';
      var val = parseFloat(row[valueField]) || 0;
      if (!groups[cat]) { groups[cat] = 0; counts[cat] = 0; }
      groups[cat] += val;
      counts[cat]++;
    });
    return Object.keys(groups).map(function(cat) {
      var value;
      if (aggregation === 'count') value = counts[cat];
      else if (aggregation === 'average') value = counts[cat] ? +(groups[cat] / counts[cat]).toFixed(2) : 0;
      else value = groups[cat];
      return { category: cat, value: value };
    });
  }

  // ── BAR_VERTICAL renderer (uses _dAggregateRows) ─────────────────────────────
  function _dRenderBarVertical(viz, rows, container) {
    var cfg = viz.config || {};
    var catField = cfg.categoryField || '';
    var valField = cfg.valueField || '';
    var agg = cfg.aggregation || 'sum';

    if (!catField || !valField || !rows.length) {
      _dMissingConfig(container, 'BAR_VERTICAL');
      return;
    }

    var data = _dAggregateRows(rows, catField, valField, agg);
    _dDisposeDomCharts(container);
    var el = document.createElement('div');
    el.className = 'dash-block-chart';
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    window.DWBVizTab.loadEcharts().then(function(ec) {
      var existing = ec.getInstanceByDom(el);
      if (existing) existing.dispose();
      var chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function(d) { return d.category; }), axisLabel: { rotate: 30, fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: data.map(function(d) { return d.value; }), itemStyle: { color: '#005EB8' } }],
        grid: { left: 50, right: 20, bottom: 60, top: 20 }
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _dMissingConfig(container, 'BAR_VERTICAL (ECharts unavailable)'); });
  }

  // ── LINE renderer ─────────────────────────────────────────────────────────────
  function _dRenderLine(viz, rows, container) {
    var cfg = viz.config || {};
    var xField = cfg.xField || '';
    var series = cfg.series || [];
    var agg = cfg.aggregation || 'sum';

    if (!xField || !series.length || !series.some(function(s) { return s.valueField; })) {
      _dMissingConfig(container, 'LINE');
      return;
    }

    // Collect unique x categories in row order
    var xCats = [];
    var xSeen = {};
    rows.forEach(function(row) {
      var x = row[xField] !== undefined ? String(row[xField]) : '(blank)';
      if (!xSeen[x]) { xSeen[x] = true; xCats.push(x); }
    });

    var echartsSeries = series.filter(function(s) { return s.valueField; }).map(function(s, idx) {
      var aggData = _dAggregateRows(rows, xField, s.valueField, agg);
      var catMap = {};
      aggData.forEach(function(d) { catMap[d.category] = d.value; });
      var yData = xCats.map(function(x) { return catMap[x] !== undefined ? catMap[x] : 0; });
      return {
        type: 'line',
        name: s.label || s.valueField,
        smooth: cfg.smoothed || false,
        data: yData,
        itemStyle: { color: s.color || _D_PALETTE[idx % _D_PALETTE.length] },
        yAxisIndex: cfg.dualYAxis ? (idx % 2) : 0
      };
    });

    var yAxisDef;
    if (cfg.dualYAxis) {
      yAxisDef = [
        { type: 'value', name: cfg.yLabel || '', nameTextStyle: { fontSize: 11 } },
        { type: 'value', name: cfg.y2Label || '', nameTextStyle: { fontSize: 11 } }
      ];
    } else {
      yAxisDef = { type: 'value', name: cfg.yLabel || '' };
    }

    _dDisposeDomCharts(container);
    var el = document.createElement('div');
    el.className = 'dash-block-chart';
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    window.DWBVizTab.loadEcharts().then(function(ec) {
      var existing = ec.getInstanceByDom(el);
      if (existing) existing.dispose();
      var chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: echartsSeries.length > 1 ? { bottom: 0 } : { show: false },
        xAxis: { type: 'category', data: xCats, name: cfg.xLabel || '', nameTextStyle: { fontSize: 11 } },
        yAxis: yAxisDef,
        series: echartsSeries,
        grid: { top: 40, bottom: 40, left: 60, right: cfg.dualYAxis ? 60 : 20 }
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _dMissingConfig(container, 'LINE (ECharts unavailable)'); });
  }

  // ── PIE renderer ──────────────────────────────────────────────────────────────
  function _dRenderPie(viz, rows, container) {
    var cfg = viz.config || {};
    var catField = cfg.categoryField || '';
    var agg = cfg.aggregation || 'sum';

    if (!catField) {
      _dMissingConfig(container, 'PIE');
      return;
    }

    var data;
    if (agg === 'count' || !cfg.valueField) {
      var countMap = {};
      rows.forEach(function(row) {
        var cat = row[catField] !== undefined ? String(row[catField]) : '(blank)';
        countMap[cat] = (countMap[cat] || 0) + 1;
      });
      data = Object.keys(countMap).map(function(cat) { return { name: cat, value: countMap[cat] }; });
    } else {
      data = _dAggregateRows(rows, catField, cfg.valueField, agg).map(function(d) { return { name: d.category, value: d.value }; });
    }

    var showLabels = cfg.showLabels !== false;
    var showLegend = cfg.showLegend !== false;

    _dDisposeDomCharts(container);
    var el = document.createElement('div');
    el.className = 'dash-block-chart';
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    window.DWBVizTab.loadEcharts().then(function(ec) {
      var existing = ec.getInstanceByDom(el);
      if (existing) existing.dispose();
      var chart = ec.init(el);
      chart.setOption({
        color: _D_PALETTE,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { show: showLegend, orient: 'vertical', right: 10, type: 'scroll' },
        series: [{
          type: 'pie',
          radius: cfg.donut ? ['40%','70%'] : '70%',
          data: data,
          label: { show: showLabels, formatter: '{b}: {d}%' },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
        }]
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _dMissingConfig(container, 'PIE (ECharts unavailable)'); });
  }

  // ── STACKED_DIVERGING_BAR (Likert) renderer ───────────────────────────────────
  function _dRenderStackedDivergingBar(viz, rows, container) {
    var cfg = viz.config || {};
    var questionField = cfg.questionField || '';
    var responseField = cfg.responseField || '';

    if (!questionField || !responseField) {
      _dMissingConfig(container, 'STACKED_DIVERGING_BAR');
      return;
    }

    var scaleType = cfg.scaleType || '5point';
    var scaleLabels = (scaleType === 'custom') ? (cfg.scaleLabels || []) : (_LIKERT_SCALES[scaleType] || _LIKERT_SCALES['5point']);
    var scaleColors;
    if (scaleType === '7point') {
      scaleColors = _LIKERT_COLORS_7.slice();
    } else if (scaleType === 'custom') {
      var baseC = ['#1d4ed8','#3b82f6','#93c5fd','#94a3b8','#fdba74','#f97316','#c2410c'];
      scaleColors = baseC.slice(0, scaleLabels.length);
    } else {
      scaleColors = _LIKERT_COLORS_5.slice();
    }

    var n = scaleLabels.length;
    if (!n) { _dMissingConfig(container, 'STACKED_DIVERGING_BAR'); return; }

    var midIdx = Math.floor(n / 2);
    var hasNeutral = (n % 2 === 1);

    // Unique questions in first-occurrence order
    var questions = [];
    var qSeen = {};
    rows.forEach(function(row) {
      var q = row[questionField] !== undefined ? String(row[questionField]) : '';
      if (q && !qSeen[q]) { qSeen[q] = true; questions.push(q); }
    });
    if (!questions.length) { _dMissingConfig(container, 'STACKED_DIVERGING_BAR'); return; }

    // Count responses per question per scale label
    var counts = {};
    questions.forEach(function(q) {
      counts[q] = {};
      scaleLabels.forEach(function(l) { counts[q][l] = 0; });
    });

    rows.forEach(function(row) {
      var q = row[questionField] !== undefined ? String(row[questionField]) : '';
      var r = row[responseField] !== undefined ? String(row[responseField]) : '';
      if (!q || !counts[q]) return;
      var rLower = r.toLowerCase().trim();
      var matched = null;
      for (var li = 0; li < scaleLabels.length; li++) {
        if (scaleLabels[li].toLowerCase().trim() === rLower) { matched = scaleLabels[li]; break; }
      }
      if (matched) {
        var inc = 1;
        if (cfg.countField && row[cfg.countField] !== undefined) inc = parseInt(row[cfg.countField]) || 1;
        counts[q][matched] = (counts[q][matched] || 0) + inc;
      }
    });

    // Build diverging series following v1.0 stacking pattern:
    // [neutral-left(neg), ...negOrd(outermost-first, idx 0..midIdx-1), neutral-right(pos), ...posOrd(innermost-first, idx midIdx+1..n-1)]
    var neutralLabel = hasNeutral ? scaleLabels[midIdx] : '';
    var neutralColor = hasNeutral ? (scaleColors[midIdx] || '#94a3b8') : '';

    var series = [];

    if (hasNeutral) {
      series.push({
        type: 'bar', name: '__nl_' + neutralLabel, stack: 'likert',
        data: questions.map(function(q) { return -Math.floor((counts[q][neutralLabel] || 0) / 2); }),
        itemStyle: { color: neutralColor }, label: { show: false }
      });
    }

    // Negative series: outermost first = ascending index order (index 0 = most negative)
    for (var ni = 0; ni < midIdx; ni++) {
      (function(idx) {
        var lbl = scaleLabels[idx];
        series.push({
          type: 'bar', name: lbl, stack: 'likert',
          data: questions.map(function(q) { return -(counts[q][lbl] || 0); }),
          itemStyle: { color: scaleColors[idx] || '#94a3b8' },
          emphasis: { focus: 'series' }
        });
      })(ni);
    }

    if (hasNeutral) {
      series.push({
        type: 'bar', name: neutralLabel, stack: 'likert',
        data: questions.map(function(q) { return Math.ceil((counts[q][neutralLabel] || 0) / 2); }),
        itemStyle: { color: neutralColor }, emphasis: { focus: 'series' }
      });
    }

    // Positive series: innermost first = ascending index order (midIdx+1 = least positive)
    var posStart = midIdx + (hasNeutral ? 1 : 0);
    for (var pi = posStart; pi < n; pi++) {
      (function(idx) {
        var lbl = scaleLabels[idx];
        series.push({
          type: 'bar', name: lbl, stack: 'likert',
          data: questions.map(function(q) { return counts[q][lbl] || 0; }),
          itemStyle: { color: scaleColors[idx] || '#94a3b8' },
          emphasis: { focus: 'series' }
        });
      })(pi);
    }

    // Legend (skip __ ghost series, deduplicate)
    var legendData = [];
    var legendSeen = {};
    series.forEach(function(s) {
      if (!s.name.startsWith('__') && !legendSeen[s.name]) { legendSeen[s.name] = true; legendData.push(s.name); }
    });

    _dDisposeDomCharts(container);
    var el = document.createElement('div');
    el.className = 'dash-block-chart';
    el.style.cssText = 'width:100%;height:' + Math.max(200, questions.length * 40 + 80) + 'px';
    container.innerHTML = '';
    container.appendChild(el);

    window.DWBVizTab.loadEcharts().then(function(ec) {
      var existing = ec.getInstanceByDom(el);
      if (existing) existing.dispose();
      var chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: legendData, bottom: 4, type: 'scroll' },
        grid: { top: 20, bottom: 40, left: 160, right: 20 },
        xAxis: {
          type: 'value',
          min: function(value) { return -Math.max(Math.abs(value.min), Math.abs(value.max)); },
          max: function(value) { return Math.max(Math.abs(value.min), Math.abs(value.max)); }
        },
        yAxis: { type: 'category', data: questions, inverse: true },
        series: series
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _dMissingConfig(container, 'STACKED_DIVERGING_BAR (ECharts unavailable)'); });
  }

  // ── WORD_CLOUD renderer ───────────────────────────────────────────────────────
  function _dRenderWordCloud(viz, rows, container) {
    var cfg = viz.config || {};
    var wordField = cfg.wordField || '';

    if (!wordField) {
      _dMissingConfig(container, 'WORD_CLOUD');
      return;
    }

    var maxWords = cfg.maxWords || 100;
    var wordMap = {};
    rows.forEach(function(row) {
      var word = row[wordField] !== undefined ? String(row[wordField]).trim() : '';
      if (!word) return;
      if (cfg.weightField && row[cfg.weightField] !== undefined) {
        wordMap[word] = (wordMap[word] || 0) + (parseFloat(row[cfg.weightField]) || 0);
      } else {
        wordMap[word] = (wordMap[word] || 0) + 1;
      }
    });

    var wordData = Object.keys(wordMap)
      .map(function(w) { return { name: w, value: wordMap[w] }; })
      .sort(function(a, b) { return b.value - a.value; })
      .slice(0, maxWords);

    if (!wordData.length) { _dMissingConfig(container, 'WORD_CLOUD'); return; }

    var colorMode = cfg.colorMode || 'palette';

    _dDisposeDomCharts(container);
    var el = document.createElement('div');
    el.className = 'dash-block-chart';
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    window.DWBVizTab.loadEcharts().then(function(ec) {
      if (!_dWcPromise) {
        _dWcPromise = new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js';
          s.onload = resolve;
          s.onerror = function() { _dWcPromise = null; reject(new Error('Word cloud library unavailable')); };
          document.head.appendChild(s);
        });
      }
      _dWcPromise.then(function() {
        var existing = ec.getInstanceByDom(el);
        if (existing) existing.dispose();
        var chart = ec.init(el);
        var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#005EB8';
        chart.setOption({
          series: [{
            type: 'wordCloud',
            shape: 'circle',
            sizeRange: [12, 48],
            rotationRange: [0, 0],
            gridSize: 8,
            data: wordData,
            textStyle: {
              color: colorMode === 'single'
                ? accentColor
                : function() { return _D_PALETTE[Math.floor(Math.random() * _D_PALETTE.length)]; }
            }
          }]
        });
        setTimeout(function() { chart.resize(); }, 50);
      }).catch(function() {
        container.innerHTML = '<div style="padding:20px;color:var(--danger);font-size:12px">⚠️ Word cloud library unavailable.</div>';
      });
    }).catch(function() { _dMissingConfig(container, 'WORD_CLOUD (ECharts unavailable)'); });
  }

  // ── STAT_CARD renderer ─────────────────────────────────────────────────────────
  function _dComputeStatVar(variable, allRows, filteredRows) {
    var rows = variable.scope === 'unfiltered' ? allRows : filteredRows;
    if (variable.aggregation === 'count') return rows.length;
    if (!variable.field) return 0;
    var vals = rows.map(function(r) { return r[variable.field]; }).filter(function(v) { return v !== undefined && v !== null && v !== ''; });
    if (variable.aggregation === 'sum') {
      return vals.reduce(function(s, v) { return s + (parseFloat(v) || 0); }, 0);
    }
    if (variable.aggregation === 'average') {
      if (!vals.length) return 0;
      var sum = vals.reduce(function(s, v) { return s + (parseFloat(v) || 0); }, 0);
      return +(sum / vals.length).toFixed(2);
    }
    if (variable.aggregation === 'mode') {
      var freq = {};
      vals.forEach(function(v) { freq[v] = (freq[v] || 0) + 1; });
      var best = null, bestCount = -1;
      Object.keys(freq).forEach(function(k) {
        if (freq[k] > bestCount) { best = k; bestCount = freq[k]; }
      });
      return best;
    }
    return 0;
  }

  function _dRenderStatCardLine(text, varMap) {
    return text.replace(/\{\{(\w+)\}\}/g, function(match, name) {
      return varMap.hasOwnProperty(name) ? String(varMap[name]) : match;
    });
  }

  function _dRenderStatCard(contentEl, viz, allRows, filteredRows) {
    var cfg = viz.config || {};
    if (!(cfg.lines || []).length) {
      _dMissingConfig(contentEl, 'STAT_CARD');
      return;
    }
    contentEl.innerHTML = '<div class="dash-statcard"></div>';
    var cardEl = contentEl.querySelector('.dash-statcard');
    var varMap = {};
    (cfg.variables || []).forEach(function(v) {
      if (v.name) varMap[v.name] = _dComputeStatVar(v, allRows, filteredRows);
    });
    (cfg.lines || []).forEach(function(line) {
      var div = document.createElement('div');
      div.className = 'dash-statcard-line';
      div.style.fontSize = (line.fontSize || 16) + 'px';
      div.style.fontWeight = line.weight === 'bold' ? '700' : '400';
      div.style.textAlign = line.align || 'center';
      if (line.color) div.style.color = line.color;
      div.textContent = _dRenderStatCardLine(line.text || '', varMap);
      cardEl.appendChild(div);
    });
  }

  // ── QUOTES_BOARD renderer ──────────────────────────────────────────────────────
  function _dRenderQuotesBoard(contentEl, viz, rows) {
    var cfg = viz.config || {};
    if (!cfg.quoteField) { _dMissingConfig(contentEl, 'QUOTES_BOARD'); return; }
    var maxQuotes = (cfg.maxQuotes != null) ? Math.max(1, cfg.maxQuotes) : 12;
    var layout = cfg.layout || 'grid';
    var filtered = (rows || []).filter(function(row) {
      var val = row[cfg.quoteField];
      return val !== undefined && val !== null && String(val).trim() !== '';
    }).slice(0, maxQuotes);
    var cardsHtml = filtered.map(function(row) {
      var text = String(row[cfg.quoteField]);
      var attribution = (cfg.attributionField && row[cfg.attributionField] != null)
        ? String(row[cfg.attributionField]).trim() : '';
      var sentiment = '';
      if (cfg.sentimentField && row[cfg.sentimentField] != null) {
        var s = String(row[cfg.sentimentField]).toLowerCase().trim();
        if (s === 'positive' || s === 'neutral' || s === 'negative') sentiment = s;
      }
      return '<div class="dash-quote-card' + (sentiment ? ' dash-quote-' + sentiment : '') + '">' +
        '<div class="dash-quote-text">“' + _dEsc(text) + '”</div>' +
        (attribution ? '<div class="dash-quote-attribution">— ' + _dEsc(attribution) + '</div>' : '') +
        '</div>';
    }).join('');
    contentEl.innerHTML = '<div class="dash-quotes-board' + (layout === 'list' ? ' layout-list' : '') + '">' + cardsHtml + '</div>';
  }

  // ── RICH_TEXT renderer ─────────────────────────────────────────────────────────
  function _dRenderRichText(contentEl, viz, rows) {
    var cfg = viz.config || {};
    if (!cfg.text) { _dMissingConfig(contentEl, 'RICH_TEXT'); return; }
    var row = (rows && rows[0]) ? rows[0] : {};
    var text = cfg.text.replace(/\{\{(\w+)\}\}/g, function(match, name) {
      return row.hasOwnProperty(name) ? String(row[name]) : match;
    });
    contentEl.innerHTML = '<div class="dash-richtext"></div>';
    var el = contentEl.querySelector('.dash-richtext');
    el.style.fontSize = (cfg.fontSize || 16) + 'px';
    el.style.fontWeight = cfg.weight === 'bold' ? '700' : '400';
    el.style.textAlign = cfg.align || 'left';
    if (cfg.color) el.style.color = cfg.color;
    el.textContent = text;
  }

  // ── AI_ASSIST renderer ─────────────────────────────────────────────────────────
  function _dBuildAiPrompt(viz, rows) {
    var cfg = viz.config || {};
    var maxRows = cfg.maxRows || 50;
    var fields = (cfg.includeFields && cfg.includeFields.length)
      ? cfg.includeFields
      : (rows[0] ? Object.keys(rows[0]) : []);
    var sample = rows.slice(0, maxRows).map(function(row) {
      var obj = {};
      fields.forEach(function(f) { obj[f] = row[f]; });
      return obj;
    });
    var template = cfg.promptTemplate || 'Analyze the following data and provide insights:\n\n{{data}}';
    return template.replace('{{data}}', JSON.stringify(sample, null, 2));
  }

  function _dRenderAiAssist(contentEl, viz, rows) {
    var existing = (viz.config && viz.config.response) ? viz.config.response : '';
    contentEl.innerHTML =
      '<div class="dash-ai-assist">' +
        '<div class="dash-ai-controls">' +
          '<button class="dash-ai-copy-btn">📋 Copy Prompt</button>' +
          '<span class="dash-ai-copy-status"></span>' +
        '</div>' +
        '<div class="dash-ai-response-label">Response (paste here):</div>' +
        '<textarea class="dash-ai-response" placeholder="Paste the AI response here...">' + _dEsc(existing) + '</textarea>' +
      '</div>';
    var copyBtn = contentEl.querySelector('.dash-ai-copy-btn');
    var statusEl = contentEl.querySelector('.dash-ai-copy-status');
    var respEl = contentEl.querySelector('.dash-ai-response');
    copyBtn.addEventListener('click', function() {
      var prompt = _dBuildAiPrompt(viz, rows);
      try {
        navigator.clipboard.writeText(prompt).then(function() {
          statusEl.textContent = '✓ Copied';
          setTimeout(function() { statusEl.textContent = ''; }, 2000);
        }).catch(function() {
          statusEl.textContent = '⚠️ Copy failed — select and copy manually';
        });
      } catch (e) {
        statusEl.textContent = '⚠️ Clipboard unavailable';
      }
    });
    respEl.addEventListener('blur', function() {
      viz.config = viz.config || {};
      viz.config.response = this.value;
      if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
    });
  }

  function _dEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    mount: mount,
    renderBarVertical: _dRenderBarVertical,
    renderLine: _dRenderLine,
    renderPie: _dRenderPie,
    renderStackedDivergingBar: _dRenderStackedDivergingBar,
    renderWordCloud: _dRenderWordCloud,
    renderStatCard: _dRenderStatCard,
    renderQuotesBoard: _dRenderQuotesBoard,
    renderRichText: _dRenderRichText,
    renderAiAssist: _dRenderAiAssist,
    aggregateRows: _dAggregateRows
  };
})();

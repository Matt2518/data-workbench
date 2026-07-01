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

  function _dGetFilterableFields(display, vizList) {
    var fields = {};
    var result = [];
    (display.placements || []).forEach(function(p) {
      var viz = (vizList || []).find(function(v) { return v.id === p.vizId; });
      if (!viz || !viz.linkToDisplayFilters) return;
      (viz.filterableFields || []).forEach(function(f) {
        if (!fields[f]) { fields[f] = true; result.push(f); }
      });
    });
    return result;
  }

  function _dGetUniqueValues(field, display, snapshots, vizList) {
    var seen = {};
    var vals = [];
    (display.placements || []).forEach(function(p) {
      var viz = (vizList || []).find(function(v) { return v.id === p.vizId; });
      if (!viz || !viz.linkToDisplayFilters) return;
      if ((viz.filterableFields || []).indexOf(field) === -1) return;
      (snapshots[viz.snapshotName] || []).forEach(function(row) {
        if (row[field] !== undefined) {
          var v = String(row[field]);
          if (!seen[v]) { seen[v] = true; vals.push(v); }
        }
      });
    });
    return vals.sort();
  }

  function _dRenderFilterBar(filterBarEl, display, vizList, snapshots, onFilterChange) {
    if (!filterBarEl) return;
    var filterableFields = _dGetFilterableFields(display, vizList);
    if (!filterableFields.length) {
      filterBarEl.classList.add('hidden');
      filterBarEl.innerHTML = '';
      return;
    }
    filterBarEl.classList.remove('hidden');
    var activeFilters = _dActiveFilters(display);
    filterBarEl.innerHTML = '';

    var label = document.createElement('span');
    label.className = 'dash-filter-label';
    label.textContent = 'Filters';
    filterBarEl.appendChild(label);

    filterableFields.forEach(function(field) {
      var activeVal = activeFilters.hasOwnProperty(field) ? activeFilters[field] : null;
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative';

      var chip = document.createElement('span');
      chip.className = 'dash-filter-chip' + (activeVal !== null ? ' active' : '');

      var chipLabel = document.createElement('span');
      chipLabel.textContent = field + ': ' + (activeVal !== null ? String(activeVal) : 'All');
      chip.appendChild(chipLabel);

      if (activeVal !== null) {
        var clrBtn = document.createElement('button');
        clrBtn.className = 'dash-filter-chip-remove';
        clrBtn.textContent = '✕';
        clrBtn.addEventListener('click', (function(f) { return function(e) {
          e.stopPropagation();
          display.filterContext = display.filterContext || { activeFilters: {} };
          display.filterContext.activeFilters = display.filterContext.activeFilters || {};
          delete display.filterContext.activeFilters[f];
          if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
          if (onFilterChange) onFilterChange();
        }; })(field));
        chip.appendChild(clrBtn);
      }

      chip.addEventListener('click', (function(f, av) { return function() {
        var existing = wrapper.querySelector('.dash-filter-dropdown');
        if (existing) { wrapper.removeChild(existing); return; }
        document.querySelectorAll('.dash-filter-dropdown').forEach(function(d) {
          if (d.parentElement) d.parentElement.removeChild(d);
        });
        var dd = document.createElement('div');
        dd.className = 'dash-filter-dropdown';

        var allBtn = document.createElement('button');
        allBtn.className = 'dash-filter-dropdown-item' + (av === null ? ' active' : '');
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', function() {
          display.filterContext = display.filterContext || { activeFilters: {} };
          display.filterContext.activeFilters = display.filterContext.activeFilters || {};
          delete display.filterContext.activeFilters[f];
          if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
          if (onFilterChange) onFilterChange();
        });
        dd.appendChild(allBtn);

        _dGetUniqueValues(f, display, snapshots, vizList).forEach(function(val) {
          var opt = document.createElement('button');
          opt.className = 'dash-filter-dropdown-item' + (av !== null && String(av) === val ? ' active' : '');
          opt.textContent = val;
          opt.addEventListener('click', function() {
            display.filterContext = display.filterContext || { activeFilters: {} };
            display.filterContext.activeFilters = display.filterContext.activeFilters || {};
            display.filterContext.activeFilters[f] = val;
            if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
            if (onFilterChange) onFilterChange();
          });
          dd.appendChild(opt);
        });

        wrapper.appendChild(dd);
        setTimeout(function() {
          document.addEventListener('click', function _ddCloser(e) {
            if (!wrapper.contains(e.target)) {
              if (wrapper.contains(dd)) wrapper.removeChild(dd);
              document.removeEventListener('click', _ddCloser);
            }
          });
        }, 10);
      }; })(field, activeVal));

      wrapper.appendChild(chip);
      filterBarEl.appendChild(wrapper);
    });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'dash-clear-filters';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', function() {
      display.filterContext = { activeFilters: {} };
      if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
      if (onFilterChange) onFilterChange();
    });
    filterBarEl.appendChild(clearBtn);
  }

  function mount(container, display) {
    if (!container || !display) return;

    const cfg = display.config || {};
    const layout = cfg.layout || '2col';
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];

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
          <button class="tb-btn" id="dash-export-btn">Export HTML</button>
        </div>
        <div class="dash-filter-bar hidden" id="dash-filter-bar"></div>
        <div class="dash-canvas" id="dash-canvas">
          <div class="dash-grid layout-${layout}" id="dash-grid"></div>
        </div>
      </div>`;

    container.querySelectorAll('.dash-layout-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        display.config = display.config || {};
        display.config.layout = btn.dataset.layout;
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        mount(container, display);
      });
    });

    container.querySelector('#dash-add-viz-btn').addEventListener('click', function() {
      _dShowAddPlacementModal(container, display);
    });

    container.querySelector('#dash-fullscreen-btn').addEventListener('click', function() {
      _dEnterFullscreen(display);
    });

    container.querySelector('#dash-export-btn').addEventListener('click', function() {
      _dExportHtml(display, container.querySelector('#dash-export-btn'));
    });

    var filterBarEl = container.querySelector('#dash-filter-bar');
    var gridEl = container.querySelector('#dash-grid');

    function _doFilterUpdate() {
      _dRenderFilterBar(filterBarEl, display, vizList, snapshots, _doFilterUpdate);
      _dDisposeDomCharts(gridEl);
      gridEl.innerHTML = '';
      _dRenderPlacements(display, gridEl, _dActiveFilters(display), _doFilterUpdate);
    }

    _dRenderFilterBar(filterBarEl, display, vizList, snapshots, _doFilterUpdate);
    _dRenderPlacements(display, gridEl, _dActiveFilters(display), _doFilterUpdate);
  }

  function _dRenderPlacements(display, grid, filters, onFilterChange) {
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
        _dDisposeDomCharts(grid);
        grid.innerHTML = '';
        _dRenderPlacements(display, grid, _dActiveFilters(display), onFilterChange);
      });

      grid.appendChild(card);

      const body = card.querySelector('#dash-pb-' + placement.id);
      if (!body) return;

      switch (viz.type) {
        case 'BAR_VERTICAL':          _dRenderBarVertical(viz, rows, body, display, onFilterChange); break;
        case 'LINE':                  _dRenderLine(viz, rows, body, display, onFilterChange); break;
        case 'PIE':                   _dRenderPie(viz, rows, body, display, onFilterChange); break;
        case 'STACKED_DIVERGING_BAR': _dRenderStackedDivergingBar(viz, rows, body, display, onFilterChange); break;
        case 'WORD_CLOUD':            _dRenderWordCloud(viz, rows, body, display, onFilterChange); break;
        case 'STAT_CARD':             _dRenderStatCard(body, viz, allRows, rows); break;
        case 'DATA_TABLE':            _dRenderDataTable(body, viz, rows); break;
        case 'AI_ASSIST':             _dRenderAiAssist(body, viz, rows); break;
        case 'QUOTES_BOARD':          _dRenderQuotesBoard(body, viz, rows); break;
        case 'RICH_TEXT':             _dRenderRichText(body, viz, rows); break;
        default:
          if (window.DWBVizTab) window.DWBVizTab.renderViz(viz, rows, body, allRows);
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
  function _dRenderBarVertical(viz, rows, container, display, onFilterChange) {
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

    var activeFilters = (display && display.filterContext && display.filterContext.activeFilters) || {};
    var activeVal = activeFilters.hasOwnProperty(catField) ? String(activeFilters[catField]) : null;
    var barData = data.map(function(d) {
      var color = (activeVal !== null)
        ? (String(d.category) === activeVal ? '#005EB8' : 'rgba(0,94,184,0.3)')
        : '#005EB8';
      return { value: d.value, itemStyle: { color: color } };
    });

    window.DWBVizTab.loadEcharts().then(function(ec) {
      var existing = ec.getInstanceByDom(el);
      if (existing) existing.dispose();
      var chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function(d) { return d.category; }), axisLabel: { rotate: 30, fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: barData }],
        grid: { left: 50, right: 20, bottom: 60, top: 20 }
      });
      setTimeout(function() { chart.resize(); }, 50);
      chart.on('click', function(params) {
        if (!display || !onFilterChange) return;
        if (!viz.linkToDisplayFilters || !(viz.filterableFields || []).length) return;
        if (!catField) return;
        var value = params.name || (params.data && params.data.name) || '';
        if (!value) return;
        display.filterContext = display.filterContext || { activeFilters: {} };
        display.filterContext.activeFilters = display.filterContext.activeFilters || {};
        if (display.filterContext.activeFilters[catField] === value) {
          delete display.filterContext.activeFilters[catField];
        } else {
          display.filterContext.activeFilters[catField] = value;
        }
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        onFilterChange();
      });
    }).catch(function() { _dMissingConfig(container, 'BAR_VERTICAL (ECharts unavailable)'); });
  }

  // ── LINE renderer ─────────────────────────────────────────────────────────────
  function _dRenderLine(viz, rows, container, display, onFilterChange) {
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
      chart.on('click', function(params) {
        if (!display || !onFilterChange) return;
        if (!viz.linkToDisplayFilters || !(viz.filterableFields || []).length) return;
        if (!xField) return;
        var value = params.name || '';
        if (!value) return;
        display.filterContext = display.filterContext || { activeFilters: {} };
        display.filterContext.activeFilters = display.filterContext.activeFilters || {};
        if (display.filterContext.activeFilters[xField] === value) {
          delete display.filterContext.activeFilters[xField];
        } else {
          display.filterContext.activeFilters[xField] = value;
        }
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        onFilterChange();
      });
    }).catch(function() { _dMissingConfig(container, 'LINE (ECharts unavailable)'); });
  }

  // ── PIE renderer ──────────────────────────────────────────────────────────────
  function _dRenderPie(viz, rows, container, display, onFilterChange) {
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

    var activeFilters = (display && display.filterContext && display.filterContext.activeFilters) || {};
    var activeVal = activeFilters.hasOwnProperty(catField) ? String(activeFilters[catField]) : null;
    if (activeVal !== null) {
      data = data.map(function(d) {
        return { name: d.name, value: d.value, selected: d.name === activeVal };
      });
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
        color: _D_PALETTE,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { show: showLegend, orient: 'vertical', right: 10, type: 'scroll' },
        series: [{
          type: 'pie',
          radius: cfg.donut ? ['40%','70%'] : '70%',
          selectedMode: 'single',
          selectedOffset: 10,
          data: data,
          label: { show: showLabels, formatter: '{b}: {d}%' },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
        }]
      });
      setTimeout(function() { chart.resize(); }, 50);
      chart.on('click', function(params) {
        if (!display || !onFilterChange) return;
        if (!viz.linkToDisplayFilters || !(viz.filterableFields || []).length) return;
        if (!catField) return;
        var value = params.name || '';
        if (!value) return;
        display.filterContext = display.filterContext || { activeFilters: {} };
        display.filterContext.activeFilters = display.filterContext.activeFilters || {};
        if (display.filterContext.activeFilters[catField] === value) {
          delete display.filterContext.activeFilters[catField];
        } else {
          display.filterContext.activeFilters[catField] = value;
        }
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        onFilterChange();
      });
    }).catch(function() { _dMissingConfig(container, 'PIE (ECharts unavailable)'); });
  }

  // ── STACKED_DIVERGING_BAR (Likert) renderer ───────────────────────────────────
  function _dRenderStackedDivergingBar(viz, rows, container, display, onFilterChange) {
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
      chart.on('click', function(params) {
        if (!display || !onFilterChange) return;
        if (!viz.linkToDisplayFilters || !(viz.filterableFields || []).length) return;
        var field = (viz.config || {}).questionField || '';
        if (!field) return;
        var value = params.name || '';
        if (!value || value.indexOf('__') === 0) return;
        display.filterContext = display.filterContext || { activeFilters: {} };
        display.filterContext.activeFilters = display.filterContext.activeFilters || {};
        if (display.filterContext.activeFilters[field] === value) {
          delete display.filterContext.activeFilters[field];
        } else {
          display.filterContext.activeFilters[field] = value;
        }
        if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
        onFilterChange();
      });
    }).catch(function() { _dMissingConfig(container, 'STACKED_DIVERGING_BAR (ECharts unavailable)'); });
  }

  // ── WORD_CLOUD renderer ───────────────────────────────────────────────────────
  function _dRenderWordCloud(viz, rows, container, display, onFilterChange) {
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
        chart.on('click', function(params) {
          if (!display || !onFilterChange) return;
          if (!viz.linkToDisplayFilters || !(viz.filterableFields || []).length) return;
          var field = (viz.config || {}).categoryField || (viz.config || {}).xField || '';
          if (!field) return;
          var value = params.name || (params.data && params.data.name) || '';
          if (!value) return;
          display.filterContext = display.filterContext || { activeFilters: {} };
          display.filterContext.activeFilters = display.filterContext.activeFilters || {};
          if (display.filterContext.activeFilters[field] === value) {
            delete display.filterContext.activeFilters[field];
          } else {
            display.filterContext.activeFilters[field] = value;
          }
          if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
          onFilterChange();
        });
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

  // ── DATA_TABLE renderer ────────────────────────────────────────────────────────
  function _dRenderDataTable(body, viz, rows) {
    var cfg = viz.config || {};
    var selectedCols = (cfg.selectedColumns && cfg.selectedColumns.length) ? cfg.selectedColumns : null;
    var maxRows = cfg.maxRows || 200;
    var showRowNums = cfg.showRowNumbers === true;
    var enableSearch = cfg.enableSearch === true;

    if (!rows.length) {
      body.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">No data available.</div>';
      return;
    }

    var allCols = Object.keys(rows[0]);
    var cols = selectedCols ? selectedCols.filter(function(c) { return allCols.indexOf(c) !== -1; }) : allCols;
    var allIndices = rows.map(function(_, i) { return i; });

    var wrap = document.createElement('div');
    var searchInput = null;

    if (enableSearch) {
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'dash-table-search';
      searchInput.placeholder = 'Search…';
      wrap.appendChild(searchInput);
    }

    var tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow:auto;max-height:360px';
    wrap.appendChild(tableWrap);

    function renderTable(indices) {
      var limit = Math.min(indices.length, maxRows);
      var html = '<table class="dwb-data-table"><thead><tr>';
      if (showRowNums) html += '<th style="color:var(--text-faint);font-weight:normal;width:40px">#</th>';
      html += cols.map(function(c) { return '<th>' + _dEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      for (var i = 0; i < limit; i++) {
        var ri = indices[i];
        html += '<tr>';
        if (showRowNums) html += '<td class="row-num-cell">' + (ri + 1) + '</td>';
        html += cols.map(function(c) {
          var v = String(rows[ri][c] !== undefined ? rows[ri][c] : '');
          return '<td>' + _dEsc(v.length > 60 ? v.slice(0, 60) + '…' : v) + '</td>';
        }).join('') + '</tr>';
      }
      html += '</tbody></table>';
      if (indices.length > limit) {
        html += '<div style="padding:6px 8px;font-size:11px;color:var(--text-muted)">Showing ' + limit + ' of ' + indices.length + ' rows</div>';
      }
      tableWrap.innerHTML = html;
    }

    renderTable(allIndices);

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var term = this.value.toLowerCase();
        if (!term) { renderTable(allIndices); return; }
        var filtered = allIndices.filter(function(ri) {
          return cols.some(function(c) {
            return String(rows[ri][c] !== undefined ? rows[ri][c] : '').toLowerCase().indexOf(term) !== -1;
          });
        });
        renderTable(filtered);
      });
    }

    body.innerHTML = '';
    body.appendChild(wrap);
  }

  // ── Export HTML ───────────────────────────────────────────────────────────────

  var _dExportCSS = [
    ':root{--navy-midnight:#002244;--navy-sailor:#005EB8;--navy-gold:#C5B230;--navy-light:#EAF2FB;',
    '--bg-main:#f8fafc;--bg-surface:#ffffff;--bg-raised:#f1f5f9;--border:#e2e8f0;--border-strong:#94a3b8;',
    '--text-main:#1e293b;--text-muted:#64748b;--text-faint:#94a3b8;',
    '--accent:#005EB8;--accent-light:#EAF2FB;--success:#059669;--danger:#dc2626;}',
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;background:#f8fafc;color:#1e293b}',
    'button{cursor:pointer;font-family:inherit;font-size:inherit}',
    '#filter-banner{align-items:center;gap:12px;padding:10px 20px;background:#EAF2FB;border-left:4px solid #C5B230;font-size:12px;color:#1e293b;flex-wrap:wrap}',
    '#filter-banner-text{flex:1}',
    '#reset-filters-btn{padding:4px 12px;border:1px solid #005EB8;border-radius:4px;background:#fff;color:#005EB8;font-size:11px}',
    '#reset-filters-btn:hover{background:#EAF2FB}',
    '#dismiss-banner-btn{background:none;border:none;font-size:16px;color:#64748b;padding:0 4px}',
    '#dismiss-banner-btn:hover{color:#1e293b}',
    '#filter-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 20px;background:#fff;border-bottom:1px solid #e2e8f0}',
    '.export-chip-wrapper{position:relative}',
    '.export-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;font-size:12px;cursor:pointer;user-select:none}',
    '.export-chip:hover{border-color:#005EB8;color:#005EB8}',
    '.export-chip.active{background:#EAF2FB;border-color:#005EB8;color:#005EB8}',
    '.export-chip-clear{background:none;border:none;font-size:14px;color:inherit;cursor:pointer;padding:0 2px;line-height:1;opacity:0.7}',
    '.export-chip-clear:hover{opacity:1}',
    '.export-chip-dropdown{position:absolute;top:calc(100% + 4px);left:0;z-index:100;background:#fff;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:160px;max-height:240px;overflow-y:auto}',
    '.export-chip-option{display:block;width:100%;padding:7px 14px;background:none;border:none;text-align:left;font-size:12px;font-family:inherit;cursor:pointer;color:#1e293b}',
    '.export-chip-option:hover{background:#f1f5f9}',
    '.export-chip-option.selected{background:#EAF2FB;color:#005EB8;font-weight:600}',
    '#dashboard-canvas{padding:20px}',
    '.dash-grid{display:grid;gap:16px}',
    '.dash-grid.layout-1col{grid-template-columns:1fr}',
    '.dash-grid.layout-2col{grid-template-columns:1fr 1fr}',
    '.dash-grid.layout-3col{grid-template-columns:1fr 1fr 1fr}',
    '.dash-grid.layout-2col-6040{grid-template-columns:3fr 2fr}',
    '.dash-grid.layout-2col-7030{grid-template-columns:7fr 3fr}',
    '.dash-placement{background:#fff;border:1px solid #e2e8f0;border-left:3px solid #C5B230;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}',
    '.dash-placement-header{display:flex;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(135deg,#002244 0%,#005EB8 100%)}',
    '.dash-placement-title{flex:1;font-size:13px;font-weight:600;color:#fff}',
    '.dash-placement-body{padding:12px;min-height:160px}',
    '.vt-kpi{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:140px;padding:20px;gap:4px;text-align:center}',
    '.vt-kpi-value{font-size:48px;font-weight:700;color:#005EB8;line-height:1;letter-spacing:-0.02em}',
    '.vt-kpi-label{font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em}',
    '.vt-kpi-sub{font-size:11px;color:#94a3b8}',
    '.dash-statcard{display:flex;flex-direction:column;gap:8px;justify-content:center;align-items:center;height:100%;padding:16px;min-height:140px}',
    '.dash-statcard-line{line-height:1.3;color:#1e293b}',
    '.dash-quotes-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;padding:16px}',
    '.dash-quotes-board.layout-list{display:flex;flex-direction:column;gap:12px}',
    '.dash-quote-card{background:#f1f5f9;border-left:3px solid #94a3b8;border-radius:6px;padding:16px}',
    '.dash-quote-positive{border-left-color:#059669}.dash-quote-neutral{border-left-color:#94a3b8}.dash-quote-negative{border-left-color:#dc2626}',
    '.dash-quote-text{font-size:13px;font-style:italic;color:#1e293b;line-height:1.4}',
    '.dash-quote-attribution{font-size:12px;color:#64748b;margin-top:8px;font-weight:600}',
    '.dash-richtext{padding:16px;line-height:1.5;color:#1e293b}',
    '.dash-ai-export{padding:16px;font-size:13px;line-height:1.6;color:#1e293b;white-space:pre-wrap}',
    '.dash-ai-export-note{font-size:11px;color:#64748b;font-style:italic;margin-top:8px}',
    '.dwb-data-table{width:100%;border-collapse:collapse;font-size:12px}',
    '.dwb-data-table th{background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-weight:600;white-space:nowrap}',
    '.dwb-data-table td{border:1px solid #e2e8f0;padding:3px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dwb-data-table tbody tr:nth-child(even) td{background:#f1f5f9}',
    '.dash-block-chart{width:100%}'
  ].join('');

  function _dGetEChartsSource() {
    return fetch('https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js')
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .catch(function() {
        for (var i = 0; i < document.scripts.length; i++) {
          var s = document.scripts[i];
          if (s.src && s.src.indexOf('echarts') !== -1 && s.src.indexOf('wordcloud') === -1) {
            return fetch(s.src).then(function(r2) { if (!r2.ok) throw new Error('HTTP ' + r2.status); return r2.text(); });
          }
        }
        throw new Error('no-source');
      });
  }

  function _dNeedsWordCloud(display, visualizations) {
    return (display.placements || []).some(function(p) {
      var viz = visualizations.find(function(v) { return v.id === p.vizId; });
      return viz && viz.type === 'WORD_CLOUD';
    });
  }

  function _dBuildExportRuntime() {
    return `(function() {
  var S = EXPORT_STATE;
  var display = S.display;
  var vizList = S.visualizations;
  var snaps = S.snapshots;
  var activeFilters = JSON.parse(JSON.stringify(S.initialFilters || {}));
  var PALETTE = ['#005EB8','#C5B230','#059669','#dc2626','#f59e0b','#0ea5e9','#8b5cf6','#ec4899'];
  var LIKERT_5 = ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'];
  var LIKERT_7 = ['Strongly Disagree','Disagree','Somewhat Disagree','Neutral','Somewhat Agree','Agree','Strongly Agree'];
  var LCOLORS_5 = ['#1d4ed8','#3b82f6','#94a3b8','#f97316','#c2410c'];
  var LCOLORS_7 = ['#1d4ed8','#3b82f6','#93c5fd','#94a3b8','#fdba74','#f97316','#c2410c'];

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function getFilteredRows(viz) {
    var rows = snaps[viz.snapshotName] || [];
    if (!viz.linkToDisplayFilters) return rows;
    var keys = Object.keys(activeFilters);
    if (!keys.length) return rows;
    return rows.filter(function(row) {
      return keys.every(function(k) { return String(row[k]!==undefined?row[k]:'')===String(activeFilters[k]); });
    });
  }

  function getFilterableFields() {
    var fields = {}; var result = [];
    vizList.forEach(function(v) {
      if (v.linkToDisplayFilters && (v.filterableFields||[]).length) {
        v.filterableFields.forEach(function(f) { if (!fields[f]) { fields[f]=true; result.push(f); } });
      }
    });
    return result;
  }

  function getUniqueValues(field) {
    var seen = {}; var vals = [];
    Object.keys(snaps).forEach(function(sn) {
      (snaps[sn]||[]).forEach(function(row) {
        if (row[field]!==undefined) { var v=String(row[field]); if (!seen[v]) { seen[v]=true; vals.push(v); } }
      });
    });
    return vals.sort();
  }

  function renderBanner() {
    var banner = document.getElementById('filter-banner');
    var textEl = document.getElementById('filter-banner-text');
    var keys = Object.keys(activeFilters);
    if (!banner) return;
    if (keys.length) {
      banner.style.display = 'flex';
      if (textEl) textEl.textContent = '\u{1F50D} Filtered view: ' + keys.map(function(k) { return k+': '+activeFilters[k]; }).join(', ');
    } else { banner.style.display = 'none'; }
  }

  function renderChips() {
    var container = document.getElementById('filter-chips');
    if (!container) return;
    var fields = getFilterableFields();
    if (!fields.length) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    container.innerHTML = '';
    fields.forEach(function(field) {
      var activeVal = activeFilters.hasOwnProperty(field) ? activeFilters[field] : null;
      var wrapper = document.createElement('div');
      wrapper.className = 'export-chip-wrapper';
      var chip = document.createElement('div');
      chip.className = 'export-chip' + (activeVal !== null ? ' active' : '');
      var labelSpan = document.createElement('span');
      labelSpan.textContent = field + ': ' + (activeVal !== null ? String(activeVal) : 'All');
      chip.appendChild(labelSpan);
      if (activeVal !== null) {
        var clr = document.createElement('button');
        clr.className = 'export-chip-clear';
        clr.textContent = '\xD7';
        clr.addEventListener('click', (function(f) { return function(e) {
          e.stopPropagation(); delete activeFilters[f];
          renderBanner(); renderChips(); renderPlacements();
        }; })(field));
        chip.appendChild(clr);
      }
      chip.addEventListener('click', (function(f, av) { return function() {
        var existing = wrapper.querySelector('.export-chip-dropdown');
        if (existing) { wrapper.removeChild(existing); return; }
        document.querySelectorAll('.export-chip-dropdown').forEach(function(d) { d.parentElement.removeChild(d); });
        var dd = document.createElement('div');
        dd.className = 'export-chip-dropdown';
        var allBtn = document.createElement('button');
        allBtn.className = 'export-chip-option' + (av === null ? ' selected' : '');
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', function() { delete activeFilters[f]; renderBanner(); renderChips(); renderPlacements(); });
        dd.appendChild(allBtn);
        getUniqueValues(f).forEach(function(val) {
          var opt = document.createElement('button');
          opt.className = 'export-chip-option' + (av !== null && String(av) === val ? ' selected' : '');
          opt.textContent = val;
          opt.addEventListener('click', function() { activeFilters[f] = val; renderBanner(); renderChips(); renderPlacements(); });
          dd.appendChild(opt);
        });
        wrapper.appendChild(dd);
        setTimeout(function() {
          document.addEventListener('click', function closer(e) {
            if (!wrapper.contains(e.target)) { if (wrapper.contains(dd)) wrapper.removeChild(dd); document.removeEventListener('click', closer); }
          });
        }, 10);
      }; })(field, activeVal));
      wrapper.appendChild(chip);
      container.appendChild(wrapper);
    });
  }

  function aggregateRows(rows, catField, valField, agg) {
    var g = {}, c = {};
    (rows||[]).forEach(function(row) {
      var cat = row[catField]!==undefined ? String(row[catField]) : '(blank)';
      var val = parseFloat(row[valField]) || 0;
      if (!g[cat]) { g[cat]=0; c[cat]=0; }
      g[cat]+=val; c[cat]++;
    });
    return Object.keys(g).map(function(cat) {
      var v = agg==='count' ? c[cat] : agg==='average' ? (c[cat] ? +(g[cat]/c[cat]).toFixed(2) : 0) : g[cat];
      return { category: cat, value: v };
    });
  }

  function disposeDomCharts(container) {
    if (window.echarts) {
      container.querySelectorAll('.dash-block-chart').forEach(function(el) {
        var inst = window.echarts.getInstanceByDom(el);
        if (inst) inst.dispose();
      });
    }
  }

  function missingConfig(container, type) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;font-size:12px;text-align:center">⚙️ Configure '+esc(type)+' to display.</div>';
  }

  function renderBarVertical(viz, rows, container) {
    var cfg=viz.config||{}; var catF=cfg.categoryField||''; var valF=cfg.valueField||''; var agg=cfg.aggregation||'sum';
    if (!catF||!valF||!rows.length) { missingConfig(container,'BAR_VERTICAL'); return; }
    var data=aggregateRows(rows,catF,valF,agg);
    disposeDomCharts(container);
    var el=document.createElement('div'); el.className='dash-block-chart'; el.style.cssText='width:100%;height:300px';
    container.innerHTML=''; container.appendChild(el);
    var ec=window.echarts; var existing=ec.getInstanceByDom(el); if(existing) existing.dispose();
    var chart=ec.init(el);
    chart.setOption({ tooltip:{trigger:'axis'}, xAxis:{type:'category',data:data.map(function(d){return d.category;}),axisLabel:{rotate:30,fontSize:11}}, yAxis:{type:'value'}, series:[{type:'bar',data:data.map(function(d){return d.value;}),itemStyle:{color:'#005EB8'}}], grid:{left:50,right:20,bottom:60,top:20} });
    setTimeout(function(){chart.resize();},50);
  }

  function renderLine(viz, rows, container) {
    var cfg=viz.config||{}; var xF=cfg.xField||''; var series=cfg.series||[]; var agg=cfg.aggregation||'sum';
    if (!xF||!series.length||!series.some(function(s){return s.valueField;})) { missingConfig(container,'LINE'); return; }
    var xCats=[]; var xSeen={};
    rows.forEach(function(row){ var x=row[xF]!==undefined?String(row[xF]):'(blank)'; if(!xSeen[x]){xSeen[x]=true;xCats.push(x);} });
    var echartsSeries=series.filter(function(s){return s.valueField;}).map(function(s,idx){
      var aggD=aggregateRows(rows,xF,s.valueField,agg); var cm={};
      aggD.forEach(function(d){cm[d.category]=d.value;});
      return {type:'line',name:s.label||s.valueField,smooth:cfg.smoothed||false,data:xCats.map(function(x){return cm[x]!==undefined?cm[x]:0;}),itemStyle:{color:s.color||PALETTE[idx%PALETTE.length]},yAxisIndex:cfg.dualYAxis?(idx%2):0};
    });
    var yAxisDef=cfg.dualYAxis?[{type:'value',name:cfg.yLabel||''},{type:'value',name:cfg.y2Label||''}]:{type:'value',name:cfg.yLabel||''};
    disposeDomCharts(container);
    var el=document.createElement('div'); el.className='dash-block-chart'; el.style.cssText='width:100%;height:300px';
    container.innerHTML=''; container.appendChild(el);
    var ec=window.echarts; var existing=ec.getInstanceByDom(el); if(existing) existing.dispose();
    var chart=ec.init(el);
    chart.setOption({ tooltip:{trigger:'axis'}, legend:echartsSeries.length>1?{bottom:0}:{show:false}, xAxis:{type:'category',data:xCats,name:cfg.xLabel||''}, yAxis:yAxisDef, series:echartsSeries, grid:{top:40,bottom:40,left:60,right:cfg.dualYAxis?60:20} });
    setTimeout(function(){chart.resize();},50);
  }

  function renderPie(viz, rows, container) {
    var cfg=viz.config||{}; var catF=cfg.categoryField||''; var agg=cfg.aggregation||'sum';
    if (!catF) { missingConfig(container,'PIE'); return; }
    var data;
    if (agg==='count'||!cfg.valueField) {
      var cm={}; rows.forEach(function(row){ var cat=row[catF]!==undefined?String(row[catF]):'(blank)'; cm[cat]=(cm[cat]||0)+1; });
      data=Object.keys(cm).map(function(cat){return{name:cat,value:cm[cat]};});
    } else { data=aggregateRows(rows,catF,cfg.valueField,agg).map(function(d){return{name:d.category,value:d.value};}); }
    disposeDomCharts(container);
    var el=document.createElement('div'); el.className='dash-block-chart'; el.style.cssText='width:100%;height:300px';
    container.innerHTML=''; container.appendChild(el);
    var ec=window.echarts; var existing=ec.getInstanceByDom(el); if(existing) existing.dispose();
    var chart=ec.init(el);
    chart.setOption({ color:PALETTE, tooltip:{trigger:'item',formatter:'{b}: {c} ({d}%)'}, legend:{show:cfg.showLegend!==false,orient:'vertical',right:10,type:'scroll'}, series:[{type:'pie',radius:cfg.donut?['40%','70%']:'70%',data:data,label:{show:cfg.showLabels!==false,formatter:'{b}: {d}%'},emphasis:{itemStyle:{shadowBlur:10,shadowColor:'rgba(0,0,0,0.5)'}}}] });
    setTimeout(function(){chart.resize();},50);
  }

  function renderStackedDivergingBar(viz, rows, container) {
    var cfg=viz.config||{}; var qF=cfg.questionField||''; var rF=cfg.responseField||'';
    if (!qF||!rF) { missingConfig(container,'STACKED_DIVERGING_BAR'); return; }
    var scaleType=cfg.scaleType||'5point';
    var scaleLabels=scaleType==='custom'?(cfg.scaleLabels||[]):(scaleType==='7point'?LIKERT_7:LIKERT_5);
    var scaleColors=scaleType==='7point'?LCOLORS_7.slice():scaleType==='custom'?['#1d4ed8','#3b82f6','#93c5fd','#94a3b8','#fdba74','#f97316','#c2410c'].slice(0,scaleLabels.length):LCOLORS_5.slice();
    var n=scaleLabels.length; if (!n) { missingConfig(container,'STACKED_DIVERGING_BAR'); return; }
    var midIdx=Math.floor(n/2); var hasNeutral=(n%2===1);
    var questions=[]; var qSeen={};
    rows.forEach(function(row){ var q=row[qF]!==undefined?String(row[qF]):''; if(q&&!qSeen[q]){qSeen[q]=true;questions.push(q);} });
    if (!questions.length) { missingConfig(container,'STACKED_DIVERGING_BAR'); return; }
    var counts={};
    questions.forEach(function(q){ counts[q]={}; scaleLabels.forEach(function(l){counts[q][l]=0;}); });
    rows.forEach(function(row){
      var q=row[qF]!==undefined?String(row[qF]):''; var r=row[rF]!==undefined?String(row[rF]):'';
      if(!q||!counts[q]) return;
      var rL=r.toLowerCase().trim(); var matched=null;
      for(var li=0;li<scaleLabels.length;li++){if(scaleLabels[li].toLowerCase().trim()===rL){matched=scaleLabels[li];break;}}
      if(matched){var inc=1;if(cfg.countField&&row[cfg.countField]!==undefined) inc=parseInt(row[cfg.countField])||1;counts[q][matched]=(counts[q][matched]||0)+inc;}
    });
    var neutralLabel=hasNeutral?scaleLabels[midIdx]:''; var neutralColor=hasNeutral?(scaleColors[midIdx]||'#94a3b8'):'';
    var series=[];
    if(hasNeutral){series.push({type:'bar',name:'__nl_'+neutralLabel,stack:'likert',data:questions.map(function(q){return -Math.floor((counts[q][neutralLabel]||0)/2);}),itemStyle:{color:neutralColor},label:{show:false}});}
    for(var ni=0;ni<midIdx;ni++){(function(idx){var lbl=scaleLabels[idx];series.push({type:'bar',name:lbl,stack:'likert',data:questions.map(function(q){return -(counts[q][lbl]||0);}),itemStyle:{color:scaleColors[idx]||'#94a3b8'},emphasis:{focus:'series'}});})(ni);}
    if(hasNeutral){series.push({type:'bar',name:neutralLabel,stack:'likert',data:questions.map(function(q){return Math.ceil((counts[q][neutralLabel]||0)/2);}),itemStyle:{color:neutralColor},emphasis:{focus:'series'}});}
    var posStart=midIdx+(hasNeutral?1:0);
    for(var pi=posStart;pi<n;pi++){(function(idx){var lbl=scaleLabels[idx];series.push({type:'bar',name:lbl,stack:'likert',data:questions.map(function(q){return counts[q][lbl]||0;}),itemStyle:{color:scaleColors[idx]||'#94a3b8'},emphasis:{focus:'series'}});})(pi);}
    var legendData=[]; var legendSeen={};
    series.forEach(function(s){if(s.name.indexOf('__')!==0&&!legendSeen[s.name]){legendSeen[s.name]=true;legendData.push(s.name);}});
    disposeDomCharts(container);
    var el=document.createElement('div'); el.className='dash-block-chart'; el.style.cssText='width:100%;height:'+Math.max(200,questions.length*40+80)+'px';
    container.innerHTML=''; container.appendChild(el);
    var ec=window.echarts; var existing=ec.getInstanceByDom(el); if(existing) existing.dispose();
    var chart=ec.init(el);
    chart.setOption({ tooltip:{trigger:'axis',axisPointer:{type:'shadow'}}, legend:{data:legendData,bottom:4,type:'scroll'}, grid:{top:20,bottom:40,left:160,right:20}, xAxis:{type:'value',min:function(v){return -Math.max(Math.abs(v.min),Math.abs(v.max));},max:function(v){return Math.max(Math.abs(v.min),Math.abs(v.max));}}, yAxis:{type:'category',data:questions,inverse:true}, series:series });
    setTimeout(function(){chart.resize();},50);
  }

  function renderWordCloud(viz, rows, container) {
    var cfg=viz.config||{}; var wF=cfg.wordField||'';
    if (!wF) { missingConfig(container,'WORD_CLOUD'); return; }
    var maxW=cfg.maxWords||100; var wm={};
    rows.forEach(function(row){ var w=row[wF]!==undefined?String(row[wF]).trim():''; if(!w) return; if(cfg.weightField&&row[cfg.weightField]!==undefined){wm[w]=(wm[w]||0)+(parseFloat(row[cfg.weightField])||0);}else{wm[w]=(wm[w]||0)+1;} });
    var wordData=Object.keys(wm).map(function(w){return{name:w,value:wm[w]};}).sort(function(a,b){return b.value-a.value;}).slice(0,maxW);
    if (!wordData.length) { missingConfig(container,'WORD_CLOUD'); return; }
    disposeDomCharts(container);
    var el=document.createElement('div'); el.className='dash-block-chart'; el.style.cssText='width:100%;height:300px';
    container.innerHTML=''; container.appendChild(el);
    var ec=window.echarts; var existing=ec.getInstanceByDom(el); if(existing) existing.dispose();
    var chart=ec.init(el);
    chart.setOption({ series:[{ type:'wordCloud', shape:'circle', sizeRange:[12,48], rotationRange:[0,0], gridSize:8, data:wordData, textStyle:{color:cfg.colorMode==='single'?'#005EB8':function(){return PALETTE[Math.floor(Math.random()*PALETTE.length)];}} }] });
    setTimeout(function(){chart.resize();},50);
  }

  function computeStatVar(variable, allRows, filteredRows) {
    var rows=variable.scope==='unfiltered'?allRows:filteredRows;
    if(variable.aggregation==='count') return rows.length;
    if(!variable.field) return 0;
    var vals=rows.map(function(r){return r[variable.field];}).filter(function(v){return v!==undefined&&v!==null&&v!=='';});
    if(variable.aggregation==='sum') return vals.reduce(function(s,v){return s+(parseFloat(v)||0);},0);
    if(variable.aggregation==='average'){if(!vals.length)return 0;return +(vals.reduce(function(s,v){return s+(parseFloat(v)||0);},0)/vals.length).toFixed(2);}
    if(variable.aggregation==='mode'){var freq={};vals.forEach(function(v){freq[v]=(freq[v]||0)+1;});var best=null,bestC=-1;Object.keys(freq).forEach(function(k){if(freq[k]>bestC){best=k;bestC=freq[k];}});return best;}
    return 0;
  }

  function renderStatCard(container, viz, allRows, filteredRows) {
    var cfg=viz.config||{}; if(!(cfg.lines||[]).length){missingConfig(container,'STAT_CARD');return;}
    var varMap={};
    (cfg.variables||[]).forEach(function(v){if(v.name)varMap[v.name]=computeStatVar(v,allRows,filteredRows);});
    var cardEl=document.createElement('div'); cardEl.className='dash-statcard';
    (cfg.lines||[]).forEach(function(line){
      var div=document.createElement('div'); div.className='dash-statcard-line';
      div.style.fontSize=(line.fontSize||16)+'px'; div.style.fontWeight=line.weight==='bold'?'700':'400';
      div.style.textAlign=line.align||'center'; if(line.color) div.style.color=line.color;
      div.textContent=(line.text||'').replace(/\\{\\{(\\w+)\\}\\}/g,function(m,n){return varMap.hasOwnProperty(n)?String(varMap[n]):m;});
      cardEl.appendChild(div);
    });
    container.innerHTML=''; container.appendChild(cardEl);
  }

  function renderKpiStat(container, viz, rows) {
    var cfg=viz.config||{}; var col=cfg.valueField||(rows.length?Object.keys(rows[0])[0]:''); var agg=cfg.aggregation||'count';
    var value=rows.length;
    if(col&&rows.length>0){if(agg==='sum') value=rows.reduce(function(s,r){return s+(parseFloat(r[col])||0);},0);else if(agg==='average') value=rows.reduce(function(s,r){return s+(parseFloat(r[col])||0);},0)/rows.length;}
    var prefix=cfg.prefix||''; var suffix=cfg.suffix||'';
    var formatted=prefix+(Number.isInteger(value)?value.toLocaleString():(+value.toFixed(cfg.decimals||0)).toLocaleString())+suffix;
    container.innerHTML='<div class="vt-kpi"><div class="vt-kpi-value">'+esc(formatted)+'</div><div class="vt-kpi-label">'+esc(cfg.label||viz.label)+'</div><div class="vt-kpi-sub">'+rows.length.toLocaleString()+' rows</div></div>';
  }

  function renderDataTable(container, viz, rows) {
    var cfg=viz.config||{};
    var selCols=(cfg.selectedColumns&&cfg.selectedColumns.length)?cfg.selectedColumns:null;
    var maxR=cfg.maxRows||200;
    var showNums=cfg.showRowNumbers===true;
    if(!rows.length){container.innerHTML='<div style="padding:20px;color:#64748b;font-size:12px">No data available.</div>';return;}
    var allCols=Object.keys(rows[0]);
    var cols=selCols?selCols.filter(function(c){return allCols.indexOf(c)!==-1;}):allCols;
    var limit=Math.min(rows.length,maxR);
    var html='<div style="overflow:auto;max-height:360px"><table class="dwb-data-table"><thead><tr>';
    if(showNums) html+='<th style="color:#94a3b8;font-weight:normal;width:40px">#</th>';
    html+=cols.map(function(c){return'<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>';
    for(var i=0;i<limit;i++){
      html+='<tr>';
      if(showNums) html+='<td style="color:#94a3b8;font-size:10px;text-align:right;padding:3px 6px;user-select:none;width:40px">'+(i+1)+'</td>';
      html+=cols.map(function(c){var v=String(rows[i][c]!==undefined?rows[i][c]:'');return'<td>'+esc(v.length>60?v.slice(0,60)+'…':v)+'</td>';}).join('')+'</tr>';
    }
    html+='</tbody></table></div>';
    if(rows.length>limit) html+='<div style="padding:6px 8px;font-size:11px;color:#64748b">Showing '+limit+' of '+rows.length+' rows</div>';
    container.innerHTML=html;
  }

  function renderQuotesBoard(container, viz, rows) {
    var cfg=viz.config||{}; if(!cfg.quoteField){missingConfig(container,'QUOTES_BOARD');return;}
    var maxQ=(cfg.maxQuotes!=null)?Math.max(1,cfg.maxQuotes):12; var layout=cfg.layout||'grid';
    var filtered=(rows||[]).filter(function(row){var val=row[cfg.quoteField];return val!==undefined&&val!==null&&String(val).trim()!=='';}).slice(0,maxQ);
    var cardsHtml=filtered.map(function(row){
      var text=String(row[cfg.quoteField]);
      var attr=(cfg.attributionField&&row[cfg.attributionField]!=null)?String(row[cfg.attributionField]).trim():'';
      var sentiment=''; if(cfg.sentimentField&&row[cfg.sentimentField]!=null){var s=String(row[cfg.sentimentField]).toLowerCase().trim();if(s==='positive'||s==='neutral'||s==='negative')sentiment=s;}
      return '<div class="dash-quote-card'+(sentiment?' dash-quote-'+sentiment:'')+'">'+'<div class="dash-quote-text">\\u201c'+esc(text)+'\\u201d</div>'+(attr?'<div class="dash-quote-attribution">\\u2014 '+esc(attr)+'</div>':'')+'</div>';
    }).join('');
    container.innerHTML='<div class="dash-quotes-board'+(layout==='list'?' layout-list':'')+'">' +cardsHtml+'</div>';
  }

  function renderRichText(container, viz, rows) {
    var cfg=viz.config||{}; if(!cfg.text){missingConfig(container,'RICH_TEXT');return;}
    var row=(rows&&rows[0])?rows[0]:{};
    var text=cfg.text.replace(/\\{\\{(\\w+)\\}\\}/g,function(m,n){return row.hasOwnProperty(n)?String(row[n]):m;});
    var el=document.createElement('div'); el.className='dash-richtext';
    el.style.fontSize=(cfg.fontSize||16)+'px'; el.style.fontWeight=cfg.weight==='bold'?'700':'400';
    el.style.textAlign=cfg.align||'left'; if(cfg.color) el.style.color=cfg.color;
    el.textContent=text;
    container.innerHTML=''; container.appendChild(el);
  }

  function renderAiAssist(container, viz) {
    var cfg=viz.config||{}; var resp=cfg.response||'';
    if(resp){
      container.innerHTML='<div class="dash-ai-export">'+esc(resp)+'<div class="dash-ai-export-note">AI-generated response (exported view)</div></div>';
    } else {
      container.innerHTML='<div style="padding:16px;font-size:12px;color:#94a3b8;text-align:center">AI Assist not available in exported view.</div>';
    }
  }

  function renderPlacements() {
    var canvas=document.getElementById('dashboard-canvas');
    if(!canvas) return;
    disposeDomCharts(canvas);
    canvas.innerHTML='';
    (display.placements||[]).forEach(function(placement){
      var viz=vizList.find(function(v){return v.id===placement.vizId;});
      if(!viz) return;
      var filteredRows=getFilteredRows(viz);
      var allRows=snaps[viz.snapshotName]||[];
      var card=document.createElement('div'); card.className='dash-placement';
      var pid='exp-pb-'+String(placement.id).replace(/[^a-zA-Z0-9_-]/g,'_');
      card.innerHTML='<div class="dash-placement-header"><span class="dash-placement-title">'+esc(viz.label)+'</span></div><div class="dash-placement-body" id="'+pid+'"></div>';
      canvas.appendChild(card);
      var body=document.getElementById(pid);
      if(!body) return;
      switch(viz.type){
        case 'BAR_VERTICAL': renderBarVertical(viz,filteredRows,body); break;
        case 'LINE': renderLine(viz,filteredRows,body); break;
        case 'PIE': renderPie(viz,filteredRows,body); break;
        case 'STACKED_DIVERGING_BAR': renderStackedDivergingBar(viz,filteredRows,body); break;
        case 'WORD_CLOUD': renderWordCloud(viz,filteredRows,body); break;
        case 'STAT_CARD': renderStatCard(body,viz,allRows,filteredRows); break;
        case 'KPI_STAT': renderKpiStat(body,viz,filteredRows); break;
        case 'DATA_TABLE': renderDataTable(body,viz,filteredRows); break;
        case 'QUOTES_BOARD': renderQuotesBoard(body,viz,filteredRows); break;
        case 'RICH_TEXT': renderRichText(body,viz,filteredRows); break;
        case 'AI_ASSIST': renderAiAssist(body,viz); break;
        default: body.innerHTML='<div style="padding:20px;color:#94a3b8;font-size:12px;text-align:center">'+esc(viz.type)+'</div>';
      }
    });
  }

  function init() {
    var layout=(display.config||{}).layout||'2col';
    var canvas=document.getElementById('dashboard-canvas');
    if(canvas) canvas.className='dash-grid layout-'+layout;
    renderBanner();
    renderChips();
    renderPlacements();
    var resetBtn=document.getElementById('reset-filters-btn');
    if(resetBtn) resetBtn.addEventListener('click',function(){activeFilters={};renderBanner();renderChips();renderPlacements();});
    var dismissBtn=document.getElementById('dismiss-banner-btn');
    if(dismissBtn) dismissBtn.addEventListener('click',function(){var b=document.getElementById('filter-banner');if(b)b.style.display='none';});
  }

  init();
})();`;
  }

  function _dBuildExportHtml(exportState, ecSource, wcSource) {
    var flowName = (exportState.flow && exportState.flow.name) || 'Export';
    var displayLabel = exportState.display.label || 'Dashboard';
    var hasFilters = Object.keys(exportState.initialFilters || {}).length > 0;

    var safeScript = function(src) { return src.replace(/<\/script>/gi, '<\\/script>'); };
    var stateJson = safeScript(JSON.stringify(exportState));
    var runtime = safeScript(_dBuildExportRuntime());

    var wcTag = wcSource ? '<script>' + safeScript(wcSource) + '<\/script>' : '';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
      '<title>' + _dEsc(flowName) + ' — ' + _dEsc(displayLabel) + '</title>\n' +
      '<style>\n' + _dExportCSS + '\n</style>\n' +
      '<script>' + safeScript(ecSource) + '<\/script>\n' +
      wcTag + '\n' +
      '</head>\n<body>\n' +
      '<div id="filter-banner" style="display:' + (hasFilters ? 'flex' : 'none') + '">' +
        '<span id="filter-banner-text"></span>' +
        '<button id="reset-filters-btn">↺ Reset filters</button>' +
        '<button id="dismiss-banner-btn">✕</button>' +
      '</div>\n' +
      '<div id="filter-chips"></div>\n' +
      '<div id="dashboard-canvas"></div>\n' +
      '<script>\nvar EXPORT_STATE = ' + stateJson + ';\n' + runtime + '\n<\/script>\n' +
      '</body>\n</html>';
  }

  function _dExportHtml(display, btn) {
    var originalText = btn.textContent;
    btn.textContent = 'Building export…';
    btn.disabled = true;

    var state = window.DWBState;
    var vizList = (state.flow && state.flow.visualizations) || [];

    var neededSnaps = {};
    (display.placements || []).forEach(function(p) {
      var viz = vizList.find(function(v) { return v.id === p.vizId; });
      if (viz && viz.snapshotName) neededSnaps[viz.snapshotName] = (state.snapshots || {})[viz.snapshotName] || [];
    });

    var placedVizs = vizList.filter(function(v) {
      return (display.placements || []).some(function(p) { return p.vizId === v.id; });
    });

    var needsWc = _dNeedsWordCloud(display, vizList);

    var wcPromise = needsWc
      ? fetch('https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js')
          .then(function(r) { return r.ok ? r.text() : null; }).catch(function() { return null; })
      : Promise.resolve(null);

    _dGetEChartsSource().then(function(ecSource) {
      return wcPromise.then(function(wcSource) {
        var exportState = {
          flow: (state.flow && state.flow.meta) ? state.flow.meta : {},
          display: display,
          snapshots: neededSnaps,
          visualizations: placedVizs,
          initialFilters: JSON.parse(JSON.stringify(_dActiveFilters(display)))
        };

        var html = _dBuildExportHtml(exportState, ecSource, wcSource);
        var flowName = (exportState.flow && exportState.flow.name) || 'Export';
        var filename = (flowName + ' - ' + (display.label || 'Dashboard')).replace(/[\\/:*?"<>|]/g, '-') + '.html';

        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);

        btn.textContent = '✓ Downloaded';
        setTimeout(function() { btn.textContent = originalText; btn.disabled = false; }, 2000);
      });
    }).catch(function() {
      alert('⚠️ Could not embed ECharts — ensure you have internet access when exporting, or load ECharts before going offline.');
      btn.textContent = originalText;
      btn.disabled = false;
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
    aggregateRows: _dAggregateRows,
    exportHtml: _dExportHtml
  };
})();

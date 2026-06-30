/* === DWBVizTab: visualization asset library and live preview === */

window.DWBVizTab = (function() {
  let _vtEchartsPromise = null;

  const _vtVizTypes = [
    { type: 'BAR_VERTICAL',          icon: '📊', name: 'Bar Chart',         desc: 'Vertical bars with aggregation' },
    { type: 'LINE',                   icon: '📈', name: 'Line Chart',        desc: 'Trend over categories' },
    { type: 'PIE',                    icon: '🥧', name: 'Pie Chart',         desc: 'Part-to-whole proportions' },
    { type: 'KPI_STAT',               icon: '🎯', name: 'KPI Stat',          desc: 'Single metric spotlight' },
    { type: 'DATA_TABLE',             icon: '📋', name: 'Data Table',        desc: 'Searchable tabular view' },
    { type: 'STAT_CARD',              icon: '🃏', name: 'Stat Card',         desc: 'Multi-stat summary card' },
    { type: 'WORD_CLOUD',             icon: '☁',  name: 'Word Cloud',        desc: 'Frequency visualization' },
    { type: 'STACKED_DIVERGING_BAR',  icon: '⚖',  name: 'Diverging Bar',    desc: 'Likert / agreement scale' },
    { type: 'RICH_TEXT',              icon: '📝', name: 'Rich Text',         desc: 'Formatted text block' },
    { type: 'QUOTES_BOARD',           icon: '💬', name: 'Quotes Board',      desc: 'Highlighted text quotes' },
    { type: 'AI_ASSIST',              icon: '🤖', name: 'AI Insights',       desc: 'AI-powered summary (requires API key)' },
    { type: 'TIMELINE_HORIZONTAL',   icon: '⏩', name: 'Timeline (H)',      desc: 'Horizontal timeline events' },
    { type: 'TIMELINE_GANTT',         icon: '📅', name: 'Gantt Chart',       desc: 'Duration bars on a timeline' },
    { type: 'TIMELINE_VERTICAL',      icon: '📌', name: 'Timeline (V)',      desc: 'Vertical event timeline' }
  ];

  function _vtLoadEcharts() {
    if (window.echarts) return Promise.resolve(window.echarts);
    if (_vtEchartsPromise) return _vtEchartsPromise;
    _vtEchartsPromise = new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
      s.onload = function() { resolve(window.echarts); };
      s.onerror = function() { _vtEchartsPromise = null; reject(new Error('ECharts failed to load')); };
      document.head.appendChild(s);
      setTimeout(function() {
        if (!window.echarts) { _vtEchartsPromise = null; reject(new Error('ECharts load timeout')); }
      }, 8000);
    });
    return _vtEchartsPromise;
  }

  function _vtAggregateRows(rows, categoryField, valueField, aggregation) {
    const map = {};
    const order = [];
    rows.forEach(function(row) {
      const cat = String(row[categoryField] !== undefined ? row[categoryField] : '(blank)');
      const val = parseFloat(row[valueField]) || 0;
      if (!map[cat]) { map[cat] = { sum: 0, count: 0 }; order.push(cat); }
      map[cat].sum += val;
      map[cat].count++;
    });
    return order.map(function(cat) {
      const d = map[cat];
      let value;
      if (aggregation === 'count') value = d.count;
      else if (aggregation === 'average') value = d.count ? d.sum / d.count : 0;
      else value = d.sum;
      return { category: cat, value: Math.round(value * 100) / 100 };
    });
  }

  function mount() {
    const panel = document.getElementById('panel-viz');
    if (!panel) return;

    const snapshots = window.DWBState.snapshots || {};
    const snapshotNames = Object.keys(snapshots);
    const flow = window.DWBState.flow;
    const vizList = (flow && flow.visualizations) || [];

    panel.innerHTML = `
      <div id="vt-sidebar">
        <div id="vt-sidebar-header">
          <span>Assets</span>
          <span style="margin-left:auto;font-size:10px;color:var(--text-faint)" id="vt-asset-count">${vizList.length}</span>
        </div>
        <div id="vt-asset-list"></div>
        <button class="vt-add-btn" id="vt-add-viz-btn">＋ Add Visualization</button>
      </div>
      <div id="vt-main">
        <div id="vt-toolbar">
          <span style="font-size:12px;color:var(--text-muted)">Dataset:</span>
          <select id="vt-snapshot-select" style="min-width:180px">
            ${snapshotNames.length === 0 ? '<option value="">No snapshots — run pipeline first</option>' : ''}
            ${snapshotNames.map(function(n) { return '<option value="' + _vtEsc(n) + '">' + _vtEsc(n) + ' (' + (snapshots[n]||[]).length + ' rows)</option>'; }).join('')}
          </select>
          <div class="flex-spacer"></div>
          <button class="tb-btn" id="vt-refresh-btn">↻ Refresh</button>
        </div>
        <div id="vt-canvas-wrap">
          <div id="vt-canvas"></div>
          <div id="vt-config"></div>
        </div>
      </div>`;

    document.getElementById('vt-add-viz-btn').addEventListener('click', _vtShowAddModal);
    document.getElementById('vt-refresh-btn').addEventListener('click', function() {
      window.DWBPipeline.run().then(function() { mount(); });
    });

    _vtRenderAssetList();
    _vtRenderCanvas();
  }

  function _vtRenderAssetList() {
    const list = document.getElementById('vt-asset-list');
    if (!list) return;
    const state = window.DWBState;
    const vizList = (state.flow && state.flow.visualizations) || [];
    const countEl = document.getElementById('vt-asset-count');
    if (countEl) countEl.textContent = vizList.length;

    if (vizList.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-faint);font-size:11px">No assets yet.<br>Click ＋ to add one.</div>';
      return;
    }

    list.innerHTML = vizList.map(function(viz) {
      const typeInfo = _vtVizTypes.find(function(t) { return t.type === viz.type; }) || { icon: '📊' };
      const isSelected = viz.id === state.selectedVizId;
      return `<div class="vt-asset-item${isSelected ? ' selected' : ''}" data-viz-id="${viz.id}">
        <span class="vt-asset-icon">${typeInfo.icon}</span>
        <div class="vt-asset-info">
          <div class="vt-asset-label" title="${_vtEsc(viz.label)}">${_vtEsc(viz.label)}</div>
          <div class="vt-asset-type">${viz.type} · ${viz.snapshotName || 'no data'}</div>
        </div>
        <button class="vt-asset-del" data-del-id="${viz.id}" title="Delete">✕</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.vt-asset-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.vt-asset-del')) return;
        window.DWBState.selectedVizId = item.dataset.vizId;
        _vtRenderAssetList();
        _vtRenderCanvas();
        _vtShowConfig(item.dataset.vizId);
      });
    });

    list.querySelectorAll('.vt-asset-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _vtDeleteViz(btn.dataset.delId);
      });
    });
  }

  function _vtRenderCanvas() {
    const canvas = document.getElementById('vt-canvas');
    if (!canvas) return;

    const state = window.DWBState;
    const vizId = state.selectedVizId;
    const vizList = (state.flow && state.flow.visualizations) || [];

    if (vizList.length === 0) {
      canvas.innerHTML = '<div class="vt-no-data"><div style="font-size:36px">📊</div><div>Add a visualization asset to get started</div></div>';
      return;
    }

    // Show selected or first
    const viz = vizId ? vizList.find(function(v) { return v.id === vizId; }) : vizList[0];
    if (!viz) { canvas.innerHTML = '<div class="vt-no-data">Select an asset to preview it.</div>'; return; }

    canvas.innerHTML = `<div class="vt-preview-block">
      <div class="vt-block-header">
        <span class="vt-block-title">${_vtEsc(viz.label)}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.6)">${viz.type}</span>
      </div>
      <div class="vt-block-body" id="vt-render-area" style="padding:16px;min-height:200px"></div>
    </div>`;

    const snapshots = state.snapshots || {};
    const rows = snapshots[viz.snapshotName] || [];
    _vtRenderViz(viz, rows, document.getElementById('vt-render-area'));
  }

  function _vtRenderViz(viz, rows, container) {
    if (!container) return;
    var db = window.DWBDashboard;
    switch (viz.type) {
      case 'BAR_VERTICAL':
        db ? db.renderBarVertical(viz, rows, container) : _vtRenderBarVertical(viz, rows, container);
        break;
      case 'LINE':
        db ? db.renderLine(viz, rows, container) : _vtPlaceholder(container, 'LINE');
        break;
      case 'PIE':
        db ? db.renderPie(viz, rows, container) : _vtPlaceholder(container, 'PIE');
        break;
      case 'STACKED_DIVERGING_BAR':
        db ? db.renderStackedDivergingBar(viz, rows, container) : _vtPlaceholder(container, 'STACKED_DIVERGING_BAR');
        break;
      case 'WORD_CLOUD':
        db ? db.renderWordCloud(viz, rows, container) : _vtPlaceholder(container, 'WORD_CLOUD');
        break;
      case 'KPI_STAT':      _vtRenderKpi(viz, rows, container); break;
      case 'DATA_TABLE':    _vtRenderDataTable(viz, rows, container); break;
      case 'TIMELINE_HORIZONTAL':
      case 'TIMELINE_GANTT':
      case 'TIMELINE_VERTICAL':
        window.DWBTimelines ? window.DWBTimelines.render(viz, rows, container) : _vtPlaceholder(container, viz.type);
        break;
      default:
        _vtPlaceholder(container, viz.type);
    }
  }

  function _vtRenderPreview(viz) {
    var renderArea = document.getElementById('vt-render-area');
    if (renderArea) {
      if (window.echarts) {
        renderArea.querySelectorAll('.dash-block-chart').forEach(function(el) {
          var inst = window.echarts.getInstanceByDom(el);
          if (inst) inst.dispose();
        });
      }
      var snapshots = window.DWBState.snapshots || {};
      var rows = snapshots[viz.snapshotName] || [];
      _vtRenderViz(viz, rows, renderArea);
    } else {
      _vtRenderCanvas();
    }
  }

  function _vtRenderBarVertical(viz, rows, container) {
    const cfg = viz.config || {};
    const catField = cfg.categoryField || (rows.length ? Object.keys(rows[0])[0] : '');
    const valField = cfg.valueField    || (rows.length ? Object.keys(rows[0])[1] : '');
    const agg      = cfg.aggregation   || 'sum';

    if (!catField || !valField || rows.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">Configure category and value fields in the config panel.</div>';
      return;
    }

    const data = _vtAggregateRows(rows, catField, valField, agg);
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    _vtLoadEcharts().then(function(ec) {
      const chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function(d) { return d.category; }), axisLabel: { rotate: 30, fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: data.map(function(d) { return d.value; }), itemStyle: { color: '#005EB8' } }],
        grid: { left: 50, right: 20, bottom: 60, top: 20 }
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _vtPlaceholder(container, 'BAR_VERTICAL (ECharts unavailable)'); });
  }

  function _vtRenderLine(viz, rows, container) {
    const cfg = viz.config || {};
    const catField = cfg.categoryField || (rows.length ? Object.keys(rows[0])[0] : '');
    const valField = cfg.valueField    || (rows.length ? Object.keys(rows[0])[1] : '');
    const agg      = cfg.aggregation   || 'sum';

    if (!catField || !valField || rows.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">Configure category and value fields.</div>';
      return;
    }

    const data = _vtAggregateRows(rows, catField, valField, agg);
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:300px';
    container.innerHTML = '';
    container.appendChild(el);

    _vtLoadEcharts().then(function(ec) {
      const chart = ec.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function(d) { return d.category; }), axisLabel: { rotate: 30, fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: data.map(function(d) { return d.value; }), smooth: true, itemStyle: { color: '#005EB8' } }],
        grid: { left: 50, right: 20, bottom: 60, top: 20 }
      });
      setTimeout(function() { chart.resize(); }, 50);
    }).catch(function() { _vtPlaceholder(container, 'LINE (ECharts unavailable)'); });
  }

  function _vtRenderKpi(viz, rows, container) {
    const cfg = viz.config || {};
    const col = cfg.valueField || (rows.length ? Object.keys(rows[0])[0] : '');
    const agg = cfg.aggregation || 'count';
    const label = cfg.label || viz.label;

    let value = rows.length;
    if (col && rows.length > 0) {
      if (agg === 'count') value = rows.length;
      else if (agg === 'sum') value = rows.reduce(function(s, r) { return s + (parseFloat(r[col]) || 0); }, 0);
      else if (agg === 'average') value = rows.length ? rows.reduce(function(s, r) { return s + (parseFloat(r[col]) || 0); }, 0) / rows.length : 0;
    }

    const prefix = cfg.prefix || '';
    const suffix = cfg.suffix || '';
    const formatted = prefix + (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(cfg.decimals || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + suffix;

    container.innerHTML = `<div class="vt-kpi">
      <div class="vt-kpi-value">${_vtEsc(formatted)}</div>
      <div class="vt-kpi-label">${_vtEsc(label)}</div>
      <div class="vt-kpi-sub">${rows.length.toLocaleString()} rows · ${col || 'count'}</div>
    </div>`;
  }

  function _vtRenderDataTable(viz, rows, container) {
    if (rows.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">No data available.</div>';
      return;
    }
    const cols = Object.keys(rows[0]);
    const limit = Math.min(rows.length, 100);
    let html = '<div style="overflow:auto;max-height:360px"><table class="dwb-data-table">';
    html += '<thead><tr>' + cols.map(function(c) { return '<th>' + _vtEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (let i = 0; i < limit; i++) {
      html += '<tr>' + cols.map(function(c) {
        const v = String(rows[i][c] !== undefined ? rows[i][c] : '');
        return '<td>' + _vtEsc(v.length > 60 ? v.slice(0,60)+'…' : v) + '</td>';
      }).join('') + '</tr>';
    }
    html += '</tbody></table></div>';
    if (rows.length > limit) html += '<div style="padding:6px 8px;font-size:11px;color:var(--text-muted)">Showing ' + limit + ' of ' + rows.length + ' rows</div>';
    container.innerHTML = html;
  }

  function _vtPlaceholder(container, type) {
    container.innerHTML = `<div class="vt-renderer-placeholder">
      <div style="font-size:32px">🔧</div>
      <div style="font-weight:600">${_vtEsc(type)}</div>
      <div style="font-size:12px;color:var(--text-muted)">Renderer coming soon</div>
    </div>`;
  }

  function _vtShowConfig(vizId) {
    const configEl = document.getElementById('vt-config');
    if (!configEl) return;
    const state = window.DWBState;
    const viz = state.flow && state.flow.visualizations.find(function(v) { return v.id === vizId; });
    if (!viz) { configEl.classList.remove('visible'); return; }

    const snapshots = state.snapshots || {};
    const snapshotNames = Object.keys(snapshots);
    const rows = snapshots[viz.snapshotName] || [];
    const cols = rows.length ? Object.keys(rows[0]) : [];

    configEl.classList.add('visible');

    // Common header (label + snapshot)
    configEl.innerHTML = `
      <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Viz Config</div>
        <div class="form-row"><label>Label</label>
          <input id="vc-label" type="text" value="${_vtEsc(viz.label)}" style="width:100%"></div>
        <div class="form-row"><label>Dataset (snapshot)</label>
          <select id="vc-snap" style="width:100%">
            <option value="">-- none --</option>
            ${snapshotNames.map(function(n) { return '<option value="' + _vtEsc(n) + '"' + (viz.snapshotName === n ? ' selected' : '') + '>' + _vtEsc(n) + '</option>'; }).join('')}
          </select></div>
      </div>`;

    document.getElementById('vc-label').addEventListener('input', function(e) { viz.label = e.target.value; });
    document.getElementById('vc-snap').addEventListener('change', function(e) {
      viz.snapshotName = e.target.value;
      window.DWBShell && window.DWBShell.markDirty();
      _vtRenderCanvas();
    });

    // onChange callback for live-update builders
    const onChange = function() {
      window.DWBShell && window.DWBShell.markDirty();
      _vtRenderPreview(viz);
    };

    // Type-specific config dispatch
    if (viz.type === 'LINE') {
      configEl.appendChild(_vtBuildLineConfig(viz, cols, onChange));
    } else if (viz.type === 'PIE') {
      configEl.appendChild(_vtBuildPieConfig(viz, cols, onChange));
    } else if (viz.type === 'STACKED_DIVERGING_BAR') {
      configEl.appendChild(_vtBuildStackedDivergingBarConfig(viz, cols, onChange));
    } else if (viz.type === 'WORD_CLOUD') {
      configEl.appendChild(_vtBuildWordCloudConfig(viz, cols, onChange));
    } else if (viz.type === 'BAR_VERTICAL') {
      configEl.appendChild(_vtBuildBarVerticalConfig(viz, cols, onChange));
    } else if (viz.type === 'KPI_STAT') {
      configEl.appendChild(_vtBuildKpiConfig(viz, cols, onChange));
    } else {
      const ph = document.createElement('div');
      ph.className = 'vt-config-section';
      ph.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">⚙️ Configuration coming soon.</span>';
      configEl.appendChild(ph);
    }
  }

  // ── BAR_VERTICAL config builder ───────────────────────────────────────────────
  function _vtBuildBarVerticalConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    const el = document.createElement('div');

    function colSel(id, selected) {
      return '<select id="' + id + '" style="width:100%"><option value="">-- select --</option>' +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    const aggVal = cfg.aggregation || 'sum';
    el.innerHTML = '<div class="vt-config-section"><span class="vt-config-label">Chart Settings</span>' +
      '<div class="form-row"><label>Category field</label>' + colSel('vcbv-cat', cfg.categoryField) + '</div>' +
      '<div class="form-row"><label>Value field</label>' + colSel('vcbv-val', cfg.valueField) + '</div>' +
      '<div class="form-row"><label>Aggregation</label><div style="display:flex;gap:10px">' +
      ['sum','count','average'].map(function(a) {
        return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcbv-agg" value="' + a + '"' + (aggVal === a ? ' checked' : '') + '> ' + (a.charAt(0).toUpperCase() + a.slice(1)) + '</label>';
      }).join('') + '</div></div></div>';

    el.querySelector('#vcbv-cat').addEventListener('change', function() { cfg.categoryField = this.value; onChange(); });
    el.querySelector('#vcbv-val').addEventListener('change', function() { cfg.valueField = this.value; onChange(); });
    el.querySelectorAll('input[name="vcbv-agg"]').forEach(function(r) {
      r.addEventListener('change', function() { cfg.aggregation = this.value; onChange(); });
    });

    return el;
  }

  // ── KPI_STAT config builder ───────────────────────────────────────────────────
  function _vtBuildKpiConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    const el = document.createElement('div');

    function colSel(id, selected, includeNone) {
      const blank = includeNone ? '<option value="">-- none --</option>' : '<option value="">-- select --</option>';
      return '<select id="' + id + '" style="width:100%">' + blank +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    const aggVal = cfg.aggregation || 'count';
    el.innerHTML = '<div class="vt-config-section"><span class="vt-config-label">KPI Settings</span>' +
      '<div class="form-row"><label>Value field</label>' + colSel('vck-val', cfg.valueField, true) + '</div>' +
      '<div class="form-row"><label>Aggregation</label><div style="display:flex;gap:10px">' +
      ['sum','count','average'].map(function(a) {
        return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vck-agg" value="' + a + '"' + (aggVal === a ? ' checked' : '') + '> ' + (a.charAt(0).toUpperCase() + a.slice(1)) + '</label>';
      }).join('') + '</div></div>' +
      '<div class="form-row"><label>Prefix</label><input id="vck-pre" type="text" value="' + _vtEsc(cfg.prefix || '') + '" style="width:100%" placeholder="$"></div>' +
      '<div class="form-row"><label>Suffix</label><input id="vck-suf" type="text" value="' + _vtEsc(cfg.suffix || '') + '" style="width:100%" placeholder="%"></div>' +
      '<div class="form-row"><label>Decimals</label><input id="vck-dec" type="number" value="' + (cfg.decimals || 0) + '" min="0" max="4" style="width:100%"></div>' +
      '</div>';

    el.querySelector('#vck-val').addEventListener('change', function() { cfg.valueField = this.value || ''; onChange(); });
    el.querySelectorAll('input[name="vck-agg"]').forEach(function(r) {
      r.addEventListener('change', function() { cfg.aggregation = this.value; onChange(); });
    });
    el.querySelector('#vck-pre').addEventListener('input', function() { cfg.prefix = this.value; onChange(); });
    el.querySelector('#vck-suf').addEventListener('input', function() { cfg.suffix = this.value; onChange(); });
    el.querySelector('#vck-dec').addEventListener('change', function() { cfg.decimals = Math.max(0, Math.min(4, parseInt(this.value) || 0)); onChange(); });

    return el;
  }

  // ── LINE config builder ───────────────────────────────────────────────────────
  function _vtBuildLineConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    if (!cfg.series) cfg.series = [];

    const el = document.createElement('div');

    function colSel(id, selected, style) {
      const opts = ['<option value="">-- select --</option>'].concat(
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; })
      ).join('');
      return '<select id="' + id + '" style="' + (style || 'width:100%') + '">' + opts + '</select>';
    }

    function rebuild() {
      el.innerHTML = '';

      // CHART DATA section
      const ds = document.createElement('div');
      ds.className = 'vt-config-section';
      const aggVal = cfg.aggregation || 'sum';
      ds.innerHTML = '<span class="vt-config-label">Chart Data</span>' +
        '<div class="form-row"><label>X axis field</label>' + colSel('vcl-xf', cfg.xField) + '</div>' +
        '<div class="form-row"><label>Aggregation</label><div style="display:flex;gap:10px">' +
        ['sum','count','average'].map(function(a) {
          return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal">' +
            '<input type="radio" name="vcl-agg" value="' + a + '"' + (aggVal === a ? ' checked' : '') + '> ' +
            (a.charAt(0).toUpperCase() + a.slice(1)) + '</label>';
        }).join('') + '</div></div>' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Series</div>' +
        '<div id="vcl-series-list"></div>' +
        '<button class="vt-add-btn" id="vcl-add-series" style="margin-top:4px;width:calc(100% - 0px)">＋ Add Series</button>';
      el.appendChild(ds);

      ds.querySelector('#vcl-xf').addEventListener('change', function() { cfg.xField = this.value; onChange(); });
      ds.querySelectorAll('input[name="vcl-agg"]').forEach(function(r) {
        r.addEventListener('change', function() { cfg.aggregation = this.value; onChange(); });
      });

      const seriesList = ds.querySelector('#vcl-series-list');
      cfg.series.forEach(function(s, idx) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:6px;position:relative';
        const swatchBg = s.color || '#005EB8';
        row.innerHTML =
          '<span class="vcl-swatch" style="width:16px;height:16px;border-radius:50%;background:' + swatchBg + ';cursor:pointer;flex-shrink:0" title="Cycle color"></span>' +
          colSel('vcl-sf-' + idx, s.valueField, 'flex:1;min-width:0') +
          '<input type="text" class="vcl-sl-' + idx + '" value="' + _vtEsc(s.label || '') + '" placeholder="Label" style="width:70px">' +
          '<button class="vcl-del" style="background:none;border:none;color:var(--text-faint);opacity:0;font-size:14px;padding:0 2px;transition:opacity 0.15s">✕</button>';

        row.addEventListener('mouseenter', function() { row.querySelector('.vcl-del').style.opacity = '1'; });
        row.addEventListener('mouseleave', function() { row.querySelector('.vcl-del').style.opacity = '0'; });

        row.querySelector('.vcl-swatch').addEventListener('click', function() {
          const pal = ['#005EB8','#C5B230','#059669','#dc2626','#f59e0b','#0ea5e9','#8b5cf6','#ec4899'];
          const ci = pal.indexOf(s.color || pal[0]);
          s.color = pal[(ci + 1) % pal.length];
          this.style.background = s.color;
          onChange();
        });
        row.querySelector('#vcl-sf-' + idx).addEventListener('change', function() { s.valueField = this.value; onChange(); });
        row.querySelector('.vcl-sl-' + idx).addEventListener('input', function() { s.label = this.value; onChange(); });
        row.querySelector('.vcl-del').addEventListener('click', function() { cfg.series.splice(idx, 1); rebuild(); onChange(); });

        seriesList.appendChild(row);
      });

      ds.querySelector('#vcl-add-series').addEventListener('click', function() {
        cfg.series.push({ valueField: '', label: '', color: '' });
        rebuild();
      });

      // DISPLAY section
      const disp = document.createElement('div');
      disp.className = 'vt-config-section';
      disp.innerHTML = '<span class="vt-config-label">Display</span>' +
        '<div class="form-row form-row-inline" style="margin-bottom:8px"><label><input type="checkbox" id="vcl-smooth"' + (cfg.smoothed ? ' checked' : '') + '> Smooth lines</label></div>' +
        '<div class="form-row form-row-inline" style="margin-bottom:8px"><label><input type="checkbox" id="vcl-dual"' + (cfg.dualYAxis ? ' checked' : '') + '> Dual Y axis</label></div>' +
        '<div class="form-row"><label>X axis label</label><input type="text" id="vcl-xl" value="' + _vtEsc(cfg.xLabel || '') + '" style="width:100%"></div>' +
        '<div class="form-row"><label>Y axis label</label><input type="text" id="vcl-yl" value="' + _vtEsc(cfg.yLabel || '') + '" style="width:100%"></div>' +
        '<div class="form-row" id="vcl-y2r" style="' + (cfg.dualYAxis ? '' : 'display:none') + '"><label>Y2 axis label</label><input type="text" id="vcl-y2l" value="' + _vtEsc(cfg.y2Label || '') + '" style="width:100%"></div>';
      el.appendChild(disp);

      disp.querySelector('#vcl-smooth').addEventListener('change', function() { cfg.smoothed = this.checked; onChange(); });
      const dualCk = disp.querySelector('#vcl-dual');
      const y2Row  = disp.querySelector('#vcl-y2r');
      dualCk.addEventListener('change', function() { cfg.dualYAxis = this.checked; y2Row.style.display = cfg.dualYAxis ? '' : 'none'; onChange(); });
      disp.querySelector('#vcl-xl').addEventListener('input', function() { cfg.xLabel = this.value; onChange(); });
      disp.querySelector('#vcl-yl').addEventListener('input', function() { cfg.yLabel = this.value; onChange(); });
      disp.querySelector('#vcl-y2l').addEventListener('input', function() { cfg.y2Label = this.value; onChange(); });
    }

    rebuild();
    return el;
  }

  // ── PIE config builder ────────────────────────────────────────────────────────
  function _vtBuildPieConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    const el = document.createElement('div');

    function colSel(id, selected, includeNone) {
      const blank = includeNone ? '<option value="">-- none --</option>' : '<option value="">-- select --</option>';
      return '<select id="' + id + '" style="width:100%">' + blank +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    const aggVal = cfg.aggregation || 'count';
    el.innerHTML = '<div class="vt-config-section"><span class="vt-config-label">Chart Data</span>' +
      '<div class="form-row"><label>Category field</label>' + colSel('vcp-cat', cfg.categoryField) + '</div>' +
      '<div class="form-row" id="vcp-vr" style="' + (aggVal === 'count' ? 'display:none' : '') + '"><label>Value field</label>' + colSel('vcp-val', cfg.valueField) + '</div>' +
      '<div class="form-row"><label>Aggregation</label><div style="display:flex;gap:10px">' +
      ['sum','count','average'].map(function(a) {
        return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcp-agg" value="' + a + '"' + (aggVal === a ? ' checked' : '') + '> ' + (a.charAt(0).toUpperCase() + a.slice(1)) + '</label>';
      }).join('') + '</div></div></div>' +
      '<div class="vt-config-section"><span class="vt-config-label">Display</span>' +
      '<div class="form-row form-row-inline"><label><input type="checkbox" id="vcp-donut"' + (cfg.donut ? ' checked' : '') + '> Donut style</label></div>' +
      '<div class="form-row form-row-inline"><label><input type="checkbox" id="vcp-labels"' + (cfg.showLabels !== false ? ' checked' : '') + '> Show labels</label></div>' +
      '<div class="form-row form-row-inline"><label><input type="checkbox" id="vcp-legend"' + (cfg.showLegend !== false ? ' checked' : '') + '> Show legend</label></div></div>';

    el.querySelector('#vcp-cat').addEventListener('change', function() { cfg.categoryField = this.value; onChange(); });
    el.querySelector('#vcp-val').addEventListener('change', function() { cfg.valueField = this.value; onChange(); });
    const valRow = el.querySelector('#vcp-vr');
    el.querySelectorAll('input[name="vcp-agg"]').forEach(function(r) {
      r.addEventListener('change', function() {
        cfg.aggregation = this.value;
        valRow.style.display = this.value === 'count' ? 'none' : '';
        onChange();
      });
    });
    el.querySelector('#vcp-donut').addEventListener('change', function() { cfg.donut = this.checked; onChange(); });
    el.querySelector('#vcp-labels').addEventListener('change', function() { cfg.showLabels = this.checked; onChange(); });
    el.querySelector('#vcp-legend').addEventListener('change', function() { cfg.showLegend = this.checked; onChange(); });

    return el;
  }

  // ── STACKED_DIVERGING_BAR config builder ──────────────────────────────────────
  function _vtBuildStackedDivergingBarConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    const el = document.createElement('div');

    function colSel(id, selected, includeNone) {
      const blank = includeNone ? '<option value="">-- none --</option>' : '<option value="">-- select --</option>';
      return '<select id="' + id + '" style="width:100%">' + blank +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    function rebuild() {
      el.innerHTML = '';
      const scaleType = cfg.scaleType || '5point';
      const ds = document.createElement('div');
      ds.className = 'vt-config-section';
      ds.innerHTML = '<span class="vt-config-label">Chart Data</span>' +
        '<div class="form-row"><label>Question/category field</label>' + colSel('vcsdb-q', cfg.questionField) + '</div>' +
        '<div class="form-row"><label>Response field</label>' + colSel('vcsdb-r', cfg.responseField) + '</div>' +
        '<div class="form-row"><label>Scale type</label><div style="display:flex;gap:10px">' +
        [['5point','5-point'],['7point','7-point'],['custom','Custom']].map(function(pair) {
          return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcsdb-scale" value="' + pair[0] + '"' + (scaleType === pair[0] ? ' checked' : '') + '> ' + pair[1] + '</label>';
        }).join('') + '</div></div>' +
        '<div id="vcsdb-custom" style="' + (scaleType !== 'custom' ? 'display:none' : '') + ';margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Custom scale labels</div>' +
        '<div id="vcsdb-clist"></div>' +
        '<button class="vt-add-btn" id="vcsdb-add" style="margin-top:2px;width:calc(100%)">＋ Add point</button>' +
        '</div>' +
        '<div class="form-row"><label>Pre-aggregated count field</label>' + colSel('vcsdb-cnt', cfg.countField, true) +
        '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Leave blank to compute counts from raw responses</span></div>';
      el.appendChild(ds);

      ds.querySelector('#vcsdb-q').addEventListener('change', function() { cfg.questionField = this.value; onChange(); });
      ds.querySelector('#vcsdb-r').addEventListener('change', function() { cfg.responseField = this.value; onChange(); });
      ds.querySelector('#vcsdb-cnt').addEventListener('change', function() { cfg.countField = this.value || ''; onChange(); });

      const customSec = ds.querySelector('#vcsdb-custom');
      ds.querySelectorAll('input[name="vcsdb-scale"]').forEach(function(r) {
        r.addEventListener('change', function() {
          cfg.scaleType = this.value;
          customSec.style.display = this.value === 'custom' ? '' : 'none';
          onChange();
        });
      });

      if (scaleType === 'custom') {
        const clist = ds.querySelector('#vcsdb-clist');
        (cfg.scaleLabels || []).forEach(function(lbl, idx) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px';
          row.innerHTML = '<input type="text" value="' + _vtEsc(lbl) + '" placeholder="Scale point ' + (idx + 1) + '" style="flex:1">' +
            '<button style="background:none;border:none;color:var(--text-faint);font-size:14px;padding:0 2px">✕</button>';
          row.querySelector('input').addEventListener('input', function() { cfg.scaleLabels[idx] = this.value; onChange(); });
          row.querySelector('button').addEventListener('click', function() { cfg.scaleLabels.splice(idx, 1); rebuild(); onChange(); });
          clist.appendChild(row);
        });
        ds.querySelector('#vcsdb-add').addEventListener('click', function() {
          cfg.scaleLabels = cfg.scaleLabels || [];
          cfg.scaleLabels.push('');
          rebuild();
        });
      }
    }

    rebuild();
    return el;
  }

  // ── WORD_CLOUD config builder ─────────────────────────────────────────────────
  function _vtBuildWordCloudConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    const cfg = viz.config;
    const el = document.createElement('div');

    function colSel(id, selected, includeNone) {
      const blank = includeNone ? '<option value="">-- none --</option>' : '<option value="">-- select --</option>';
      return '<select id="' + id + '" style="width:100%">' + blank +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    const colorMode = cfg.colorMode || 'palette';
    el.innerHTML = '<div class="vt-config-section"><span class="vt-config-label">Chart Data</span>' +
      '<div class="form-row"><label>Word field</label>' + colSel('vcwc-word', cfg.wordField) + '</div>' +
      '<div class="form-row"><label>Weight field</label>' + colSel('vcwc-wt', cfg.weightField, true) +
      '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Leave blank to use word frequency</span></div>' +
      '<div class="form-row"><label>Max words</label><input type="number" id="vcwc-max" value="' + (cfg.maxWords || 100) + '" min="10" max="500" style="width:100%"></div>' +
      '</div>' +
      '<div class="vt-config-section"><span class="vt-config-label">Display</span>' +
      '<div class="form-row"><label>Color mode</label><div style="display:flex;gap:12px">' +
      '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcwc-color" value="palette"' + (colorMode !== 'single' ? ' checked' : '') + '> Palette</label>' +
      '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcwc-color" value="single"' + (colorMode === 'single' ? ' checked' : '') + '> Single accent color</label>' +
      '</div></div></div>';

    el.querySelector('#vcwc-word').addEventListener('change', function() { cfg.wordField = this.value; onChange(); });
    el.querySelector('#vcwc-wt').addEventListener('change', function() { cfg.weightField = this.value || ''; onChange(); });
    el.querySelector('#vcwc-max').addEventListener('change', function() { cfg.maxWords = Math.max(10, Math.min(500, parseInt(this.value) || 100)); onChange(); });
    el.querySelectorAll('input[name="vcwc-color"]').forEach(function(r) {
      r.addEventListener('change', function() { cfg.colorMode = this.value; onChange(); });
    });

    return el;
  }

  function _vtShowAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';

    overlay.innerHTML = `<div class="modal" style="width:560px;max-height:80vh">
      <div class="modal-header">
        <span>Add Visualization</span>
        <button class="modal-close" id="vt-modal-close">✕</button>
      </div>
      <div style="padding:12px 12px 4px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em">Choose type</div>
      <div class="vt-picker-grid" id="vt-type-grid" style="overflow-y:auto;max-height:calc(80vh - 80px)">
        ${_vtVizTypes.map(function(t) {
          return '<div class="vt-picker-item" data-type="' + t.type + '">' +
            '<div class="vt-picker-icon">' + t.icon + '</div>' +
            '<div class="vt-picker-name">' + _vtEsc(t.name) + '</div>' +
            '<div class="vt-picker-desc">' + _vtEsc(t.desc) + '</div>' +
            '</div>';
        }).join('')}
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#vt-modal-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelectorAll('.vt-picker-item').forEach(function(item) {
      item.addEventListener('click', function() {
        const typeInfo = _vtVizTypes.find(function(t) { return t.type === item.dataset.type; });
        _vtAddViz(item.dataset.type, typeInfo ? typeInfo.name : item.dataset.type);
        document.body.removeChild(overlay);
      });
    });
  }

  function _vtAddViz(type, label) {
    const state = window.DWBState;
    if (!state.flow) return;
    const viz = window.DWBSchema.createViz(type, label);
    // Auto-assign first available snapshot
    const snapNames = Object.keys(state.snapshots || {});
    if (snapNames.length > 0) viz.snapshotName = snapNames[0];
    state.flow.visualizations.push(viz);
    state.selectedVizId = viz.id;
    window.DWBShell.markDirty();
    _vtRenderAssetList();
    _vtRenderCanvas();
    _vtShowConfig(viz.id);
  }

  function _vtDeleteViz(vizId) {
    const state = window.DWBState;
    if (!state.flow) return;
    state.flow.visualizations = state.flow.visualizations.filter(function(v) { return v.id !== vizId; });
    if (state.selectedVizId === vizId) state.selectedVizId = null;
    window.DWBShell.markDirty();
    _vtRenderAssetList();
    _vtRenderCanvas();
    const configEl = document.getElementById('vt-config');
    if (configEl) configEl.classList.remove('visible');
  }

  function _vtEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount, renderViz: _vtRenderViz, loadEcharts: _vtLoadEcharts, aggregateRows: _vtAggregateRows };
})();

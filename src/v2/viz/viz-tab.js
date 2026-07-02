/* === DWBVizTab: visualization asset library and live preview === */

window.DWBVizTab = (function() {
  let _vtEchartsPromise = null;

  const _vtVizTypes = [
    { type: 'BAR_VERTICAL',          icon: '📊', name: 'Bar Chart',         desc: 'Vertical bars with aggregation' },
    { type: 'LINE',                   icon: '📈', name: 'Line Chart',        desc: 'Trend over categories' },
    { type: 'PIE',                    icon: '🥧', name: 'Pie Chart',         desc: 'Part-to-whole proportions' },
    { type: 'KPI_STAT',               icon: '🎯', name: 'KPI Stat',          desc: 'Single metric spotlight' },
    { type: 'DATA_TABLE',             icon: '📋', name: 'Data Table',        desc: 'Searchable tabular view' },
    { type: 'STAT_CARD',              icon: '🏷️', name: 'Stat Card',         desc: 'Tokenized text with computed variables' },
    { type: 'WORD_CLOUD',             icon: '☁',  name: 'Word Cloud',        desc: 'Frequency visualization' },
    { type: 'STACKED_DIVERGING_BAR',  icon: '⚖',  name: 'Diverging Bar',    desc: 'Likert / agreement scale' },
    { type: 'RICH_TEXT',              icon: '📝', name: 'Rich Text',         desc: 'Formatted text with data tokens' },
    { type: 'QUOTES_BOARD',           icon: '💬', name: 'Quotes Board',      desc: 'Display quotes with sentiment indicators' },
    { type: 'AI_ASSIST',              icon: '🤖', name: 'AI Assist',         desc: 'Clipboard-based prompt builder for external AI tools' },
    { type: 'TIMELINE_HORIZONTAL',   icon: '⏩', name: 'Timeline (H)',      desc: 'Horizontal timeline events' },
    { type: 'TIMELINE_GANTT',         icon: '📅', name: 'Gantt Chart',       desc: 'Duration bars on a timeline' },
    { type: 'TIMELINE_VERTICAL',      icon: '📌', name: 'Timeline (V)',      desc: 'Vertical event timeline' },
    { type: 'FILTER_WIDGET',          icon: '🎛️', name: 'Filter Widget',    desc: 'Interactive filter control for the dashboard filter bar', category: 'Data' }
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

  function _vtRenderViz(viz, rows, container, allRows) {
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
      case 'STAT_CARD':
        db ? db.renderStatCard(container, viz, allRows || rows, rows) : _vtPlaceholder(container, 'STAT_CARD');
        break;
      case 'QUOTES_BOARD':
        db ? db.renderQuotesBoard(container, viz, rows) : _vtPlaceholder(container, 'QUOTES_BOARD');
        break;
      case 'RICH_TEXT':
        db ? db.renderRichText(container, viz, rows) : _vtPlaceholder(container, 'RICH_TEXT');
        break;
      case 'AI_ASSIST':
        container.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-faint);text-align:center">AI Assist renders an interactive copy/paste panel in the Dashboard — preview not available here.</div>';
        break;
      case 'FILTER_WIDGET':
        _vtRenderFilterWidgetPreview(container, viz, rows);
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
    var cfg = viz.config || {};
    var selectedCols = (cfg.selectedColumns && cfg.selectedColumns.length) ? cfg.selectedColumns : null;
    var maxRows = cfg.maxRows || 200;
    var showRowNums = cfg.showRowNumbers === true;
    if (rows.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">No data available.</div>';
      return;
    }
    var allCols = Object.keys(rows[0]);
    var cols = selectedCols ? selectedCols.filter(function(c) { return allCols.indexOf(c) !== -1; }) : allCols;
    var limit = Math.min(rows.length, maxRows);
    var html = '<div style="overflow:auto;max-height:360px"><table class="dwb-data-table"><thead><tr>';
    if (showRowNums) html += '<th style="color:var(--text-faint);font-weight:normal;width:40px">#</th>';
    html += cols.map(function(c) { return '<th>' + _vtEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var i = 0; i < limit; i++) {
      html += '<tr>';
      if (showRowNums) html += '<td class="row-num-cell">' + (i + 1) + '</td>';
      html += cols.map(function(c) {
        var v = String(rows[i][c] !== undefined ? rows[i][c] : '');
        return '<td>' + _vtEsc(v.length > 60 ? v.slice(0, 60) + '…' : v) + '</td>';
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

    // Display Filters section (all viz types)
    configEl.appendChild(_vtBuildDisplayFiltersSection(viz, cols, onChange));

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
    } else if (viz.type === 'STAT_CARD') {
      configEl.appendChild(_vtBuildStatCardConfig(viz, cols, onChange));
    } else if (viz.type === 'QUOTES_BOARD') {
      configEl.appendChild(_vtBuildQuotesBoardConfig(viz, cols, onChange));
    } else if (viz.type === 'RICH_TEXT') {
      configEl.appendChild(_vtBuildRichTextConfig(viz, cols, onChange));
    } else if (viz.type === 'AI_ASSIST') {
      configEl.appendChild(_vtBuildAiAssistConfig(viz, cols, onChange));
    } else if (viz.type === 'DATA_TABLE') {
      configEl.appendChild(_vtBuildDataTableConfig(viz, cols, onChange));
    } else if (viz.type === 'FILTER_WIDGET') {
      configEl.appendChild(_vtBuildFilterWidgetConfig(viz, cols, onChange));
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

      // Detect likert metadata for current responseField
      let metaBanner = null;
      if (cfg.responseField) {
        const snMeta = window.DWBState && window.DWBState.snapshotMeta && window.DWBState.snapshotMeta[viz.snapshotName];
        if (snMeta && snMeta.columnTypes && snMeta.columnTypes[cfg.responseField]) {
          const cm = snMeta.columnTypes[cfg.responseField];
          if (cm.type === 'likert' && cm.scale && cm.scale.length) metaBanner = cm;
        }
      }
      const useAutoScale = metaBanner && (cfg.useAutoScale !== false);

      const ds = document.createElement('div');
      ds.className = 'vt-config-section';

      if (metaBanner) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:var(--accent-light);border:1px solid var(--accent);border-radius:4px;padding:6px 10px;font-size:11px;margin-bottom:8px';
        banner.innerHTML = '<div style="color:var(--accent);font-weight:600">✓ Likert metadata detected for <em>' + _vtEsc(cfg.responseField) + '</em></div>' +
          '<label style="display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer;font-weight:normal">' +
          '<input type="checkbox"' + (useAutoScale ? ' checked' : '') + '> Use automatic scale from pipeline metadata</label>';
        banner.querySelector('input').addEventListener('change', function() {
          cfg.useAutoScale = this.checked;
          onChange();
          rebuild();
        });
        ds.appendChild(banner);
      }

      const body = document.createElement('div');
      body.innerHTML = '<span class="vt-config-label">Chart Data</span>' +
        '<div class="form-row"><label>Question/category field</label>' + colSel('vcsdb-q', cfg.questionField) + '</div>' +
        '<div class="form-row"><label>Response field</label>' + colSel('vcsdb-r', cfg.responseField) + '</div>' +
        (useAutoScale ? '' :
          '<div class="form-row"><label>Scale type</label><div style="display:flex;gap:10px">' +
          [['5point','5-point'],['7point','7-point'],['custom','Custom']].map(function(pair) {
            return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcsdb-scale" value="' + pair[0] + '"' + (scaleType === pair[0] ? ' checked' : '') + '> ' + pair[1] + '</label>';
          }).join('') + '</div></div>' +
          '<div id="vcsdb-custom" style="' + (scaleType !== 'custom' ? 'display:none' : '') + ';margin-bottom:8px">' +
          '<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Custom scale labels</div>' +
          '<div id="vcsdb-clist"></div>' +
          '<button class="vt-add-btn" id="vcsdb-add" style="margin-top:2px;width:calc(100%)">＋ Add point</button>' +
          '</div>'
        ) +
        '<div class="form-row"><label>Pre-aggregated count field</label>' + colSel('vcsdb-cnt', cfg.countField, true) +
        '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Leave blank to compute counts from raw responses</span></div>';
      ds.appendChild(body);
      el.appendChild(ds);

      body.querySelector('#vcsdb-q').addEventListener('change', function() { cfg.questionField = this.value; onChange(); rebuild(); });
      body.querySelector('#vcsdb-r').addEventListener('change', function() { cfg.responseField = this.value; onChange(); rebuild(); });
      body.querySelector('#vcsdb-cnt').addEventListener('change', function() { cfg.countField = this.value || ''; onChange(); });

      if (!useAutoScale) {
        const customSec = body.querySelector('#vcsdb-custom');
        body.querySelectorAll('input[name="vcsdb-scale"]').forEach(function(r) {
          r.addEventListener('change', function() {
            cfg.scaleType = this.value;
            customSec.style.display = this.value === 'custom' ? '' : 'none';
            onChange();
          });
        });

        if (scaleType === 'custom') {
          const clist = body.querySelector('#vcsdb-clist');
          (cfg.scaleLabels || []).forEach(function(lbl, idx) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px';
            row.innerHTML = '<input type="text" value="' + _vtEsc(lbl) + '" placeholder="Scale point ' + (idx + 1) + '" style="flex:1">' +
              '<button style="background:none;border:none;color:var(--text-faint);font-size:14px;padding:0 2px">✕</button>';
            row.querySelector('input').addEventListener('input', function() { cfg.scaleLabels[idx] = this.value; onChange(); });
            row.querySelector('button').addEventListener('click', function() { cfg.scaleLabels.splice(idx, 1); rebuild(); onChange(); });
            clist.appendChild(row);
          });
          body.querySelector('#vcsdb-add').addEventListener('click', function() {
            cfg.scaleLabels = cfg.scaleLabels || [];
            cfg.scaleLabels.push('');
            rebuild();
          });
        }
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

  // ── STAT_CARD config builder ──────────────────────────────────────────────────
  function _vtBuildStatCardConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    if (!cfg.variables) cfg.variables = [];
    if (!cfg.lines) cfg.lines = [];

    var el = document.createElement('div');
    var _focusedLineInput = null;

    function rebuildAvailableVars() {
      var helper = el.querySelector('#vsc-avail-helper');
      if (!helper) return;
      var validVars = cfg.variables.filter(function(v) { return v.name && /^\w+$/.test(v.name); });
      if (!validVars.length) {
        helper.textContent = 'Define variables above to use them in your template.';
        return;
      }
      helper.innerHTML = '<span style="color:var(--text-faint)">Available: </span>' +
        validVars.map(function(v) {
          return '<span class="vsc-var-pill" style="display:inline-block;padding:1px 7px;background:var(--accent-light);color:var(--accent);border-radius:10px;cursor:pointer;margin:0 2px;font-size:10px">{{' + v.name + '}}</span>';
        }).join('');
      helper.querySelectorAll('.vsc-var-pill').forEach(function(pill) {
        pill.addEventListener('click', function() {
          var token = this.textContent;
          if (!_focusedLineInput) return;
          var inp = _focusedLineInput;
          var start = inp.selectionStart;
          var end = inp.selectionEnd;
          inp.value = inp.value.slice(0, start) + token + inp.value.slice(end);
          inp.setSelectionRange(start + token.length, start + token.length);
          inp.focus();
          var lineIdx = parseInt(inp.dataset.lineIdx);
          if (!isNaN(lineIdx) && cfg.lines[lineIdx]) cfg.lines[lineIdx].text = inp.value;
          onChange();
        });
      });
    }

    function rebuild() {
      el.innerHTML = '';

      // ── VARIABLES section ──────────────────────────────────────────────────────
      var varSec = document.createElement('div');
      varSec.className = 'vt-config-section';
      varSec.innerHTML = '<span class="vt-config-label">Variables</span>' +
        '<div id="vsc-var-list"></div>' +
        '<button class="vt-add-btn" id="vsc-add-var" style="width:100%;margin-top:4px">＋ Add Variable</button>';
      el.appendChild(varSec);

      var varList = varSec.querySelector('#vsc-var-list');

      cfg.variables.forEach(function(v, idx) {
        var isCount = (v.aggregation || 'count') === 'count';
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;padding:8px;background:var(--bg-raised);border-radius:4px;border:1px solid var(--border)';
        row.innerHTML =
          '<div style="display:flex;align-items:center;gap:4px">' +
            '<input type="text" id="vsc-name-' + idx + '" value="' + _vtEsc(v.name || '') + '" placeholder="e.g. avg_score" style="flex:1;min-width:0">' +
            '<button class="vsc-var-del" style="background:none;border:none;color:var(--text-faint);font-size:14px;padding:0 4px;cursor:pointer;flex-shrink:0" title="Remove">✕</button>' +
          '</div>' +
          '<div id="vsc-name-err-' + idx + '" style="display:none;font-size:10px;color:var(--danger)"></div>' +
          '<div style="display:flex;gap:4px;align-items:center">' +
            '<select id="vsc-agg-' + idx + '" style="width:90px;flex-shrink:0">' +
              '<option value="count"' + (v.aggregation === 'count' || !v.aggregation ? ' selected' : '') + '>Count</option>' +
              '<option value="sum"' + (v.aggregation === 'sum' ? ' selected' : '') + '>Sum</option>' +
              '<option value="average"' + (v.aggregation === 'average' ? ' selected' : '') + '>Average</option>' +
              '<option value="mode"' + (v.aggregation === 'mode' ? ' selected' : '') + '>Mode</option>' +
            '</select>' +
            '<select id="vsc-field-' + idx + '" style="flex:1;min-width:0' + (isCount ? ';opacity:0.4' : '') + '"' + (isCount ? ' disabled' : '') + '>' +
              '<option value="">-- field --</option>' +
              cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === (v.field || '') ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') +
            '</select>' +
            '<select id="vsc-scope-' + idx + '" style="width:90px;flex-shrink:0">' +
              '<option value="filtered"' + (v.scope !== 'unfiltered' ? ' selected' : '') + '>Filtered</option>' +
              '<option value="unfiltered"' + (v.scope === 'unfiltered' ? ' selected' : '') + '>Unfiltered</option>' +
            '</select>' +
          '</div>';

        varList.appendChild(row);

        var nameInput = row.querySelector('#vsc-name-' + idx);
        var nameErr = row.querySelector('#vsc-name-err-' + idx);
        var aggSel = row.querySelector('#vsc-agg-' + idx);
        var fieldSel = row.querySelector('#vsc-field-' + idx);
        var scopeSel = row.querySelector('#vsc-scope-' + idx);

        nameInput.addEventListener('input', function() {
          var val = this.value;
          if (!val || !/^\w+$/.test(val)) {
            nameErr.textContent = 'Use letters, numbers, and underscores only (no spaces)';
            nameErr.style.display = '';
          } else {
            var isDupe = cfg.variables.some(function(other, oi) { return oi !== idx && other.name === val; });
            if (isDupe) {
              nameErr.textContent = 'Duplicate name — last write wins';
              nameErr.style.display = '';
            } else {
              nameErr.style.display = 'none';
            }
            v.name = val;
            onChange();
            rebuildAvailableVars();
          }
        });

        aggSel.addEventListener('change', function() {
          v.aggregation = this.value;
          var isCountNow = this.value === 'count';
          fieldSel.disabled = isCountNow;
          fieldSel.style.opacity = isCountNow ? '0.4' : '';
          onChange();
        });

        fieldSel.addEventListener('change', function() { v.field = this.value; onChange(); });
        scopeSel.addEventListener('change', function() { v.scope = this.value; onChange(); });

        row.querySelector('.vsc-var-del').addEventListener('click', function() {
          cfg.variables.splice(idx, 1);
          rebuild();
          onChange();
        });
      });

      varSec.querySelector('#vsc-add-var').addEventListener('click', function() {
        cfg.variables.push({ name: '', field: '', aggregation: 'count', scope: 'filtered' });
        rebuild();
      });

      // ── Available variables helper ─────────────────────────────────────────────
      var availHelper = document.createElement('div');
      availHelper.id = 'vsc-avail-helper';
      availHelper.style.cssText = 'padding:4px 0 6px;font-size:11px';
      el.appendChild(availHelper);
      rebuildAvailableVars();

      // ── TEMPLATE section ───────────────────────────────────────────────────────
      var tplSec = document.createElement('div');
      tplSec.className = 'vt-config-section';
      tplSec.innerHTML = '<span class="vt-config-label">Template</span>' +
        '<div id="vsc-line-list"></div>' +
        '<button class="vt-add-btn" id="vsc-add-line" style="width:100%;margin-top:4px">＋ Add Line</button>';
      el.appendChild(tplSec);

      var lineList = tplSec.querySelector('#vsc-line-list');
      var _dragSrcIdx = null;

      cfg.lines.forEach(function(line, idx) {
        var card = document.createElement('div');
        card.className = 'vsc-line-card';
        card.style.cssText = 'background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:8px;position:relative';
        card.draggable = true;
        card.dataset.lineIdx = String(idx);

        var colorVal = line.color || '';
        card.innerHTML =
          '<div style="display:flex;align-items:center;gap:4px">' +
            '<span class="vsc-drag-handle" style="cursor:grab;color:var(--text-faint);font-size:16px;padding:0 2px;line-height:1;flex-shrink:0;user-select:none" title="Drag to reorder">⠿</span>' +
            '<input type="text" class="vsc-line-text" data-line-idx="' + idx + '" value="' + _vtEsc(line.text || '') + '" placeholder="Type text, use {{variable}} to insert a value" style="flex:1;min-width:0">' +
            '<button class="vsc-line-del" style="background:none;border:none;color:var(--text-faint);font-size:14px;padding:0 4px;cursor:pointer;flex-shrink:0" title="Remove">✕</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">' +
            '<input type="number" class="vsc-font-size" value="' + (line.fontSize || 16) + '" min="10" max="72" style="width:60px" title="Font size">' +
            '<button class="vsc-bold-btn" style="padding:2px 8px;font-weight:700;font-size:12px;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:' + (line.weight === 'bold' ? 'var(--accent)' : 'var(--bg-surface)') + ';color:' + (line.weight === 'bold' ? '#fff' : 'var(--text-muted)') + '" title="Bold">B</button>' +
            '<div style="display:flex;border-radius:3px;overflow:hidden">' +
              ['left','center','right'].map(function(a) {
                var icons = { left: '⬅', center: '↔', right: '➡' };
                var active = (line.align || 'center') === a;
                return '<button class="vsc-align-btn" data-align="' + a + '" style="padding:2px 7px;font-size:11px;cursor:pointer;border:1px solid var(--border);border-right:none;background:' + (active ? 'var(--accent)' : 'var(--bg-surface)') + ';color:' + (active ? '#fff' : 'var(--text-muted)') + ';' + (a === 'right' ? 'border-right:1px solid var(--border)' : '') + '">' + icons[a] + '</button>';
              }).join('') +
            '</div>' +
            '<input type="color" class="vsc-color-pick" value="' + (colorVal || '#000000') + '" style="width:28px;height:28px;border:1px solid var(--border);border-radius:3px;cursor:pointer;padding:1px" title="Text color">' +
            '<button class="vsc-color-auto" style="font-size:10px;padding:2px 6px;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:' + (colorVal ? 'var(--bg-surface)' : 'var(--accent)') + ';color:' + (colorVal ? 'var(--text-muted)' : '#fff') + '" title="Use theme default color">Auto</button>' +
          '</div>';

        lineList.appendChild(card);

        var textInput = card.querySelector('.vsc-line-text');
        var fontSizeInput = card.querySelector('.vsc-font-size');
        var boldBtn = card.querySelector('.vsc-bold-btn');
        var colorPick = card.querySelector('.vsc-color-pick');
        var colorAuto = card.querySelector('.vsc-color-auto');

        textInput.addEventListener('focus', function() { _focusedLineInput = this; });
        textInput.addEventListener('input', function() { line.text = this.value; onChange(); });

        fontSizeInput.addEventListener('change', function() {
          line.fontSize = Math.max(10, Math.min(72, parseInt(this.value) || 16));
          this.value = line.fontSize;
          onChange();
        });

        boldBtn.addEventListener('click', function() {
          line.weight = line.weight === 'bold' ? 'normal' : 'bold';
          this.style.background = line.weight === 'bold' ? 'var(--accent)' : 'var(--bg-surface)';
          this.style.color = line.weight === 'bold' ? '#fff' : 'var(--text-muted)';
          onChange();
        });

        card.querySelectorAll('.vsc-align-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            line.align = btn.dataset.align;
            card.querySelectorAll('.vsc-align-btn').forEach(function(b) {
              var isActive = b.dataset.align === line.align;
              b.style.background = isActive ? 'var(--accent)' : 'var(--bg-surface)';
              b.style.color = isActive ? '#fff' : 'var(--text-muted)';
            });
            onChange();
          });
        });

        colorPick.addEventListener('input', function() {
          line.color = this.value;
          colorAuto.style.background = 'var(--bg-surface)';
          colorAuto.style.color = 'var(--text-muted)';
          onChange();
        });

        colorAuto.addEventListener('click', function() {
          line.color = '';
          colorPick.value = '#000000';
          this.style.background = 'var(--accent)';
          this.style.color = '#fff';
          onChange();
        });

        card.querySelector('.vsc-line-del').addEventListener('click', function() {
          cfg.lines.splice(idx, 1);
          rebuild();
          onChange();
        });

        // Drag-to-reorder
        card.addEventListener('dragstart', function(e) {
          _dragSrcIdx = idx;
          e.dataTransfer.effectAllowed = 'move';
          card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', function() {
          _dragSrcIdx = null;
          card.style.opacity = '';
          lineList.querySelectorAll('.vsc-line-card').forEach(function(c) { c.style.outline = ''; });
        });

        card.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          lineList.querySelectorAll('.vsc-line-card').forEach(function(c) { c.style.outline = ''; });
          card.style.outline = '2px solid var(--accent)';
        });

        card.addEventListener('drop', function(e) {
          e.preventDefault();
          lineList.querySelectorAll('.vsc-line-card').forEach(function(c) { c.style.outline = ''; });
          if (_dragSrcIdx === null || _dragSrcIdx === idx) return;
          var moved = cfg.lines.splice(_dragSrcIdx, 1)[0];
          var insertAt = idx > _dragSrcIdx ? idx - 1 : idx;
          cfg.lines.splice(insertAt, 0, moved);
          _dragSrcIdx = null;
          rebuild();
          onChange();
        });
      });

      tplSec.querySelector('#vsc-add-line').addEventListener('click', function() {
        cfg.lines.push({ text: '', fontSize: 16, weight: 'normal', color: '', align: 'center' });
        rebuild();
      });
    }

    rebuild();
    return el;
  }

  // ── QUOTES_BOARD config builder ───────────────────────────────────────────────
  function _vtBuildQuotesBoardConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    var el = document.createElement('div');

    function colSel(id, selected, includeNone) {
      var blank = includeNone ? '<option value="">-- none --</option>' : '<option value="">-- select --</option>';
      return '<select id="' + id + '" style="width:100%">' + blank +
        cols.map(function(c) {
          return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>';
        }).join('') + '</select>';
    }

    var layout = cfg.layout || 'grid';
    el.innerHTML =
      '<div class="vt-config-section"><span class="vt-config-label">Chart Data</span>' +
        '<div class="form-row"><label>Quote field</label>' + colSel('vcqb-quote', cfg.quoteField) + '</div>' +
        '<div class="form-row"><label>Attribution field</label>' + colSel('vcqb-attr', cfg.attributionField, true) + '</div>' +
        '<div class="form-row"><label>Sentiment field</label>' + colSel('vcqb-sent', cfg.sentimentField, true) +
          '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Expects values: positive, neutral, or negative — produced by the Sentiment Analysis pipeline node</span>' +
        '</div>' +
      '</div>' +
      '<div class="vt-config-section"><span class="vt-config-label">Display</span>' +
        '<div class="form-row"><label>Max quotes</label>' +
          '<input type="number" id="vcqb-max" value="' + (cfg.maxQuotes != null ? cfg.maxQuotes : 12) + '" min="1" max="50" style="width:100%"></div>' +
        '<div class="form-row"><label>Layout</label><div style="display:flex;gap:12px">' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcqb-layout" value="grid"' + (layout === 'grid' ? ' checked' : '') + '> Grid</label>' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcqb-layout" value="list"' + (layout !== 'grid' ? ' checked' : '') + '> List</label>' +
        '</div></div>' +
      '</div>';

    el.querySelector('#vcqb-quote').addEventListener('change', function() { cfg.quoteField = this.value; onChange(); });
    el.querySelector('#vcqb-attr').addEventListener('change', function() { cfg.attributionField = this.value || ''; onChange(); });
    el.querySelector('#vcqb-sent').addEventListener('change', function() { cfg.sentimentField = this.value || ''; onChange(); });
    el.querySelector('#vcqb-max').addEventListener('change', function() {
      cfg.maxQuotes = Math.max(1, Math.min(50, parseInt(this.value) || 12));
      this.value = cfg.maxQuotes;
      onChange();
    });
    el.querySelectorAll('input[name="vcqb-layout"]').forEach(function(r) {
      r.addEventListener('change', function() { cfg.layout = this.value; onChange(); });
    });

    return el;
  }

  // ── RICH_TEXT config builder ──────────────────────────────────────────────────
  function _vtBuildRichTextConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    var el = document.createElement('div');
    var _focusedTextArea = null;

    function buildPills() {
      var pillsEl = el.querySelector('#vrt-col-pills');
      if (!pillsEl) return;
      if (!cols.length) {
        pillsEl.innerHTML = '<span style="font-size:10px;color:var(--text-faint)">No columns — select a dataset above.</span>';
        return;
      }
      pillsEl.innerHTML = '<span style="font-size:10px;color:var(--text-faint);margin-right:4px">Insert column:</span>' +
        cols.map(function(c) {
          return '<span class="vsc-var-pill" style="display:inline-block;padding:1px 7px;background:var(--accent-light);color:var(--accent);border-radius:10px;cursor:pointer;margin:0 2px;font-size:10px">{{' + _vtEsc(c) + '}}</span>';
        }).join('');
      pillsEl.querySelectorAll('.vsc-var-pill').forEach(function(pill) {
        pill.addEventListener('click', function() {
          var token = this.textContent;
          if (!_focusedTextArea) return;
          var ta = _focusedTextArea;
          var start = ta.selectionStart;
          var end = ta.selectionEnd;
          ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
          ta.setSelectionRange(start + token.length, start + token.length);
          ta.focus();
          cfg.text = ta.value;
          onChange();
        });
      });
    }

    var align = cfg.align || 'left';
    var weight = cfg.weight || 'normal';
    var colorVal = cfg.color || '';

    el.innerHTML =
      '<div class="vt-config-section"><span class="vt-config-label">Text</span>' +
        '<div class="form-row"><label>Content</label>' +
          '<textarea id="vrt-text" rows="4" style="width:100%;resize:vertical" placeholder="Type text, use {{column_name}} to insert a value from the first row">' + _vtEsc(cfg.text || '') + '</textarea>' +
        '</div>' +
        '<div id="vrt-col-pills" style="padding:2px 0 10px;font-size:11px;line-height:2"></div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-bottom:8px">' +
          '<input type="number" id="vrt-size" value="' + (cfg.fontSize || 16) + '" min="10" max="72" style="width:60px" title="Font size (px)">' +
          '<button id="vrt-bold" style="padding:2px 8px;font-weight:700;font-size:12px;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:' + (weight === 'bold' ? 'var(--accent)' : 'var(--bg-surface)') + ';color:' + (weight === 'bold' ? '#fff' : 'var(--text-muted)') + '" title="Bold">B</button>' +
          '<div style="display:flex;border-radius:3px;overflow:hidden">' +
            ['left','center','right'].map(function(a) {
              var icon = { left: '⬅', center: '↔', right: '➡' }[a];
              var active = align === a;
              return '<button class="vrt-align-btn" data-align="' + a + '" style="padding:2px 7px;font-size:11px;cursor:pointer;border:1px solid var(--border);border-right:' + (a === 'right' ? '1px solid var(--border)' : 'none') + ';background:' + (active ? 'var(--accent)' : 'var(--bg-surface)') + ';color:' + (active ? '#fff' : 'var(--text-muted)') + '">' + icon + '</button>';
            }).join('') +
          '</div>' +
          '<input type="color" id="vrt-color" value="' + (colorVal || '#000000') + '" style="width:28px;height:28px;border:1px solid var(--border);border-radius:3px;cursor:pointer;padding:1px" title="Text color">' +
          '<button id="vrt-color-auto" style="font-size:10px;padding:2px 6px;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:' + (!colorVal ? 'var(--accent)' : 'var(--bg-surface)') + ';color:' + (!colorVal ? '#fff' : 'var(--text-muted)') + '" title="Use theme default color">Auto</button>' +
        '</div>' +
      '</div>';

    buildPills();

    var textArea = el.querySelector('#vrt-text');
    textArea.addEventListener('focus', function() { _focusedTextArea = this; });
    textArea.addEventListener('input', function() { cfg.text = this.value; onChange(); });

    el.querySelector('#vrt-size').addEventListener('change', function() {
      cfg.fontSize = Math.max(10, Math.min(72, parseInt(this.value) || 16));
      this.value = cfg.fontSize;
      onChange();
    });

    el.querySelector('#vrt-bold').addEventListener('click', function() {
      cfg.weight = cfg.weight === 'bold' ? 'normal' : 'bold';
      this.style.background = cfg.weight === 'bold' ? 'var(--accent)' : 'var(--bg-surface)';
      this.style.color = cfg.weight === 'bold' ? '#fff' : 'var(--text-muted)';
      onChange();
    });

    el.querySelectorAll('.vrt-align-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        cfg.align = btn.dataset.align;
        el.querySelectorAll('.vrt-align-btn').forEach(function(b) {
          var isActive = b.dataset.align === cfg.align;
          b.style.background = isActive ? 'var(--accent)' : 'var(--bg-surface)';
          b.style.color = isActive ? '#fff' : 'var(--text-muted)';
        });
        onChange();
      });
    });

    el.querySelector('#vrt-color').addEventListener('input', function() {
      cfg.color = this.value;
      el.querySelector('#vrt-color-auto').style.background = 'var(--bg-surface)';
      el.querySelector('#vrt-color-auto').style.color = 'var(--text-muted)';
      onChange();
    });

    el.querySelector('#vrt-color-auto').addEventListener('click', function() {
      cfg.color = '';
      el.querySelector('#vrt-color').value = '#000000';
      this.style.background = 'var(--accent)';
      this.style.color = '#fff';
      onChange();
    });

    return el;
  }

  // ── AI_ASSIST config builder ──────────────────────────────────────────────────
  function _vtBuildAiAssistConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    if (!cfg.includeFields) cfg.includeFields = [];
    if (cfg.promptTemplate == null) {
      cfg.promptTemplate = 'Analyze the following data and provide insights:\n\n{{data}}';
    }

    var el = document.createElement('div');
    var promptSec = document.createElement('div');
    promptSec.className = 'vt-config-section';
    promptSec.innerHTML =
      '<span class="vt-config-label">Prompt</span>' +
      '<div class="form-row"><label>Prompt template</label>' +
        '<textarea id="vcai-tmpl" rows="4" style="width:100%;resize:vertical" placeholder="Use {{data}} to insert the data sample as JSON">' +
          _vtEsc(cfg.promptTemplate) +
        '</textarea>' +
        '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Use {{data}} to insert the data sample as JSON</span>' +
      '</div>' +
      '<div class="form-row"><label>Max rows to include</label>' +
        '<input type="number" id="vcai-max" value="' + (cfg.maxRows || 50) + '" min="1" max="500" style="width:100%"></div>' +
      '<div class="form-row"><label>Include fields</label>' +
        '<div id="vcai-fields" style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:6px"></div>' +
        '<span style="font-size:10px;color:var(--text-faint);margin-top:2px">Leave all checked to include all columns</span>' +
      '</div>';
    el.appendChild(promptSec);

    var fieldsContainer = promptSec.querySelector('#vcai-fields');
    if (!cols.length) {
      fieldsContainer.innerHTML = '<span style="font-size:11px;color:var(--text-faint)">No columns — select a dataset first</span>';
    } else {
      cols.forEach(function(col) {
        var isChecked = cfg.includeFields.length === 0 || cfg.includeFields.indexOf(col) !== -1;
        var lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:normal;padding:2px 0;cursor:pointer';
        lbl.innerHTML = '<input type="checkbox" value="' + _vtEsc(col) + '"' + (isChecked ? ' checked' : '') + '> ' + _vtEsc(col);
        fieldsContainer.appendChild(lbl);
      });

      fieldsContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var checked = Array.from(fieldsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(function(c) { return c.value; });
          cfg.includeFields = (checked.length === cols.length) ? [] : checked;
          window.DWBShell && window.DWBShell.markDirty();
        });
      });
    }

    promptSec.querySelector('#vcai-tmpl').addEventListener('input', function() {
      cfg.promptTemplate = this.value;
      window.DWBShell && window.DWBShell.markDirty();
    });

    promptSec.querySelector('#vcai-max').addEventListener('change', function() {
      cfg.maxRows = Math.max(1, Math.min(500, parseInt(this.value) || 50));
      this.value = cfg.maxRows;
      window.DWBShell && window.DWBShell.markDirty();
    });

    return el;
  }

  // ── Display Filters section (shared across all viz types) ────────────────────
  function _vtBuildDisplayFiltersSection(viz, cols, onChange) {
    var el = document.createElement('div');
    el.className = 'vt-config-section';

    function rebuild() {
      el.innerHTML = '';

      var sectionLabel = document.createElement('span');
      sectionLabel.className = 'vt-config-label';
      sectionLabel.textContent = 'Display Filters';
      el.appendChild(sectionLabel);

      var ffRow = document.createElement('div');
      ffRow.className = 'form-row';
      ffRow.innerHTML = '<label>Filterable fields</label>';
      el.appendChild(ffRow);

      var tags = document.createElement('div');
      tags.className = 'vt-filter-tags';
      el.appendChild(tags);

      var fields = viz.filterableFields || (viz.filterableFields = []);
      fields.forEach(function(field, idx) {
        var tag = document.createElement('span');
        tag.className = 'vt-filter-tag';
        tag.appendChild(document.createTextNode(field));
        var rmBtn = document.createElement('button');
        rmBtn.className = 'vt-filter-tag-remove';
        rmBtn.textContent = '×';
        rmBtn.title = 'Remove';
        rmBtn.addEventListener('click', function() {
          viz.filterableFields = fields.filter(function(_, i) { return i !== idx; });
          onChange();
          rebuild();
        });
        tag.appendChild(rmBtn);
        tags.appendChild(tag);
      });

      var snapshots = (window.DWBState && window.DWBState.snapshots) || {};
      var snapRows = viz.snapshotName ? (snapshots[viz.snapshotName] || []) : [];
      var availCols = snapRows.length ? Object.keys(snapRows[0]) : cols;
      var unused = availCols.filter(function(c) { return fields.indexOf(c) === -1; });

      if (!viz.snapshotName) {
        var note = document.createElement('div');
        note.style.cssText = 'font-size:11px;color:var(--text-faint);padding:2px 0 6px';
        note.textContent = 'Bind a snapshot to add filterable fields';
        el.appendChild(note);
      } else if (unused.length > 0) {
        var addWrap = document.createElement('div');
        addWrap.style.cssText = 'position:relative;display:inline-block;margin-top:2px';
        var addBtn = document.createElement('button');
        addBtn.className = 'vt-filter-add-btn';
        addBtn.textContent = '＋ Add field';
        addWrap.appendChild(addBtn);
        el.appendChild(addWrap);

        addBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var existing = addWrap.querySelector('.vt-filter-dropdown');
          if (existing) { existing.remove(); return; }
          var dd = document.createElement('div');
          dd.className = 'vt-filter-dropdown';
          unused.forEach(function(col) {
            var opt = document.createElement('button');
            opt.className = 'vt-filter-dropdown-item';
            opt.textContent = col;
            opt.addEventListener('click', function() {
              viz.filterableFields = fields.concat([col]);
              onChange();
              rebuild();
            });
            dd.appendChild(opt);
          });
          addWrap.appendChild(dd);
          setTimeout(function() {
            var closer = function(ev) {
              if (!addWrap.contains(ev.target)) { dd.remove(); document.removeEventListener('click', closer); }
            };
            document.addEventListener('click', closer);
          }, 10);
        });
      }

      // Link to display filters toggle
      var linked = viz.linkToDisplayFilters !== false;
      var toggleRow = document.createElement('div');
      toggleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px';
      var toggleInfo = document.createElement('div');
      toggleInfo.innerHTML =
        '<div style="font-size:12px;font-weight:600;color:var(--text-main)">Respond to display filters</div>' +
        '<div style="font-size:11px;color:var(--text-faint);margin-top:2px">When off, always shows unfiltered data</div>';
      toggleRow.appendChild(toggleInfo);

      var toggleLabel = document.createElement('label');
      toggleLabel.className = 'vt-toggle';
      var toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = linked;
      var toggleTrack = document.createElement('span');
      toggleTrack.className = 'vt-toggle-track';
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(toggleTrack);
      toggleRow.appendChild(toggleLabel);
      el.appendChild(toggleRow);

      toggleInput.addEventListener('change', function() {
        viz.linkToDisplayFilters = this.checked;
        onChange();
      });
    }

    rebuild();
    return el;
  }

  // ── DATA_TABLE config builder ─────────────────────────────────────────────────
  function _vtBuildDataTableConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    if (!cfg.selectedColumns) cfg.selectedColumns = [];

    var el = document.createElement('div');
    var _dtDragSrcIdx = null;

    function rebuild() {
      el.innerHTML = '';

      // COLUMNS section
      var colSec = document.createElement('div');
      colSec.className = 'vt-config-section';

      var secHeader = document.createElement('div');
      secHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
      secHeader.innerHTML =
        '<span class="vt-config-label" style="margin-bottom:0">Columns</span>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="vt-dt-sel-all" style="font-size:10px;background:none;border:none;color:var(--accent);cursor:pointer;padding:0">Select all</button>' +
          '<button class="vt-dt-clr-all" style="font-size:10px;background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0">Clear all</button>' +
        '</div>';
      colSec.appendChild(secHeader);

      var colList = document.createElement('div');
      colList.style.cssText = 'max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg-raised);padding:2px 0';
      colSec.appendChild(colList);

      var allNote = document.createElement('div');
      allNote.style.cssText = 'font-size:10px;color:var(--text-faint);margin-top:4px';
      allNote.textContent = 'All columns shown when none selected';
      colSec.appendChild(allNote);
      el.appendChild(colSec);

      var selectedSet = {};
      (cfg.selectedColumns || []).forEach(function(c) { selectedSet[c] = true; });
      var orderedCols = (cfg.selectedColumns && cfg.selectedColumns.length)
        ? cfg.selectedColumns.filter(function(c) { return cols.indexOf(c) !== -1; })
            .concat(cols.filter(function(c) { return !selectedSet[c]; }))
        : cols.slice();

      orderedCols.forEach(function(col, idx) {
        var isChecked = !!selectedSet[col];
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:default;transition:background 0.1s';
        row.draggable = true;
        row.dataset.col = col;

        var drag = document.createElement('span');
        drag.textContent = '⠿';
        drag.style.cssText = 'cursor:grab;color:var(--text-faint);font-size:13px;user-select:none;flex-shrink:0';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isChecked;
        cb.style.flexShrink = '0';

        var lbl = document.createElement('span');
        lbl.textContent = col;
        lbl.style.cssText = 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';

        row.appendChild(drag);
        row.appendChild(cb);
        row.appendChild(lbl);
        colList.appendChild(row);

        cb.addEventListener('change', function() {
          if (this.checked) {
            if (cfg.selectedColumns.indexOf(col) === -1) cfg.selectedColumns.push(col);
          } else {
            cfg.selectedColumns = cfg.selectedColumns.filter(function(c) { return c !== col; });
          }
          selectedSet[col] = this.checked;
          onChange();
        });

        row.addEventListener('dragstart', function(e) {
          _dtDragSrcIdx = idx;
          e.dataTransfer.effectAllowed = 'move';
          row.style.opacity = '0.5';
        });
        row.addEventListener('dragend', function() {
          _dtDragSrcIdx = null;
          row.style.opacity = '';
          colList.querySelectorAll('[draggable]').forEach(function(r) { r.style.outline = ''; });
        });
        row.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          colList.querySelectorAll('[draggable]').forEach(function(r) { r.style.outline = ''; });
          row.style.outline = '2px solid var(--accent)';
        });
        row.addEventListener('drop', function(e) {
          e.preventDefault();
          colList.querySelectorAll('[draggable]').forEach(function(r) { r.style.outline = ''; });
          if (_dtDragSrcIdx === null || _dtDragSrcIdx === idx) return;
          var moved = orderedCols.splice(_dtDragSrcIdx, 1)[0];
          var insertAt = idx > _dtDragSrcIdx ? idx - 1 : idx;
          orderedCols.splice(insertAt, 0, moved);
          _dtDragSrcIdx = null;
          var currentChecked = {};
          cfg.selectedColumns.forEach(function(c) { currentChecked[c] = true; });
          cfg.selectedColumns = orderedCols.filter(function(c) { return currentChecked[c]; });
          rebuild();
          onChange();
        });
      });

      secHeader.querySelector('.vt-dt-sel-all').addEventListener('click', function() {
        cfg.selectedColumns = cols.slice();
        rebuild();
        onChange();
      });
      secHeader.querySelector('.vt-dt-clr-all').addEventListener('click', function() {
        cfg.selectedColumns = [];
        rebuild();
        onChange();
      });

      // DISPLAY section
      var dispSec = document.createElement('div');
      dispSec.className = 'vt-config-section';
      dispSec.innerHTML =
        '<span class="vt-config-label">Display</span>' +
        '<div class="form-row"><label>Max rows</label>' +
          '<input type="number" class="vt-dt-maxrows" value="' + (cfg.maxRows || 200) + '" min="1" max="1000" style="width:100%"></div>' +
        '<div class="form-row form-row-inline" style="margin-bottom:6px"><label>' +
          '<input type="checkbox" class="vt-dt-rownums"' + (cfg.showRowNumbers ? ' checked' : '') + '> Show row numbers' +
        '</label></div>' +
        '<div class="form-row form-row-inline"><label>' +
          '<input type="checkbox" class="vt-dt-search"' + (cfg.enableSearch ? ' checked' : '') + '> Enable search' +
        '</label></div>';
      el.appendChild(dispSec);

      dispSec.querySelector('.vt-dt-maxrows').addEventListener('change', function() {
        cfg.maxRows = Math.max(1, Math.min(1000, parseInt(this.value) || 200));
        this.value = cfg.maxRows;
        onChange();
      });
      dispSec.querySelector('.vt-dt-rownums').addEventListener('change', function() {
        cfg.showRowNumbers = this.checked;
        onChange();
      });
      dispSec.querySelector('.vt-dt-search').addEventListener('change', function() {
        cfg.enableSearch = this.checked;
        onChange();
      });
    }

    rebuild();
    return el;
  }

  // ── FILTER_WIDGET config builder ──────────────────────────────────────────────
  function _vtBuildFilterWidgetConfig(viz, cols, onChange) {
    viz.config = viz.config || {};
    var cfg = viz.config;
    var el = document.createElement('div');

    function colSel(id, selected) {
      return '<select id="' + id + '" style="width:100%"><option value="">-- select --</option>' +
        cols.map(function(c) { return '<option value="' + _vtEsc(c) + '"' + (c === selected ? ' selected' : '') + '>' + _vtEsc(c) + '</option>'; }).join('') + '</select>';
    }

    var style = cfg.style || 'dropdown';
    el.innerHTML =
      '<div class="vt-config-section"><span class="vt-config-label">Filter</span>' +
        '<div class="form-row"><label>Field</label>' + colSel('vcfw-field', cfg.field || '') + '</div>' +
        '<div class="form-row"><label>Style</label><div style="display:flex;gap:12px">' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcfw-style" value="dropdown"' + (style !== 'chips' ? ' checked' : '') + '> Dropdown</label>' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:normal"><input type="radio" name="vcfw-style" value="chips"' + (style === 'chips' ? ' checked' : '') + '> Chips</label>' +
        '</div></div>' +
        '<div class="form-row"><label>Label <span style="color:var(--text-faint);font-weight:normal">(optional)</span></label>' +
          '<input id="vcfw-label" type="text" value="' + _vtEsc(cfg.label || '') + '" placeholder="Defaults to field name" style="width:100%"></div>' +
        '<div class="form-row" id="vcfw-search-row" style="' + (style === 'chips' ? 'display:none' : '') + '"><label style="display:flex;align-items:center;gap:6px;font-weight:normal">' +
          '<input type="checkbox" id="vcfw-searchable"' + (cfg.searchable !== false ? ' checked' : '') + '> Searchable (dropdown panel)' +
        '</label></div>' +
      '</div>';

    var searchRow = el.querySelector('#vcfw-search-row');
    el.querySelector('#vcfw-field').addEventListener('change', function() { cfg.field = this.value; onChange(); });
    el.querySelector('#vcfw-label').addEventListener('input', function() { cfg.label = this.value; onChange(); });
    el.querySelector('#vcfw-searchable').addEventListener('change', function() { cfg.searchable = this.checked; onChange(); });
    el.querySelectorAll('input[name="vcfw-style"]').forEach(function(r) {
      r.addEventListener('change', function() {
        cfg.style = this.value;
        searchRow.style.display = this.value === 'chips' ? 'none' : '';
        onChange();
      });
    });

    return el;
  }

  // ── FILTER_WIDGET live preview ────────────────────────────────────────────
  function _vtRenderFilterWidgetPreview(container, viz, rows) {
    var cfg = viz.config || {};
    var style = cfg.style || 'chips';
    var label = cfg.label || cfg.field || 'Field';
    var field = cfg.field;

    if (style === 'dropdown') {
      container.innerHTML =
        '<div class="vt-fw-preview">' +
          '<button class="vt-fw-preview-btn" disabled>' + _vtEsc(label) + ' ▾</button>' +
          '<p class="vt-fw-preview-note">Opens a multi-select panel in the Dashboard</p>' +
        '</div>';
      return;
    }

    // Chips style
    var uniqueVals = null;
    if (rows && rows.length && field) {
      var seen = {};
      uniqueVals = [];
      rows.forEach(function(row) {
        if (row[field] !== undefined) {
          var v = String(row[field]);
          if (!seen[v]) { seen[v] = true; uniqueVals.push(v); }
        }
      });
    }

    var MAX = 6;
    var html = '<div class="vt-fw-preview"><span class="vt-fw-preview-label">' + _vtEsc(label) + ':</span>';

    if (!uniqueVals) {
      ['Value 1', 'Value 2', 'Value 3'].forEach(function(v) {
        html += '<span class="vt-fw-preview-chip vt-fw-preview-chip-muted">' + _vtEsc(v) + '</span>';
      });
      html += '<span class="vt-fw-preview-more">Bind a snapshot to see real values</span>';
    } else if (uniqueVals.length === 0) {
      html += '<span class="vt-fw-preview-more">No values found for this field</span>';
    } else {
      var shown = uniqueVals.slice(0, MAX);
      var remainder = uniqueVals.length - shown.length;
      shown.forEach(function(v) {
        html += '<span class="vt-fw-preview-chip">' + _vtEsc(v) + '</span>';
      });
      if (remainder > 0) {
        html += '<span class="vt-fw-preview-more">+' + remainder + ' more</span>';
      }
    }

    html += '</div>';
    container.innerHTML = html;
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

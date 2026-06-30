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
    switch (viz.type) {
      case 'BAR_VERTICAL':  _vtRenderBarVertical(viz, rows, container); break;
      case 'LINE':          _vtRenderLine(viz, rows, container); break;
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
      </div>
      ${_vtBuildTypeConfig(viz, cols)}
      <div style="padding:10px 12px">
        <button class="btn-primary" id="vc-apply" style="width:100%;padding:7px">Apply</button>
      </div>`;

    document.getElementById('vc-label').addEventListener('input', function(e) { viz.label = e.target.value; });
    document.getElementById('vc-snap').addEventListener('change', function(e) { viz.snapshotName = e.target.value; });
    document.getElementById('vc-apply').addEventListener('click', function() {
      _vtSaveConfigFromForm(viz, configEl);
      window.DWBShell.markDirty();
      _vtRenderCanvas();
    });
  }

  function _vtBuildTypeConfig(viz, cols) {
    const cfg = viz.config || {};
    const colOpts = ['<option value="">-- select --</option>'].concat(cols.map(function(c) {
      return '<option value="' + _vtEsc(c) + '">' + _vtEsc(c) + '</option>';
    })).join('');
    const aggOpts = [['sum','Sum'],['count','Count'],['average','Average']].map(function(a) {
      return '<option value="' + a[0] + '"' + (cfg.aggregation === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
    }).join('');

    if (viz.type === 'BAR_VERTICAL' || viz.type === 'LINE') {
      return `<div class="vt-config-section">
        <span class="vt-config-label">Chart Settings</span>
        <div class="form-row"><label>Category field</label>
          <select id="vc-cat" style="width:100%">${colOpts.replace('value="' + _vtEsc(cfg.categoryField||'') + '"', 'value="' + _vtEsc(cfg.categoryField||'') + '" selected')}</select></div>
        <div class="form-row"><label>Value field</label>
          <select id="vc-val" style="width:100%">${colOpts.replace('value="' + _vtEsc(cfg.valueField||'') + '"', 'value="' + _vtEsc(cfg.valueField||'') + '" selected')}</select></div>
        <div class="form-row"><label>Aggregation</label>
          <select id="vc-agg" style="width:100%">${aggOpts}</select></div>
      </div>`;
    }
    if (viz.type === 'KPI_STAT') {
      return `<div class="vt-config-section">
        <span class="vt-config-label">KPI Settings</span>
        <div class="form-row"><label>Value field</label>
          <select id="vc-val" style="width:100%">${colOpts}</select></div>
        <div class="form-row"><label>Aggregation</label>
          <select id="vc-agg" style="width:100%">${aggOpts}</select></div>
        <div class="form-row"><label>Prefix</label>
          <input id="vc-prefix" type="text" value="${_vtEsc(cfg.prefix||'')}" style="width:100%" placeholder="$"></div>
        <div class="form-row"><label>Suffix</label>
          <input id="vc-suffix" type="text" value="${_vtEsc(cfg.suffix||'')}" style="width:100%" placeholder="%"></div>
        <div class="form-row"><label>Decimals</label>
          <input id="vc-decimals" type="number" value="${cfg.decimals||0}" min="0" max="4" style="width:100%"></div>
      </div>`;
    }
    return '<div class="vt-config-section"><span style="font-size:12px;color:var(--text-muted)">No additional config for ' + viz.type + '.</span></div>';
  }

  function _vtSaveConfigFromForm(viz, el) {
    viz.config = viz.config || {};
    const cat  = el.querySelector('#vc-cat');
    const val  = el.querySelector('#vc-val');
    const agg  = el.querySelector('#vc-agg');
    const pre  = el.querySelector('#vc-prefix');
    const suf  = el.querySelector('#vc-suffix');
    const dec  = el.querySelector('#vc-decimals');
    if (cat) viz.config.categoryField = cat.value;
    if (val) viz.config.valueField    = val.value;
    if (agg) viz.config.aggregation   = agg.value;
    if (pre) viz.config.prefix        = pre.value;
    if (suf) viz.config.suffix        = suf.value;
    if (dec) viz.config.decimals      = parseInt(dec.value, 10) || 0;
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

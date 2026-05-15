'use strict';

// ─── Global helpers (callable from inline HTML event handlers) ────────────────

DWB._lc_addSeries = function (elementId) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  cfg.series = cfg.series || [];
  cfg.series.push(_lcDefaultSeries());
  DWB.viz.renderSidebar(elementId);
  DWB.viz.renderElement(elementId);
};

DWB._lc_removeSeries = function (elementId, idx) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  if (!cfg.series || cfg.series.length <= 1) return;
  cfg.series.splice(idx, 1);
  DWB.viz.renderSidebar(elementId);
  DWB.viz.renderElement(elementId);
};

DWB._lc_setSeries = function (elementId, idx, key, value) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  if (!cfg.series || !cfg.series[idx]) return;
  cfg.series[idx][key] = value;
  if (key === 'yAxis') DWB.viz.renderSidebar(elementId);
  DWB.viz.renderElement(elementId);
};

DWB._lc_setSeriesCol = function (elementId, idx, colStr) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  if (!cfg.series || !cfg.series[idx]) return;
  cfg.series[idx].col = colStr === '' ? null : parseInt(colStr);
  DWB.viz.renderSidebar(elementId);
  DWB.viz.renderElement(elementId);
};

DWB._lc_setField = function (elementId, key, value) {
  DWB.updateConfig_viz(elementId, key, value);
  DWB.viz.renderElement(elementId);
};

// ─── Module-level helpers ─────────────────────────────────────────────────────

function _lcDefaultSeries() {
  return { col: null, label: '', yAxis: 'left', smooth: false, showSymbol: true, fill: false };
}

function _lcGetSeries(cfg) {
  return (cfg.series && cfg.series.length > 0) ? cfg.series : [_lcDefaultSeries()];
}

function _lcEscHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Element registration ─────────────────────────────────────────────────────

DWB.registerElement('LINE_CHART', {
  title: 'Line Chart',
  icon: '📉',
  category: 'Charts',
  desc: 'Multi-series line chart with dual Y axis, smooth curves, area fill, and per-series configuration.',
  headerCompatible: false,
  columnAffinity: { primary: ['number', 'date', 'categorical'] },

  _palette: ['#1B3A6B', '#E67E22', '#27AE60', '#8E44AD', '#E74C3C', '#1ABC9C'],

  renderConfig(element, dataset) {
    const cfg     = element.config || {};
    const eid     = element.id;
    const headers = dataset ? dataset.headers : [];

    if (!cfg.series || cfg.series.length === 0) cfg.series = [_lcDefaultSeries()];
    const series = cfg.series;

    const colOpts = (selectedIdx) => headers.map((h, i) =>
      `<option value="${i}" ${selectedIdx === i ? 'selected' : ''}>${_lcEscHtml(h)}</option>`
    ).join('');

    const seriesHtml = series.map((s, i) => {
      const colName    = (s.col !== null && s.col !== undefined && headers[s.col]) ? headers[s.col] : `Series ${i + 1}`;
      const labelVal   = _lcEscHtml(s.label || '');
      const canRemove  = series.length > 1;

      return `
        <div style="border:1px solid var(--border);border-radius:4px;padding:8px 10px;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <select class="sidebar-input" style="flex:1;margin-bottom:0"
              onchange="DWB._lc_setSeriesCol('${eid}',${i},this.value)">
              <option value="">— select column —</option>${colOpts(s.col)}
            </select>
            <button style="padding:2px 8px;font-size:13px;background:transparent;border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--danger,#dc2626);line-height:1"
              ${canRemove ? '' : 'disabled'}
              onclick="DWB._lc_removeSeries('${eid}',${i})">×</button>
          </div>
          <div style="margin-bottom:6px">
            <label class="sidebar-label">Series label</label>
            <input type="text" class="sidebar-input" value="${labelVal}" placeholder="${_lcEscHtml(colName)}"
              oninput="DWB._lc_setSeries('${eid}',${i},'label',this.value)">
          </div>
          <div class="dwb-config-inline" style="margin-bottom:4px">
            <div>
              <label class="sidebar-label">Y axis</label>
              <select class="sidebar-input" onchange="DWB._lc_setSeries('${eid}',${i},'yAxis',this.value)">
                <option value="left" ${(s.yAxis || 'left') === 'left' ? 'selected' : ''}>Left</option>
                <option value="right" ${s.yAxis === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
            <div>
              <label class="sidebar-label">Line style</label>
              <select class="sidebar-input" onchange="DWB._lc_setSeries('${eid}',${i},'smooth',this.value==='smooth')">
                <option value="straight" ${!s.smooth ? 'selected' : ''}>Straight</option>
                <option value="smooth" ${s.smooth ? 'selected' : ''}>Smooth</option>
              </select>
            </div>
          </div>
          <label class="sidebar-checkbox-item">
            <input type="checkbox" ${s.showSymbol !== false ? 'checked' : ''}
              onchange="DWB._lc_setSeries('${eid}',${i},'showSymbol',this.checked)">
            Show data point markers
          </label>
          <label class="sidebar-checkbox-item">
            <input type="checkbox" ${s.fill ? 'checked' : ''}
              onchange="DWB._lc_setSeries('${eid}',${i},'fill',this.checked)">
            Fill area under line
          </label>
        </div>`;
    }).join('');

    const hasRightAxis = series.some(s => s.yAxis === 'right');
    const leftYLabel   = _lcEscHtml(cfg.leftYLabel  || '');
    const rightYLabel  = _lcEscHtml(cfg.rightYLabel || '');
    const showLegend   = cfg.showLegend !== false;
    const chartTitle   = _lcEscHtml(cfg.chartTitle  || '');

    return `
      <div class="dwb-config-group">
        <label class="sidebar-label">X axis column</label>
        <select class="sidebar-input" onchange="DWB._lc_setField('${eid}','xCol',this.value===''?null:parseInt(this.value))">
          <option value="">— none —</option>${colOpts(cfg.xCol)}
        </select>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-label">Series</label>
        ${seriesHtml}
        <button style="width:100%;margin-top:2px;background:transparent;border:1px dashed var(--border);border-radius:4px;cursor:pointer;color:var(--text-muted);font-size:12px;padding:5px 0"
          onclick="DWB._lc_addSeries('${eid}')">+ Add Series</button>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-label">Left Y axis label</label>
        <input type="text" class="sidebar-input" value="${leftYLabel}" placeholder="(optional)"
          oninput="DWB._lc_setField('${eid}','leftYLabel',this.value)">
      </div>
      ${hasRightAxis ? `
      <div class="dwb-config-group">
        <label class="sidebar-label">Right Y axis label</label>
        <input type="text" class="sidebar-input" value="${rightYLabel}" placeholder="(optional)"
          oninput="DWB._lc_setField('${eid}','rightYLabel',this.value)">
      </div>` : ''}
      <div class="dwb-config-group">
        <label class="sidebar-label">Chart title</label>
        <input type="text" class="sidebar-input" value="${chartTitle}" placeholder="(optional)"
          oninput="DWB._lc_setField('${eid}','chartTitle',this.value)">
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-checkbox-item">
          <input type="checkbox" ${showLegend ? 'checked' : ''}
            onchange="DWB._lc_setField('${eid}','showLegend',this.checked)">
          Show legend
        </label>
      </div>`;
  },

  render(element, dataset, filters) {
    const container = document.getElementById('element-content-' + element.id);
    if (!container) return;

    if (!dataset || !dataset.rows || dataset.rows.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">No data available.</div>';
      return;
    }

    const cfg = element.config || {};
    if (!cfg.series || cfg.series.length === 0) cfg.series = [_lcDefaultSeries()];

    const xIdx = cfg.xCol !== undefined && cfg.xCol !== null ? cfg.xCol : null;

    if (xIdx === null) {
      container.innerHTML = '<div class="dwb-empty-state">Select an X axis column.</div>';
      return;
    }

    const activeSeries = cfg.series.filter(s => s.col !== null && s.col !== undefined);

    if (activeSeries.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">Add at least one series column.</div>';
      return;
    }

    if (!window.echarts) {
      container.innerHTML = '<div class="dwb-empty-state">ECharts not loaded.</div>';
      return;
    }

    if (element._instance) {
      element._instance.dispose();
      element._instance = null;
    }
    if (element._resizeObs instanceof ResizeObserver) { element._resizeObs.disconnect(); }
    element._resizeObs = null;

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    element._instance = chart;

    const cs = getComputedStyle(document.documentElement);
    const labelColor  = cs.getPropertyValue('--text-main').trim()  || '#1e293b';
    const borderColor = cs.getPropertyValue('--border').trim()      || '#e2e8f0';
    const bgColor     = cs.getPropertyValue('--bg-surface').trim()  || '#ffffff';

    const xCategories  = dataset.rows.map(row => String(row[xIdx] ?? ''));
    const hasRightAxis = activeSeries.some(s => s.yAxis === 'right');

    const chartSeries = activeSeries.map((s, i) => {
      const name = s.label || dataset.headers[s.col] || ('Series ' + (i + 1));
      return {
        type: 'line',
        name,
        smooth: s.smooth || false,
        showSymbol: s.showSymbol !== false,
        yAxisIndex: (hasRightAxis && s.yAxis === 'right') ? 1 : 0,
        areaStyle: s.fill ? { opacity: 0.2 } : null,
        data: dataset.rows.map(row => {
          const v = parseFloat(row[s.col]);
          return isNaN(v) ? null : v;
        }),
        connectNulls: false
      };
    });

    const yAxes = [{
      type: 'value',
      name: cfg.leftYLabel || '',
      nameTextStyle: { color: labelColor, fontSize: 11 },
      axisLabel: { color: labelColor, fontSize: 11 },
      axisLine: { lineStyle: { color: borderColor } },
      splitLine: { lineStyle: { color: borderColor } }
    }];

    if (hasRightAxis) {
      yAxes.push({
        type: 'value',
        name: cfg.rightYLabel || '',
        nameTextStyle: { color: labelColor, fontSize: 11 },
        position: 'right',
        axisLabel: { color: labelColor, fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: borderColor } },
        splitLine: { show: false }
      });
    }

    const showLegend = cfg.showLegend !== false;
    const titleText  = cfg.chartTitle || '';
    const topPad     = titleText ? 44 : (showLegend ? 40 : 12);
    const bottomPad  = showLegend ? 40 : 12;

    chart.setOption({
      color: this._palette,
      backgroundColor: 'transparent',
      ...(titleText ? {
        title: {
          text: titleText, left: 'center', top: 8,
          textStyle: { color: labelColor, fontSize: 13, fontWeight: 600 }
        }
      } : {}),
      tooltip: {
        trigger: 'axis',
        backgroundColor: bgColor,
        borderColor: borderColor,
        textStyle: { color: labelColor }
      },
      legend: showLegend ? {
        type: 'scroll',
        bottom: 4,
        textStyle: { color: labelColor, fontSize: 11 }
      } : { show: false },
      grid: {
        left: '2%',
        right: hasRightAxis ? '6%' : '2%',
        top: topPad,
        bottom: bottomPad,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xCategories,
        axisLabel: { color: labelColor, fontSize: 11 },
        axisLine: { lineStyle: { color: borderColor } },
        splitLine: { lineStyle: { color: borderColor } }
      },
      yAxis: yAxes,
      series: chartSeries
    });

    element._resizeObs = new ResizeObserver(() => {
      if (element._instance && !element._instance.isDisposed()) {
        element._instance.resize();
      }
    });
    element._resizeObs.observe(container);
  },

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
    const x    = cfg.xCol !== undefined && cfg.xCol !== null ? dataset.headers[cfg.xCol] : '(unset)';
    const cols = _lcGetSeries(cfg)
      .filter(s => s.col !== null && s.col !== undefined)
      .map(s => s.label || dataset.headers[s.col] || s.col)
      .join(', ');
    return `Line Chart: x=${x}, series=[${cols}], rows=${dataset.rowCount}.`;
  },

  getEchartsInstance(element) { return element._instance || null; }
});

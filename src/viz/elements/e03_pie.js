DWB.registerElement('PIE', {
  title: 'Pie / Donut Chart',
  icon: '🥧',
  category: 'Charts',
  desc: 'Pie or donut chart with aggregation and click-to-filter.',
  headerCompatible: false,
  columnAffinity: { primary: ['categorical', 'text'] },

  _colorSchemes: {
    navy:    ['#1B3A6B','#005EB8','#4A90D9','#7BB3E8','#A8CFEF','#C8E0F7'],
    warm:    ['#C0392B','#E67E22','#F1C40F','#27AE60','#2980B9','#8E44AD'],
    cool:    ['#2C3E50','#2980B9','#1ABC9C','#3498DB','#27AE60','#16A085'],
    mono:    ['#1B3A6B','#2D5FA0','#4A82C8','#6FA0D8','#96BBE4','#BDD3F0'],
    golden:  ['#B8860B','#DAA520','#F0C040','#C8A200','#A07800','#805800'],
  },

  renderConfig(element, dataset) {
    const cfg     = element.config || {};
    const headers = dataset ? dataset.headers : [];

    const colOpts = (name) => headers.map((h, i) =>
      `<option value="${i}" ${cfg[name] === i ? 'selected' : ''}>${h}</option>`
    ).join('');

    const aggOpts = ['count','sum','avg'].map(a =>
      `<option value="${a}" ${(cfg.aggregation||'count') === a ? 'selected' : ''}>${a.toUpperCase()}</option>`
    ).join('');

    const schemeOpts = Object.keys(this._colorSchemes).map(k =>
      `<option value="${k}" ${(cfg.colorScheme||'navy') === k ? 'selected' : ''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`
    ).join('');

    const radius   = cfg.radius   !== undefined ? cfg.radius   : 0;
    const maxSlices = cfg.maxSlices !== undefined ? cfg.maxSlices : 12;
    const showLabels = cfg.showLabels !== false;

    return `
      <div class="dwb-config-group">
        <label class="sidebar-label">Category column</label>
        <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','categoryCol',parseInt(this.value))">
          <option value="">— none —</option>${colOpts('categoryCol')}
        </select>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-label">Value column</label>
        <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','valueCol',this.value===''?null:parseInt(this.value))">
          <option value="">— none (count) —</option>${colOpts('valueCol')}
        </select>
      </div>
      <div class="dwb-config-group dwb-config-inline">
        <div>
          <label class="sidebar-label">Aggregation</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','aggregation',this.value)">${aggOpts}</select>
        </div>
        <div>
          <label class="sidebar-label">Color scheme</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','colorScheme',this.value)">${schemeOpts}</select>
        </div>
      </div>
      <div class="dwb-config-group dwb-config-inline">
        <div>
          <label class="sidebar-label">Inner radius % (0=pie)</label>
          <input type="number" class="sidebar-input" value="${radius}" min="0" max="80" step="5"
            oninput="DWB.updateConfig_viz('${element.id}','radius',parseInt(this.value)||0)">
        </div>
        <div>
          <label class="sidebar-label">Max slices</label>
          <input type="number" class="sidebar-input" value="${maxSlices}" min="2" max="50"
            oninput="DWB.updateConfig_viz('${element.id}','maxSlices',parseInt(this.value)||12)">
        </div>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-checkbox-item">
          <input type="checkbox" ${showLabels ? 'checked' : ''}
            onchange="DWB.updateConfig_viz('${element.id}','showLabels',this.checked)">
          Show slice labels
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

    const cfg       = element.config || {};
    const catIdx    = cfg.categoryCol !== undefined && cfg.categoryCol !== null ? cfg.categoryCol : null;
    const valIdx    = cfg.valueCol    !== undefined && cfg.valueCol    !== null ? cfg.valueCol    : null;
    const agg       = cfg.aggregation || 'count';
    const scheme    = this._colorSchemes[cfg.colorScheme || 'navy'];
    const innerR    = cfg.radius    !== undefined ? cfg.radius    : 0;
    const maxSlices = cfg.maxSlices !== undefined ? cfg.maxSlices : 12;

    if (catIdx === null) {
      container.innerHTML = '<div class="dwb-empty-state">Select a category column.</div>';
      return;
    }

    const buckets = {};
    for (const row of dataset.rows) {
      const key = String(row[catIdx] ?? '(blank)');
      const num = valIdx !== null ? parseFloat(row[valIdx]) : NaN;
      if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
      buckets[key].count++;
      if (!isNaN(num)) buckets[key].sum += num;
    }

    let data = Object.entries(buckets).map(([name, b]) => {
      const value = agg === 'sum' ? b.sum : agg === 'avg' ? (b.count ? b.sum / b.count : 0) : b.count;
      return { name, value };
    }).sort((a, b) => b.value - a.value);

    // Roll up tail into "Other"
    if (data.length > maxSlices) {
      const tail  = data.slice(maxSlices - 1);
      const other = tail.reduce((s, d) => s + d.value, 0);
      data = data.slice(0, maxSlices - 1);
      data.push({ name: `Other (${tail.length})`, value: other });
    }

    if (!window.echarts) {
      container.innerHTML = '<div class="dwb-empty-state">ECharts not loaded.</div>';
      return;
    }

    container.style.minHeight = '200px';

    if (element._instance) { element._instance.dispose(); element._instance = null; }
    if (element._resizeObs) { element._resizeObs.disconnect(); element._resizeObs = null; }

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    element._instance = chart;

    const catCol = dataset.headers[catIdx];
    const outerR = '70%';
    const innerRStr = innerR > 0 ? innerR + '%' : '0';

    chart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: p => `${p.name}<br/>${p.value} (${p.percent}%)`
      },
      legend: { show: false },
      color: scheme,
      series: [{
        type: 'pie',
        radius: [innerRStr, outerR],
        center: ['50%', '50%'],
        data: data.map(d => ({ name: d.name, value: d.value })),
        label: cfg.showLabels !== false
          ? { show: true, fontSize: 10, formatter: '{b}: {d}%' }
          : { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
        }
      }]
    });

    chart.on('click', params => {
      if (params.componentType === 'series' && params.name !== `Other (${data.length})`) {
        DWB.viz.addFilter(catCol, params.name, element.id);
      }
    });

    element._resizeObs = new ResizeObserver(() => {
      if (element._instance && !element._instance.isDisposed()) element._instance.resize();
    });
    element._resizeObs.observe(container);
  },

  onFilterChange(element, dataset, filters) { this.render(element, dataset, filters); },

  onThemeChange(element) {
    if (element._instance && !element._instance.isDisposed()) element._instance.resize();
  },

  getPromptContext(element, dataset, filters) {
    if (!dataset) return 'No data.';
    const cfg = element.config || {};
    const cat = cfg.categoryCol !== undefined ? dataset.headers[cfg.categoryCol] : '(unset)';
    return `Pie chart: category=${cat}, agg=${cfg.aggregation||'count'}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance(element) { return element._instance || null; }
});

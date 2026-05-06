DWB.registerElement('BAR_V', {
  title: 'Bar Chart (Vertical)',
  icon: '📈',
  category: 'Charts',
  desc: 'Vertical bar chart with aggregation, sort, and click-to-filter.',
  headerCompatible: false,
  columnAffinity: { primary: ['categorical', 'text', 'number'] },

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

    const aggOpts = ['count','sum','avg','min','max'].map(a =>
      `<option value="${a}" ${(cfg.aggregation||'count') === a ? 'selected' : ''}>${a.toUpperCase()}</option>`
    ).join('');

    const sortOpts = [['value-desc','Value ↓'],['value-asc','Value ↑'],['label-asc','Label A–Z'],['label-desc','Label Z–A']].map(([v,l]) =>
      `<option value="${v}" ${(cfg.sort||'value-desc') === v ? 'selected' : ''}>${l}</option>`
    ).join('');

    const schemeOpts = Object.keys(this._colorSchemes).map(k =>
      `<option value="${k}" ${(cfg.colorScheme||'navy') === k ? 'selected' : ''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`
    ).join('');

    const maxItems   = cfg.maxItems   !== undefined ? cfg.maxItems   : 20;
    const showValues = cfg.showValues !== false;
    const labelRotate = cfg.labelRotate !== undefined ? cfg.labelRotate : 45;

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
          <label class="sidebar-label">Sort</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','sort',this.value)">${sortOpts}</select>
        </div>
      </div>
      <div class="dwb-config-group dwb-config-inline">
        <div>
          <label class="sidebar-label">Color scheme</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','colorScheme',this.value)">${schemeOpts}</select>
        </div>
        <div>
          <label class="sidebar-label">Max bars</label>
          <input type="number" class="sidebar-input" value="${maxItems}" min="1" max="200"
            oninput="DWB.updateConfig_viz('${element.id}','maxItems',parseInt(this.value)||20)">
        </div>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-label">Label rotation (°)</label>
        <input type="number" class="sidebar-input" value="${labelRotate}" min="0" max="90" step="15"
          oninput="DWB.updateConfig_viz('${element.id}','labelRotate',parseInt(this.value)||0)">
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-checkbox-item">
          <input type="checkbox" ${showValues ? 'checked' : ''}
            onchange="DWB.updateConfig_viz('${element.id}','showValues',this.checked)">
          Show value labels
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

    const cfg      = element.config || {};
    const catIdx   = cfg.categoryCol !== undefined && cfg.categoryCol !== null ? cfg.categoryCol : null;
    const valIdx   = cfg.valueCol    !== undefined && cfg.valueCol    !== null ? cfg.valueCol    : null;
    const agg      = cfg.aggregation || 'count';
    const sort     = cfg.sort || 'value-desc';
    const scheme   = this._colorSchemes[cfg.colorScheme || 'navy'];
    const maxItems = cfg.maxItems || 20;
    const labelRotate = cfg.labelRotate !== undefined ? cfg.labelRotate : 45;

    if (catIdx === null) {
      container.innerHTML = '<div class="dwb-empty-state">Select a category column.</div>';
      return;
    }

    // Aggregate
    const buckets = {};
    for (const row of dataset.rows) {
      const key = String(row[catIdx] ?? '(blank)');
      const num = valIdx !== null ? parseFloat(row[valIdx]) : NaN;
      if (!buckets[key]) buckets[key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
      const b = buckets[key];
      b.count++;
      if (!isNaN(num)) { b.sum += num; b.min = Math.min(b.min, num); b.max = Math.max(b.max, num); }
    }

    let data = Object.entries(buckets).map(([label, b]) => {
      let value;
      switch (agg) {
        case 'sum':   value = b.sum; break;
        case 'avg':   value = b.count > 0 ? b.sum / b.count : 0; break;
        case 'min':   value = isFinite(b.min) ? b.min : 0; break;
        case 'max':   value = isFinite(b.max) ? b.max : 0; break;
        default:      value = b.count;
      }
      return { label, value };
    });

    // Sort
    if (sort === 'value-desc') data.sort((a, b) => b.value - a.value);
    else if (sort === 'value-asc') data.sort((a, b) => a.value - b.value);
    else if (sort === 'label-asc') data.sort((a, b) => a.label.localeCompare(b.label));
    else if (sort === 'label-desc') data.sort((a, b) => b.label.localeCompare(a.label));

    data = data.slice(0, maxItems);

    if (!window.echarts) {
      container.innerHTML = '<div class="dwb-empty-state">ECharts not loaded.</div>';
      return;
    }

    const bottomPad = labelRotate > 0 ? Math.round(labelRotate * 1.4) : 24;
    container.style.minHeight = '200px';

    if (element._instance) {
      element._instance.dispose();
      element._instance = null;
    }
    if (element._resizeObs) { element._resizeObs.disconnect(); element._resizeObs = null; }

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    element._instance = chart;

    const catCol = dataset.headers[catIdx];
    const colors = data.map((_, i) => scheme[i % scheme.length]);

    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '2%', right: '2%', top: cfg.showValues !== false ? 28 : 12, bottom: bottomPad, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(d => d.label),
        axisLabel: {
          fontSize: 11,
          rotate: labelRotate,
          width: 80,
          overflow: 'truncate',
          interval: 0
        }
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar',
        data: data.map((d, i) => ({ value: d.value, itemStyle: { color: colors[i] } })),
        label: cfg.showValues !== false
          ? { show: true, position: 'top', fontSize: 10,
              formatter: p => typeof p.value === 'number' && !Number.isInteger(p.value)
                ? p.value.toFixed(2) : String(p.value) }
          : { show: false }
      }]
    });

    chart.on('click', params => {
      if (params.componentType === 'series') {
        DWB.viz.addFilter(catCol, params.name, element.id);
      }
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
    if (element._instance && !element._instance.isDisposed()) {
      element._instance.resize();
    }
  },

  getPromptContext(element, dataset, filters) {
    if (!dataset) return 'No data.';
    const cfg = element.config || {};
    const cat = cfg.categoryCol !== undefined ? dataset.headers[cfg.categoryCol] : '(unset)';
    const val = cfg.valueCol    !== undefined ? dataset.headers[cfg.valueCol]    : 'count';
    return `Vertical Bar: category=${cat}, value=${val}, agg=${cfg.aggregation||'count'}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance(element) { return element._instance || null; }
});

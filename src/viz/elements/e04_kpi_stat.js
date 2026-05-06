DWB.registerElement('KPI_STAT', {
  title: 'KPI Stat',
  icon: '🔢',
  category: 'Data',
  desc: 'Single metric card: aggregate a column and display as a large statistic.',
  headerCompatible: true,
  columnAffinity: { primary: ['number'] },

  renderConfig(element, dataset) {
    const cfg     = element.config || {};
    const headers = dataset ? dataset.headers : [];

    const colOpts = headers.map((h, i) =>
      `<option value="${i}" ${cfg.valueCol === i ? 'selected' : ''}>${h}</option>`
    ).join('');

    const aggOpts = ['count','sum','avg','min','max','distinct'].map(a =>
      `<option value="${a}" ${(cfg.aggregation||'count') === a ? 'selected' : ''}>${a.toUpperCase()}</option>`
    ).join('');

    const fmtOpts = [['auto','Auto'],['number','Number'],['currency','Currency ($)'],['percent','Percent (%)'],['compact','Compact (1.2K)']].map(([v,l]) =>
      `<option value="${v}" ${(cfg.format||'auto') === v ? 'selected' : ''}>${l}</option>`
    ).join('');

    const prefix = cfg.prefix || '';
    const suffix = cfg.suffix || '';
    const showLabel = cfg.showLabel !== false;

    return `
      <div class="dwb-config-group">
        <label class="sidebar-label">Value column</label>
        <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','valueCol',this.value===''?null:parseInt(this.value))">
          <option value="">— none —</option>${colOpts}
        </select>
      </div>
      <div class="dwb-config-group dwb-config-inline">
        <div>
          <label class="sidebar-label">Aggregation</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','aggregation',this.value)">${aggOpts}</select>
        </div>
        <div>
          <label class="sidebar-label">Format</label>
          <select class="sidebar-input" onchange="DWB.updateConfig_viz('${element.id}','format',this.value)">${fmtOpts}</select>
        </div>
      </div>
      <div class="dwb-config-group dwb-config-inline">
        <div>
          <label class="sidebar-label">Prefix</label>
          <input type="text" class="sidebar-input" value="${prefix.replace(/"/g,'&quot;')}" placeholder="e.g. $"
            oninput="DWB.updateConfig_viz('${element.id}','prefix',this.value)">
        </div>
        <div>
          <label class="sidebar-label">Suffix</label>
          <input type="text" class="sidebar-input" value="${suffix.replace(/"/g,'&quot;')}" placeholder="e.g. %"
            oninput="DWB.updateConfig_viz('${element.id}','suffix',this.value)">
        </div>
      </div>
      <div class="dwb-config-group">
        <label class="sidebar-checkbox-item">
          <input type="checkbox" ${showLabel ? 'checked' : ''}
            onchange="DWB.updateConfig_viz('${element.id}','showLabel',this.checked)">
          Show metric label below value
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

    const cfg    = element.config || {};
    const valIdx = cfg.valueCol !== undefined && cfg.valueCol !== null ? cfg.valueCol : null;
    const agg    = cfg.aggregation || 'count';

    let computed;
    let label;

    if (agg === 'count') {
      computed = dataset.rows.length;
      label = 'Row Count';
    } else if (agg === 'distinct' && valIdx !== null) {
      const uniq = new Set(dataset.rows.map(r => r[valIdx]));
      computed = uniq.size;
      label = `Distinct ${dataset.headers[valIdx]}`;
    } else if (valIdx !== null) {
      const nums = dataset.rows.map(r => parseFloat(r[valIdx])).filter(n => !isNaN(n));
      if (nums.length === 0) { computed = 0; }
      else if (agg === 'sum') { computed = nums.reduce((a, b) => a + b, 0); }
      else if (agg === 'avg') { computed = nums.reduce((a, b) => a + b, 0) / nums.length; }
      else if (agg === 'min') { computed = Math.min(...nums); }
      else if (agg === 'max') { computed = Math.max(...nums); }
      label = `${agg.toUpperCase()} of ${dataset.headers[valIdx]}`;
    } else {
      container.innerHTML = '<div class="dwb-empty-state">Select a value column.</div>';
      return;
    }

    const formatted = this._format(computed, cfg.format || 'auto', cfg.prefix || '', cfg.suffix || '');

    container.innerHTML = `
      <div class="dwb-kpi-stat">
        <div class="dwb-kpi-value">${formatted}</div>
        ${cfg.showLabel !== false ? `<div class="dwb-kpi-label">${label}</div>` : ''}
        <div class="dwb-kpi-rows">${dataset.rows.length.toLocaleString()} rows</div>
      </div>`;
  },

  _format(value, fmt, prefix, suffix) {
    let str;
    if (fmt === 'currency') {
      str = '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (fmt === 'percent') {
      str = value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    } else if (fmt === 'compact') {
      str = this._compact(value);
    } else if (fmt === 'number') {
      str = Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      // auto
      str = Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return prefix + str + suffix;
  },

  _compact(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B';
    if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1)  + 'M';
    if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1)  + 'K';
    return sign + abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
  },

  onFilterChange(element, dataset, filters) { this.render(element, dataset, filters); },
  onThemeChange() {},

  getPromptContext(element, dataset, filters) {
    if (!dataset) return 'No data.';
    const cfg = element.config || {};
    const col = cfg.valueCol !== undefined ? dataset.headers[cfg.valueCol] : '(unset)';
    return `KPI Stat: agg=${cfg.aggregation||'count'}, column=${col}, rows=${dataset.rowCount}.`;
  },

  getEchartsInstance() { return null; }
});

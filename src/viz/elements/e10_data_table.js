DWB.registerElement('DATA_TABLE', {
  title: 'Data Table',
  icon: '📋',
  category: 'Data',
  desc: 'Displays filtered data as a formatted, searchable table.',
  headerCompatible: false,
  columnAffinity: { primary: ['text', 'categorical', 'number', 'date'] },

  renderConfig(element, dataset) {
    const cfg     = element.config || {};
    const headers = dataset ? dataset.headers : [];

    const selected = cfg.selectedColumns && cfg.selectedColumns.length > 0
      ? cfg.selectedColumns
      : headers.map((_, i) => i);

    const colChecks = headers.map((h, i) =>
      `<label class="sidebar-checkbox-item">
        <input type="checkbox" ${selected.includes(i) ? 'checked' : ''}
          onchange="DWB.viz._tableToggleCol('${element.id}',${i},this.checked)">
        ${h}
      </label>`
    ).join('');

    const maxRows     = cfg.maxRows !== undefined ? cfg.maxRows : 100;
    const showCount   = cfg.showRowCount !== false;

    return `
      <div style="padding:8px 12px 0">
        <div class="sidebar-label">Columns to display</div>
        <div class="sidebar-checkbox-list" style="margin-bottom:10px">
          ${colChecks || '<span style="color:var(--text-faint);font-size:12px">No dataset loaded</span>'}
        </div>
        <label class="sidebar-label">Max rows</label>
        <input type="number" class="sidebar-input" value="${maxRows}" min="1" max="5000"
          oninput="DWB.updateConfig_viz('${element.id}','maxRows',parseInt(this.value)||100)">
        <label class="sidebar-checkbox-item" style="margin-top:4px">
          <input type="checkbox" ${showCount ? 'checked' : ''}
            onchange="DWB.updateConfig_viz('${element.id}','showRowCount',this.checked)">
          Show row count
        </label>
      </div>`;
  },

  render(element, dataset, filters) {
    const container = document.getElementById('element-content-' + element.id);
    if (!container) return;

    if (!dataset || !dataset.rows || dataset.rows.length === 0) {
      container.innerHTML = '<div class="dwb-empty-state">No data available. Push a dataset from the pipeline.</div>';
      return;
    }

    const cfg     = element.config || {};
    const maxRows = cfg.maxRows || 100;
    const allHdrs = dataset.headers;
    const selCols = (cfg.selectedColumns && cfg.selectedColumns.length > 0)
      ? cfg.selectedColumns.filter(i => i < allHdrs.length)
      : allHdrs.map((_, i) => i);

    const rows    = dataset.rows.slice(0, maxRows);
    const searchId = 'search-' + element.id;
    const tableId  = 'table-'  + element.id;

    let html = '<div class="dwb-table-wrapper"><div class="dwb-table-toolbar">';
    if (cfg.showRowCount !== false) {
      html += `<span class="dwb-row-count">${dataset.rows.length.toLocaleString()} row${dataset.rows.length !== 1 ? 's' : ''}`;
      if (dataset.rows.length > maxRows) html += ` (showing ${maxRows})`;
      html += '</span>';
    } else {
      html += '<span></span>';
    }
    html += `<input type="text" id="${searchId}" class="dwb-search-input" placeholder="Search…"
      oninput="DWB.viz.tableSearch('${element.id}')">`;
    html += '</div>';

    html += `<div class="dwb-table-scroll"><table id="${tableId}" class="dwb-data-table"><thead><tr>`;
    selCols.forEach(ci => { html += `<th>${allHdrs[ci]}</th>`; });
    html += '</tr></thead><tbody>';

    rows.forEach(row => {
      html += '<tr>';
      selCols.forEach(ci => {
        const val = String(row[ci] ?? '');
        html += `<td data-val="${val.replace(/"/g, '&quot;')}">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';
    container.innerHTML = html;
  },

  onFilterChange(element, dataset, filters) {
    DWB.viz._elementRegistry['DATA_TABLE'].render(element, dataset, filters);
  },

  onThemeChange() { /* table uses CSS vars — no action needed */ },

  getPromptContext(element, dataset, filters) {
    if (!dataset) return 'No data.';
    return `Data Table: ${dataset.rowCount} rows, ${dataset.headers.length} columns. ` +
      'Filters: ' + (filters.length ? filters.map(f => `${f.column}=${f.value}`).join(', ') : 'none');
  },

  getEchartsInstance() { return null; }
});

// Helper for updating element config from sidebar without triggering full re-render
DWB.updateConfig_viz = function (elementId, key, value) {
  const found = DWB.viz.findElement(elementId);
  if (found) found.element.config[key] = value;
};

// Helper for toggling column selection in DATA_TABLE config
DWB.viz._tableToggleCol = function (elementId, colIdx, checked) {
  const found = DWB.viz.findElement(elementId);
  if (!found) return;
  const cfg = found.element.config;
  const ds  = DWB.viz.getActiveDataset(found.element);
  if (!cfg.selectedColumns || cfg.selectedColumns.length === 0) {
    cfg.selectedColumns = ds ? ds.headers.map((_, i) => i) : [];
  }
  if (checked) {
    if (!cfg.selectedColumns.includes(colIdx)) cfg.selectedColumns.push(colIdx);
  } else {
    cfg.selectedColumns = cfg.selectedColumns.filter(i => i !== colIdx);
  }
};

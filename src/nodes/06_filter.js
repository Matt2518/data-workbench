DWB.register('FILTER', {
  title: 'Filter Rows',
  icon: '🔍',
  category: 'Row Operations',
  desc: 'Keep only rows matching a condition.',
  implemented: true,
  defaultConfig: { colIndex: 0, operator: 'contains', value: '', caseSensitive: false },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const hideValue = cfg.operator === 'is empty' || cfg.operator === 'is not empty';

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i == cfg.colIndex ? ' selected' : ''}>${h}</option>`
    ).join('');

    const operators = [
      'contains', 'not contains', 'equals', 'not equals',
      'starts with', 'ends with', 'greater than', 'less than',
      'is empty', 'is not empty'
    ];
    const opOpts = operators.map(op =>
      `<option value="${op}"${op === cfg.operator ? ' selected' : ''}>${op}</option>`
    ).join('');

    const status = (node.output && node.status === 'ok')
      ? `<div style="margin-top:8px;font-size:12px;color:var(--success)">✓ ${node.output.rows.length.toLocaleString()} rows kept of ${prevData.rows.length.toLocaleString()} total</div>`
      : node.status === 'error'
        ? `<div style="margin-top:8px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column</label>
          <select id="flt-col-${node.id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Operator</label>
          <select id="flt-op-${node.id}" style="width:100%">${opOpts}</select>
        </div>
        ${!hideValue ? `
        <div id="flt-val-wrap-${node.id}">
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Value</label>
          <div style="display:flex;gap:6px">
            <input type="text" id="flt-val-${node.id}" value="${cfg.value.replace(/"/g,'&quot;')}"
              placeholder="Filter value…" style="flex:1">
            <button id="flt-run-${node.id}"
              style="padding:4px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
              Apply
            </button>
          </div>
        </div>` : ''}
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer">
          <input type="checkbox" id="flt-cs-${node.id}" ${cfg.caseSensitive ? 'checked' : ''}>
          Case sensitive
        </label>
        ${status}
      </div>`;

    document.getElementById(`flt-col-${node.id}`).addEventListener('change', e => {
      node.config.colIndex = parseInt(e.target.value, 10);
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.getElementById(`flt-op-${node.id}`).addEventListener('change', e => {
      node.config.operator = e.target.value;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    if (!hideValue) {
      const valEl = document.getElementById(`flt-val-${node.id}`);
      valEl.addEventListener('input', e => { node.config.value = e.target.value; });
      document.getElementById(`flt-run-${node.id}`).addEventListener('click', () => {
        node.config.value = valEl.value;
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    }

    document.getElementById(`flt-cs-${node.id}`).addEventListener('change', e => {
      node.config.caseSensitive = e.target.checked;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndex, operator, value, caseSensitive } = node.config;
    const total = inputData.rows.length;

    const filtered = inputData.rows.filter(row => {
      let cell = String(row[colIndex] ?? '');

      if (operator === 'is empty')     return cell.trim() === '';
      if (operator === 'is not empty') return cell.trim() !== '';

      let cmp = value;
      if (!caseSensitive) { cell = cell.toLowerCase(); cmp = cmp.toLowerCase(); }

      if (operator === 'greater than' || operator === 'less than') {
        const cn = parseFloat(cell), vn = parseFloat(cmp);
        if (isNaN(cn) || isNaN(vn)) return false;
        return operator === 'greater than' ? cn > vn : cn < vn;
      }

      switch (operator) {
        case 'contains':     return cell.includes(cmp);
        case 'not contains': return !cell.includes(cmp);
        case 'equals':       return cell === cmp;
        case 'not equals':   return cell !== cmp;
        case 'starts with':  return cell.startsWith(cmp);
        case 'ends with':    return cell.endsWith(cmp);
        default: return true;
      }
    });

    const out = DWB.passthroughCopy(inputData);
    out.rows = filtered;
    node.output = out;
    DWB.log(`Filter: kept ${filtered.length} of ${total} rows`);
  }
});

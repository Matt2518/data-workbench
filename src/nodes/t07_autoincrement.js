DWB.register('AUTOINCREMENT', {
  title: 'AutoIncrement',
  icon: '🔢',
  category: 'Transform',
  desc: 'Add a sequential ID or counter column to the dataset.',
  implemented: true,
  defaultConfig: { colName: 'ID', startValue: 1, step: 1, prefix: '', suffix: '', padLength: 0, position: 'first' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;

    const posOpts = [['first','First column'],['last','Last column']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="ai-pos-${node.id}" value="${v}" ${cfg.position===v?'checked':''}> ${l}
      </label>`
    ).join('');

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Added column "${cfg.colName}"</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column Name</label>
          <input type="text" id="ai-name-${node.id}" value="${cfg.colName.replace(/"/g,'&quot;')}" style="width:100%">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Start Value</label>
            <input type="number" id="ai-start-${node.id}" value="${cfg.startValue}" style="width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Step</label>
            <input type="number" id="ai-step-${node.id}" value="${cfg.step}" style="width:100%">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Prefix</label>
            <input type="text" id="ai-prefix-${node.id}" value="${cfg.prefix.replace(/"/g,'&quot;')}" placeholder="e.g. ROW-" style="width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Suffix</label>
            <input type="text" id="ai-suffix-${node.id}" value="${cfg.suffix.replace(/"/g,'&quot;')}" style="width:100%">
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Pad to Length (0 = no padding)</label>
          <input type="number" id="ai-pad-${node.id}" value="${cfg.padLength}" min="0" style="width:80px">
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Position</div>
          <div style="display:flex;gap:12px">${posOpts}</div>
        </div>
        <button id="ai-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          🔢 Apply
        </button>
        ${status}
      </div>`;

    const inputs = {
      name:   [document.getElementById(`ai-name-${node.id}`),   v => cfg.colName    = v],
      start:  [document.getElementById(`ai-start-${node.id}`),  v => cfg.startValue = parseFloat(v) || 1],
      step:   [document.getElementById(`ai-step-${node.id}`),   v => cfg.step       = parseFloat(v) || 1],
      prefix: [document.getElementById(`ai-prefix-${node.id}`), v => cfg.prefix     = v],
      suffix: [document.getElementById(`ai-suffix-${node.id}`), v => cfg.suffix     = v],
      pad:    [document.getElementById(`ai-pad-${node.id}`),    v => cfg.padLength  = parseInt(v, 10) || 0]
    };
    Object.values(inputs).forEach(([el, setter]) => {
      el.addEventListener('input', () => setter(el.value));
    });

    document.querySelectorAll(`input[name="ai-pos-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.position = r.value; });
    });

    document.getElementById(`ai-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colName, startValue, step, prefix, suffix, padLength, position } = node.config;

    let name = (colName || 'ID').trim();
    let warned = false;
    if (inputData.headers.includes(name)) {
      name = name + '_1';
      warned = true;
      DWB.log(`AutoIncrement: column name collision, renamed to "${name}"`, 'warn');
    }

    const values = inputData.rows.map((_, i) => {
      const num = startValue + i * step;
      const padded = padLength > 0 ? String(num).padStart(padLength, '0') : String(num);
      return prefix + padded + suffix;
    });

    const out = DWB.passthroughCopy(inputData);
    if (position === 'first') {
      out.headers = [name, ...inputData.headers];
      out.rows = inputData.rows.map((r, i) => [values[i], ...r]);
      if (inputData.columnTypes) out.columnTypes = ['text', ...inputData.columnTypes];
      if (out.columnTypeMeta) {
        const shifted = {};
        Object.entries(out.columnTypeMeta).forEach(([k, v]) => { shifted[parseInt(k)+1] = v; });
        out.columnTypeMeta = shifted;
      }
    } else {
      out.headers = [...inputData.headers, name];
      out.rows = inputData.rows.map((r, i) => [...r, values[i]]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    }

    node.output = out;
    DWB.log(`AutoIncrement: added column "${name}"${warned ? ' (renamed due to collision)' : ''}`);
  }
});

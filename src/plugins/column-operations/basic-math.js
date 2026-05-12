DWB.register('BASIC_MATH', {
  title: 'Basic Math',
  icon: '🧮',
  category: 'Column Operations',
  desc: 'Performs arithmetic on one or two columns, writing the result to a new column.',
  implemented: true,
  defaultConfig: {
    colA: 0,
    operation: 'add',
    operandType: 'column',
    colB: 0,
    constant: 0,
    newColName: 'Result',
    decimals: 2
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const colOpts = sel => prevData.headers.map((h, i) =>
      `<option value="${i}"${i === sel ? ' selected' : ''}>${h}</option>`).join('');

    const opOpts = [
      ['add',      'Add (+)'],
      ['subtract', 'Subtract (−)'],
      ['multiply', 'Multiply (×)'],
      ['divide',   'Divide (÷)'],
      ['modulo',   'Modulo (%)'],
      ['power',    'Power (^)']
    ].map(([v, l]) => `<option value="${v}"${v === cfg.operation ? ' selected' : ''}>${l}</option>`).join('');

    const opTypeOpts = [['column', 'Column'], ['constant', 'Constant']].map(([v, l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="bm-optype-${id}" value="${v}"${v === cfg.operandType ? ' checked' : ''}> ${l}
      </label>`).join('');

    const operandHtml = cfg.operandType === 'column' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column B</label>
        <select id="bm-colb-${id}" style="width:100%">${colOpts(cfg.colB)}</select>
      </div>` : `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Constant</label>
        <input type="number" id="bm-const-${id}" value="${cfg.constant}" step="any" style="width:100%">
      </div>`;

    const decOpts = [[0,'0'],[1,'1'],[2,'2'],[3,'3'],[4,'4'],[-1,'No rounding']].map(([v, l]) =>
      `<option value="${v}"${v === cfg.decimals ? ' selected' : ''}>${l}</option>`).join('');

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column A</label>
          <select id="bm-cola-${id}" style="width:100%">${colOpts(cfg.colA)}</select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Operation</label>
          <select id="bm-op-${id}" style="width:100%">${opOpts}</select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Operand Type</div>
          <div style="display:flex;gap:12px">${opTypeOpts}</div>
        </div>
        ${operandHtml}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
          <input type="text" id="bm-name-${id}" value="${cfg.newColName.replace(/"/g, '&quot;')}" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Decimal Places</label>
          <select id="bm-dec-${id}" style="width:100%">${decOpts}</select>
        </div>
        ${status}
      </div>`;

    document.getElementById(`bm-cola-${id}`).addEventListener('change', e => {
      cfg.colA = parseInt(e.target.value, 10);
      DWB.runFrom(node.id);
    });
    document.getElementById(`bm-op-${id}`).addEventListener('change', e => {
      cfg.operation = e.target.value;
      DWB.runFrom(node.id);
    });
    document.querySelectorAll(`input[name="bm-optype-${id}"]`).forEach(r => {
      r.addEventListener('change', () => {
        cfg.operandType = r.value;
        DWB.renderActiveNode();
        DWB.runFrom(node.id);
      });
    });
    if (cfg.operandType === 'column') {
      document.getElementById(`bm-colb-${id}`).addEventListener('change', e => {
        cfg.colB = parseInt(e.target.value, 10);
        DWB.runFrom(node.id);
      });
    } else {
      document.getElementById(`bm-const-${id}`).addEventListener('input', e => {
        cfg.constant = parseFloat(e.target.value) || 0;
        DWB.runFrom(node.id);
      });
    }
    document.getElementById(`bm-name-${id}`).addEventListener('input', e => {
      cfg.newColName = e.target.value;
      DWB.runFrom(node.id);
    });
    document.getElementById(`bm-dec-${id}`).addEventListener('change', e => {
      cfg.decimals = parseInt(e.target.value, 10);
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colA, operation, operandType, colB, constant, newColName, decimals } = node.config;

    const results = inputData.rows.map(r => {
      const a = parseFloat(r[colA]);
      const b = operandType === 'column' ? parseFloat(r[colB]) : constant;
      if (isNaN(a) || isNaN(b)) return '';

      let result;
      switch (operation) {
        case 'add':      result = a + b; break;
        case 'subtract': result = a - b; break;
        case 'multiply': result = a * b; break;
        case 'divide':   result = b === 0 ? NaN : a / b; break;
        case 'modulo':   result = b === 0 ? NaN : a % b; break;
        case 'power':    result = Math.pow(a, b); break;
        default:         result = NaN;
      }

      if (isNaN(result) || !isFinite(result)) return '';
      return decimals >= 0 ? result.toFixed(decimals) : String(result);
    });

    const colName = (newColName || 'Result').trim();
    const out = DWB.passthroughCopy(inputData);
    out.headers = [...inputData.headers, colName];
    out.rows = inputData.rows.map((r, i) => [...r, results[i]]);
    if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'number'];

    node.output = out;
    DWB.log(`Basic Math: added column "${colName}"`);
  }
});

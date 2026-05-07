DWB.register('IF_THEN_ELSE', {
  title: 'If / Then / Else',
  icon: '🔀',
  category: 'Transform',
  desc: 'Create a new column based on conditional logic applied to existing columns.',
  implemented: true,
  defaultConfig: {
    outputCol: 'result', position: 'last', afterCol: 0,
    conditions: [{ colIndex: 0, operator: 'equals', value: '' }],
    joinLogic: 'all',
    thenType: 'static', thenValue: '', thenColIndex: 0,
    elseType: 'static', elseValue: '', elseColIndex: 0,
    caseSensitive: false
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (!cfg.conditions.length) cfg.conditions.push({ colIndex: 0, operator: 'equals', value: '' });

    const OPERATORS = ['equals','not equals','contains','not contains','starts with','ends with',
      'greater than','less than','greater than or equal','less than or equal',
      'is empty','is not empty','matches regex'];
    const NO_VALUE_OPS = new Set(['is empty','is not empty']);

    const colOptsFn = (selIdx) => prevData.headers.map((h, i) =>
      `<option value="${i}"${i == selIdx ? ' selected' : ''}>${h}</option>`
    ).join('');

    function buildConditions() {
      return cfg.conditions.map((cond, ci) => {
        const opOpts = OPERATORS.map(op =>
          `<option value="${op}"${op===cond.operator?' selected':''}>${op}</option>`).join('');
        const hideVal = NO_VALUE_OPS.has(cond.operator);
        return `
          <div class="ite-cond" data-ci="${ci}"
            style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;align-items:center;
                   padding:4px 6px;border-bottom:1px solid var(--border);background:var(--bg-surface)">
            <select class="ite-cond-col" data-ci="${ci}" style="font-size:12px">${colOptsFn(cond.colIndex)}</select>
            <select class="ite-cond-op" data-ci="${ci}" style="font-size:12px;min-width:120px">${opOpts}</select>
            ${hideVal
              ? `<input type="text" class="ite-cond-val" data-ci="${ci}" value="" style="font-size:12px;width:90px;visibility:hidden">`
              : `<input type="text" class="ite-cond-val" data-ci="${ci}" value="${(cond.value||'').replace(/"/g,'&quot;')}" placeholder="value" style="font-size:12px;width:90px">`}
            <button class="ite-rm-cond" data-ci="${ci}"
              style="padding:1px 5px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px;${cfg.conditions.length<=1?'opacity:0.3;pointer-events:none':''}">✕</button>
          </div>`;
      }).join('');
    }

    const joinOpts = [['all','ALL conditions (AND)'],['any','ANY condition (OR)']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="ite-join-${node.id}" value="${v}" ${cfg.joinLogic===v?'checked':''}> ${l}
      </label>`).join('');

    function valueSectionHtml(prefix, selectedType, selectedVal, selectedCol, includeEmpty) {
      const types = includeEmpty
        ? [['static','Static text'],['column','Column value'],['empty','Empty string']]
        : [['static','Static text'],['column','Column value']];
      const radios = types.map(([v,l]) =>
        `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
          <input type="radio" name="${prefix}-type-${node.id}" value="${v}" ${selectedType===v?'checked':''}> ${l}
        </label>`).join('');
      const inp = selectedType === 'static'
        ? `<input type="text" id="${prefix}-sval-${node.id}" value="${(selectedVal||'').replace(/"/g,'&quot;')}" style="width:100%;margin-top:4px">`
        : selectedType === 'column'
          ? `<select id="${prefix}-cval-${node.id}" style="width:100%;margin-top:4px">${colOptsFn(selectedCol)}</select>`
          : '';
      return `<div style="display:flex;gap:8px;flex-wrap:wrap">${radios}</div>${inp}`;
    }

    const posOpts = [['first','First'],['last','Last'],['after','After column']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="ite-pos-${node.id}" value="${v}" ${cfg.position===v?'checked':''}> ${l}
      </label>`).join('');

    const afterPicker = cfg.position === 'after' ? `
      <select id="ite-after-${node.id}" style="width:100%;margin-top:4px">${colOptsFn(cfg.afterCol)}</select>` : '';

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Column "${cfg.outputCol}" added</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Output Column Name</label>
          <input type="text" id="ite-name-${node.id}" value="${cfg.outputCol.replace(/"/g,'&quot;')}" style="width:100%">
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Conditions</div>
          <div id="ite-conds-${node.id}" style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
            ${buildConditions()}
          </div>
          <button id="ite-add-cond-${node.id}"
            style="margin-top:4px;width:100%;padding:4px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">
            + Add Condition
          </button>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Match Logic</div>
          <div style="display:flex;gap:12px">${joinOpts}</div>
        </div>
        <div style="padding:8px;border:1px solid var(--border);border-radius:4px">
          <div style="font-size:11px;font-weight:600;color:var(--success);margin-bottom:6px">THEN (if conditions met)</div>
          ${valueSectionHtml('ite-then', cfg.thenType, cfg.thenValue, cfg.thenColIndex, false)}
        </div>
        <div style="padding:8px;border:1px solid var(--border);border-radius:4px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px">ELSE (if conditions not met)</div>
          ${valueSectionHtml('ite-else', cfg.elseType, cfg.elseValue, cfg.elseColIndex, true)}
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="ite-cs-${node.id}" ${cfg.caseSensitive?'checked':''}> Case sensitive matching
        </label>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Position</div>
          <div style="display:flex;flex-direction:column;gap:3px">${posOpts}</div>
          ${afterPicker}
        </div>
        <button id="ite-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          🔀 Apply
        </button>
        ${status}
      </div>`;

    const condsEl = document.getElementById(`ite-conds-${node.id}`);

    function rebuildConds() { condsEl.innerHTML = buildConditions(); attachCondListeners(); }

    function attachCondListeners() {
      condsEl.querySelectorAll('.ite-cond-col').forEach(sel => {
        sel.addEventListener('change', e => {
          cfg.conditions[parseInt(e.target.dataset.ci, 10)].colIndex = parseInt(e.target.value, 10);
          DWB.runFrom(node.id);
        });
      });
      condsEl.querySelectorAll('.ite-cond-op').forEach(sel => {
        sel.addEventListener('change', e => {
          cfg.conditions[parseInt(e.target.dataset.ci, 10)].operator = e.target.value;
          rebuildConds(); DWB.runFrom(node.id);
        });
      });
      condsEl.querySelectorAll('.ite-cond-val').forEach(inp => {
        inp.addEventListener('input', e => {
          cfg.conditions[parseInt(e.target.dataset.ci, 10)].value = e.target.value;
        });
      });
      condsEl.querySelectorAll('.ite-rm-cond').forEach(btn => {
        btn.addEventListener('click', e => {
          const ci = parseInt(e.target.dataset.ci, 10);
          if (cfg.conditions.length <= 1) return;
          cfg.conditions.splice(ci, 1);
          rebuildConds(); DWB.runFrom(node.id);
        });
      });
    }
    attachCondListeners();

    document.getElementById(`ite-add-cond-${node.id}`).addEventListener('click', () => {
      cfg.conditions.push({ colIndex: 0, operator: 'equals', value: '' });
      rebuildConds();
    });

    document.querySelectorAll(`input[name="ite-join-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.joinLogic = r.value; DWB.runFrom(node.id); });
    });

    document.getElementById(`ite-name-${node.id}`).addEventListener('input', e => { cfg.outputCol = e.target.value; });

    // THEN value section
    document.querySelectorAll(`input[name="ite-then-type-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.thenType = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    const thenSval = document.getElementById(`ite-then-sval-${node.id}`);
    if (thenSval) thenSval.addEventListener('input', e => { cfg.thenValue = e.target.value; });
    const thenCval = document.getElementById(`ite-then-cval-${node.id}`);
    if (thenCval) thenCval.addEventListener('change', e => { cfg.thenColIndex = parseInt(e.target.value, 10); DWB.runFrom(node.id); });

    // ELSE value section
    document.querySelectorAll(`input[name="ite-else-type-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.elseType = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    const elseSval = document.getElementById(`ite-else-sval-${node.id}`);
    if (elseSval) elseSval.addEventListener('input', e => { cfg.elseValue = e.target.value; });
    const elseCval = document.getElementById(`ite-else-cval-${node.id}`);
    if (elseCval) elseCval.addEventListener('change', e => { cfg.elseColIndex = parseInt(e.target.value, 10); DWB.runFrom(node.id); });

    document.getElementById(`ite-cs-${node.id}`).addEventListener('change', e => {
      cfg.caseSensitive = e.target.checked; DWB.runFrom(node.id);
    });

    document.querySelectorAll(`input[name="ite-pos-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.position = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    if (cfg.position === 'after') {
      document.getElementById(`ite-after-${node.id}`).addEventListener('change', e => {
        cfg.afterCol = parseInt(e.target.value, 10); DWB.runFrom(node.id);
      });
    }

    document.getElementById(`ite-run-${node.id}`).addEventListener('click', () => {
      cfg.outputCol = document.getElementById(`ite-name-${node.id}`).value;
      if (thenSval) cfg.thenValue = thenSval.value;
      if (elseSval) cfg.elseValue = elseSval.value;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { outputCol, position, afterCol, conditions, joinLogic, thenType, thenValue, thenColIndex, elseType, elseValue, elseColIndex, caseSensitive } = node.config;

    const cs = caseSensitive;

    function testCondition(cond, row) {
      let cell = String(row[cond.colIndex] ?? '');
      const op = cond.operator;
      if (op === 'is empty')     return cell.trim() === '';
      if (op === 'is not empty') return cell.trim() !== '';
      let val = cond.value || '';
      if (!cs) { cell = cell.toLowerCase(); val = val.toLowerCase(); }
      if (op === 'greater than' || op === 'less than' || op === 'greater than or equal' || op === 'less than or equal') {
        const cn = parseFloat(cell), vn = parseFloat(val);
        if (!isNaN(cn) && !isNaN(vn)) {
          if (op === 'greater than')          return cn > vn;
          if (op === 'less than')             return cn < vn;
          if (op === 'greater than or equal') return cn >= vn;
          return cn <= vn;
        }
        if (op === 'greater than')          return cell > val;
        if (op === 'less than')             return cell < val;
        if (op === 'greater than or equal') return cell >= val;
        return cell <= val;
      }
      if (op === 'matches regex') {
        try { return new RegExp(cond.value || '', cs ? '' : 'i').test(String(row[cond.colIndex] ?? '')); }
        catch { return false; }
      }
      switch (op) {
        case 'equals':       return cell === val;
        case 'not equals':   return cell !== val;
        case 'contains':     return cell.includes(val);
        case 'not contains': return !cell.includes(val);
        case 'starts with':  return cell.startsWith(val);
        case 'ends with':    return cell.endsWith(val);
        default:             return false;
      }
    }

    function evaluate(row) {
      if (joinLogic === 'any') return conditions.some(c => testCondition(c, row));
      return conditions.every(c => testCondition(c, row));
    }

    function getVal(type, staticVal, colIdx, row) {
      if (type === 'column') return String(row[colIdx] ?? '');
      if (type === 'empty')  return '';
      return staticVal || '';
    }

    const name = (outputCol || 'result').trim();
    const newVals = inputData.rows.map(row =>
      evaluate(row) ? getVal(thenType, thenValue, thenColIndex, row) : getVal(elseType, elseValue, elseColIndex, row)
    );

    const out = DWB.passthroughCopy(inputData);
    if (position === 'first') {
      out.headers = [name, ...inputData.headers];
      out.rows = inputData.rows.map((r, i) => [newVals[i], ...r]);
      if (inputData.columnTypes) out.columnTypes = ['text', ...inputData.columnTypes];
    } else if (position === 'after') {
      const ins = (afterCol ?? 0) + 1;
      out.headers = [...inputData.headers.slice(0, ins), name, ...inputData.headers.slice(ins)];
      out.rows = inputData.rows.map((r, i) => [...r.slice(0, ins), newVals[i], ...r.slice(ins)]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes.slice(0, ins), 'text', ...inputData.columnTypes.slice(ins)];
    } else {
      out.headers = [...inputData.headers, name];
      out.rows = inputData.rows.map((r, i) => [...r, newVals[i]]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    }

    node.output = out;
    DWB.log(`If/Then/Else: added column "${name}" (${conditions.length} condition(s), ${joinLogic.toUpperCase()} logic)`);
  }
});

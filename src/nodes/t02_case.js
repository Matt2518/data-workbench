DWB.register('CASE_NORMALIZE', {
  title: 'Standardize Case',
  icon: '🔡',
  category: 'Transform',
  desc: 'Convert text columns to a consistent case format.',
  implemented: true,
  defaultConfig: { colIndices: 'all', mode: 'title' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (cfg.colIndices === 'all') cfg.colIndices = prevData.headers.map((_, i) => i);

    const checks = prevData.headers.map((h, i) => {
      const checked = cfg.colIndices.includes(i);
      return `<label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer">
        <input type="checkbox" data-idx="${i}" ${checked ? 'checked' : ''}> ${h}
      </label>`;
    }).join('');

    const modes = [
      ['upper', 'UPPERCASE'],
      ['lower', 'lowercase'],
      ['title', 'Title Case'],
      ['name',  'Name Case (Mc/Mac, hyphenated)'],
      ['sentence', 'Sentence case']
    ];
    const modeOpts = modes.map(([v, l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="case-mode-${node.id}" value="${v}" ${cfg.mode===v?'checked':''}> ${l}
      </label>`
    ).join('');

    const status = node.status === 'ok'
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Columns</div>
          <div id="case-cols-${node.id}" style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
            ${checks}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Mode</div>
          <div style="display:flex;flex-direction:column;gap:3px">${modeOpts}</div>
        </div>
        ${status}
      </div>`;

    document.getElementById(`case-cols-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.colIndices.includes(idx)) cfg.colIndices.push(idx); }
      else { cfg.colIndices = cfg.colIndices.filter(i => i !== idx); }
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.querySelectorAll(`input[name="case-mode-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.mode = r.value; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndices, mode } = node.config;
    const idxSet = new Set(Array.isArray(colIndices) ? colIndices : inputData.headers.map((_, i) => i));

    function toTitle(s) {
      return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    function toName(s) {
      let v = toTitle(s);
      v = v.replace(/\bMc([a-z])/gi, (_, c) => 'Mc' + c.toUpperCase());
      v = v.replace(/\bMac([a-z])/gi, (_, c) => 'Mac' + c.toUpperCase());
      v = v.replace(/-([a-z])/g, (_, c) => '-' + c.toUpperCase());
      return v;
    }
    function toSentence(s) {
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    const out = DWB.passthroughCopy(inputData);
    out.rows = inputData.rows.map(r => r.map((cell, ci) => {
      if (!idxSet.has(ci) || typeof cell !== 'string') return cell;
      switch (mode) {
        case 'upper':    return cell.toUpperCase();
        case 'lower':    return cell.toLowerCase();
        case 'title':    return toTitle(cell);
        case 'name':     return toName(cell);
        case 'sentence': return toSentence(cell);
        default: return cell;
      }
    }));

    node.output = out;
    DWB.log(`Standardize Case: applied ${mode} to ${idxSet.size} column(s)`);
  }
});

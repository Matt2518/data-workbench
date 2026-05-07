DWB.register('TRIM_WHITESPACE', {
  title: 'Whitespace Trim',
  icon: '✂️',
  category: 'Transform',
  desc: 'Remove leading and trailing whitespace from text columns.',
  implemented: true,
  defaultConfig: { colIndices: 'all', mode: 'both', collapseInternal: false },

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

    const modeOpts = [['both','Trim both'],['left','Trim left'],['right','Trim right']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="trim-mode-${node.id}" value="${v}" ${cfg.mode===v?'checked':''}> ${l}
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
          <div id="trim-cols-${node.id}" style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
            ${checks}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Mode</div>
          <div style="display:flex;flex-direction:column;gap:3px">${modeOpts}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="trim-collapse-${node.id}" ${cfg.collapseInternal?'checked':''}>
          Also collapse internal whitespace
        </label>
        ${status}
      </div>`;

    document.getElementById(`trim-cols-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.colIndices.includes(idx)) cfg.colIndices.push(idx); }
      else { cfg.colIndices = cfg.colIndices.filter(i => i !== idx); }
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.querySelectorAll(`input[name="trim-mode-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.mode = r.value; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });

    document.getElementById(`trim-collapse-${node.id}`).addEventListener('change', e => {
      cfg.collapseInternal = e.target.checked;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndices, mode, collapseInternal } = node.config;
    const idxSet = new Set(Array.isArray(colIndices) ? colIndices : inputData.headers.map((_, i) => i));

    const out = DWB.passthroughCopy(inputData);
    let changed = 0;
    out.rows = inputData.rows.map(r => r.map((cell, ci) => {
      if (!idxSet.has(ci) || typeof cell !== 'string' || cell === '') return cell;
      let v = cell;
      if (mode === 'both')  v = v.trim();
      else if (mode === 'left')  v = v.trimStart();
      else if (mode === 'right') v = v.trimEnd();
      if (collapseInternal) v = v.replace(/\s+/g, ' ');
      if (v !== cell) changed++;
      return v;
    }));

    node.output = out;
    DWB.log(`Whitespace Trim: ${changed} cells modified`);
  }
});

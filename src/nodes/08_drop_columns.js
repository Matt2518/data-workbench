DWB.register('DROP_COLS', {
  title: 'Drop Column(s)',
  icon: '🗑️',
  category: 'Column Operations',
  desc: 'Remove one or more columns.',
  implemented: true,
  defaultConfig: { dropIndices: [] },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const allDropped = cfg.dropIndices.length === prevData.headers.length;
    const keepCount  = prevData.headers.length - cfg.dropIndices.length;

    const warn = allDropped
      ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">⚠ Cannot drop all columns.</div>`
      : '';

    const status = (node.output && node.status === 'ok' && !allDropped)
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ Keeping ${node.output.headers.length} of ${prevData.headers.length} columns</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    const checks = prevData.headers.map((h, i) => {
      const checked = cfg.dropIndices.includes(i);
      return `
        <label style="display:flex;align-items:center;gap:7px;padding:4px 2px;
                      font-size:12px;cursor:pointer;color:${checked ? 'var(--danger)' : 'var(--text-main)'}">
          <input type="checkbox" data-idx="${i}" ${checked ? 'checked' : ''}>
          <span style="${checked ? 'text-decoration:line-through;color:var(--text-faint)' : ''}">${h}</span>
        </label>`;
    }).join('');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-height:0">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:2px;flex-shrink:0">
          Check columns to drop
        </div>
        <div id="drop-checks-${node.id}" style="flex:1;min-height:120px;overflow-y:auto;width:100%;
             border:1px solid var(--border);border-radius:4px;padding:4px 8px">
          ${checks}
        </div>
        ${warn}${status}
      </div>`;

    document.getElementById(`drop-checks-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) {
        if (!cfg.dropIndices.includes(idx)) cfg.dropIndices.push(idx);
      } else {
        cfg.dropIndices = cfg.dropIndices.filter(i => i !== idx);
      }
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { dropIndices } = node.config;

    if (dropIndices.length === inputData.headers.length) {
      throw new Error('Cannot drop all columns.');
    }

    const keepIndices = inputData.headers.map((_, i) => i).filter(i => !dropIndices.includes(i));
    const out = {
      headers: keepIndices.map(i => inputData.headers[i]),
      rows:    inputData.rows.map(r => keepIndices.map(i => r[i]))
    };
    if (inputData.columnTypes) {
      out.columnTypes = keepIndices.map(i => inputData.columnTypes[i] || 'text');
    }
    if (inputData.columnTypeMeta) {
      out.columnTypeMeta = {};
      keepIndices.forEach((origIdx, newIdx) => {
        if (inputData.columnTypeMeta[origIdx]) out.columnTypeMeta[newIdx] = inputData.columnTypeMeta[origIdx];
      });
    }
    node.output = out;

    DWB.log(`Dropped ${dropIndices.length} columns, ${keepIndices.length} remaining`);
  }
});

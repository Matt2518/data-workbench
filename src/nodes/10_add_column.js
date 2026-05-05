DWB.register('ADD_COL', {
  title: 'Add Column',
  icon: '➕',
  category: 'Column Operations',
  desc: 'Append a new column — blank, copied from another, or a static value.',
  implemented: true,
  defaultConfig: { newName: 'New_Column', mode: 'blank', sourceColIndex: 0, staticValue: '' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;

    const modeOpts = ['blank', 'copy', 'static'].map(m =>
      `<option value="${m}"${m === cfg.mode ? ' selected' : ''}>${
        m === 'blank' ? 'Blank (empty)' : m === 'copy' ? 'Copy column' : 'Static value'
      }</option>`
    ).join('');

    const copyPicker = (cfg.mode === 'copy') ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source Column</label>
        <select id="addcol-src-${node.id}" style="width:100%">
          ${prevData.headers.map((h, i) =>
            `<option value="${i}"${i == cfg.sourceColIndex ? ' selected' : ''}>${h}</option>`
          ).join('')}
        </select>
      </div>` : '';

    const staticInput = (cfg.mode === 'static') ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Static Value</label>
        <div style="display:flex;gap:6px">
          <input type="text" id="addcol-static-${node.id}"
            value="${cfg.staticValue.replace(/"/g,'&quot;')}"
            placeholder="Value for every row…" style="flex:1">
          <button id="addcol-srun-${node.id}"
            style="padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
            Apply
          </button>
        </div>
      </div>` : '';

    const status = (node.output && node.status === 'ok')
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ Added column: ${node.output.headers[node.output.headers.length - 1]}</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column Name</label>
          <div style="display:flex;gap:6px">
            <input type="text" id="addcol-name-${node.id}"
              value="${cfg.newName.replace(/"/g,'&quot;')}"
              placeholder="New_Column" style="flex:1">
            <button id="addcol-nrun-${node.id}"
              style="padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
              Apply
            </button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Mode</label>
          <select id="addcol-mode-${node.id}" style="width:100%">${modeOpts}</select>
        </div>
        ${copyPicker}${staticInput}
        ${status}
      </div>`;

    // Column name: oninput updates config, Apply button runs
    const nameEl = document.getElementById(`addcol-name-${node.id}`);
    nameEl.addEventListener('input', () => { cfg.newName = nameEl.value; });
    document.getElementById(`addcol-nrun-${node.id}`).addEventListener('click', () => {
      cfg.newName = nameEl.value;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    // Mode: onchange → rebuild UI + run
    document.getElementById(`addcol-mode-${node.id}`).addEventListener('change', e => {
      cfg.mode = e.target.value;
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });

    // Copy source picker
    if (cfg.mode === 'copy') {
      document.getElementById(`addcol-src-${node.id}`).addEventListener('change', e => {
        cfg.sourceColIndex = parseInt(e.target.value, 10);
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    }

    // Static value: oninput updates config, Apply button runs
    if (cfg.mode === 'static') {
      const staticEl = document.getElementById(`addcol-static-${node.id}`);
      staticEl.addEventListener('input', () => { cfg.staticValue = staticEl.value; });
      document.getElementById(`addcol-srun-${node.id}`).addEventListener('click', () => {
        cfg.staticValue = staticEl.value;
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { newName, mode, sourceColIndex, staticValue } = node.config;
    const name = (newName || '').trim() || 'Untitled';

    const newRows = inputData.rows.map(r => {
      let val = '';
      if (mode === 'copy')   val = r[sourceColIndex] ?? '';
      if (mode === 'static') val = staticValue;
      return [...r, val];
    });

    const out = DWB.passthroughCopy(inputData);
    out.headers = [...inputData.headers, name];
    out.rows = newRows;
    if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    node.output = out;
    DWB.log(`Added column: ${name}`);
  }
});

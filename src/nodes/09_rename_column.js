DWB.register('RENAME_COL', {
  title: 'Rename Column',
  icon: '✏️',
  category: 'Column Operations',
  desc: 'Rename one or more column headers.',
  implemented: true,
  defaultConfig: { renames: {} },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const renameCount = Object.values(cfg.renames).filter(v => v && v.trim()).length;

    const status = (node.output && node.status === 'ok')
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ ${renameCount} column${renameCount !== 1 ? 's' : ''} renamed</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    const rows = prevData.headers.map((h, i) => {
      const val = (cfg.renames[i] !== undefined ? cfg.renames[i] : '').replace(/"/g, '&quot;');
      return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center;
                    padding:3px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
               title="${h}">${h}</div>
          <input type="text" id="ren-inp-${node.id}-${i}"
            value="${val}" placeholder="${h}"
            style="width:100%;font-size:12px">
        </div>`;
    }).join('');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;
                    font-size:10px;font-weight:700;color:var(--text-faint);
                    text-transform:uppercase;letter-spacing:0.06em;padding:0 0 4px">
          <span>Current Name</span><span>New Name</span>
        </div>
        <div id="ren-rows-${node.id}" style="max-height:130px;overflow-y:auto">${rows}</div>
        ${status}
        <button id="ren-run-${node.id}"
          style="margin-top:6px;padding:6px 14px;background:var(--accent);color:#fff;
                 border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ✏️ Apply All
        </button>
      </div>`;

    // oninput: update config only
    prevData.headers.forEach((_, i) => {
      const inp = document.getElementById(`ren-inp-${node.id}-${i}`);
      if (!inp) return;
      inp.addEventListener('input', () => {
        const val = inp.value;
        if (val) cfg.renames[i] = val;
        else delete cfg.renames[i];
      });
    });

    document.getElementById(`ren-run-${node.id}`).addEventListener('click', () => {
      // Sync any pending values before running
      prevData.headers.forEach((_, i) => {
        const inp = document.getElementById(`ren-inp-${node.id}-${i}`);
        if (!inp) return;
        if (inp.value) cfg.renames[i] = inp.value;
        else delete cfg.renames[i];
      });
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { renames } = node.config;

    const newHeaders = inputData.headers.map((h, i) => {
      const r = renames[i];
      return (r && r.trim()) ? r.trim() : h;
    });

    const renameCount = Object.values(renames).filter(v => v && v.trim()).length;
    node.output = { headers: newHeaders, rows: inputData.rows.map(r => [...r]) };
    DWB.log(`Renamed ${renameCount} column${renameCount !== 1 ? 's' : ''}`);
  }
});

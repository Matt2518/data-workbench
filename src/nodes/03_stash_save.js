DWB.register('STASH_SAVE', {
  title: 'Save to Stash',
  icon: '📌',
  category: 'Input & Output',
  desc: 'Save current dataset to a named stash. Non-destructive.',
  implemented: true,
  defaultConfig: { stashName: '' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    const existing = DWB.listStashes();

    const warn = !node.config.stashName
      ? `<div style="margin-top:8px;font-size:11px;color:var(--warning)">⚠ Name required.</div>`
      : existing.includes(node.config.stashName)
        ? `<div style="margin-top:8px;font-size:11px;color:var(--warning)">⚠ Will overwrite existing stash "${node.config.stashName}"</div>`
        : '';

    const status = node.output && node.config.stashName
      ? `<div style="margin-top:10px;font-size:12px;color:var(--success)">✓ Stashed as: ${node.config.stashName}</div>`
      : '';

    const stashRef = existing.length
      ? `<div style="margin-top:6px;font-size:11px;color:var(--text-faint)">Existing stashes: ${existing.join(', ')}</div>`
      : `<div style="margin-top:6px;font-size:11px;color:var(--text-faint)">No stashes yet.</div>`;

    const dataInfo = prevData
      ? `<div style="margin-top:4px;font-size:11px;color:var(--text-faint)">${prevData.rows.length.toLocaleString()} rows · ${prevData.headers.length} columns to stash</div>`
      : `<div style="margin-top:4px;font-size:11px;color:var(--text-faint)">No upstream data yet.</div>`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Stash Name</label>
        <input type="text" id="stsh-name-${node.id}"
          value="${node.config.stashName}"
          placeholder="e.g. pre_match_snapshot"
          style="width:100%">
        ${warn}${status}${stashRef}${dataInfo}
        <button id="stsh-run-${node.id}"
          style="margin-top:8px;padding:6px 14px;background:var(--accent);color:#fff;
                 border:none;border-radius:4px;font-size:12px;cursor:pointer">
          📌 Save to Stash
        </button>
      </div>`;

    const input = document.getElementById(`stsh-name-${node.id}`);
    input.addEventListener('input', () => {
      DWB.updateConfig(node.id, 'stashName', input.value.trim());
    });

    document.getElementById(`stsh-run-${node.id}`).addEventListener('click', () => {
      node.config.stashName = input.value.trim();
      DWB.runFrom(node.id);
      DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No data to stash.');
    if (!node.config.stashName) throw new Error('Stash name is required.');
    DWB.setStash(node.config.stashName, inputData, node.id);
    node.output = DWB.passthroughCopy(inputData);
    DWB.log(`Stashed as: ${node.config.stashName} (${inputData.rows.length} rows)`);
  }
});

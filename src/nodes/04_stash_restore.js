DWB.register('STASH_RESTORE', {
  title: 'Restore from Stash',
  icon: '📤',
  category: 'Input & Output',
  desc: 'Replace current pipeline data with a named stash. Ignores upstream input.',
  implemented: true,
  defaultConfig: { stashName: '' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    const names = DWB.listStashes();

    if (!names.length) {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;
                    justify-content:center;height:100%;gap:8px;color:var(--text-faint)">
          <span style="font-size:28px">📤</span>
          <span style="font-size:12px">No stashes saved yet.</span>
          <span style="font-size:11px">Use a Stash Save node upstream to create one.</span>
        </div>`;
      return;
    }

    const stash = DWB.getStash(node.config.stashName);

    let metaHtml = '';
    if (stash) {
      const ts = stash.timestamp instanceof Date
        ? stash.timestamp.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
        : '';
      metaHtml = `
        <div style="margin-top:8px;padding:8px;background:var(--bg-raised);
                    border-radius:4px;font-size:11px;color:var(--text-muted);line-height:1.7">
          Rows: <strong>${stash.data.rows.length.toLocaleString()}</strong> ·
          Columns: <strong>${stash.data.headers.length}</strong> ·
          Saved: <strong>${ts}</strong>
        </div>`;
    }

    const status = node.output && node.config.stashName
      ? `<div style="margin-top:10px;font-size:12px;color:var(--success)">✓ Restored: ${node.config.stashName}</div>`
      : '';

    const options = [`<option value="">-- Select a stash --</option>`,
      ...names.map(n =>
        `<option value="${n}"${n === node.config.stashName ? ' selected' : ''}>${n}</option>`)
    ].join('');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Select Stash</label>
        <select id="srest-sel-${node.id}" style="width:100%">${options}</select>
        ${metaHtml}${status}
        <div style="margin-top:4px;font-size:11px;color:var(--text-faint)">
          ℹ This node replaces upstream data with the stash contents.
        </div>
      </div>`;

    document.getElementById(`srest-sel-${node.id}`).addEventListener('change', e => {
      node.config.stashName = e.target.value;
      DWB.runFrom(node.id);
      DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    // Source node — ignores inputData entirely
    if (!node.config.stashName) throw new Error('No stash selected.');
    const stash = DWB.getStash(node.config.stashName);
    if (!stash) throw new Error(`Stash "${node.config.stashName}" not found. It may have been deleted.`);
    node.output = {
      headers: [...stash.data.headers],
      rows: stash.data.rows.map(r => [...r])
    };
    DWB.log(`Restored stash: ${node.config.stashName} (${node.output.rows.length} rows)`);
  }
});

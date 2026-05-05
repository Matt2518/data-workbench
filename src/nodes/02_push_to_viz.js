DWB.register('PUSH_TO_VIZ', {
  title: 'Push to Viz',
  icon: '📊',
  category: 'Input & Output',
  desc: 'Promote current dataset to the Viz dashboard. Non-destructive — data passes through unchanged.',
  implemented: true,
  defaultConfig: { datasetName: '' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    const warn = !node.config.datasetName
      ? `<div style="margin-top:8px;font-size:11px;color:var(--warning)">⚠ Name required to push.</div>`
      : '';

    const status = node.output && node.config.datasetName
      ? `<div style="margin-top:10px;font-size:12px;color:var(--success)">✓ Promoted as: ${node.config.datasetName}</div>`
      : node.output
        ? `<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">Data is passing through — set a name to push to Viz.</div>`
        : '';

    const rows = prevData ? prevData.rows.length : null;
    const cols = prevData ? prevData.headers.length : null;
    const dataInfo = rows !== null
      ? `<div style="margin-top:8px;font-size:11px;color:var(--text-faint)">${rows.toLocaleString()} rows · ${cols} columns upstream</div>`
      : `<div style="margin-top:8px;font-size:11px;color:var(--text-faint)">No upstream data yet.</div>`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Dataset Name</label>
        <input type="text" id="pviz-name-${node.id}"
          value="${node.config.datasetName}"
          placeholder="e.g. final_results"
          style="width:100%">
        ${warn}${status}${dataInfo}
        <button id="pviz-run-${node.id}"
          style="margin-top:8px;padding:6px 14px;background:var(--accent);color:#fff;
                 border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ▶ Push to Viz
        </button>
      </div>`;

    const input = document.getElementById(`pviz-name-${node.id}`);
    input.addEventListener('input', () => {
      DWB.updateConfig(node.id, 'datasetName', input.value.trim());
    });

    document.getElementById(`pviz-run-${node.id}`).addEventListener('click', () => {
      node.config.datasetName = input.value.trim();
      DWB.runFrom(node.id);
      DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No data to push.');
    node.output = DWB.passthroughCopy(inputData);
    if (!node.config.datasetName) {
      DWB.log('Push to Viz: no dataset name — passing through without promoting.', 'warn');
      return;
    }
    DWB.promoteToActive(node.config.datasetName, inputData);
    DWB.log(`Pushed to Viz as: ${node.config.datasetName} (${inputData.rows.length} rows)`);
  }
});

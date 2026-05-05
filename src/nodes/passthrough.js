DWB.register('PASSTHROUGH', {
  title: 'Passthrough',
  icon: '➡️',
  category: 'Transform',
  desc: 'Passes data through unchanged. Useful as a checkpoint.',
  implemented: true,
  defaultConfig: {},

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    const rows = prevData ? prevData.rows.length : 0;
    const cols = prevData ? prevData.headers.length : 0;
    body.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);padding:4px 0">
        <p>No configuration — data passes through unchanged.</p>
        <p style="margin-top:8px;color:var(--text-faint)">
          Upstream: ${rows.toLocaleString()} rows · ${cols} columns
        </p>
        <button onclick="DWB.runFrom('${node.id}')"
          style="margin-top:12px;padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">
          ▶ Run
        </button>
      </div>`;
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data');
    node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
  }
});

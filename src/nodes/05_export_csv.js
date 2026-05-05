DWB.register('EXPORT_CSV', {
  title: 'Export to CSV',
  icon: '💾',
  category: 'Input & Output',
  desc: 'Download the current pipeline data as a CSV file.',
  implemented: true,
  defaultConfig: { fileName: 'export.csv' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    const hasData = !!prevData;
    const rows = hasData ? prevData.rows.length : 0;
    const cols = hasData ? prevData.headers.length : 0;

    const dataInfo = hasData
      ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
           ${rows.toLocaleString()} rows × ${cols} columns ready to export
         </div>`
      : `<div style="margin-top:8px;font-size:12px;color:var(--text-faint)">
           No data — run an upstream node first.
         </div>`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Filename</label>
        <input type="text" id="exp-fname-${node.id}"
          value="${node.config.fileName}"
          placeholder="export.csv"
          style="width:100%">
        ${dataInfo}
        <button id="exp-dl-${node.id}" ${hasData ? '' : 'disabled'}
          style="margin-top:8px;padding:8px 16px;font-size:13px;font-weight:600;
                 background:${hasData ? 'var(--accent)' : 'var(--bg-raised)'};
                 color:${hasData ? '#fff' : 'var(--text-faint)'};
                 border:1px solid ${hasData ? 'transparent' : 'var(--border)'};
                 border-radius:5px;cursor:${hasData ? 'pointer' : 'not-allowed'}">
          ⬇ Download CSV
        </button>
      </div>`;

    document.getElementById(`exp-fname-${node.id}`).addEventListener('input', e => {
      node.config.fileName = e.target.value.trim() || 'export.csv';
    });

    if (hasData) {
      document.getElementById(`exp-dl-${node.id}`).addEventListener('click', () => {
        // Run execute to ensure node.output is set and pipeline state is current
        DWB.runFrom(node.id);
        const data = node.output;
        if (!data) { DWB.log('Export failed — no output data', 'error'); return; }

        const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [
          data.headers.map(escape).join(','),
          ...data.rows.map(row => row.map(escape).join(','))
        ];
        const csv  = lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const fname = node.config.fileName.endsWith('.csv')
          ? node.config.fileName
          : node.config.fileName + '.csv';
        const a = Object.assign(document.createElement('a'), { href: url, download: fname });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        DWB.log(`Exported "${fname}" (${data.rows.length} rows, ${data.headers.length} columns)`, 'success');
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No data to export.');
    node.output = DWB.passthroughCopy(inputData);
  }
});

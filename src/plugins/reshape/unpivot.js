DWB.register('UNPIVOT', {
  title: 'Unpivot (Melt)',
  icon: '🔄',
  category: 'Reshape',
  desc: 'Transforms wide-format data to long format by melting selected value columns into key-value row pairs.',
  implemented: true,
  defaultConfig: {
    idCols: [],
    valueCols: [],
    keyColName: 'Variable',
    valueColName: 'Value'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const idOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${cfg.idCols.includes(i) ? ' selected' : ''}>${h}</option>`).join('');
    const valOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${cfg.valueCols.includes(i) ? ' selected' : ''}>${h}</option>`).join('');

    const previewN = prevData.rows.length * cfg.valueCols.length;
    const previewM = cfg.idCols.length + 2;

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done — ${node.output ? node.output.rows.length.toLocaleString() : 0} rows</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">ID Columns (keep as-is)</label>
          <select id="un-id-${id}" multiple style="width:100%;height:120px">${idOpts}</select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Value Columns (unpivot)</label>
          <select id="un-val-${id}" multiple style="width:100%;height:120px">${valOpts}</select>
        </div>
        <div id="un-preview-${id}" style="font-size:11px;color:var(--text-faint)">
          Output: ~${previewN.toLocaleString()} rows, ${previewM} columns
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Key Column Name</label>
          <input type="text" id="un-key-${id}" value="${cfg.keyColName.replace(/"/g, '&quot;')}" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Value Column Name</label>
          <input type="text" id="un-valname-${id}" value="${cfg.valueColName.replace(/"/g, '&quot;')}" style="width:100%">
        </div>
        ${status}
      </div>`;

    function updatePreview() {
      const el = document.getElementById(`un-preview-${id}`);
      if (el) {
        const n = prevData.rows.length * cfg.valueCols.length;
        const m = cfg.idCols.length + 2;
        el.textContent = `Output: ~${n.toLocaleString()} rows, ${m} columns`;
      }
    }

    document.getElementById(`un-id-${id}`).addEventListener('change', e => {
      cfg.idCols = Array.from(e.target.selectedOptions).map(o => parseInt(o.value, 10));
      updatePreview();
      DWB.runFrom(node.id);
    });
    document.getElementById(`un-val-${id}`).addEventListener('change', e => {
      cfg.valueCols = Array.from(e.target.selectedOptions).map(o => parseInt(o.value, 10));
      updatePreview();
      DWB.runFrom(node.id);
    });
    document.getElementById(`un-key-${id}`).addEventListener('input', e => {
      cfg.keyColName = e.target.value;
      DWB.runFrom(node.id);
    });
    document.getElementById(`un-valname-${id}`).addEventListener('input', e => {
      cfg.valueColName = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { idCols, valueCols, keyColName, valueColName } = node.config;

    if (!valueCols.length) {
      node.output = DWB.passthroughCopy(inputData);
      return;
    }

    const idHeaders  = idCols.map(i => inputData.headers[i] || `Col_${i}`);
    const newHeaders = [...idHeaders, keyColName || 'Variable', valueColName || 'Value'];

    const newRows = [];
    for (const row of inputData.rows) {
      const idValues = idCols.map(i => row[i] ?? '');
      for (const vi of valueCols) {
        newRows.push([...idValues, inputData.headers[vi] || `Col_${vi}`, row[vi] ?? '']);
      }
    }

    node.output = { headers: newHeaders, rows: newRows };
    DWB.log(`Unpivot: ${inputData.rows.length} rows × ${valueCols.length} value columns → ${newRows.length} rows`);
  }
});

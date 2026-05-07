DWB.register('SPLIT_COL', {
  title: 'Split Column',
  icon: '✂️',
  category: 'Transform',
  desc: 'Split a column into multiple columns by a delimiter or fixed position.',
  implemented: true,
  defaultConfig: {
    colIndex: 0, mode: 'delimiter', delimiter: ',', maxSplits: 0,
    trimWhitespace: true, widths: '', autoName: true,
    customNames: [], keepSource: false, insertPos: 'after'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i == cfg.colIndex ? ' selected' : ''}>${h}</option>`
    ).join('');

    // Estimate expected column count for custom names
    function expectedCount() {
      if (cfg.mode === 'delimiter') {
        if (cfg.maxSplits > 0) return cfg.maxSplits + 1;
        // Scan up to 100 rows to determine max splits
        let max = 2;
        const delim = cfg.delimiter || ',';
        inputData_scan: for (let i = 0; i < Math.min(prevData.rows.length, 100); i++) {
          const v = String(prevData.rows[i][cfg.colIndex] ?? '');
          const parts = v.split(delim).length;
          if (parts > max) max = parts;
        }
        return max;
      } else {
        const ws = (cfg.widths || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        return ws.length || 2;
      }
    }

    const count = expectedCount();
    while (cfg.customNames.length < count) {
      cfg.customNames.push(`${prevData.headers[cfg.colIndex] || 'col'}_${cfg.customNames.length + 1}`);
    }

    const modeOpts = [['delimiter','By delimiter'],['fixed','By fixed width']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="sp-mode-${node.id}" value="${v}" ${cfg.mode===v?'checked':''}> ${l}
      </label>`).join('');

    let modeUI = '';
    if (cfg.mode === 'delimiter') {
      modeUI = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Delimiter</label>
            <input type="text" id="sp-delim-${node.id}" value="${cfg.delimiter.replace(/"/g,'&quot;')}" style="width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Max splits (0=all)</label>
            <input type="number" id="sp-max-${node.id}" value="${cfg.maxSplits}" min="0" style="width:100%">
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="sp-trim-${node.id}" ${cfg.trimWhitespace?'checked':''}> Trim whitespace from results
        </label>`;
    } else {
      modeUI = `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column widths (comma-separated)</label>
          <input type="text" id="sp-widths-${node.id}" value="${cfg.widths.replace(/"/g,'&quot;')}" placeholder="e.g. 3,5,4" style="width:100%">
          <div style="font-size:10px;color:var(--text-faint);margin-top:2px">e.g. "3,5,4" → 3-char, 5-char, 4-char columns</div>
        </div>`;
    }

    const autoNameCheck = `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
        <input type="checkbox" id="sp-auto-${node.id}" ${cfg.autoName?'checked':''}> Auto-name columns ([source]_1, _2, …)
      </label>`;

    const customNamesUI = !cfg.autoName ? `
      <div id="sp-names-${node.id}" style="display:flex;flex-direction:column;gap:3px">
        ${cfg.customNames.slice(0, count).map((n, i) => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:var(--text-faint);min-width:18px">${i+1}</span>
            <input type="text" class="sp-cname" data-idx="${i}" value="${n.replace(/"/g,'&quot;')}" style="flex:1;font-size:12px">
          </div>`).join('')}
      </div>` : '';

    const insertOpts = [['after','After source column'],['last','Last']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="sp-ins-${node.id}" value="${v}" ${cfg.insertPos===v?'checked':''}> ${l}
      </label>`).join('');

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source Column</label>
          <select id="sp-col-${node.id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Mode</div>
          <div style="display:flex;gap:12px">${modeOpts}</div>
        </div>
        ${modeUI}
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Output Column Names</div>
          ${autoNameCheck}
          ${customNamesUI}
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="sp-keep-${node.id}" ${cfg.keepSource?'checked':''}> Keep source column
        </label>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Insert Position</div>
          <div style="display:flex;flex-direction:column;gap:3px">${insertOpts}</div>
        </div>
        <button id="sp-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ✂️ Apply
        </button>
        ${status}
      </div>`;

    document.getElementById(`sp-col-${node.id}`).addEventListener('change', e => {
      cfg.colIndex = parseInt(e.target.value, 10);
      cfg.customNames = [];
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });
    document.querySelectorAll(`input[name="sp-mode-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.mode = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });

    if (cfg.mode === 'delimiter') {
      document.getElementById(`sp-delim-${node.id}`).addEventListener('input', e => { cfg.delimiter = e.target.value; });
      document.getElementById(`sp-max-${node.id}`).addEventListener('input', e => {
        cfg.maxSplits = parseInt(e.target.value, 10) || 0;
        cfg.customNames = []; DWB.renderActiveNode();
      });
      document.getElementById(`sp-trim-${node.id}`).addEventListener('change', e => {
        cfg.trimWhitespace = e.target.checked; DWB.runFrom(node.id);
      });
    } else {
      document.getElementById(`sp-widths-${node.id}`).addEventListener('input', e => {
        cfg.widths = e.target.value; cfg.customNames = []; DWB.renderActiveNode();
      });
    }

    document.getElementById(`sp-auto-${node.id}`).addEventListener('change', e => {
      cfg.autoName = e.target.checked; DWB.renderActiveNode(); DWB.runFrom(node.id);
    });

    if (!cfg.autoName) {
      document.querySelectorAll('.sp-cname').forEach(inp => {
        inp.addEventListener('input', e => {
          cfg.customNames[parseInt(e.target.dataset.idx, 10)] = e.target.value;
        });
      });
    }

    document.getElementById(`sp-keep-${node.id}`).addEventListener('change', e => {
      cfg.keepSource = e.target.checked; DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    document.querySelectorAll(`input[name="sp-ins-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.insertPos = r.value; DWB.runFrom(node.id); });
    });
    document.getElementById(`sp-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndex, mode, delimiter, maxSplits, trimWhitespace, widths, autoName, customNames, keepSource, insertPos } = node.config;
    const srcHeader = inputData.headers[colIndex];

    function splitRow(val) {
      const s = String(val ?? '');
      if (mode === 'delimiter') {
        const d = delimiter || ',';
        const limit = maxSplits > 0 ? maxSplits + 1 : undefined;
        const parts = limit ? s.split(d).slice(0, limit) : s.split(d);
        // If limited and original had more splits, last part gets remainder
        if (limit && s.split(d).length > limit) {
          parts[parts.length - 1] = s.split(d).slice(limit - 1).join(d);
        }
        return trimWhitespace ? parts.map(p => p.trim()) : parts;
      } else {
        const ws = (widths || '').split(',').map(w => parseInt(w.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        if (!ws.length) return [s];
        const parts = [];
        let pos = 0;
        for (const w of ws) { parts.push(s.slice(pos, pos + w)); pos += w; }
        return parts;
      }
    }

    // Determine max column count from all rows
    let maxCols = 2;
    inputData.rows.forEach(r => {
      const parts = splitRow(r[colIndex]);
      if (parts.length > maxCols) maxCols = parts.length;
    });

    // Build output column names
    const outNames = Array.from({ length: maxCols }, (_, i) =>
      autoName ? `${srcHeader}_${i+1}` : (customNames[i] || `${srcHeader}_${i+1}`)
    );

    // Build output dataset
    const out = DWB.passthroughCopy(inputData);
    const newCols = outNames;

    if (!keepSource) {
      // Replace source column with split columns
      const srcIdx = colIndex;
      out.headers = [
        ...inputData.headers.slice(0, srcIdx),
        ...newCols,
        ...inputData.headers.slice(srcIdx + 1)
      ];
      out.rows = inputData.rows.map(r => {
        const parts = splitRow(r[srcIdx]);
        while (parts.length < maxCols) parts.push('');
        return [
          ...r.slice(0, srcIdx),
          ...parts,
          ...r.slice(srcIdx + 1)
        ];
      });
      if (inputData.columnTypes) {
        out.columnTypes = [
          ...inputData.columnTypes.slice(0, srcIdx),
          ...newCols.map(() => 'text'),
          ...inputData.columnTypes.slice(srcIdx + 1)
        ];
      }
    } else if (insertPos === 'after') {
      const ins = colIndex + 1;
      out.headers = [...inputData.headers.slice(0, ins), ...newCols, ...inputData.headers.slice(ins)];
      out.rows = inputData.rows.map(r => {
        const parts = splitRow(r[colIndex]);
        while (parts.length < maxCols) parts.push('');
        return [...r.slice(0, ins), ...parts, ...r.slice(ins)];
      });
      if (inputData.columnTypes) {
        out.columnTypes = [...inputData.columnTypes.slice(0, ins), ...newCols.map(() => 'text'), ...inputData.columnTypes.slice(ins)];
      }
    } else {
      out.headers = [...inputData.headers, ...newCols];
      out.rows = inputData.rows.map(r => {
        const parts = splitRow(r[colIndex]);
        while (parts.length < maxCols) parts.push('');
        return [...r, ...parts];
      });
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, ...newCols.map(() => 'text')];
    }

    node.output = out;
    DWB.log(`Split Column: "${srcHeader}" → ${maxCols} column(s)`);
  }
});

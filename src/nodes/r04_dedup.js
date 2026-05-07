DWB.register('REMOVE_DUPS', {
  title: 'Remove Duplicates',
  icon: '🗑️',
  category: 'Row Operations',
  desc: 'Remove duplicate rows based on one or more columns.',
  implemented: true,
  defaultConfig: { colIndices: 'all', keepFirst: true, caseSensitive: false },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const allSelected = cfg.colIndices === 'all';
    const selectedSet = allSelected
      ? new Set(prevData.headers.map((_, i) => i))
      : new Set(Array.isArray(cfg.colIndices) ? cfg.colIndices : []);

    function computePreview(indices, cs) {
      const idxArr = [...indices];
      const seen = new Set();
      let dups = 0;
      for (const row of prevData.rows) {
        const key = JSON.stringify(idxArr.map(i => cs ? (row[i] ?? '') : String(row[i] ?? '').toLowerCase()));
        if (seen.has(key)) dups++;
        else seen.add(key);
      }
      return { total: prevData.rows.length, kept: prevData.rows.length - dups, dups };
    }

    const preview = computePreview(selectedSet, cfg.caseSensitive);

    const colChecks = prevData.headers.map((h, i) => {
      const checked = selectedSet.has(i);
      return `<label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer;${allSelected?'opacity:0.5':''}">
        <input type="checkbox" class="dd-col" data-idx="${i}" ${checked?'checked':''} ${allSelected?'disabled':''}> ${h}
      </label>`;
    }).join('');

    const keepOpts = [['true','First occurrence'],['false','Last occurrence']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="dd-keep-${node.id}" value="${v}" ${String(cfg.keepFirst)===v?'checked':''}> ${l}
      </label>`).join('');

    const status = node.status === 'ok' && node.output
      ? `<div style="font-size:12px;color:var(--success)">✓ ${node.output.rows.length.toLocaleString()} rows remain</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div id="dd-preview-${node.id}"
          style="font-size:12px;color:var(--text-muted);padding:6px 8px;background:var(--bg-raised);border-radius:4px">
          ${prevData.rows.length.toLocaleString()} rows → <strong>${preview.kept.toLocaleString()}</strong> rows
          (${preview.dups.toLocaleString()} duplicate${preview.dups===1?'':'s'} removed)
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Columns to Consider</div>
          <label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer;font-weight:600">
            <input type="checkbox" id="dd-all-${node.id}" ${allSelected?'checked':''}> All columns
          </label>
          <div id="dd-cols-${node.id}" style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px;margin-top:4px">
            ${colChecks}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Keep</div>
          <div style="display:flex;gap:12px">${keepOpts}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="dd-cs-${node.id}" ${cfg.caseSensitive?'checked':''}> Case sensitive
        </label>
        <button id="dd-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          🗑️ Apply
        </button>
        ${status}
      </div>`;

    function updatePreview() {
      const idxs = cfg.colIndices === 'all'
        ? new Set(prevData.headers.map((_, i) => i))
        : new Set(Array.isArray(cfg.colIndices) ? cfg.colIndices : []);
      const p = computePreview(idxs, cfg.caseSensitive);
      const el = document.getElementById(`dd-preview-${node.id}`);
      if (el) el.innerHTML = `${prevData.rows.length.toLocaleString()} rows → <strong>${p.kept.toLocaleString()}</strong> rows (${p.dups.toLocaleString()} duplicate${p.dups===1?'':'s'} removed)`;
    }

    document.getElementById(`dd-all-${node.id}`).addEventListener('change', e => {
      cfg.colIndices = e.target.checked ? 'all' : prevData.headers.map((_, i) => i);
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });

    document.getElementById(`dd-cols-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      if (!Array.isArray(cfg.colIndices)) cfg.colIndices = prevData.headers.map((_, i) => i);
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.colIndices.includes(idx)) cfg.colIndices.push(idx); }
      else { cfg.colIndices = cfg.colIndices.filter(i => i !== idx); }
      updatePreview(); DWB.runFrom(node.id);
    });

    document.querySelectorAll(`input[name="dd-keep-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.keepFirst = r.value === 'true'; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });

    document.getElementById(`dd-cs-${node.id}`).addEventListener('change', e => {
      cfg.caseSensitive = e.target.checked; updatePreview(); DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.getElementById(`dd-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndices, keepFirst, caseSensitive } = node.config;

    const indices = colIndices === 'all'
      ? inputData.headers.map((_, i) => i)
      : (Array.isArray(colIndices) ? colIndices : inputData.headers.map((_, i) => i));

    function makeKey(row) {
      return JSON.stringify(indices.map(i => {
        const v = String(row[i] ?? '');
        return caseSensitive ? v : v.toLowerCase();
      }));
    }

    let result;
    if (keepFirst) {
      const seen = new Set();
      result = inputData.rows.filter(row => {
        const key = makeKey(row);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    } else {
      const seen = new Set();
      result = [];
      for (let i = inputData.rows.length - 1; i >= 0; i--) {
        const key = makeKey(inputData.rows[i]);
        if (!seen.has(key)) { seen.add(key); result.unshift(inputData.rows[i]); }
      }
    }

    const removed = inputData.rows.length - result.length;
    const out = DWB.passthroughCopy(inputData);
    out.rows = result;
    node.output = out;
    DWB.log(`Remove Duplicates: removed ${removed} duplicate row(s). ${result.length} rows remain.`);
  }
});

DWB.register('APPEND_ROWS', {
  title: 'Append Rows',
  icon: '⬇️',
  category: 'Row Operations',
  desc: 'Append rows from a stash to the current dataset.',
  implemented: true,
  defaultConfig: { stashName: '', matchMode: 'name', dedup: false },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    const cfg = node.config;
    const stashNames = DWB.listStashes();

    if (!stashNames.length) {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-faint)">
          <span style="font-size:28px">⬇️</span>
          <span style="font-size:12px">No stashes available.</span>
          <span style="font-size:11px">Use a Save to Stash node upstream first.</span>
        </div>`;
      return;
    }

    const stashOpts = [
      `<option value="">-- Select a stash --</option>`,
      ...stashNames.map(n => `<option value="${n}"${n===cfg.stashName?' selected':''}>${n}</option>`)
    ].join('');

    const matchOpts = [['name','By name (match column headers)'],['position','By position (match by index)']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="app-match-${node.id}" value="${v}" ${cfg.matchMode===v?'checked':''}> ${l}
      </label>`).join('');

    function previewHtml() {
      if (!cfg.stashName || !prevData) return `<div style="font-size:11px;color:var(--text-faint)">Select a stash to see preview.</div>`;
      const stash = DWB.getStash(cfg.stashName);
      if (!stash) return `<div style="font-size:11px;color:var(--danger)">Stash not found.</div>`;
      const active = prevData.rows.length;
      const stashRows = stash.data.rows.length;
      const total = active + stashRows;
      return `<div style="font-size:12px;color:var(--text-muted);padding:6px 8px;background:var(--bg-raised);border-radius:4px">
        Active: <strong>${active.toLocaleString()}</strong> rows &nbsp;+&nbsp;
        Stash: <strong>${stashRows.toLocaleString()}</strong> rows &nbsp;=&nbsp;
        <strong>${total.toLocaleString()}</strong> total
      </div>`;
    }

    const status = node.status === 'ok' && node.output
      ? `<div style="font-size:12px;color:var(--success)">✓ ${node.output.rows.length.toLocaleString()} rows total</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Stash</label>
          <select id="app-stash-${node.id}" style="width:100%">${stashOpts}</select>
        </div>
        <div id="app-preview-${node.id}">${previewHtml()}</div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Column Matching</div>
          <div style="display:flex;flex-direction:column;gap:3px">${matchOpts}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="app-dedup-${node.id}" ${cfg.dedup?'checked':''}> Remove duplicate rows after appending
        </label>
        <button id="app-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ⬇️ Append
        </button>
        ${status}
      </div>`;

    document.getElementById(`app-stash-${node.id}`).addEventListener('change', e => {
      cfg.stashName = e.target.value;
      document.getElementById(`app-preview-${node.id}`).innerHTML = previewHtml();
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.querySelectorAll(`input[name="app-match-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.matchMode = r.value; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });

    document.getElementById(`app-dedup-${node.id}`).addEventListener('change', e => {
      cfg.dedup = e.target.checked; DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.getElementById(`app-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { stashName, matchMode, dedup } = node.config;
    if (!stashName) throw new Error('No stash selected.');
    const stash = DWB.getStash(stashName);
    if (!stash) throw new Error(`Stash "${stashName}" not found.`);

    const activeHeaders = inputData.headers;
    const stashData = stash.data;
    let mergedHeaders, activeRows, stashRows;

    if (matchMode === 'name') {
      // Union of both header sets (preserve active order first, then stash-only headers)
      const extra = stashData.headers.filter(h => !activeHeaders.includes(h));
      mergedHeaders = [...activeHeaders, ...extra];

      activeRows = inputData.rows.map(r => {
        return mergedHeaders.map((h, i) => {
          const ai = i < activeHeaders.length ? i : -1;
          return ai >= 0 ? (r[ai] ?? '') : '';
        });
      });

      stashRows = stashData.rows.map(r => {
        return mergedHeaders.map(h => {
          const si = stashData.headers.indexOf(h);
          return si >= 0 ? (r[si] ?? '') : '';
        });
      });
    } else {
      // By position: use active headers, truncate/pad stash rows
      mergedHeaders = activeHeaders;
      activeRows = inputData.rows;
      stashRows = stashData.rows.map(r => {
        const padded = [...r];
        while (padded.length < mergedHeaders.length) padded.push('');
        return padded.slice(0, mergedHeaders.length);
      });
    }

    let combined = [...activeRows, ...stashRows];

    if (dedup) {
      const seen = new Set();
      combined = combined.filter(r => {
        const key = JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }

    node.output = { headers: mergedHeaders, rows: combined };
    DWB.log(`Append Rows: appended ${stashRows.length} rows from stash "${stashName}". Total: ${combined.length} rows.`);
  }
});

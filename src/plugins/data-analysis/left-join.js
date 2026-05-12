DWB.register('LEFT_JOIN', {
  title: 'Left Join',
  icon: '🔗',
  category: 'Data Analysis',
  desc: 'Joins pipeline data with a second dataset (from stash or CSV upload) based on a shared key column.',
  implemented: true,
  defaultConfig: {
    sourceBType: 'stash',
    stashName: '',
    tableBData: null,
    joinKeyA: 0,
    joinKeyB: 0,
    columnsToAppend: [],
    duplicateStrategy: 'one-to-many'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    // Auto-reload stash data after a workflow reload
    if (!cfg.tableBData && cfg.sourceBType === 'stash' && cfg.stashName) {
      const stash = DWB.getStash(cfg.stashName);
      if (stash) cfg.tableBData = stash.data;
    }

    // --- Source type select ---
    const sourceHtml = `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source (Table B)</label>
        <select id="lj-src-${id}" style="width:100%">
          <option value="stash"${cfg.sourceBType === 'stash' ? ' selected' : ''}>From Stash</option>
          <option value="upload"${cfg.sourceBType === 'upload' ? ' selected' : ''}>Upload CSV</option>
        </select>
      </div>`;

    // --- Stash picker ---
    let loaderHtml = '';
    if (cfg.sourceBType === 'stash') {
      const names = DWB.listStashes();
      if (!names.length) {
        loaderHtml = `<div style="font-size:11px;color:var(--text-faint)">No stashes available.</div>`;
      } else {
        const opts = [`<option value="">-- Select a stash --</option>`,
          ...names.map(n => `<option value="${n}"${n === cfg.stashName ? ' selected' : ''}>${n}</option>`)
        ].join('');
        loaderHtml = `
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Stash</label>
            <select id="lj-stash-${id}" style="width:100%">${opts}</select>
          </div>`;
      }
    } else {
      const reuploadNotice = !cfg.tableBData
        ? `<div style="font-size:11px;color:var(--text-faint);margin-top:3px">Re-upload required after workflow reload.</div>`
        : '';
      loaderHtml = `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">CSV File</label>
          <label style="display:inline-block;padding:5px 14px;background:var(--accent);
                        color:#fff;border-radius:4px;font-size:12px;cursor:pointer;border:none;font-family:inherit">
            Browse…
            <input type="file" accept=".csv" style="display:none" id="lj-file-${id}">
          </label>
          ${reuploadNotice}
        </div>`;
    }

    // --- Table B loaded section ---
    let tableBHtml = '';
    if (cfg.tableBData) {
      const B = cfg.tableBData;

      const aKeyOpts = prevData.headers.map((h, i) =>
        `<option value="${i}"${i === cfg.joinKeyA ? ' selected' : ''}>${h}</option>`).join('');
      const bKeyOpts = B.headers.map((h, i) =>
        `<option value="${i}"${i === cfg.joinKeyB ? ' selected' : ''}>${h}</option>`).join('');

      const stratDescs = {
        'one-to-many': 'Each matching Table B row generates a new output row.',
        'copy-first':  'Only the first matching Table B row is used per Table A row.',
        'merge':       'All matching values are comma-joined into a single output row.'
      };
      const stratOpts = [
        ['one-to-many', 'One-to-Many — new row per match'],
        ['copy-first',  'Copy First — use first matching record only'],
        ['merge',       'Merge — comma-separate multiple matches in one row']
      ].map(([v, l]) => `<option value="${v}"${v === cfg.duplicateStrategy ? ' selected' : ''}>${l}</option>`).join('');

      const colOpts = B.headers.map((h, i) =>
        `<option value="${i}"${cfg.columnsToAppend.includes(i) ? ' selected' : ''}>${h}</option>`).join('');

      tableBHtml = `
        <div style="font-size:11px;color:var(--text-faint)">Table B loaded: ${B.rows.length.toLocaleString()} rows</div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Join Keys</div>
          <div style="display:flex;align-items:flex-end;gap:6px">
            <div style="flex:1">
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">Table A (Pipeline)</div>
              <select id="lj-keya-${id}" style="width:100%">${aKeyOpts}</select>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--text-muted);padding-bottom:5px">=</div>
            <div style="flex:1">
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">Table B</div>
              <select id="lj-keyb-${id}" style="width:100%">${bKeyOpts}</select>
            </div>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Duplicate Strategy</label>
          <select id="lj-strat-${id}" style="width:100%">${stratOpts}</select>
          <div style="font-size:10px;color:var(--text-faint);margin-top:3px">${stratDescs[cfg.duplicateStrategy]}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted)">Columns to Append</label>
            <span style="display:flex;gap:4px">
              <button id="lj-selall-${id}" style="font-size:10px;padding:2px 7px;border:1px solid var(--border-strong);
                background:transparent;border-radius:3px;cursor:pointer;color:var(--text-muted)">All</button>
              <button id="lj-selnone-${id}" style="font-size:10px;padding:2px 7px;border:1px solid var(--border-strong);
                background:transparent;border-radius:3px;cursor:pointer;color:var(--text-muted)">None</button>
            </span>
          </div>
          <select id="lj-cols-${id}" multiple style="width:100%;height:120px">${colOpts}</select>
        </div>`;
    }

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Joined — ${node.output ? node.output.rows.length.toLocaleString() : 0} rows</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${sourceHtml}
        ${loaderHtml}
        ${tableBHtml}
        ${status}
      </div>`;

    // Source type change
    document.getElementById(`lj-src-${id}`).addEventListener('change', e => {
      cfg.sourceBType  = e.target.value;
      cfg.tableBData   = null;
      cfg.stashName    = '';
      cfg.columnsToAppend = [];
      DWB.renderActiveNode();
      DWB.runFrom(node.id);
    });

    // Stash picker
    if (cfg.sourceBType === 'stash') {
      const stashSel = document.getElementById(`lj-stash-${id}`);
      if (stashSel) {
        stashSel.addEventListener('change', e => {
          const name = e.target.value;
          cfg.stashName = name;
          if (name) {
            const stash = DWB.getStash(name);
            cfg.tableBData = stash ? stash.data : null;
          } else {
            cfg.tableBData = null;
          }
          cfg.columnsToAppend = [];
          cfg.joinKeyB = 0;
          DWB.renderActiveNode();
          DWB.runFrom(node.id);
        });
      }
    }

    // CSV upload
    if (cfg.sourceBType === 'upload') {
      const fi = document.getElementById(`lj-file-${id}`);
      if (fi) {
        fi.addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            const result = Papa.parse(ev.target.result, { header: false, skipEmptyLines: true });
            if (result.data.length < 1) return;
            cfg.tableBData = {
              headers: result.data[0].map(String),
              rows:    result.data.slice(1)
            };
            cfg.columnsToAppend = [];
            cfg.joinKeyB = 0;
            DWB.renderActiveNode();
            DWB.runFrom(node.id);
          };
          reader.readAsText(file);
        });
      }
    }

    // Join key selects and columns multiselect (only when B is loaded)
    if (cfg.tableBData) {
      document.getElementById(`lj-keya-${id}`).addEventListener('change', e => {
        cfg.joinKeyA = parseInt(e.target.value, 10);
        DWB.runFrom(node.id);
      });
      document.getElementById(`lj-keyb-${id}`).addEventListener('change', e => {
        cfg.joinKeyB = parseInt(e.target.value, 10);
        DWB.runFrom(node.id);
      });
      document.getElementById(`lj-strat-${id}`).addEventListener('change', e => {
        cfg.duplicateStrategy = e.target.value;
        DWB.renderActiveNode();
        DWB.runFrom(node.id);
      });

      const colsSel = document.getElementById(`lj-cols-${id}`);
      colsSel.addEventListener('change', () => {
        cfg.columnsToAppend = Array.from(colsSel.selectedOptions).map(o => parseInt(o.value, 10));
        DWB.runFrom(node.id);
      });
      document.getElementById(`lj-selall-${id}`).addEventListener('click', () => {
        Array.from(colsSel.options).forEach(o => o.selected = true);
        cfg.columnsToAppend = Array.from(colsSel.options).map(o => parseInt(o.value, 10));
        DWB.runFrom(node.id);
      });
      document.getElementById(`lj-selnone-${id}`).addEventListener('click', () => {
        Array.from(colsSel.options).forEach(o => o.selected = false);
        cfg.columnsToAppend = [];
        DWB.runFrom(node.id);
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { tableBData, joinKeyA, joinKeyB, columnsToAppend, duplicateStrategy } = node.config;

    if (!tableBData || !columnsToAppend.length) {
      node.output = DWB.passthroughCopy(inputData);
      return;
    }

    // Build output headers; suffix colliding Table B names with _B
    const aHeaders = inputData.headers;
    const bHeaders = columnsToAppend.map(i => {
      const name = String(tableBData.headers[i] ?? `Col_${i}`);
      return aHeaders.includes(name) ? name + '_B' : name;
    });
    const newHeaders = [...aHeaders, ...bHeaders];

    // Build O(N) lookup Map: trimmed key string → array of Table B rows
    const bMap = new Map();
    for (const row of tableBData.rows) {
      const key = String(row[joinKeyB] ?? '').trim();
      if (!bMap.has(key)) bMap.set(key, []);
      bMap.get(key).push(row);
    }

    const newRows = [];
    const emptyAppend = columnsToAppend.map(() => '');

    for (const aRow of inputData.rows) {
      const key     = String(aRow[joinKeyA] ?? '').trim();
      const matches = bMap.get(key);

      if (!matches || !matches.length) {
        newRows.push([...aRow, ...emptyAppend]);
        continue;
      }

      if (duplicateStrategy === 'copy-first') {
        newRows.push([...aRow, ...columnsToAppend.map(i => matches[0][i] ?? '')]);
      } else if (duplicateStrategy === 'merge') {
        const merged = columnsToAppend.map(i =>
          matches.map(r => String(r[i] ?? '')).filter(v => v !== '').join(', ')
        );
        newRows.push([...aRow, ...merged]);
      } else {
        // one-to-many
        for (const bRow of matches) {
          newRows.push([...aRow, ...columnsToAppend.map(i => bRow[i] ?? '')]);
        }
      }
    }

    node.output = { headers: newHeaders, rows: newRows };
    DWB.log(`Left Join: ${inputData.rows.length} → ${newRows.length} rows (${bHeaders.length} column(s) appended)`);
  }
});

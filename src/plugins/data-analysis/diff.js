DWB.register('DIFF_TABLES', {
  title: 'Compare / Diff Tables',
  icon: '🔍',
  category: 'Data Analysis',
  desc: 'Compare current pipeline data against a stash to find New, Deleted, Changed, and Unchanged rows.',
  implemented: true,
  defaultConfig: {
    stashName: '',
    keyColIndex: 0,
    statusColName: 'Diff_Status',
    sortByKey: true
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const stashes = DWB.listStashes();

    let stashHtml;
    if (!stashes.length) {
      stashHtml = `<div style="font-size:11px;color:var(--text-faint)">No stashes available. Save a baseline earlier in the pipeline first.</div>`;
    } else {
      const opts = [
        `<option value="">-- Select a stash --</option>`,
        ...stashes.map(n => `<option value="${n}"${n === cfg.stashName ? ' selected' : ''}>${n}</option>`)
      ].join('');
      stashHtml = `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Baseline Stash</label>
          <select id="dt-stash-${id}" style="width:100%">${opts}</select>
        </div>`;
    }

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i === cfg.keyColIndex ? ' selected' : ''}>${h}</option>`).join('');

    let stashInfoHtml = '';
    if (cfg.stashName) {
      const stash = DWB.getStash(cfg.stashName);
      if (stash) {
        stashInfoHtml = `<div style="font-size:11px;color:var(--text-faint)">Baseline: ${cfg.stashName} · ${stash.data.rows.length.toLocaleString()} rows</div>`;
      }
    }

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="background:var(--bg-raised);border-left:3px solid var(--accent);border-radius:4px;padding:9px 11px;font-size:11px;color:var(--text-muted);line-height:1.5">
          Compares your current data (New) against a saved stash (Old). Appends a status column tagging each row as New, Deleted, Changed, or Unchanged.
        </div>
        ${stashHtml}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Key Column</label>
          <select id="dt-keycol-${id}" style="width:100%">${colOpts}</select>
          <div style="font-size:11px;color:var(--text-faint);margin-top:3px">Must exist in both tables. Used to match rows.</div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Status Column Name</label>
          <input type="text" id="dt-statcol-${id}" value="${String(cfg.statusColName).replace(/"/g, '&quot;')}" style="width:100%">
        </div>
        ${stashInfoHtml}
      </div>`;

    if (stashes.length) {
      const stashSel = document.getElementById(`dt-stash-${id}`);
      if (stashSel) {
        stashSel.addEventListener('change', e => {
          cfg.stashName = e.target.value;
          DWB.renderActiveNode();
          DWB.runFrom(node.id);
        });
      }
    }

    document.getElementById(`dt-keycol-${id}`).addEventListener('change', e => {
      cfg.keyColIndex = parseInt(e.target.value, 10);
      DWB.runFrom(node.id);
    });

    document.getElementById(`dt-statcol-${id}`).addEventListener('input', e => {
      cfg.statusColName = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { stashName, keyColIndex, statusColName, sortByKey } = node.config;

    if (!stashName) {
      node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
      return;
    }

    const stash = DWB.getStash(stashName);
    if (!stash) throw new Error(`Stash '${stashName}' not found.`);

    const baseline = stash.data;
    const keyName = inputData.headers[keyColIndex];
    const oldKeyIndex = baseline.headers.indexOf(keyName);
    if (oldKeyIndex === -1) throw new Error(`Key column '${keyName}' not found in baseline.`);

    const newHeaders = [...inputData.headers, statusColName || 'Diff_Status'];

    // Build old dict: keyed by lowercased trimmed key value
    const oldDict = {};
    for (const row of baseline.rows) {
      const key = String(row[oldKeyIndex] ?? '').toLowerCase().trim();
      if (!key) continue;
      oldDict[key] = { originalRow: row, wasFoundInNew: false };
    }

    // For each new header, find its corresponding index in baseline (-1 if absent)
    const colMappingNewToOld = inputData.headers.map(h => baseline.headers.indexOf(h));

    const newRows = [];

    for (const row of inputData.rows) {
      const searchKey = String(row[keyColIndex] ?? '').toLowerCase().trim();

      if (!searchKey) {
        newRows.push([...row, 'Unchanged']);
        continue;
      }

      if (!(searchKey in oldDict)) {
        newRows.push([...row, 'New']);
        continue;
      }

      const entry = oldDict[searchKey];
      entry.wasFoundInNew = true;

      const alignedOldRow = colMappingNewToOld.map(oldIdx =>
        oldIdx === -1 ? '' : String(entry.originalRow[oldIdx] ?? '')
      );
      const newRowNorm = row.map(v => String(v ?? ''));

      const tag = JSON.stringify(newRowNorm) === JSON.stringify(alignedOldRow) ? 'Unchanged' : 'Changed';
      newRows.push([...row, tag]);
    }

    // Inject rows that exist in baseline but not in new data
    for (const entry of Object.values(oldDict)) {
      if (entry.wasFoundInNew) continue;
      const deletedRow = colMappingNewToOld.map(oldIdx =>
        oldIdx === -1 ? '' : String(entry.originalRow[oldIdx] ?? '')
      );
      newRows.push([...deletedRow, 'Deleted']);
    }

    if (sortByKey) {
      newRows.sort((a, b) =>
        String(a[keyColIndex] ?? '').localeCompare(
          String(b[keyColIndex] ?? ''), undefined, { numeric: true, sensitivity: 'base' }
        )
      );
    }

    node.output = { headers: newHeaders, rows: newRows };
  }
});

function pivotGroupCount(data, groupCols) {
  const keys = new Set();
  for (const row of data.rows) {
    const key = groupCols.map(ci => String(row[ci] ?? '') || '(Blank)').join(' | ');
    keys.add(key);
  }
  return keys.size;
}

DWB.register('PIVOT', {
  title: 'Pivot / Group By',
  icon: '📊',
  category: 'Data Analysis',
  desc: 'Group rows by one or two columns and compute one or more aggregations per group.',
  implemented: true,
  defaultConfig: {
    groupCols: [0],
    aggregations: [{ colIndex: 0, func: 'count' }],
    sortBy: 'key_asc'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const sectionLabel = text =>
      `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:6px">${text}</div>`;

    const colOpts = sel => prevData.headers.map((h, i) =>
      `<option value="${i}"${i === sel ? ' selected' : ''}>${h}</option>`).join('');

    const hasTwoGroups = cfg.groupCols.length >= 2;
    const sameCols = hasTwoGroups && cfg.groupCols[0] === cfg.groupCols[1];

    const sameColWarning = sameCols
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">Both group columns are the same.</div>`
      : '';

    const secondGroupHtml = hasTwoGroups ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Second Group Column</label>
        <select id="pv-grp1-${id}" style="width:100%">${colOpts(cfg.groupCols[1])}</select>
        ${sameColWarning}
      </div>` : '';

    // Aggregation rows
    const funcOpts = sel => [
      ['count',          'Count'],
      ['count_distinct', 'Count Distinct'],
      ['sum',            'Sum'],
      ['avg',            'Average'],
      ['min',            'Min'],
      ['max',            'Max']
    ].map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');

    const aggRows = cfg.aggregations.map((agg, i) => {
      const isCount  = agg.func === 'count';
      const colStyle = isCount ? 'opacity:0.4;pointer-events:none' : '';
      const rmvBtn   = cfg.aggregations.length > 1
        ? `<button id="pv-rmv-${id}-${i}" style="padding:3px 8px;font-size:11px;border:1px solid var(--border-strong);background:transparent;border-radius:3px;cursor:pointer;color:var(--text-muted);white-space:nowrap;flex-shrink:0">Remove</button>`
        : '';
      return `
        <div style="display:flex;gap:6px;align-items:center">
          <select id="pv-acol-${id}-${i}" style="flex:1;${colStyle}">${colOpts(agg.colIndex)}</select>
          <select id="pv-afunc-${id}-${i}" style="flex:1">${funcOpts(agg.func)}</select>
          ${rmvBtn}
        </div>`;
    }).join('');

    const addBtnHtml = cfg.aggregations.length < 6
      ? `<button id="pv-addagg-${id}" style="margin-top:4px;font-size:12px;padding:4px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;cursor:pointer;font-family:inherit">+ Add Aggregation</button>`
      : '';

    const sortOpts = [
      ['key_asc',    'Group Key — A to Z'],
      ['key_desc',   'Group Key — Z to A'],
      ['value_desc', 'First Value — High to Low'],
      ['value_asc',  'First Value — Low to High'],
      ['none',       'No Sorting (insertion order)']
    ].map(([v, l]) => `<option value="${v}"${v === cfg.sortBy ? ' selected' : ''}>${l}</option>`).join('');

    const groupCount = pivotGroupCount(prevData, cfg.groupCols);

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          ${sectionLabel('Group By')}
          <div style="display:flex;flex-direction:column;gap:8px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Primary Column</label>
              <select id="pv-grp0-${id}" style="width:100%">${colOpts(cfg.groupCols[0])}</select>
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="pv-two-${id}"${hasTwoGroups ? ' checked' : ''}>
              Add a second group level
            </label>
            <div id="pv-grp1-wrap-${id}"${hasTwoGroups ? '' : ' style="display:none"'}>${secondGroupHtml.trim()}</div>
          </div>
        </div>

        <div>
          ${sectionLabel('Aggregations')}
          <div id="pv-aggs-${id}" style="display:flex;flex-direction:column;gap:6px">${aggRows}</div>
          ${addBtnHtml}
        </div>

        <div>
          ${sectionLabel('Sort Output By')}
          <select id="pv-sort-${id}" style="width:100%">${sortOpts}</select>
        </div>

        <div id="pv-preview-${id}" style="font-size:11px;color:var(--text-faint)">${groupCount.toLocaleString()} group${groupCount !== 1 ? 's' : ''} from ${prevData.rows.length.toLocaleString()} rows</div>
      </div>`;

    // Helpers for partial DOM updates
    function refreshPreview() {
      const el = document.getElementById(`pv-preview-${id}`);
      if (!el) return;
      const n = pivotGroupCount(prevData, cfg.groupCols);
      el.textContent = `${n.toLocaleString()} group${n !== 1 ? 's' : ''} from ${prevData.rows.length.toLocaleString()} rows`;
    }

    function refreshSameColWarning() {
      const wrap = document.getElementById(`pv-grp1-wrap-${id}`);
      if (!wrap) return;
      const warnEl = wrap.querySelector('[data-same-col-warn]');
      const isSame = cfg.groupCols.length >= 2 && cfg.groupCols[0] === cfg.groupCols[1];
      if (warnEl) {
        warnEl.style.display = isSame ? '' : 'none';
      }
    }

    // Inject a data attribute on the warning div so we can find it
    const grp1Wrap = document.getElementById(`pv-grp1-wrap-${id}`);
    if (grp1Wrap && sameColWarning) {
      const warnDiv = grp1Wrap.querySelector('div[style*="text-muted"]');
      if (warnDiv) warnDiv.setAttribute('data-same-col-warn', '1');
    }

    // — Group By listeners —
    document.getElementById(`pv-grp0-${id}`).addEventListener('change', e => {
      cfg.groupCols[0] = parseInt(e.target.value, 10);
      refreshPreview();
      if (cfg.groupCols.length >= 2) {
        DWB.renderActiveNode();
      }
      DWB.runFrom(node.id);
    });

    document.getElementById(`pv-two-${id}`).addEventListener('change', e => {
      if (e.target.checked) {
        cfg.groupCols = [cfg.groupCols[0], cfg.groupCols[0]];
      } else {
        cfg.groupCols = [cfg.groupCols[0]];
      }
      DWB.renderActiveNode();
      DWB.runFrom(node.id);
    });

    if (hasTwoGroups) {
      const grp1Sel = document.getElementById(`pv-grp1-${id}`);
      if (grp1Sel) {
        grp1Sel.addEventListener('change', e => {
          cfg.groupCols[1] = parseInt(e.target.value, 10);
          refreshPreview();
          DWB.renderActiveNode();
          DWB.runFrom(node.id);
        });
      }
    }

    // — Aggregation listeners —
    cfg.aggregations.forEach((agg, i) => {
      const colSel  = document.getElementById(`pv-acol-${id}-${i}`);
      const funcSel = document.getElementById(`pv-afunc-${id}-${i}`);
      const rmvBtn  = document.getElementById(`pv-rmv-${id}-${i}`);

      if (colSel) {
        colSel.addEventListener('change', e => {
          agg.colIndex = parseInt(e.target.value, 10);
          DWB.runFrom(node.id);
        });
      }
      if (funcSel) {
        funcSel.addEventListener('change', e => {
          agg.func = e.target.value;
          const isCount = agg.func === 'count';
          if (colSel) {
            colSel.style.opacity       = isCount ? '0.4' : '';
            colSel.style.pointerEvents = isCount ? 'none' : '';
          }
          DWB.runFrom(node.id);
        });
      }
      if (rmvBtn) {
        rmvBtn.addEventListener('click', () => {
          cfg.aggregations.splice(i, 1);
          DWB.renderActiveNode();
          DWB.runFrom(node.id);
        });
      }
    });

    const addBtn = document.getElementById(`pv-addagg-${id}`);
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        cfg.aggregations.push({ colIndex: 0, func: 'count' });
        DWB.renderActiveNode();
        DWB.runFrom(node.id);
      });
    }

    // — Sort listener —
    document.getElementById(`pv-sort-${id}`).addEventListener('change', e => {
      cfg.sortBy = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { groupCols, aggregations, sortBy } = node.config;

    if (!groupCols || !groupCols.length || !aggregations || !aggregations.length) {
      node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
      return;
    }

    // Build output headers
    const groupHeaders = groupCols.map(ci => inputData.headers[ci] ?? `Col_${ci}`);
    const aggHeaders = aggregations.map(agg => {
      const colName = inputData.headers[agg.colIndex] ?? `Col_${agg.colIndex}`;
      switch (agg.func) {
        case 'count':          return `COUNT_${colName}`;
        case 'count_distinct': return `COUNT_DISTINCT_${colName}`;
        case 'sum':            return `SUM_${colName}`;
        case 'avg':            return `AVG_${colName}`;
        case 'min':            return `MIN_${colName}`;
        case 'max':            return `MAX_${colName}`;
        default:               return `${agg.func.toUpperCase()}_${colName}`;
      }
    });
    const newHeaders = [...groupHeaders, ...aggHeaders];

    // Accumulate groups — Map preserves insertion order
    const groupMap = new Map();

    for (const row of inputData.rows) {
      const keyParts = groupCols.map(ci => String(row[ci] ?? '') || '(Blank)');
      const compositeKey = keyParts.join(' | ');

      if (!groupMap.has(compositeKey)) {
        groupMap.set(compositeKey, {
          keyParts,
          count: 0,
          values: aggregations.map(() => []),
          numValues: aggregations.map(() => [])
        });
      }

      const entry = groupMap.get(compositeKey);
      entry.count++;

      aggregations.forEach((agg, i) => {
        const raw = String(row[agg.colIndex] ?? '');
        entry.values[i].push(raw);
        const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
        if (!isNaN(num)) entry.numValues[i].push(num);
      });
    }

    // Build output rows
    const newRows = [];
    for (const entry of groupMap.values()) {
      const aggResults = aggregations.map((agg, i) => {
        const vals = entry.values[i];
        const nums = entry.numValues[i];
        switch (agg.func) {
          case 'count':
            return entry.count;
          case 'count_distinct':
            return new Set(vals.filter(v => v !== '')).size;
          case 'sum':
            return nums.reduce((a, b) => a + b, 0);
          case 'avg':
            return nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '';
          case 'min':
            return vals.length > 0 ? vals.reduce((a, b) => a < b ? a : b) : '';
          case 'max':
            return vals.length > 0 ? vals.reduce((a, b) => a > b ? a : b) : '';
          default:
            return '';
        }
      });
      newRows.push([...entry.keyParts, ...aggResults]);
    }

    // Sort
    const aggColIdx = groupCols.length;
    if (sortBy === 'key_asc') {
      newRows.sort((a, b) =>
        String(a[0] ?? '').localeCompare(String(b[0] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'key_desc') {
      newRows.sort((a, b) =>
        String(b[0] ?? '').localeCompare(String(a[0] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'value_asc') {
      newRows.sort((a, b) => {
        const av = parseFloat(a[aggColIdx]), bv = parseFloat(b[aggColIdx]);
        if (!isNaN(av) && !isNaN(bv)) return av - bv;
        return String(a[aggColIdx] ?? '').localeCompare(String(b[aggColIdx] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      });
    } else if (sortBy === 'value_desc') {
      newRows.sort((a, b) => {
        const av = parseFloat(a[aggColIdx]), bv = parseFloat(b[aggColIdx]);
        if (!isNaN(av) && !isNaN(bv)) return bv - av;
        return String(b[aggColIdx] ?? '').localeCompare(String(a[aggColIdx] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    // 'none': insertion order, no sort needed

    node.output = { headers: newHeaders, rows: newRows };
    DWB.log(`Pivot: ${groupMap.size} group${groupMap.size !== 1 ? 's' : ''} · ${aggregations.length} aggregation${aggregations.length !== 1 ? 's' : ''}`);
  }
});

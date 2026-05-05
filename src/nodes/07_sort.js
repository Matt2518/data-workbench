DWB.register('SORT', {
  title: 'Sort Rows',
  icon: '↕️',
  category: 'Row Operations',
  desc: 'Sort rows by one or more columns.',
  implemented: true,
  defaultConfig: { sorts: [{ colIndex: 0, direction: 'asc' }] },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (!cfg.sorts || !cfg.sorts.length) cfg.sorts = [{ colIndex: 0, direction: 'asc' }];

    const sortRows = cfg.sorts.map((s, i) => {
      const colOpts = prevData.headers.map((h, ci) =>
        `<option value="${ci}"${ci == s.colIndex ? ' selected' : ''}>${h}</option>`
      ).join('');
      const canRemove = cfg.sorts.length > 1;
      return `
        <div style="display:flex;gap:6px;align-items:center" id="sort-row-${node.id}-${i}">
          <select id="sort-col-${node.id}-${i}" style="flex:1">${colOpts}</select>
          <button id="sort-dir-${node.id}-${i}"
            style="padding:4px 10px;border:1px solid var(--border);border-radius:4px;
                   background:${s.direction === 'asc' ? 'var(--accent-light)' : 'var(--bg-raised)'};
                   color:${s.direction === 'asc' ? 'var(--accent)' : 'var(--text-muted)'};
                   font-size:12px;cursor:pointer;white-space:nowrap;min-width:62px">
            ${s.direction === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          <button id="sort-del-${node.id}-${i}"
            ${canRemove ? '' : 'disabled'}
            style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;
                   background:transparent;color:${canRemove ? 'var(--danger)' : 'var(--text-faint)'};
                   font-size:12px;cursor:${canRemove ? 'pointer' : 'default'}">×</button>
        </div>`;
    }).join('');

    const canAdd = cfg.sorts.length < 3;
    const status = (node.output && node.status === 'ok')
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ ${node.output.rows.length.toLocaleString()} rows sorted</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted)">Sort Keys</div>
        <div style="display:flex;flex-direction:column;gap:5px" id="sort-keys-${node.id}">${sortRows}</div>
        ${canAdd ? `<button id="sort-add-${node.id}"
          style="margin-top:2px;padding:5px;border:1px dashed var(--border-strong);border-radius:4px;
                 background:transparent;color:var(--text-faint);font-size:11px;cursor:pointer;width:100%">
          + Add Sort Key
        </button>` : ''}
        ${status}
      </div>`;

    // Attach handlers for each sort row
    cfg.sorts.forEach((s, i) => {
      document.getElementById(`sort-col-${node.id}-${i}`).addEventListener('change', e => {
        cfg.sorts[i].colIndex = parseInt(e.target.value, 10);
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });

      document.getElementById(`sort-dir-${node.id}-${i}`).addEventListener('click', () => {
        cfg.sorts[i].direction = cfg.sorts[i].direction === 'asc' ? 'desc' : 'asc';
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });

      const delBtn = document.getElementById(`sort-del-${node.id}-${i}`);
      if (cfg.sorts.length > 1) {
        delBtn.addEventListener('click', () => {
          cfg.sorts.splice(i, 1);
          DWB.runFrom(node.id); DWB.renderActiveNode();
        });
      }
    });

    if (canAdd) {
      document.getElementById(`sort-add-${node.id}`).addEventListener('click', () => {
        cfg.sorts.push({ colIndex: 0, direction: 'asc' });
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { sorts } = node.config;

    const rows = [...inputData.rows];
    rows.sort((a, b) => {
      for (const { colIndex, direction } of sorts) {
        const av = a[colIndex] ?? '', bv = b[colIndex] ?? '';
        const an = parseFloat(av),    bn = parseFloat(bv);
        const cmp = (!isNaN(an) && !isNaN(bn))
          ? an - bn
          : String(av).localeCompare(String(bv));
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });

    const desc = sorts.map(s =>
      `${inputData.headers[s.colIndex] || s.colIndex} ${s.direction}`
    ).join(', ');

    const out = DWB.passthroughCopy(inputData);
    out.rows = rows;
    node.output = out;
    DWB.log(`Sorted by ${desc}`);
  }
});

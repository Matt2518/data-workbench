DWB.register('REARRANGE_COLS', {
  title: 'Rearrange Columns',
  icon: '↕️',
  category: 'Column Operations',
  desc: 'Reorder columns by dragging or moving them up/down.',
  implemented: true,
  defaultConfig: { order: null },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    // Initialize or validate order against current headers
    if (!cfg.order || cfg.order.length !== prevData.headers.length) {
      cfg.order = prevData.headers.map((_, i) => i);
    }

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Columns reordered</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    function buildRows() {
      return cfg.order.map((origIdx, pos) => {
        const h = prevData.headers[origIdx];
        return `
          <div class="rearr-row" data-pos="${pos}" draggable="true"
            style="display:grid;grid-template-columns:20px auto 1fr auto auto;gap:6px;align-items:center;
                   padding:5px 6px;border-bottom:1px solid var(--border);cursor:grab;
                   background:var(--bg-surface);user-select:none">
            <span style="font-size:13px;color:var(--text-faint)">☰</span>
            <span style="font-size:11px;color:var(--text-faint);min-width:18px;text-align:right">${pos+1}</span>
            <span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h}">${h}</span>
            <button data-up="${pos}" title="Move up"
              style="padding:1px 5px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px;${pos===0?'opacity:0.3;pointer-events:none':''}">↑</button>
            <button data-down="${pos}" title="Move down"
              style="padding:1px 5px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px;${pos===cfg.order.length-1?'opacity:0.3;pointer-events:none':''}">↓</button>
          </div>`;
      }).join('');
    }

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted)">Column Order</div>
          <button id="rearr-reset-${node.id}"
            style="font-size:11px;padding:2px 8px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text-muted)">
            Reset
          </button>
        </div>
        <div id="rearr-list-${node.id}" style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
          ${buildRows()}
        </div>
        ${status}
      </div>`;

    const list = document.getElementById(`rearr-list-${node.id}`);

    // Up/Down buttons
    list.addEventListener('click', e => {
      const up   = e.target.dataset.up;
      const down = e.target.dataset.down;
      if (up !== undefined) {
        const pos = parseInt(up, 10);
        if (pos === 0) return;
        [cfg.order[pos-1], cfg.order[pos]] = [cfg.order[pos], cfg.order[pos-1]];
        list.innerHTML = buildRows();
        DWB.runFrom(node.id);
      } else if (down !== undefined) {
        const pos = parseInt(down, 10);
        if (pos >= cfg.order.length - 1) return;
        [cfg.order[pos], cfg.order[pos+1]] = [cfg.order[pos+1], cfg.order[pos]];
        list.innerHTML = buildRows();
        DWB.runFrom(node.id);
      }
    });

    // HTML5 drag-and-drop
    let dragSrc = null;
    list.addEventListener('dragstart', e => {
      const row = e.target.closest('.rearr-row');
      if (!row) return;
      dragSrc = parseInt(row.dataset.pos, 10);
      row.style.opacity = '0.4';
    });
    list.addEventListener('dragend', e => {
      const row = e.target.closest('.rearr-row');
      if (row) row.style.opacity = '1';
    });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const row = e.target.closest('.rearr-row');
      if (row) row.style.background = 'var(--accent-light)';
    });
    list.addEventListener('dragleave', e => {
      const row = e.target.closest('.rearr-row');
      if (row) row.style.background = 'var(--bg-surface)';
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      const row = e.target.closest('.rearr-row');
      if (!row) return;
      row.style.background = 'var(--bg-surface)';
      const dropPos = parseInt(row.dataset.pos, 10);
      if (dragSrc === null || dragSrc === dropPos) return;
      const [moved] = cfg.order.splice(dragSrc, 1);
      cfg.order.splice(dropPos, 0, moved);
      dragSrc = null;
      list.innerHTML = buildRows();
      DWB.runFrom(node.id);
    });

    // Reset
    document.getElementById(`rearr-reset-${node.id}`).addEventListener('click', () => {
      cfg.order = prevData.headers.map((_, i) => i);
      list.innerHTML = buildRows();
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    let { order } = node.config;

    if (!order || order.length !== inputData.headers.length) {
      order = inputData.headers.map((_, i) => i);
    }

    const out = {
      headers: order.map(i => inputData.headers[i]),
      rows:    inputData.rows.map(r => order.map(i => r[i]))
    };
    if (inputData.columnTypes) {
      out.columnTypes = order.map(i => inputData.columnTypes[i] || 'text');
    }
    if (inputData.columnTypeMeta) {
      out.columnTypeMeta = {};
      order.forEach((origIdx, newIdx) => {
        if (inputData.columnTypeMeta[origIdx]) out.columnTypeMeta[newIdx] = inputData.columnTypeMeta[origIdx];
      });
    }

    node.output = out;
    DWB.log(`Rearrange Columns: reordered to [${out.headers.join(', ')}]`);
  }
});

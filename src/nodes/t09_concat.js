DWB.register('CONCAT_COLS', {
  title: 'Concatenate',
  icon: '🔗',
  category: 'Transform',
  desc: 'Combine two or more columns into a single new column.',
  implemented: true,
  defaultConfig: {
    parts: [], separator: ' ', outputCol: 'combined',
    position: 'last', afterCol: 0, handleEmpty: 'skip'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (!cfg.parts.length) {
      const i0 = 0, i1 = Math.min(1, prevData.headers.length - 1);
      cfg.parts = [{ type: 'column', colIndex: i0 }, { type: 'column', colIndex: i1 }];
    }

    const colOptsFn = (selIdx) => prevData.headers.map((h, i) =>
      `<option value="${i}"${i == selIdx ? ' selected' : ''}>${h}</option>`
    ).join('');

    function buildPartsHtml() {
      if (!cfg.parts.length) return `<div style="font-size:11px;color:var(--text-faint);padding:8px;text-align:center">No parts. Add a column or text.</div>`;
      return cfg.parts.map((part, i) => {
        const content = part.type === 'column'
          ? `<select class="cc-part-col" data-idx="${i}" style="flex:1;font-size:12px">${colOptsFn(part.colIndex)}</select>`
          : `<input type="text" class="cc-part-txt" data-idx="${i}" value="${(part.text||'').replace(/"/g,'&quot;')}" placeholder="Static text…" style="flex:1;font-size:12px">`;
        return `
          <div class="cc-row" data-pos="${i}" draggable="true"
            style="display:flex;align-items:center;gap:5px;padding:4px 6px;
                   border-bottom:1px solid var(--border);background:var(--bg-surface);user-select:none">
            <span style="cursor:grab;color:var(--text-faint);font-size:13px">☰</span>
            <span style="font-size:10px;color:var(--text-faint);min-width:34px;text-align:center">${part.type==='column'?'COL':'TXT'}</span>
            ${content}
            <button class="cc-rm" data-idx="${i}"
              style="padding:1px 6px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px">✕</button>
          </div>`;
      }).join('');
    }

    const posOpts = [['first','First'],['last','Last'],['after','After column']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="cc-pos-${node.id}" value="${v}" ${cfg.position===v?'checked':''}> ${l}
      </label>`).join('');

    const afterPicker = cfg.position === 'after' ? `
      <select id="cc-after-${node.id}" style="width:100%;margin-top:4px">
        ${colOptsFn(cfg.afterCol)}
      </select>` : '';

    const emptyOpts = [['skip','Skip (omit empty values)'],['include','Include (keep empty)']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="cc-empty-${node.id}" value="${v}" ${cfg.handleEmpty===v?'checked':''}> ${l}
      </label>`).join('');

    const sepEsc = cfg.separator.replace(/"/g,'&quot;');
    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Column "${cfg.outputCol}" added</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Parts (drag to reorder)</div>
          <div id="cc-list-${node.id}" style="border:1px solid var(--border);border-radius:4px;overflow:hidden;min-height:32px">
            ${buildPartsHtml()}
          </div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button id="cc-add-col-${node.id}"
              style="flex:1;padding:4px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">
              + Add Column
            </button>
            <button id="cc-add-txt-${node.id}"
              style="flex:1;padding:4px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">
              + Add Text
            </button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Separator</label>
          <div style="display:flex;gap:4px;align-items:center">
            <input type="text" id="cc-sep-${node.id}" value="${sepEsc}" style="width:80px">
            <button class="cc-sep-preset" data-val=" " style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">Space</button>
            <button class="cc-sep-preset" data-val=", " style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">,</button>
            <button class="cc-sep-preset" data-val="- " style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">-</button>
            <button class="cc-sep-preset" data-val=" | " style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">|</button>
            <button class="cc-sep-preset" data-val="" style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer">None</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Output Column Name</label>
          <div style="display:flex;gap:6px">
            <input type="text" id="cc-name-${node.id}" value="${cfg.outputCol.replace(/"/g,'&quot;')}" style="flex:1">
            <button id="cc-run-${node.id}"
              style="padding:4px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
              Apply
            </button>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Position</div>
          <div style="display:flex;flex-direction:column;gap:3px">${posOpts}</div>
          ${afterPicker}
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Handle Empty Values</div>
          <div style="display:flex;flex-direction:column;gap:3px">${emptyOpts}</div>
        </div>
        ${status}
      </div>`;

    const listEl = document.getElementById(`cc-list-${node.id}`);

    function syncPartsFromDOM() {
      listEl.querySelectorAll('.cc-part-col').forEach(sel => {
        const i = parseInt(sel.dataset.idx, 10);
        if (cfg.parts[i]) cfg.parts[i].colIndex = parseInt(sel.value, 10);
      });
      listEl.querySelectorAll('.cc-part-txt').forEach(inp => {
        const i = parseInt(inp.dataset.idx, 10);
        if (cfg.parts[i]) cfg.parts[i].text = inp.value;
      });
    }

    function rebuildList() {
      listEl.innerHTML = buildPartsHtml();
      attachListeners();
    }

    function attachListeners() {
      listEl.querySelectorAll('.cc-part-col').forEach(sel => {
        sel.addEventListener('change', e => {
          cfg.parts[parseInt(e.target.dataset.idx, 10)].colIndex = parseInt(e.target.value, 10);
          DWB.runFrom(node.id);
        });
      });
      listEl.querySelectorAll('.cc-part-txt').forEach(inp => {
        inp.addEventListener('input', e => {
          cfg.parts[parseInt(e.target.dataset.idx, 10)].text = e.target.value;
        });
      });
      listEl.querySelectorAll('.cc-rm').forEach(btn => {
        btn.addEventListener('click', e => {
          syncPartsFromDOM();
          cfg.parts.splice(parseInt(e.target.dataset.idx, 10), 1);
          rebuildList(); DWB.runFrom(node.id);
        });
      });
    }
    attachListeners();

    // Drag-and-drop
    let dragSrc = null;
    listEl.addEventListener('dragstart', e => {
      const row = e.target.closest('.cc-row');
      if (!row) return;
      syncPartsFromDOM();
      dragSrc = parseInt(row.dataset.pos, 10);
      row.style.opacity = '0.4';
    });
    listEl.addEventListener('dragend', e => {
      const row = e.target.closest('.cc-row');
      if (row) row.style.opacity = '1';
    });
    listEl.addEventListener('dragover', e => {
      e.preventDefault();
      const row = e.target.closest('.cc-row');
      if (row) row.style.background = 'var(--accent-light)';
    });
    listEl.addEventListener('dragleave', e => {
      const row = e.target.closest('.cc-row');
      if (row) row.style.background = 'var(--bg-surface)';
    });
    listEl.addEventListener('drop', e => {
      e.preventDefault();
      const row = e.target.closest('.cc-row');
      if (!row) return;
      row.style.background = 'var(--bg-surface)';
      const dropPos = parseInt(row.dataset.pos, 10);
      if (dragSrc === null || dragSrc === dropPos) return;
      const [moved] = cfg.parts.splice(dragSrc, 1);
      cfg.parts.splice(dropPos, 0, moved);
      dragSrc = null;
      rebuildList(); DWB.runFrom(node.id);
    });

    document.getElementById(`cc-add-col-${node.id}`).addEventListener('click', () => {
      syncPartsFromDOM();
      cfg.parts.push({ type: 'column', colIndex: 0 });
      rebuildList(); DWB.runFrom(node.id);
    });
    document.getElementById(`cc-add-txt-${node.id}`).addEventListener('click', () => {
      syncPartsFromDOM();
      cfg.parts.push({ type: 'text', text: '' });
      rebuildList();
    });

    const sepEl = document.getElementById(`cc-sep-${node.id}`);
    sepEl.addEventListener('input', () => { cfg.separator = sepEl.value; });
    document.querySelectorAll('.cc-sep-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        cfg.separator = btn.dataset.val;
        sepEl.value = btn.dataset.val;
        DWB.runFrom(node.id);
      });
    });

    const nameEl = document.getElementById(`cc-name-${node.id}`);
    nameEl.addEventListener('input', () => { cfg.outputCol = nameEl.value; });
    document.getElementById(`cc-run-${node.id}`).addEventListener('click', () => {
      cfg.outputCol = nameEl.value;
      cfg.separator = sepEl.value;
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    document.querySelectorAll(`input[name="cc-pos-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.position = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    if (cfg.position === 'after') {
      document.getElementById(`cc-after-${node.id}`).addEventListener('change', e => {
        cfg.afterCol = parseInt(e.target.value, 10); DWB.runFrom(node.id);
      });
    }

    document.querySelectorAll(`input[name="cc-empty-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.handleEmpty = r.value; DWB.runFrom(node.id); });
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { parts, separator, outputCol, position, afterCol, handleEmpty } = node.config;
    if (!parts || !parts.length) throw new Error('No parts defined. Add at least one column or text.');

    const name = (outputCol || 'combined').trim();
    const sep = separator ?? ' ';

    const newVals = inputData.rows.map(row => {
      const pieces = parts.map(p => {
        if (p.type === 'text') return p.text || '';
        return String(row[p.colIndex] ?? '');
      });
      if (handleEmpty === 'skip') {
        const filtered = pieces.filter((v, i) => parts[i].type === 'text' || v !== '');
        return filtered.join(sep);
      }
      return pieces.join(sep);
    });

    const out = DWB.passthroughCopy(inputData);
    if (position === 'first') {
      out.headers = [name, ...inputData.headers];
      out.rows = inputData.rows.map((r, i) => [newVals[i], ...r]);
      if (inputData.columnTypes) out.columnTypes = ['text', ...inputData.columnTypes];
    } else if (position === 'after') {
      const ins = (afterCol ?? 0) + 1;
      out.headers = [...inputData.headers.slice(0, ins), name, ...inputData.headers.slice(ins)];
      out.rows = inputData.rows.map((r, i) => [...r.slice(0, ins), newVals[i], ...r.slice(ins)]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes.slice(0, ins), 'text', ...inputData.columnTypes.slice(ins)];
    } else {
      out.headers = [...inputData.headers, name];
      out.rows = inputData.rows.map((r, i) => [...r, newVals[i]]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    }

    node.output = out;
    DWB.log(`Concatenate: added column "${name}" from ${parts.length} part(s)`);
  }
});

DWB.register('TARGETED_EDIT', {
  title: 'Edit Specific Record',
  icon: '✍️',
  category: 'Column Operations',
  desc: 'Manually overwrite cell values by matching rows against a specific value in a key column.',
  implemented: true,
  defaultConfig: {
    matchColIndex: 0,
    matchValue: '',
    editColIndex: 0,
    newValue: '',
    updateAll: false
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const colOpts = sel => prevData.headers.map((h, i) =>
      `<option value="${i}"${i === sel ? ' selected' : ''}>${h}</option>`).join('');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted)">1. Find rows where...</div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Match Column</label>
            <select id="te-mcol-${id}" style="width:100%">${colOpts(cfg.matchColIndex)}</select>
          </div>
          <div style="text-align:center;font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--text-faint)">EQUALS</div>
          <div>
            <input type="text" id="te-mval-${id}" value="${String(cfg.matchValue).replace(/"/g, '&quot;')}"
              placeholder="e.g. 'John Doe' or 'ID-1234'" style="width:100%">
          </div>
        </div>

        <div style="background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.22);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted)">2. Change this column...</div>
          <div>
            <select id="te-ecol-${id}" style="width:100%">${colOpts(cfg.editColIndex)}</select>
          </div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted)">3. To this new value...</div>
          <div>
            <input type="text" id="te-nval-${id}" value="${String(cfg.newValue).replace(/"/g, '&quot;')}"
              placeholder="Type the corrected value here..." style="width:100%">
          </div>
        </div>

        <div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="te-all-${id}"${cfg.updateAll ? ' checked' : ''}>
            Update ALL matching rows
          </label>
          <div id="te-preview-${id}" style="margin-top:6px;font-size:11px;color:var(--text-faint)"></div>
        </div>
      </div>`;

    function updatePreview() {
      const el = document.getElementById(`te-preview-${id}`);
      if (!el) return;
      const mv = String(cfg.matchValue).toLowerCase().trim();
      if (!mv) { el.textContent = ''; return; }
      let count = 0;
      for (const row of prevData.rows) {
        if (String(row[cfg.matchColIndex] ?? '').toLowerCase().trim() === mv) count++;
      }
      const verb = cfg.updateAll ? 'all will be' : 'only first will be';
      el.textContent = `${count} row${count !== 1 ? 's' : ''} match — ${verb} updated`;
    }

    updatePreview();

    document.getElementById(`te-mcol-${id}`).addEventListener('change', e => {
      cfg.matchColIndex = parseInt(e.target.value, 10);
      updatePreview();
      DWB.runFrom(node.id);
    });
    document.getElementById(`te-mval-${id}`).addEventListener('input', e => {
      cfg.matchValue = e.target.value;
      updatePreview();
      DWB.runFrom(node.id);
    });
    document.getElementById(`te-ecol-${id}`).addEventListener('change', e => {
      cfg.editColIndex = parseInt(e.target.value, 10);
      DWB.runFrom(node.id);
    });
    document.getElementById(`te-nval-${id}`).addEventListener('input', e => {
      cfg.newValue = e.target.value;
      DWB.runFrom(node.id);
    });
    document.getElementById(`te-all-${id}`).addEventListener('change', e => {
      cfg.updateAll = e.target.checked;
      updatePreview();
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { matchColIndex, matchValue, editColIndex, newValue, updateAll } = node.config;

    if (String(matchValue).trim() === '') {
      node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
      return;
    }

    const searchVal = String(matchValue).toLowerCase().trim();
    let foundFirst = false;

    const newRows = inputData.rows.map(row => {
      const newRow = [...row];
      if (updateAll || !foundFirst) {
        if (String(row[matchColIndex] ?? '').toLowerCase().trim() === searchVal) {
          newRow[editColIndex] = newValue;
          foundFirst = true;
        }
      }
      return newRow;
    });

    node.output = { headers: [...inputData.headers], rows: newRows };
  }
});

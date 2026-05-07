DWB.register('SUBSTRING', {
  title: 'Substring',
  icon: '✂️',
  category: 'Transform',
  desc: 'Extract a portion of text from a column by position or delimiter.',
  implemented: true,
  defaultConfig: {
    colIndex: 0,
    outputMode: 'overwrite',
    newColName: '',
    mode: 'position',
    start: 0,
    length: '',
    delimiter: '',
    delimTake: 'before',
    delimOccurrence: 1,
    delimiter2: '',
    lastN: 1
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (!cfg.newColName) cfg.newColName = (prevData.headers[cfg.colIndex] || 'col') + '_sub';

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i == cfg.colIndex ? ' selected' : ''}>${h}</option>`
    ).join('');

    const outOpts = [['overwrite','Overwrite source column'],['new','New column']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="sub-out-${node.id}" value="${v}" ${cfg.outputMode===v?'checked':''}> ${l}
      </label>`
    ).join('');

    const newColRow = cfg.outputMode === 'new' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
        <input type="text" id="sub-newcol-${node.id}" value="${cfg.newColName.replace(/"/g,'&quot;')}" style="width:100%">
      </div>` : '';

    const modeOpts = [['position','By position'],['delimiter','From delimiter'],['lastn','Last N characters']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="sub-mode-${node.id}" value="${v}" ${cfg.mode===v?'checked':''}> ${l}
      </label>`
    ).join('');

    let modeUI = '';
    if (cfg.mode === 'position') {
      modeUI = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Start (0-based)</label>
            <input type="number" id="sub-start-${node.id}" value="${cfg.start}" min="0" style="width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Length (blank = end)</label>
            <input type="text" id="sub-len-${node.id}" value="${cfg.length}" placeholder="to end" style="width:100%">
          </div>
        </div>`;
    } else if (cfg.mode === 'delimiter') {
      const takeOpts = [['before','Before delimiter'],['after','After delimiter'],['between','Between two delimiters']].map(([v,l]) =>
        `<option value="${v}"${cfg.delimTake===v?' selected':''}>${l}</option>`
      ).join('');
      const delim2Row = cfg.delimTake === 'between' ? `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Second Delimiter</label>
          <input type="text" id="sub-d2-${node.id}" value="${cfg.delimiter2.replace(/"/g,'&quot;')}" style="width:100%">
        </div>` : '';
      modeUI = `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Delimiter</label>
          <input type="text" id="sub-delim-${node.id}" value="${cfg.delimiter.replace(/"/g,'&quot;')}" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Take</label>
          <select id="sub-take-${node.id}" style="width:100%">${takeOpts}</select>
        </div>
        ${delim2Row}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Which occurrence (1 = first)</label>
          <input type="number" id="sub-occ-${node.id}" value="${cfg.delimOccurrence}" min="1" style="width:80px">
        </div>`;
    } else {
      modeUI = `
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">N characters from end</label>
          <input type="number" id="sub-lastn-${node.id}" value="${cfg.lastN}" min="1" style="width:80px">
        </div>`;
    }

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source Column</label>
          <select id="sub-col-${node.id}" style="width:100%">${colOpts}</select>
        </div>
        <div style="display:flex;gap:10px">${outOpts}</div>
        ${newColRow}
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Mode</div>
          <div style="display:flex;flex-direction:column;gap:3px">${modeOpts}</div>
        </div>
        ${modeUI}
        <button id="sub-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ✂️ Apply
        </button>
        ${status}
      </div>`;

    document.getElementById(`sub-col-${node.id}`).addEventListener('change', e => {
      cfg.colIndex = parseInt(e.target.value, 10);
      cfg.newColName = prevData.headers[cfg.colIndex] + '_sub';
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });
    document.querySelectorAll(`input[name="sub-out-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.outputMode = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    document.querySelectorAll(`input[name="sub-mode-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.mode = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });

    if (cfg.outputMode === 'new') {
      const nc = document.getElementById(`sub-newcol-${node.id}`);
      nc.addEventListener('input', () => { cfg.newColName = nc.value; });
    }
    if (cfg.mode === 'position') {
      const sEl = document.getElementById(`sub-start-${node.id}`);
      const lEl = document.getElementById(`sub-len-${node.id}`);
      sEl.addEventListener('input', () => { cfg.start = parseInt(sEl.value, 10) || 0; });
      lEl.addEventListener('input', () => { cfg.length = lEl.value; });
    } else if (cfg.mode === 'delimiter') {
      const dEl = document.getElementById(`sub-delim-${node.id}`);
      dEl.addEventListener('input', () => { cfg.delimiter = dEl.value; });
      document.getElementById(`sub-take-${node.id}`).addEventListener('change', e => {
        cfg.delimTake = e.target.value; DWB.renderActiveNode(); DWB.runFrom(node.id);
      });
      const occEl = document.getElementById(`sub-occ-${node.id}`);
      occEl.addEventListener('input', () => { cfg.delimOccurrence = parseInt(occEl.value, 10) || 1; });
      if (cfg.delimTake === 'between') {
        const d2El = document.getElementById(`sub-d2-${node.id}`);
        d2El.addEventListener('input', () => { cfg.delimiter2 = d2El.value; });
      }
    } else {
      const nEl = document.getElementById(`sub-lastn-${node.id}`);
      nEl.addEventListener('input', () => { cfg.lastN = parseInt(nEl.value, 10) || 1; });
    }

    document.getElementById(`sub-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndex, outputMode, newColName, mode, start, length, delimiter, delimTake, delimOccurrence, delimiter2, lastN } = node.config;

    function nthSplit(str, sep, n) {
      let idx = -1, count = 0;
      let pos = 0;
      while (pos < str.length) {
        const found = str.indexOf(sep, pos);
        if (found === -1) break;
        count++;
        if (count === n) { idx = found; break; }
        pos = found + sep.length;
      }
      return idx;
    }

    function extract(cell) {
      const s = String(cell ?? '');
      if (mode === 'position') {
        const st = start || 0;
        const l = length !== '' && length !== undefined ? parseInt(length, 10) : undefined;
        return l != null && !isNaN(l) ? s.substring(st, st + l) : s.substring(st);
      } else if (mode === 'delimiter') {
        if (!delimiter) return s;
        const occ = delimOccurrence || 1;
        const idx = nthSplit(s, delimiter, occ);
        if (idx === -1) return s;
        if (delimTake === 'before') return s.slice(0, idx);
        if (delimTake === 'after')  return s.slice(idx + delimiter.length);
        if (delimTake === 'between') {
          const after = s.slice(idx + delimiter.length);
          const idx2 = after.indexOf(delimiter2 || delimiter);
          return idx2 === -1 ? after : after.slice(0, idx2);
        }
      } else {
        return s.slice(-(lastN || 1));
      }
      return '';
    }

    const out = DWB.passthroughCopy(inputData);
    if (outputMode === 'overwrite') {
      out.rows = inputData.rows.map(r => {
        const row = [...r];
        row[colIndex] = extract(row[colIndex]);
        return row;
      });
    } else {
      const name = (newColName || '').trim() || prevData?.headers[colIndex] + '_sub' || 'substring';
      out.headers = [...inputData.headers, name];
      out.rows = inputData.rows.map(r => [...r, extract(r[colIndex])]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    }

    node.output = out;
    DWB.log(`Substring: extracted from column "${inputData.headers[colIndex]}"`);
  }
});

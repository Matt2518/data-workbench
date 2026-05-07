DWB.register('PAD_TEXT', {
  title: 'Pad Text',
  icon: '↔️',
  category: 'Transform',
  desc: 'Pad cell values to a minimum length with a fill character.',
  implemented: true,
  defaultConfig: { colIndices: 'all', targetLength: 10, fillChar: '0', direction: 'left', onlyPad: true },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (cfg.colIndices === 'all') cfg.colIndices = prevData.headers.map((_, i) => i);

    const checks = prevData.headers.map((h, i) => {
      const checked = cfg.colIndices.includes(i);
      return `<label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer">
        <input type="checkbox" data-idx="${i}" ${checked ? 'checked' : ''}> ${h}
      </label>`;
    }).join('');

    const dirOpts = [['left','Left pad'],['right','Right pad'],['both','Both (center)']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="pad-dir-${node.id}" value="${v}" ${cfg.direction===v?'checked':''}> ${l}
      </label>`
    ).join('');

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Columns</div>
          <div id="pad-cols-${node.id}" style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
            ${checks}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Target Length</label>
            <input type="number" id="pad-len-${node.id}" value="${cfg.targetLength}" min="1" style="width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Fill Character</label>
            <input type="text" id="pad-char-${node.id}" value="${cfg.fillChar.replace(/"/g,'&quot;')}" maxlength="1" style="width:100%">
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Direction</div>
          <div style="display:flex;gap:12px">${dirOpts}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="pad-only-${node.id}" ${cfg.onlyPad?'checked':''}> Only pad shorter values (don't truncate)
        </label>
        <button id="pad-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          ↔️ Apply
        </button>
        ${status}
      </div>`;

    document.getElementById(`pad-cols-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.colIndices.includes(idx)) cfg.colIndices.push(idx); }
      else { cfg.colIndices = cfg.colIndices.filter(i => i !== idx); }
    });

    document.getElementById(`pad-len-${node.id}`).addEventListener('input', e => { cfg.targetLength = parseInt(e.target.value, 10) || 1; });
    document.getElementById(`pad-char-${node.id}`).addEventListener('input', e => { cfg.fillChar = e.target.value.slice(-1) || '0'; });
    document.querySelectorAll(`input[name="pad-dir-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.direction = r.value; });
    });
    document.getElementById(`pad-only-${node.id}`).addEventListener('change', e => { cfg.onlyPad = e.target.checked; });
    document.getElementById(`pad-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndices, targetLength, fillChar, direction, onlyPad } = node.config;
    const idxSet = new Set(Array.isArray(colIndices) ? colIndices : inputData.headers.map((_, i) => i));
    const fill = (fillChar && fillChar.length) ? fillChar[0] : '0';
    const len = Math.max(1, targetLength);

    function padValue(str) {
      if (onlyPad && str.length >= len) return str;
      if (!onlyPad && str.length > len) return str.slice(0, len);
      if (direction === 'left')  return str.padStart(len, fill);
      if (direction === 'right') return str.padEnd(len, fill);
      // both: center, prefer left if odd
      const total = len - str.length;
      const left  = Math.ceil(total / 2);
      const right = total - left;
      return fill.repeat(left) + str + fill.repeat(right);
    }

    const out = DWB.passthroughCopy(inputData);
    out.rows = inputData.rows.map(r => r.map((cell, ci) => {
      if (!idxSet.has(ci)) return cell;
      const s = String(cell ?? '');
      return padValue(s);
    }));

    node.output = out;
    DWB.log(`Pad Text: applied to ${idxSet.size} column(s), target length ${len}`);
  }
});

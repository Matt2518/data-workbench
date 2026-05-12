function slugify(value, lowercase, separator) {
  let s = String(value ?? '');
  if (lowercase) s = s.toLowerCase();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/&/g, 'and');
  if (separator === '') {
    s = s.replace(/[^a-zA-Z0-9]/g, '');
  } else {
    const esc = separator === '-' ? '\\-' : separator;
    s = s.replace(new RegExp('[^a-zA-Z0-9' + esc + ']', 'g'), separator);
    s = s.replace(new RegExp('[' + esc + ']+', 'g'), separator);
    s = s.replace(new RegExp('^[' + esc + ']+|[' + esc + ']+$', 'g'), '');
  }
  return s;
}

DWB.register('URL_SAFE', {
  title: 'URL-Safe String',
  icon: '🔗',
  category: 'Column Operations',
  desc: 'Converts a column\'s values to URL-safe slugs.',
  implemented: true,
  defaultConfig: {
    sourceCol: 0,
    newColName: '',
    lowercase: true,
    separator: '-'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i === cfg.sourceCol ? ' selected' : ''}>${h}</option>`).join('');

    const sepOpts = [
      ['-', 'Hyphen (-)'],
      ['_', 'Underscore (_)'],
      ['',  'None']
    ].map(([v, l]) => `<option value="${v}"${v === cfg.separator ? ' selected' : ''}>${l}</option>`).join('');

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source Column</label>
          <select id="us-col-${id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
          <input type="text" id="us-name-${id}" value="${cfg.newColName.replace(/"/g, '&quot;')}"
            placeholder="Leave blank to overwrite" style="width:100%">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="us-lower-${id}"${cfg.lowercase ? ' checked' : ''}> Lowercase
        </label>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Separator</label>
          <select id="us-sep-${id}" style="width:100%">${sepOpts}</select>
        </div>
        ${status}
      </div>`;

    document.getElementById(`us-col-${id}`).addEventListener('change', e => {
      cfg.sourceCol = parseInt(e.target.value, 10);
      DWB.runFrom(node.id);
    });
    document.getElementById(`us-name-${id}`).addEventListener('input', e => {
      cfg.newColName = e.target.value;
      DWB.runFrom(node.id);
    });
    document.getElementById(`us-lower-${id}`).addEventListener('change', e => {
      cfg.lowercase = e.target.checked;
      DWB.runFrom(node.id);
    });
    document.getElementById(`us-sep-${id}`).addEventListener('change', e => {
      cfg.separator = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { sourceCol, newColName, lowercase, separator } = node.config;

    const results = inputData.rows.map(r => slugify(r[sourceCol], lowercase, separator));
    const out = DWB.passthroughCopy(inputData);

    if (newColName.trim()) {
      out.headers = [...inputData.headers, newColName.trim()];
      out.rows = inputData.rows.map((r, i) => [...r, results[i]]);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
    } else {
      out.rows = inputData.rows.map((r, i) => { const row = [...r]; row[sourceCol] = results[i]; return row; });
    }

    node.output = out;
    DWB.log(`URL-Safe: processed ${results.length} rows`);
  }
});

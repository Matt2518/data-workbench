function formatDate(date, fmt) {
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const y  = date.getFullYear();
  const mo = date.getMonth();
  const d  = date.getDate();
  const p2 = n => String(n).padStart(2, '0');
  switch (fmt) {
    case 'YYYY-MM-DD':   return `${y}-${p2(mo+1)}-${p2(d)}`;
    case 'MM/DD/YYYY':   return `${p2(mo+1)}/${p2(d)}/${y}`;
    case 'DD/MM/YYYY':   return `${p2(d)}/${p2(mo+1)}/${y}`;
    case 'M/D/YYYY':     return `${mo+1}/${d}/${y}`;
    case 'ISO8601':      return date.toISOString();
    case 'Display Long': return `${MONTHS[mo]} ${d}, ${y}`;
    default:             return `${y}-${p2(mo+1)}-${p2(d)}`;
  }
}

DWB.register('ARBITRARY_DATE', {
  title: 'Arbitrary Date',
  icon: '🗓️',
  category: 'Column Operations',
  desc: 'Appends a new column containing either today\'s date or a specific custom date.',
  implemented: true,
  defaultConfig: {
    newColName: 'Generated_Date',
    dateType: 'today',
    customDate: '',
    dateFormat: 'YYYY-MM-DD'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    const fmtOpts = [
      ['YYYY-MM-DD',   'YYYY-MM-DD (e.g. 2026-05-08)'],
      ['MM/DD/YYYY',   'MM/DD/YYYY (e.g. 05/08/2026)'],
      ['DD/MM/YYYY',   'DD/MM/YYYY (e.g. 08/05/2026)'],
      ['M/D/YYYY',     'M/D/YYYY (e.g. 5/8/2026)'],
      ['ISO8601',      'Full Timestamp (ISO 8601)'],
      ['Display Long', 'Display Long (e.g. May 8, 2026)']
    ].map(([v, l]) => `<option value="${v}"${v === cfg.dateFormat ? ' selected' : ''}>${l}</option>`).join('');

    const customDateRow = cfg.dateType === 'custom' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Custom Date</label>
        <input type="date" id="ad-cdate-${id}" value="${cfg.customDate}" style="width:100%">
      </div>` : '';

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Added column "${cfg.newColName || 'Date'}"</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
          <input type="text" id="ad-name-${id}" value="${cfg.newColName.replace(/"/g, '&quot;')}" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Date Type</label>
          <select id="ad-type-${id}" style="width:100%">
            <option value="today"${cfg.dateType === 'today' ? ' selected' : ''}>Today (Current System Date)</option>
            <option value="custom"${cfg.dateType === 'custom' ? ' selected' : ''}>Custom Date</option>
          </select>
        </div>
        ${customDateRow}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Output Format</label>
          <select id="ad-fmt-${id}" style="width:100%">${fmtOpts}</select>
        </div>
        ${status}
      </div>`;

    document.getElementById(`ad-name-${id}`).addEventListener('input', e => {
      cfg.newColName = e.target.value;
      DWB.runFrom(node.id);
    });

    document.getElementById(`ad-type-${id}`).addEventListener('change', e => {
      cfg.dateType = e.target.value;
      DWB.renderActiveNode();
      DWB.runFrom(node.id);
    });

    if (cfg.dateType === 'custom') {
      document.getElementById(`ad-cdate-${id}`).addEventListener('change', e => {
        cfg.customDate = e.target.value;
        DWB.runFrom(node.id);
      });
    }

    document.getElementById(`ad-fmt-${id}`).addEventListener('change', e => {
      cfg.dateFormat = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { newColName, dateType, customDate, dateFormat } = node.config;

    let date;
    if (dateType === 'today') {
      date = new Date();
    } else {
      if (!customDate) throw new Error('No custom date specified.');
      const [y, m, d] = customDate.split('-').map(Number);
      date = new Date(y, m - 1, d);
    }

    const value   = formatDate(date, dateFormat);
    const colName = (newColName || 'Date').trim();

    const out = DWB.passthroughCopy(inputData);
    out.headers = [...inputData.headers, colName];
    out.rows    = inputData.rows.map(r => [...r, value]);
    if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];

    node.output = out;
    DWB.log(`Arbitrary Date: added column "${colName}" → ${value}`);
  }
});

DWB.register('FORMAT_PHONE', {
  title: 'Format Phone',
  icon: '📞',
  category: 'Transform',
  desc: 'Standardize phone numbers to a consistent format.',
  implemented: true,
  defaultConfig: { colIndex: 0, format: 'us_paren', onError: 'leave', countryCode: '1' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i == cfg.colIndex ? ' selected' : ''}>${h}</option>`
    ).join('');

    const formats = [
      ['us_paren', '(xxx) xxx-xxxx'],
      ['us_dash',  'xxx-xxx-xxxx'],
      ['digits',   'xxxxxxxxxx (digits only)'],
      ['e164',     '+1xxxxxxxxxx (E.164)'],
      ['intl',     '+xx xx xxxx xxxx (international)']
    ];
    const fmtOpts = formats.map(([v, l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="phone-fmt-${node.id}" value="${v}" ${cfg.format===v?'checked':''}> ${l}
      </label>`
    ).join('');

    const ccRow = cfg.format === 'intl' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Country Code</label>
        <input type="text" id="phone-cc-${node.id}" value="${cfg.countryCode}" placeholder="1"
          style="width:80px">
      </div>` : '';

    const errOpts = [['leave','Leave original'],['clear','Clear cell'],['mark','Mark as ERR_PHONE']].map(([v,l]) =>
      `<option value="${v}"${cfg.onError===v?' selected':''}>${l}</option>`
    ).join('');

    const status = node.status === 'ok' && node._stats
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ ${node._stats.ok} formatted, ${node._stats.err} errors</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column</label>
          <select id="phone-col-${node.id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Output Format</div>
          <div style="display:flex;flex-direction:column;gap:3px">${fmtOpts}</div>
        </div>
        ${ccRow}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">On Error</label>
          <select id="phone-err-${node.id}" style="width:100%">${errOpts}</select>
        </div>
        ${status}
      </div>`;

    document.getElementById(`phone-col-${node.id}`).addEventListener('change', e => {
      cfg.colIndex = parseInt(e.target.value, 10);
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    document.querySelectorAll(`input[name="phone-fmt-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.format = r.value; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });
    document.getElementById(`phone-err-${node.id}`).addEventListener('change', e => {
      cfg.onError = e.target.value; DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    if (cfg.format === 'intl') {
      const ccEl = document.getElementById(`phone-cc-${node.id}`);
      ccEl.addEventListener('input', () => { cfg.countryCode = ccEl.value; });
      ccEl.addEventListener('change', () => { DWB.runFrom(node.id); DWB.renderActiveNode(); });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndex, format, onError, countryCode } = node.config;
    let ok = 0, err = 0;
    const cc = (countryCode || '1').replace(/\D/g, '');

    function applyFormat(digits) {
      const a = digits.slice(0, 3), b = digits.slice(3, 6), c = digits.slice(6);
      switch (format) {
        case 'us_paren': return `(${a}) ${b}-${c}`;
        case 'us_dash':  return `${a}-${b}-${c}`;
        case 'digits':   return digits;
        case 'e164':     return `+1${digits}`;
        case 'intl':     return `+${cc} ${a} ${b} ${c}`;
        default: return digits;
      }
    }

    const out = DWB.passthroughCopy(inputData);
    out.rows = inputData.rows.map(r => {
      const row = [...r];
      const raw = String(row[colIndex] ?? '');
      if (!raw.trim()) return row;

      let digits = raw.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);

      if (digits.length === 10) {
        row[colIndex] = applyFormat(digits);
        ok++;
      } else if (digits.length === 7) {
        row[colIndex] = applyFormat('000' + digits);
        ok++;
        DWB.log(`7-digit number found (no area code): ${raw}`, 'warn');
      } else {
        err++;
        if (onError === 'clear') row[colIndex] = '';
        else if (onError === 'mark') row[colIndex] = 'ERR_PHONE';
      }
      return row;
    });

    node._stats = { ok, err };
    node.output = out;
    DWB.log(`Format Phone: ${ok} formatted, ${err} errors`);
  }
});

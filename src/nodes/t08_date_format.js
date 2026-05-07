DWB.register('DATE_FORMAT', {
  title: 'Date Format',
  icon: '📅',
  category: 'Transform',
  desc: 'Parse and reformat date values in a column to a target format.',
  implemented: true,
  defaultConfig: {
    colIndex: 0, outputMode: 'overwrite', newColName: '',
    inputFmt: 'auto', outputFmt: 'YYYY-MM-DD', customFmt: '',
    onError: 'leave', appendTime: false, appendTimeVal: '08:00:00'
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (!cfg.newColName) cfg.newColName = (prevData.headers[cfg.colIndex] || 'date') + '_formatted';

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i == cfg.colIndex ? ' selected' : ''}>${h}</option>`
    ).join('');

    const inputFmts = [
      ['auto','Auto-detect (default)'],
      ['YYYY-MM-DD','YYYY-MM-DD'],['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],
      ['MM-DD-YYYY','MM-DD-YYYY'],['DD-MM-YYYY','DD-MM-YYYY'],['MM/DD/YY','MM/DD/YY'],
      ['DD Mon YYYY','DD Mon YYYY (e.g. 15 Jan 2024)'],['Mon DD YYYY','Mon DD YYYY (e.g. Jan 15 2024)'],
      ['unix_s','Unix timestamp (seconds)'],['unix_ms','Unix timestamp (milliseconds)']
    ];
    const outputFmts = [
      ['YYYY-MM-DD','YYYY-MM-DD'],['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],
      ['MMM-DD-YYYY','MMM-DD-YYYY (e.g. Jan-15-2024)'],['MMM DD, YYYY','MMM DD, YYYY (e.g. Jan 15, 2024)'],
      ['MMM-DD-YYYY HH:mm:ss','MMM-DD-YYYY HH:MM:SS (e.g. Jan-15-2024 08:00:00)'],
      ['DD MMM YYYY','DD MMM YYYY'],['YYYY','YYYY'],['MM/YYYY','MM/YYYY'],
      ['Day, MMM DD YYYY','Day, MMM DD YYYY (e.g. Monday, Jan 15 2024)'],
      ['unix_s','Unix timestamp (seconds)'],['custom','Custom...']
    ];

    const inOpts = inputFmts.map(([v,l]) =>
      `<option value="${v}"${v===cfg.inputFmt?' selected':''}>${l}</option>`).join('');
    const outOpts = outputFmts.map(([v,l]) =>
      `<option value="${v}"${v===cfg.outputFmt?' selected':''}>${l}</option>`).join('');

    const outModeOpts = [['overwrite','Overwrite source'],['new','New column']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="df-out-${node.id}" value="${v}" ${cfg.outputMode===v?'checked':''}> ${l}
      </label>`).join('');

    const newColRow = cfg.outputMode === 'new' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
        <input type="text" id="df-newcol-${node.id}" value="${cfg.newColName.replace(/"/g,'&quot;')}" style="width:100%">
      </div>` : '';

    const customRow = cfg.outputFmt === 'custom' ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Custom Format String</label>
        <input type="text" id="df-custom-${node.id}" value="${cfg.customFmt.replace(/"/g,'&quot;')}" placeholder="e.g. YYYY/MM/DD" style="width:100%">
        <div style="font-size:10px;color:var(--text-faint);margin-top:2px">Tokens: YYYY YY MM DD HH mm ss MMM MMMM Day Dy</div>
      </div>` : '';

    const onErrOpts = [['leave','Leave original'],['clear','Clear cell'],['err','Output ERR_DATE']].map(([v,l]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
        <input type="radio" name="df-err-${node.id}" value="${v}" ${cfg.onError===v?'checked':''}> ${l}
      </label>`).join('');

    const appendRow = cfg.appendTime ? `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Time to Append (HH:MM:SS)</label>
        <input type="text" id="df-time-${node.id}" value="${cfg.appendTimeVal.replace(/"/g,'&quot;')}" placeholder="08:00:00" style="width:120px">
      </div>` : '';

    const status = node.status === 'ok'
      ? `<div style="font-size:12px;color:var(--success)">✓ Done</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>` : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Source Column</label>
          <select id="df-col-${node.id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Output</div>
          <div style="display:flex;gap:12px">${outModeOpts}</div>
        </div>
        ${newColRow}
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Input Format</label>
          <select id="df-infmt-${node.id}" style="width:100%">${inOpts}</select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Output Format</label>
          <select id="df-outfmt-${node.id}" style="width:100%">${outOpts}</select>
        </div>
        ${customRow}
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">On Parse Error</div>
          <div style="display:flex;flex-direction:column;gap:3px">${onErrOpts}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="df-append-${node.id}" ${cfg.appendTime?'checked':''}> Append static time
        </label>
        ${appendRow}
        <button id="df-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          📅 Apply
        </button>
        ${status}
      </div>`;

    document.getElementById(`df-col-${node.id}`).addEventListener('change', e => {
      cfg.colIndex = parseInt(e.target.value, 10);
      cfg.newColName = prevData.headers[cfg.colIndex] + '_formatted';
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });
    document.querySelectorAll(`input[name="df-out-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.outputMode = r.value; DWB.renderActiveNode(); DWB.runFrom(node.id); });
    });
    if (cfg.outputMode === 'new') {
      const nc = document.getElementById(`df-newcol-${node.id}`);
      nc.addEventListener('input', () => { cfg.newColName = nc.value; });
    }
    document.getElementById(`df-infmt-${node.id}`).addEventListener('change', e => {
      cfg.inputFmt = e.target.value; DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    document.getElementById(`df-outfmt-${node.id}`).addEventListener('change', e => {
      cfg.outputFmt = e.target.value; DWB.renderActiveNode(); DWB.runFrom(node.id);
    });
    if (cfg.outputFmt === 'custom') {
      const cEl = document.getElementById(`df-custom-${node.id}`);
      cEl.addEventListener('input', () => { cfg.customFmt = cEl.value; });
    }
    document.querySelectorAll(`input[name="df-err-${node.id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.onError = r.value; DWB.runFrom(node.id); DWB.renderActiveNode(); });
    });
    document.getElementById(`df-append-${node.id}`).addEventListener('change', e => {
      cfg.appendTime = e.target.checked; DWB.renderActiveNode(); DWB.runFrom(node.id);
    });
    if (cfg.appendTime) {
      const tEl = document.getElementById(`df-time-${node.id}`);
      tEl.addEventListener('input', () => { cfg.appendTimeVal = tEl.value; });
    }
    document.getElementById(`df-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndex, outputMode, newColName, inputFmt, outputFmt, customFmt, onError, appendTime, appendTimeVal } = node.config;

    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS_LONG    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    function pad2(n) { return String(n).padStart(2, '0'); }

    function validDate(y, m, d) {
      if (m < 0 || m > 11 || d < 1 || d > 31) return null;
      const dt = new Date(y, m, d);
      return (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) ? dt : null;
    }

    function parseMonthName(v) {
      const s = String(v).trim();
      // DD Mon YYYY
      let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
      if (m) {
        const mo = MONTHS_SHORT.findIndex(mn => mn.toLowerCase() === m[2].toLowerCase().slice(0, 3));
        if (mo >= 0) return validDate(+m[3], mo, +m[1]);
      }
      // Mon DD YYYY
      m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})$/);
      if (m) {
        const mo = MONTHS_SHORT.findIndex(mn => mn.toLowerCase() === m[1].toLowerCase().slice(0, 3));
        if (mo >= 0) return validDate(+m[3], mo, +m[2]);
      }
      return null;
    }

    const PARSE_MAP = {
      'YYYY-MM-DD': v => {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? validDate(+m[1], +m[2]-1, +m[3]) : null;
      },
      'MM/DD/YYYY': v => {
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? validDate(+m[3], +m[1]-1, +m[2]) : null;
      },
      'DD/MM/YYYY': v => {
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? validDate(+m[3], +m[2]-1, +m[1]) : null;
      },
      'MM-DD-YYYY': v => {
        const m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        return m ? validDate(+m[3], +m[1]-1, +m[2]) : null;
      },
      'DD-MM-YYYY': v => {
        const m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        return m ? validDate(+m[3], +m[2]-1, +m[1]) : null;
      },
      'MM/DD/YY': v => {
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (!m) return null;
        const yr = +m[3];
        return validDate(yr < 50 ? 2000+yr : 1900+yr, +m[1]-1, +m[2]);
      },
      'DD Mon YYYY': parseMonthName,
      'Mon DD YYYY': parseMonthName,
      'unix_s': v => {
        const n = Number(v.trim());
        return (!isNaN(n) && /^\d+(\.\d+)?$/.test(v.trim())) ? new Date(n * 1000) : null;
      },
      'unix_ms': v => {
        const n = Number(v.trim());
        return (!isNaN(n) && /^\d+(\.\d+)?$/.test(v.trim())) ? new Date(n) : null;
      }
    };

    const AUTO_ORDER = ['YYYY-MM-DD','MM/DD/YYYY','DD/MM/YYYY','MM-DD-YYYY','DD-MM-YYYY','MM/DD/YY','DD Mon YYYY','Mon DD YYYY','unix_s','unix_ms'];

    function detectFormat(values) {
      const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (!nonEmpty.length) return null;
      for (const key of AUTO_ORDER) {
        const fn = PARSE_MAP[key];
        const hits = nonEmpty.filter(v => { const d = fn(String(v)); return d && !isNaN(d.getTime()); }).length;
        if (hits / nonEmpty.length >= 0.85) return key;
      }
      return null;
    }

    function formatDate(date, fmt, custom) {
      if (fmt === 'unix_s') return String(Math.floor(date.getTime() / 1000));
      const f = fmt === 'custom' ? (custom || '') : fmt;
      const Y = date.getFullYear(), Mo = date.getMonth(), D = date.getDate();
      const h = date.getHours(), mi = date.getMinutes(), s = date.getSeconds();
      return f
        .replace(/MMMM/g, MONTHS_LONG[Mo])
        .replace(/MMM/g,  MONTHS_SHORT[Mo])
        .replace(/Day/g,  DAYS_LONG[date.getDay()])
        .replace(/Dy/g,   DAYS_SHORT[date.getDay()])
        .replace(/YYYY/g, String(Y))
        .replace(/YY/g,   String(Y).slice(-2))
        .replace(/MM/g,   pad2(Mo+1))
        .replace(/DD/g,   pad2(D))
        .replace(/HH/g,   pad2(h))
        .replace(/mm/g,   pad2(mi))
        .replace(/ss/g,   pad2(s));
    }

    const colValues = inputData.rows.map(r => r[colIndex]);
    const activeFmt = inputFmt === 'auto' ? (detectFormat(colValues) || 'YYYY-MM-DD') : inputFmt;
    const parseFn = PARSE_MAP[activeFmt];

    let parsed = 0, errors = 0;
    const results = colValues.map(v => {
      const str = String(v ?? '');
      if (str.trim() === '') return str;
      const date = parseFn(str);
      if (!date || isNaN(date.getTime())) {
        errors++;
        if (onError === 'leave') return str;
        if (onError === 'clear') return '';
        return 'ERR_DATE';
      }
      parsed++;
      let out = formatDate(date, outputFmt, customFmt);
      if (appendTime) out += ' ' + (appendTimeVal || '08:00:00');
      return out;
    });

    const outObj = DWB.passthroughCopy(inputData);
    if (outputMode === 'overwrite') {
      outObj.rows = inputData.rows.map((r, i) => {
        const row = [...r]; row[colIndex] = results[i]; return row;
      });
    } else {
      const name = (newColName || '').trim() || (inputData.headers[colIndex] + '_formatted');
      outObj.headers = [...inputData.headers, name];
      outObj.rows = inputData.rows.map((r, i) => [...r, results[i]]);
      if (inputData.columnTypes) outObj.columnTypes = [...inputData.columnTypes, 'text'];
    }

    node.output = outObj;
    DWB.log(`Date Format: ${parsed} parsed, ${errors} error(s)${inputFmt==='auto' ? ` (auto-detected: ${activeFmt})` : ''}`);
  }
});

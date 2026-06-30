/* === DWBNodes: Transform category (7 nodes) === */
window.DWBNodes = window.DWBNodes || {};

/* ── Shared helpers ── */

function _tfEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Returns a .form-row div with a <label> and a <select> for column names.
   If currentRows is empty/absent the select gets a single disabled placeholder. */
function _tfColumnSelect(label, key, config, currentRows, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var cols = (currentRows && currentRows.length) ? Object.keys(currentRows[0]) : [];
  var optionsHtml;
  if (cols.length) {
    optionsHtml = '<option value="">-- select --</option>' +
      cols.map(function(c) {
        return '<option value="' + _tfEsc(c) + '"' +
          (config[key] === c ? ' selected' : '') + '>' + _tfEsc(c) + '</option>';
      }).join('');
  } else {
    optionsHtml = '<option value="" disabled selected>Run pipeline to see columns</option>';
  }
  wrap.innerHTML = '<label>' + _tfEsc(label) + '</label>' +
    '<select style="width:100%">' + optionsHtml + '</select>';
  var sel = wrap.querySelector('select');
  sel.addEventListener('change', function(e) { onChange(key, e.target.value); });
  return wrap;
}

function _tfFormatDate(date, fmt) {
  if (isNaN(date.getTime())) return '';
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return fmt
    .replace('YYYY', date.getFullYear())
    .replace('MM',   pad(date.getMonth() + 1))
    .replace('DD',   pad(date.getDate()))
    .replace('HH',   pad(date.getHours()))
    .replace('mm',   pad(date.getMinutes()))
    .replace('ss',   pad(date.getSeconds()));
}

function _tfParseDate(value, inputFormat) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return null;
  if (inputFormat) {
    /* Try known explicit patterns first */
    var m;
    if (inputFormat === 'MM/DD/YYYY') {
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    } else if (inputFormat === 'DD/MM/YYYY') {
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    } else if (inputFormat === 'YYYY-MM-DD') {
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    } else if (inputFormat === 'MM-DD-YYYY') {
      m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    } else if (inputFormat === 'DD-MM-YYYY') {
      m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    }
  }
  /* Fallback: native Date parsing */
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function _tfSlugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ── PAD_TEXT ── */

window.DWBNodes.PAD_TEXT = {
  label: 'Pad Text',
  icon: '↔️',
  category: 'Transform',
  defaultConfig: { column: '', side: 'left', char: '0', length: 5 },

  run: function(rows, config) {
    if (!config.column) return rows;
    var len = Math.max(1, config.length || 5);
    var fill = (config.char && config.char.length) ? config.char[0] : '0';
    var side = config.side || 'left';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      var s = String(row[config.column] == null ? '' : row[config.column]);
      if (s.length >= len) { return nr; }
      nr[config.column] = side === 'right' ? s.padEnd(len, fill) : s.padStart(len, fill);
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (!config.length || config.length < 1) return 'Length must be at least 1';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var sideRow = document.createElement('div');
    sideRow.className = 'form-row';
    sideRow.innerHTML = '<label>Side</label>' +
      '<div style="display:flex;gap:14px">' +
      ['left', 'right'].map(function(s) {
        return '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
          '<input type="radio" name="tf-pad-side" value="' + s + '"' + (config.side === s ? ' checked' : '') + '> ' +
          (s === 'left' ? 'Left' : 'Right') + '</label>';
      }).join('') + '</div>';
    sideRow.querySelectorAll('input[type=radio]').forEach(function(r) {
      r.addEventListener('change', function() { if (r.checked) onChange('side', r.value); });
    });
    div.appendChild(sideRow);

    var charRow = document.createElement('div');
    charRow.className = 'form-row';
    charRow.innerHTML = '<label>Fill character</label>' +
      '<input type="text" id="tf-pad-char" value="' + _tfEsc(config.char) + '" maxlength="1" style="width:2ch;text-align:center">';
    charRow.querySelector('#tf-pad-char').addEventListener('input', function(e) {
      var v = e.target.value.slice(-1);
      e.target.value = v;
      onChange('char', v || '0');
    });
    div.appendChild(charRow);

    var lenRow = document.createElement('div');
    lenRow.className = 'form-row';
    lenRow.innerHTML = '<label>Target length</label>' +
      '<input type="number" id="tf-pad-len" value="' + (config.length || 5) + '" min="1" max="50" style="width:80px">';
    lenRow.querySelector('#tf-pad-len').addEventListener('input', function(e) {
      onChange('length', parseInt(e.target.value, 10) || 1);
    });
    div.appendChild(lenRow);

    return div;
  }
};

/* ── SUBSTRING ── */

window.DWBNodes.SUBSTRING = {
  label: 'Substring',
  icon: '✂️',
  category: 'Transform',
  defaultConfig: { column: '', start: 0, end: null, outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var start = parseInt(config.start, 10) || 0;
    var end   = (config.end === null || config.end === '' || config.end === undefined)
                ? undefined : parseInt(config.end, 10);
    var outCol = (config.outputColumn || '').trim() || config.column;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var s = String(row[config.column] == null ? '' : row[config.column]);
        nr[outCol] = end !== undefined ? s.substring(start, end) : s.substring(start);
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var startRow = document.createElement('div');
    startRow.className = 'form-row';
    startRow.innerHTML = '<label>Start (0-based)</label>' +
      '<input type="number" id="tf-sub-start" value="' + (config.start || 0) + '" min="0" style="width:80px">';
    startRow.querySelector('#tf-sub-start').addEventListener('input', function(e) {
      onChange('start', parseInt(e.target.value, 10) || 0);
    });
    div.appendChild(startRow);

    var endRow = document.createElement('div');
    endRow.className = 'form-row';
    endRow.innerHTML = '<label>End (optional)</label>' +
      '<input type="number" id="tf-sub-end" value="' + (config.end == null ? '' : config.end) +
      '" min="0" style="width:80px" placeholder="End of string">';
    endRow.querySelector('#tf-sub-end').addEventListener('input', function(e) {
      var v = e.target.value.trim();
      onChange('end', v === '' ? null : (parseInt(v, 10) || null));
    });
    div.appendChild(endRow);

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-sub-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite source column" style="width:100%">';
    outRow.querySelector('#tf-sub-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    return div;
  }
};

/* ── DATE_FORMAT ── */

window.DWBNodes.DATE_FORMAT = {
  label: 'Date Format',
  icon: '📅',
  category: 'Transform',
  defaultConfig: { column: '', inputFormat: '', outputFormat: 'YYYY-MM-DD', outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var outCol = (config.outputColumn || '').trim() || config.column;
    var outFmt = (config.outputFormat || 'YYYY-MM-DD');
    var inFmt  = (config.inputFormat || '').trim();
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var raw = row[config.column];
        var s = String(raw == null ? '' : raw).trim();
        if (!s) { nr[outCol] = ''; return nr; }
        var date = _tfParseDate(s, inFmt || null);
        nr[outCol] = date ? _tfFormatDate(date, outFmt) : '';
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (!(config.outputFormat || '').trim()) return 'Output format is required';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var inFmtRow = document.createElement('div');
    inFmtRow.className = 'form-row';
    inFmtRow.innerHTML = '<label>Input format</label>' +
      '<input type="text" id="tf-df-infmt" value="' + _tfEsc(config.inputFormat || '') +
      '" placeholder="Optional parsing hint, e.g. MM/DD/YYYY" style="width:100%">';
    inFmtRow.querySelector('#tf-df-infmt').addEventListener('input', function(e) {
      onChange('inputFormat', e.target.value);
    });
    div.appendChild(inFmtRow);

    var outFmtRow = document.createElement('div');
    outFmtRow.className = 'form-row';
    outFmtRow.innerHTML = '<label>Output format</label>' +
      '<input type="text" id="tf-df-outfmt" value="' + _tfEsc(config.outputFormat || 'YYYY-MM-DD') +
      '" placeholder="YYYY-MM-DD" style="width:100%">' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Tokens: YYYY MM DD HH mm ss</div>';
    outFmtRow.querySelector('#tf-df-outfmt').addEventListener('input', function(e) {
      onChange('outputFormat', e.target.value);
    });
    div.appendChild(outFmtRow);

    var outColRow = document.createElement('div');
    outColRow.className = 'form-row';
    outColRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-df-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite" style="width:100%">';
    outColRow.querySelector('#tf-df-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outColRow);

    return div;
  }
};

/* ── FORMAT_PHONE ── */

function _tfApplyPhoneFormat(digits, format) {
  var di = 0;
  return format.split('').map(function(ch) {
    if (ch === 'X' && di < digits.length) { return digits[di++]; }
    return ch;
  }).join('');
}

window.DWBNodes.FORMAT_PHONE = {
  label: 'Format Phone',
  icon: '📞',
  category: 'Transform',
  defaultConfig: { column: '', format: '(XXX) XXX-XXXX', outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var fmt    = config.format || '(XXX) XXX-XXXX';
    var outCol = (config.outputColumn || '').trim() || config.column;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var raw    = String(row[config.column] == null ? '' : row[config.column]);
        var digits = raw.replace(/\D/g, '');
        if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
        nr[outCol] = digits.length === 10 ? _tfApplyPhoneFormat(digits, fmt) : raw;
      } catch (e) {
        nr[outCol] = String(row[config.column] == null ? '' : row[config.column]);
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var fmtRow = document.createElement('div');
    fmtRow.className = 'form-row';
    fmtRow.innerHTML = '<label>Format</label>' +
      '<input type="text" id="tf-ph-fmt" value="' + _tfEsc(config.format || '(XXX) XXX-XXXX') +
      '" placeholder="(XXX) XXX-XXXX" style="width:100%">' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">X = digit placeholder</div>';
    fmtRow.querySelector('#tf-ph-fmt').addEventListener('input', function(e) {
      onChange('format', e.target.value);
    });
    div.appendChild(fmtRow);

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-ph-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite source column" style="width:100%">';
    outRow.querySelector('#tf-ph-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    return div;
  }
};

/* ── URL_SAFE ── */

window.DWBNodes.URL_SAFE = {
  label: 'URL-Safe String',
  icon: '🔗',
  category: 'Transform',
  defaultConfig: { column: '', outputColumn: '', mode: 'slug' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var outCol = (config.outputColumn || '').trim() || config.column;
    var mode   = config.mode || 'slug';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var val = String(row[config.column] == null ? '' : row[config.column]);
        nr[outCol] = mode === 'encode' ? encodeURIComponent(val) : _tfSlugify(val);
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var modeRow = document.createElement('div');
    modeRow.className = 'form-row';
    modeRow.innerHTML = '<label>Mode</label>' +
      '<div style="display:flex;gap:14px">' +
      [['slug', 'Slug'], ['encode', 'URL Encode']].map(function(pair) {
        return '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
          '<input type="radio" name="tf-us-mode" value="' + pair[0] + '"' +
          (config.mode === pair[0] ? ' checked' : '') + '> ' + pair[1] + '</label>';
      }).join('') + '</div>';
    modeRow.querySelectorAll('input[type=radio]').forEach(function(r) {
      r.addEventListener('change', function() { if (r.checked) onChange('mode', r.value); });
    });
    div.appendChild(modeRow);

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-us-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite source column" style="width:100%">';
    outRow.querySelector('#tf-us-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    return div;
  }
};

/* ── BASIC_MATH ── */

window.DWBNodes.BASIC_MATH = {
  label: 'Basic Math',
  icon: '➗',
  category: 'Transform',
  defaultConfig: { columnA: '', operator: '+', columnB: '', constant: null, useConstant: false, outputColumn: 'result' },

  run: function(rows, config) {
    if (!config.columnA) return rows;
    var op       = config.operator || '+';
    var outCol   = (config.outputColumn || 'result').trim();
    var useConst = !!config.useConstant;
    var constVal = parseFloat(config.constant);
    if (isNaN(constVal)) constVal = 0;

    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var a = parseFloat(row[config.columnA]);
        var b = useConst ? constVal : parseFloat(row[config.columnB]);
        if (isNaN(a)) a = 0;
        if (isNaN(b)) b = 0;
        var result;
        switch (op) {
          case '+': result = a + b; break;
          case '-': result = a - b; break;
          case '*': result = a * b; break;
          case '/': result = b === 0 ? null : a / b; break;
          default:  result = null;
        }
        nr[outCol] = (result === null || !isFinite(result)) ? '' : result;
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.columnA) return 'Select Column A';
    if (!config.useConstant && !config.columnB) return 'Select Column B or enable constant';
    if (!(config.outputColumn || '').trim()) return 'Output column name is required';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column A', 'columnA', config, currentRows, onChange));

    var opRow = document.createElement('div');
    opRow.className = 'form-row';
    opRow.innerHTML = '<label>Operator</label>' +
      '<div style="display:flex;gap:10px">' +
      [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']].map(function(pair) {
        return '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">' +
          '<input type="radio" name="tf-bm-op" value="' + pair[0] + '"' +
          (config.operator === pair[0] ? ' checked' : '') + '> ' + pair[1] + '</label>';
      }).join('') + '</div>';
    opRow.querySelectorAll('input[type=radio]').forEach(function(r) {
      r.addEventListener('change', function() { if (r.checked) onChange('operator', r.value); });
    });
    div.appendChild(opRow);

    /* Toggle row */
    var toggleRow = document.createElement('div');
    toggleRow.className = 'form-row';
    toggleRow.innerHTML = '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">' +
      '<input type="checkbox" id="tf-bm-useconst"' + (config.useConstant ? ' checked' : '') + '> Use constant value</label>';
    toggleRow.querySelector('#tf-bm-useconst').addEventListener('change', function(e) {
      onChange('useConstant', e.target.checked);
      /* Rebuild the operand row */
      _tfBmRenderOperand(div, config, onChange, currentRows);
    });
    div.appendChild(toggleRow);

    /* Operand row — rendered dynamically */
    var operandHolder = document.createElement('div');
    operandHolder.id = 'tf-bm-operand';
    div.appendChild(operandHolder);
    _tfBmRenderOperand(div, config, onChange, currentRows);

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-bm-out" value="' + _tfEsc(config.outputColumn || 'result') +
      '" style="width:100%">';
    outRow.querySelector('#tf-bm-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    return div;
  }
};

function _tfBmRenderOperand(div, config, onChange, currentRows) {
  var holder = div.querySelector('#tf-bm-operand');
  if (!holder) return;
  holder.innerHTML = '';
  if (config.useConstant) {
    var constRow = document.createElement('div');
    constRow.className = 'form-row';
    constRow.innerHTML = '<label>Constant</label>' +
      '<input type="number" id="tf-bm-const" value="' + (config.constant == null ? '' : config.constant) +
      '" step="any" style="width:120px">';
    constRow.querySelector('#tf-bm-const').addEventListener('input', function(e) {
      onChange('constant', e.target.value === '' ? null : parseFloat(e.target.value));
    });
    holder.appendChild(constRow);
  } else {
    holder.appendChild(_tfColumnSelect('Column B', 'columnB', config, currentRows, onChange));
  }
}

/* ── AUTOINCREMENT ── */

window.DWBNodes.AUTOINCREMENT = {
  label: 'AutoIncrement',
  icon: '🔢',
  category: 'Transform',
  defaultConfig: { outputColumn: 'id', start: 1, step: 1 },

  run: function(rows, config) {
    var outCol = (config.outputColumn || 'id').trim();
    var start  = parseFloat(config.start);
    var step   = parseFloat(config.step);
    if (isNaN(start)) start = 1;
    if (isNaN(step))  step  = 1;
    return rows.map(function(row, i) {
      var nr = Object.assign({}, row);
      nr[outCol] = start + i * step;
      return nr;
    });
  },

  validate: function(config) {
    if (!(config.outputColumn || '').trim()) return 'Output column name is required';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-ai-out" value="' + _tfEsc(config.outputColumn || 'id') +
      '" style="width:100%">';
    outRow.querySelector('#tf-ai-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    var startRow = document.createElement('div');
    startRow.className = 'form-row';
    startRow.innerHTML = '<label>Start</label>' +
      '<input type="number" id="tf-ai-start" value="' + (config.start !== undefined ? config.start : 1) +
      '" style="width:80px">';
    startRow.querySelector('#tf-ai-start').addEventListener('input', function(e) {
      onChange('start', parseFloat(e.target.value) || 1);
    });
    div.appendChild(startRow);

    var stepRow = document.createElement('div');
    stepRow.className = 'form-row';
    stepRow.innerHTML = '<label>Step</label>' +
      '<input type="number" id="tf-ai-step" value="' + (config.step !== undefined ? config.step : 1) +
      '" style="width:80px">';
    stepRow.querySelector('#tf-ai-step').addEventListener('input', function(e) {
      onChange('step', parseFloat(e.target.value) || 1);
    });
    div.appendChild(stepRow);

    return div;
  }
};

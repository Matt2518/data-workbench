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
    var sideLbl = document.createElement('label');
    sideLbl.textContent = 'Side';
    sideRow.appendChild(sideLbl);
    sideRow.appendChild(_coreRadioGroup('tf-pad-side',
      [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }],
      config.side || 'left',
      function(val) { onChange('side', val); }
    ));
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

function _tfApplyCustomPhonePattern(pattern, digits) {
  var i = 0;
  return pattern.replace(/X/g, function() {
    return i < digits.length ? digits[i++] : '';
  });
}

function _tfApplyPhoneFormat(digits, format, countryCode, customPattern) {
  var a = digits.slice(0, 3), b = digits.slice(3, 6), c = digits.slice(6, 10);
  switch (format) {
    case 'us_paren': return '(' + a + ') ' + b + '-' + c;
    case 'us_dash':  return a + '-' + b + '-' + c;
    case 'digits':   return digits;
    case 'e164':     return '+1' + digits;
    case 'intl':     return '+' + (countryCode || '1') + ' ' + a + ' ' + b + ' ' + c;
    case 'custom':   return _tfApplyCustomPhonePattern(customPattern || '(XXX) XXX-XXXX', digits);
    default:         return '(' + a + ') ' + b + '-' + c;
  }
}

window.DWBNodes.FORMAT_PHONE = {
  label: 'Format Phone',
  icon: '📞',
  category: 'Transform',
  defaultConfig: { column: '', format: 'us_paren', countryCode: '1', customPattern: '(XXX) XXX-XXXX', onError: 'leave', outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var fmt       = config.format || 'us_paren';
    var cc        = (config.countryCode || '1').replace(/\D/g, '') || '1';
    var customPat = config.customPattern || '(XXX) XXX-XXXX';
    var onError   = config.onError || 'leave';
    var outCol    = (config.outputColumn || '').trim() || config.column;
    return rows.map(function(row) {
      var nr  = Object.assign({}, row);
      var raw = String(row[config.column] == null ? '' : row[config.column]);
      if (!raw.trim()) { nr[outCol] = raw; return nr; }
      var digits = raw.replace(/\D/g, '');
      if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
      if (digits.length === 7) digits = '000' + digits;
      if (digits.length === 10) {
        nr[outCol] = _tfApplyPhoneFormat(digits, fmt, cc, customPat);
      } else {
        if (onError === 'clear')     nr[outCol] = '';
        else if (onError === 'mark') nr[outCol] = 'ERR_PHONE';
        else                         nr[outCol] = raw;
      }
      return nr;
    });
  },

  validate: function(config) {
    return config.column ? null : 'Select a column';
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    var currentFmt = config.format || 'us_paren';

    // Conditional rows declared before the radio group so the onChange closure captures them
    var ccRow = document.createElement('div');
    ccRow.className = 'form-row';
    ccRow.style.display = currentFmt === 'intl' ? '' : 'none';
    ccRow.innerHTML = '<label>Country code</label>' +
      '<input type="text" id="tf-ph-cc" value="' + _tfEsc(config.countryCode || '1') +
      '" placeholder="1" style="width:3ch;min-width:42px">';
    ccRow.querySelector('#tf-ph-cc').addEventListener('input', function(e) {
      onChange('countryCode', e.target.value.replace(/\D/g, '') || '1');
    });

    var customRow = document.createElement('div');
    customRow.className = 'form-row';
    customRow.style.display = currentFmt === 'custom' ? '' : 'none';
    customRow.innerHTML = '<label>Pattern</label>' +
      '<input type="text" id="tf-ph-custom" value="' + _tfEsc(config.customPattern || '(XXX) XXX-XXXX') +
      '" placeholder="(XXX) XXX-XXXX" style="width:100%">' +
      '<div style="font-size:10px;color:var(--text-faint);margin-top:2px">Use X as a digit placeholder</div>';
    customRow.querySelector('#tf-ph-custom').addEventListener('input', function(e) {
      onChange('customPattern', e.target.value);
    });

    var fmtRow = document.createElement('div');
    fmtRow.className = 'form-row';
    var fmtLbl = document.createElement('label');
    fmtLbl.textContent = 'Format';
    fmtRow.appendChild(fmtLbl);
    fmtRow.appendChild(_coreRadioGroup('tf-ph-fmt',
      [
        { value: 'us_paren', label: '(xxx) xxx-xxxx' },
        { value: 'us_dash',  label: 'xxx-xxx-xxxx' },
        { value: 'digits',   label: 'xxxxxxxxxx (digits only)' },
        { value: 'e164',     label: '+1xxxxxxxxxx (E.164)' },
        { value: 'intl',     label: '+xx xx xxxx xxxx (international)' },
        { value: 'custom',   label: 'Custom pattern…' }
      ],
      currentFmt,
      function(val) {
        onChange('format', val);
        ccRow.style.display     = val === 'intl'   ? '' : 'none';
        customRow.style.display = val === 'custom' ? '' : 'none';
      },
      'vertical'
    ));
    div.appendChild(fmtRow);
    div.appendChild(ccRow);
    div.appendChild(customRow);

    var errRow = document.createElement('div');
    errRow.className = 'form-row';
    var errLbl = document.createElement('label');
    errLbl.textContent = 'On invalid';
    errRow.appendChild(errLbl);
    errRow.appendChild(_coreRadioGroup('tf-ph-err',
      [
        { value: 'leave', label: 'Leave unchanged' },
        { value: 'clear', label: 'Clear value' },
        { value: 'mark',  label: 'Mark as error' }
      ],
      config.onError || 'leave',
      function(val) { onChange('onError', val); }
    ));
    div.appendChild(errRow);

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
    var modeRowLbl = document.createElement('label');
    modeRowLbl.textContent = 'Mode';
    modeRow.appendChild(modeRowLbl);
    modeRow.appendChild(_coreRadioGroup('tf-us-mode',
      [{ value: 'slug', label: 'Slug' }, { value: 'encode', label: 'URL Encode' }],
      config.mode || 'slug',
      function(val) { onChange('mode', val); }
    ));
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
    var opLbl = document.createElement('label');
    opLbl.textContent = 'Operator';
    opRow.appendChild(opLbl);
    opRow.appendChild(_coreRadioGroup('tf-bm-op',
      [{ value: '+', label: '+' }, { value: '-', label: '−' }, { value: '*', label: '×' }, { value: '/', label: '÷' }],
      config.operator || '+',
      function(val) { onChange('operator', val); }
    ));
    div.appendChild(opRow);

    /* Toggle row */
    var toggleRow = _coreCheckboxRow('Use constant value', config.useConstant, function(v) {
      onChange('useConstant', v);
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

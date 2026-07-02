/* === DWBNodes: Transform category (8 nodes) === */
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

/* ── Date parsing/formatting helpers (v1.0-parity) ── */

function _tfValidDate(y, m, d) {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  var dt = new Date(y, m, d);
  return (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) ? dt : null;
}

var _tfMonthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var _tfMonthsLong  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var _tfDaysLong    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var _tfDaysShort   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function _tfParseMonthName(v) {
  var s = String(v).trim(), m, mo, i;
  // DD Mon YYYY
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    mo = -1;
    for (i = 0; i < _tfMonthsShort.length; i++) {
      if (_tfMonthsShort[i].toLowerCase() === m[2].toLowerCase().slice(0, 3)) { mo = i; break; }
    }
    if (mo >= 0) return _tfValidDate(+m[3], mo, +m[1]);
  }
  // Mon DD YYYY
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})$/);
  if (m) {
    mo = -1;
    for (i = 0; i < _tfMonthsShort.length; i++) {
      if (_tfMonthsShort[i].toLowerCase() === m[1].toLowerCase().slice(0, 3)) { mo = i; break; }
    }
    if (mo >= 0) return _tfValidDate(+m[3], mo, +m[2]);
  }
  return null;
}

var _tfParseMap = {
  'YYYY-MM-DD': function(v) {
    var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? _tfValidDate(+m[1], +m[2]-1, +m[3]) : null;
  },
  'MM/DD/YYYY': function(v) {
    var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? _tfValidDate(+m[3], +m[1]-1, +m[2]) : null;
  },
  'DD/MM/YYYY': function(v) {
    var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? _tfValidDate(+m[3], +m[2]-1, +m[1]) : null;
  },
  'MM-DD-YYYY': function(v) {
    var m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    return m ? _tfValidDate(+m[3], +m[1]-1, +m[2]) : null;
  },
  'DD-MM-YYYY': function(v) {
    var m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    return m ? _tfValidDate(+m[3], +m[2]-1, +m[1]) : null;
  },
  'MM/DD/YY': function(v) {
    var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!m) return null;
    var yr = +m[3];
    return _tfValidDate(yr < 50 ? 2000+yr : 1900+yr, +m[1]-1, +m[2]);
  },
  'DD Mon YYYY': _tfParseMonthName,
  'Mon DD YYYY': _tfParseMonthName,
  'unix_s': function(v) {
    var n = Number(v.trim());
    return (!isNaN(n) && /^\d+(\.\d+)?$/.test(v.trim())) ? new Date(n * 1000) : null;
  },
  'unix_ms': function(v) {
    var n = Number(v.trim());
    return (!isNaN(n) && /^\d+(\.\d+)?$/.test(v.trim())) ? new Date(n) : null;
  }
};

var _tfAutoOrder = ['YYYY-MM-DD','MM/DD/YYYY','DD/MM/YYYY','MM-DD-YYYY','DD-MM-YYYY','MM/DD/YY','DD Mon YYYY','Mon DD YYYY','unix_s','unix_ms'];

function _tfDetectFormat(values) {
  var nonEmpty = values.filter(function(v) { return v !== null && v !== undefined && String(v).trim() !== ''; });
  if (!nonEmpty.length) return { fmt: null, pct: 0 };
  for (var i = 0; i < _tfAutoOrder.length; i++) {
    var key = _tfAutoOrder[i];
    var fn = _tfParseMap[key];
    var hits = nonEmpty.filter(function(v) { var d = fn(String(v)); return d && !isNaN(d.getTime()); }).length;
    var pct = hits / nonEmpty.length;
    if (pct >= 0.85) return { fmt: key, pct: pct };
  }
  return { fmt: null, pct: 0 };
}

/* Token replace order: MMMM→MMM→Day→Dy→YYYY→YY→MM→DD→HH→mm→ss
   Longer tokens first prevents partial matches (e.g. YYYY consumed before YY can match). */
function _tfFormatDate(date, fmt) {
  if (!date || isNaN(date.getTime())) return '';
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var Y = date.getFullYear(), Mo = date.getMonth(), D = date.getDate();
  var h = date.getHours(), mi = date.getMinutes(), s = date.getSeconds();
  return fmt
    .replace(/MMMM/g, _tfMonthsLong[Mo])
    .replace(/MMM/g,  _tfMonthsShort[Mo])
    .replace(/Day/g,  _tfDaysLong[date.getDay()])
    .replace(/Dy/g,   _tfDaysShort[date.getDay()])
    .replace(/YYYY/g, String(Y))
    .replace(/YY/g,   String(Y).slice(-2))
    .replace(/MM/g,   pad(Mo + 1))
    .replace(/DD/g,   pad(D))
    .replace(/HH/g,   pad(h))
    .replace(/mm/g,   pad(mi))
    .replace(/ss/g,   pad(s));
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

var _tfDatePresets = {
  'YYYY-MM-DD':           'YYYY-MM-DD',
  'MM/DD/YYYY':           'MM/DD/YYYY',
  'DD/MM/YYYY':           'DD/MM/YYYY',
  'MMM-DD-YYYY':          'MMM-DD-YYYY',
  'MMM DD, YYYY':         'MMM DD, YYYY',
  'MMM-DD-YYYY HH:mm:ss': 'MMM-DD-YYYY HH:mm:ss',
  'DD MMM YYYY':          'DD MMM YYYY',
  'YYYY':                 'YYYY',
  'MM/YYYY':              'MM/YYYY',
  'Day, MMM DD YYYY':     'Day, MMM DD YYYY',
  'unix_s':               null
};

/* ── DATE_FORMAT ── */

window.DWBNodes.DATE_FORMAT = {
  label: 'Date Format',
  icon: '📅',
  category: 'Transform',
  defaultConfig: { column: '', inputFormat: 'auto', outputFormat: 'YYYY-MM-DD', customPattern: '', outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var outFmt = config.outputFormat || 'YYYY-MM-DD';
    var outCol = (config.outputColumn || '').trim() || config.column;

    // Detect input format once against the full column, not per row
    var activeFmt;
    if (config.inputFormat === 'auto') {
      var colValues = rows.map(function(r) { return r[config.column]; });
      var detected = _tfDetectFormat(colValues);
      activeFmt = detected.fmt || 'YYYY-MM-DD';
    } else {
      activeFmt = config.inputFormat;
    }
    var parseFn = _tfParseMap[activeFmt];

    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var raw = row[config.column];
        var s = String(raw == null ? '' : raw).trim();
        if (!s) { nr[outCol] = ''; return nr; }
        var date = parseFn ? parseFn(s) : null;
        if (!date || isNaN(date.getTime())) { nr[outCol] = ''; return nr; }
        if (outFmt === 'unix_s') {
          nr[outCol] = String(Math.floor(date.getTime() / 1000));
        } else if (outFmt === 'custom') {
          nr[outCol] = _tfFormatDate(date, config.customPattern || '');
        } else {
          var pattern = _tfDatePresets[outFmt];
          nr[outCol] = pattern ? _tfFormatDate(date, pattern) : '';
        }
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (config.outputFormat === 'custom' && !(config.customPattern || '').trim()) return 'Enter a custom pattern';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');

    // SOURCE
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    // INPUT FORMAT
    var inFmtRow = document.createElement('div');
    inFmtRow.className = 'form-row';
    var inFmtLbl = document.createElement('label');
    inFmtLbl.textContent = 'Input format';
    inFmtRow.appendChild(inFmtLbl);
    var inFmtOptions = [
      ['auto',        'Auto-detect (default)'],
      ['YYYY-MM-DD',  'YYYY-MM-DD'],
      ['MM/DD/YYYY',  'MM/DD/YYYY (e.g. 01/15/2024)'],
      ['DD/MM/YYYY',  'DD/MM/YYYY (e.g. 15/01/2024)'],
      ['MM-DD-YYYY',  'MM-DD-YYYY'],
      ['DD-MM-YYYY',  'DD-MM-YYYY'],
      ['MM/DD/YY',    'MM/DD/YY (e.g. 01/15/24)'],
      ['DD Mon YYYY', 'DD Mon YYYY (e.g. 15 Jan 2024)'],
      ['Mon DD YYYY', 'Mon DD YYYY (e.g. Jan 15 2024)'],
      ['unix_s',      'Unix timestamp (seconds)'],
      ['unix_ms',     'Unix timestamp (milliseconds)']
    ];
    var selEl = document.createElement('select');
    selEl.style.width = '100%';
    inFmtOptions.forEach(function(pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      if (config.inputFormat === pair[0]) opt.selected = true;
      selEl.appendChild(opt);
    });
    selEl.addEventListener('change', function(e) { onChange('inputFormat', e.target.value); });
    inFmtRow.appendChild(selEl);
    div.appendChild(inFmtRow);

    // Detection preview (when auto is selected and column data is available)
    if (config.inputFormat === 'auto' && currentRows && currentRows.length && config.column) {
      var colVals = currentRows.map(function(r) { return r[config.column]; });
      var det = _tfDetectFormat(colVals);
      var noteEl = document.createElement('div');
      noteEl.style.cssText = 'font-size:10px;margin-top:2px;margin-bottom:4px';
      if (det.fmt && det.pct >= 0.85) {
        noteEl.style.color = 'var(--text-faint)';
        noteEl.textContent = 'Detected: ' + det.fmt + ' (' + Math.round(det.pct * 100) + '% match)';
      } else if (det.fmt) {
        noteEl.style.color = 'var(--warning,#e6a817)';
        noteEl.textContent = '⚠️ Low confidence (' + Math.round(det.pct * 100) + '%) — consider selecting the format manually';
      } else {
        noteEl.style.color = 'var(--warning,#e6a817)';
        noteEl.textContent = '⚠️ Format not recognized — select the input format manually';
      }
      div.appendChild(noteEl);
    }

    // OUTPUT FORMAT
    var outFmtRow = document.createElement('div');
    outFmtRow.className = 'form-row';
    var outFmtLbl = document.createElement('label');
    outFmtLbl.textContent = 'Output format';
    outFmtRow.appendChild(outFmtLbl);
    var outPresets = [
      { value: 'YYYY-MM-DD',           label: 'YYYY-MM-DD' },
      { value: 'MM/DD/YYYY',           label: 'MM/DD/YYYY' },
      { value: 'DD/MM/YYYY',           label: 'DD/MM/YYYY' },
      { value: 'MMM-DD-YYYY',          label: 'MMM-DD-YYYY (e.g. Jan-15-2024)' },
      { value: 'MMM DD, YYYY',         label: 'MMM DD, YYYY (e.g. Jan 15, 2024)' },
      { value: 'MMM-DD-YYYY HH:mm:ss', label: 'MMM-DD-YYYY HH:mm:ss (e.g. Jan-15-2024 08:00:00)' },
      { value: 'DD MMM YYYY',          label: 'DD MMM YYYY' },
      { value: 'YYYY',                 label: 'YYYY' },
      { value: 'MM/YYYY',              label: 'MM/YYYY' },
      { value: 'Day, MMM DD YYYY',     label: 'Day, MMM DD YYYY (e.g. Monday, Jan 15 2024)' },
      { value: 'unix_s',               label: 'Unix timestamp (seconds)' },
      { value: 'custom',               label: 'Custom…' }
    ];

    // Custom pattern row — declared before radio group so the onChange closure can toggle it
    var customPatRow = document.createElement('div');
    customPatRow.className = 'form-row';
    customPatRow.style.display = config.outputFormat === 'custom' ? '' : 'none';
    customPatRow.innerHTML = '<label>Custom pattern</label>' +
      '<input type="text" id="tf-df-custom" value="' + _tfEsc(config.customPattern || '') +
      '" placeholder="MMM-DD-YYYY HH:mm:ss" style="width:100%">' +
      '<div style="font-size:10px;color:var(--text-faint);margin-top:2px">' +
      'Tokens: YYYY YY MM DD HH mm ss MMM MMMM Day Dy — any other characters are literal</div>';
    customPatRow.querySelector('#tf-df-custom').addEventListener('input', function(e) {
      onChange('customPattern', e.target.value);
    });

    outFmtRow.appendChild(_coreRadioGroup('tf-df-outfmt', outPresets,
      config.outputFormat || 'YYYY-MM-DD',
      function(val) {
        onChange('outputFormat', val);
        customPatRow.style.display = val === 'custom' ? '' : 'none';
      },
      'vertical'
    ));
    div.appendChild(outFmtRow);
    div.appendChild(customPatRow);

    // OUTPUT COLUMN
    var outColRow = document.createElement('div');
    outColRow.className = 'form-row';
    outColRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-df-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite source column" style="width:100%">';
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

/* ── ROUND helpers ── */

function _tfRoundValue(num, decimals, mode) {
  var factor = Math.pow(10, decimals);
  var n = parseFloat(num);
  if (isNaN(n)) return null;
  switch (mode) {
    case 'ceil':     return Math.ceil(n * factor) / factor;
    case 'floor':    return Math.floor(n * factor) / factor;
    case 'truncate': return Math.trunc(n * factor) / factor;
    default:
      return Math.round((n * factor) + (n >= 0 ? 1e-8 : -1e-8)) / factor;
  }
}

function _tfPadString(str, length, padChar, align) {
  var s = String(str);
  if (s.length >= length) return s;
  var pad = padChar.repeat(length - s.length);
  return align === 'right' ? s + pad : pad + s;
}

/* ── ROUND ── */

window.DWBNodes.ROUND = {
  label: 'Round',
  icon: '🔢',
  category: 'Transform',
  defaultConfig: { column: '', decimals: 2, roundMode: 'standard', outputFormat: 'raw', padLength: 8, padChar: '0', padAlign: 'left', outputColumn: '' },

  run: function(rows, config) {
    if (!config.column) return rows;
    var decimals = typeof config.decimals === 'number' ? config.decimals : 2;
    var mode     = config.roundMode || 'standard';
    var outFmt   = config.outputFormat || 'raw';
    var outCol   = (config.outputColumn || '').trim() || config.column;
    var padLen   = config.padLength || 8;
    var padChar  = (config.padChar && config.padChar.length) ? config.padChar[0] : '0';
    var padAlign = config.padAlign || 'left';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var rounded = _tfRoundValue(row[config.column], decimals, mode);
        if (rounded === null) { nr[outCol] = ''; return nr; }
        if (outFmt === 'fixed_decimal') {
          nr[outCol] = rounded.toFixed(decimals);
        } else if (outFmt === 'fixed_length') {
          nr[outCol] = _tfPadString(rounded.toFixed(decimals), padLen, padChar, padAlign);
        } else {
          nr[outCol] = rounded;
        }
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    var dec = config.decimals;
    if (typeof dec !== 'number' || dec < 0 || dec > 10) return 'Decimal places must be between 0 and 10';
    if (config.outputFormat === 'fixed_length' && !(config.padLength >= 1)) return 'Total length must be at least 1';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');

    // SOURCE
    div.appendChild(_tfColumnSelect('Column', 'column', config, currentRows, onChange));

    // ROUNDING
    var decRow = document.createElement('div');
    decRow.className = 'form-row';
    decRow.innerHTML = '<label>Decimal places</label>' +
      '<input type="number" id="tf-rd-dec" value="' + (config.decimals !== undefined ? config.decimals : 2) +
      '" min="0" max="10" style="width:60px">';
    decRow.querySelector('#tf-rd-dec').addEventListener('input', function(e) {
      var v = parseInt(e.target.value, 10);
      onChange('decimals', isNaN(v) ? 2 : Math.max(0, Math.min(10, v)));
    });
    div.appendChild(decRow);

    var modeRow = document.createElement('div');
    modeRow.className = 'form-row';
    var modeLbl = document.createElement('label');
    modeLbl.textContent = 'Rounding mode';
    modeRow.appendChild(modeLbl);
    modeRow.appendChild(_coreRadioGroup('tf-rd-mode',
      [
        { value: 'standard',  label: 'Standard' },
        { value: 'ceil',      label: 'Round Up' },
        { value: 'floor',     label: 'Round Down' },
        { value: 'truncate',  label: 'Truncate' }
      ],
      config.roundMode || 'standard',
      function(val) { onChange('roundMode', val); }
    ));
    div.appendChild(modeRow);

    // OUTPUT FORMAT — pad controls declared before radio group so onChange can toggle them
    var padControls = document.createElement('div');
    padControls.style.display = (config.outputFormat === 'fixed_length') ? '' : 'none';

    var padLenRow = document.createElement('div');
    padLenRow.className = 'form-row';
    padLenRow.innerHTML = '<label>Total length</label>' +
      '<input type="number" id="tf-rd-padlen" value="' + (config.padLength || 8) +
      '" min="1" max="30" style="width:60px">';
    padLenRow.querySelector('#tf-rd-padlen').addEventListener('input', function(e) {
      var v = parseInt(e.target.value, 10);
      onChange('padLength', isNaN(v) ? 8 : Math.max(1, Math.min(30, v)));
    });
    padControls.appendChild(padLenRow);

    var padCharRow = document.createElement('div');
    padCharRow.className = 'form-row';
    padCharRow.innerHTML = '<label>Pad character</label>' +
      '<input type="text" id="tf-rd-padchar" value="' + _tfEsc(config.padChar || '0') +
      '" maxlength="1" style="width:2ch;text-align:center">';
    padCharRow.querySelector('#tf-rd-padchar').addEventListener('input', function(e) {
      var v = e.target.value.slice(-1);
      e.target.value = v;
      onChange('padChar', v || '0');
    });
    padControls.appendChild(padCharRow);

    var padAlignRow = document.createElement('div');
    padAlignRow.className = 'form-row';
    var padAlignLbl = document.createElement('label');
    padAlignLbl.textContent = 'Alignment';
    padAlignRow.appendChild(padAlignLbl);
    padAlignRow.appendChild(_coreRadioGroup('tf-rd-align',
      [{ value: 'left', label: 'Left-pad' }, { value: 'right', label: 'Right-pad' }],
      config.padAlign || 'left',
      function(val) { onChange('padAlign', val); }
    ));
    padControls.appendChild(padAlignRow);

    var fmtRow = document.createElement('div');
    fmtRow.className = 'form-row';
    var fmtLbl = document.createElement('label');
    fmtLbl.textContent = 'Output format';
    fmtRow.appendChild(fmtLbl);
    fmtRow.appendChild(_coreRadioGroup('tf-rd-fmt',
      [
        { value: 'raw',           label: 'Raw number (e.g. 1.5)' },
        { value: 'fixed_decimal', label: 'Fixed decimal places (e.g. 1.50)' },
        { value: 'fixed_length',  label: 'Fixed string length (e.g. 001.50)' }
      ],
      config.outputFormat || 'raw',
      function(val) {
        onChange('outputFormat', val);
        padControls.style.display = val === 'fixed_length' ? '' : 'none';
      },
      'vertical'
    ));
    div.appendChild(fmtRow);
    div.appendChild(padControls);

    // OUTPUT COLUMN
    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column</label>' +
      '<input type="text" id="tf-rd-out" value="' + _tfEsc(config.outputColumn || '') +
      '" placeholder="Leave blank to overwrite source column" style="width:100%">';
    outRow.querySelector('#tf-rd-out').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value);
    });
    div.appendChild(outRow);

    return div;
  }
};

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

/* === DWBNodes: Advanced + Output category (4 nodes) === */
window.DWBNodes = window.DWBNodes || {};

/* ── Shared helpers (_ao prefix) ── */

function _aoEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _aoCols(currentRows) {
  return (currentRows && currentRows.length) ? Object.keys(currentRows[0]) : [];
}

function _aoColOptHtml(cols, selected) {
  return cols.length
    ? '<option value="">-- select --</option>' + cols.map(function(c) {
        return '<option value="' + _aoEsc(c) + '"' + (selected === c ? ' selected' : '') + '>' + _aoEsc(c) + '</option>';
      }).join('')
    : '<option value="" disabled selected>Run pipeline to see columns</option>';
}

function _aoColSelect(label, key, config, currentRows, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var cols = _aoCols(currentRows);
  wrap.innerHTML = '<label>' + _aoEsc(label) + '</label>' +
    '<select style="width:100%">' + _aoColOptHtml(cols, config[key]) + '</select>';
  wrap.querySelector('select').addEventListener('change', function(e) { onChange(key, e.target.value); });
  return wrap;
}

/* ── Sentiment lexicon (ported verbatim from src/plugins/data-analysis/sentiment-analysis.js) ── */

var _aoLexicon = {
  // Strong positive (+3)
  outstanding: 3, excellent: 3, exceptional: 3, fantastic: 3,
  perfect: 3, brilliant: 3, superb: 3, loved: 3,
  // Positive (+2)
  great: 2, awesome: 2, amazing: 2, wonderful: 2, best: 2,
  valuable: 2, happy: 2, engaging: 2, enjoyed: 2, love: 2,
  informative: 2, inspiring: 2, thorough: 2, comprehensive: 2,
  // Mildly positive (+1)
  good: 1, nice: 1, helpful: 1, useful: 1, effective: 1,
  clear: 1, solid: 1, improving: 1, like: 1, relevant: 1,
  applicable: 1, practical: 1, organized: 1, prepared: 1,
  knowledgeable: 1, professional: 1, interactive: 1,
  // Mildly negative (-1)
  bad: -1, unclear: -1, confusing: -1, hard: -1,
  difficult: -1, slow: -1, issue: -1, lacking: -1,
  boring: -1, outdated: -1, rushed: -1, repetitive: -1,
  vague: -1, disorganized: -1, monotonous: -1,
  // Negative (-2)
  poor: -2, terrible: -2, awful: -2, horrible: -2,
  worst: -2, failed: -2, useless: -2, waste: -2,
  broken: -2, disappointing: -2, frustrating: -2,
  inadequate: -2, unacceptable: -2, irrelevant: -2,
  unprepared: -2, ineffective: -2,
  // Strongly negative (-3)
  hate: -3, disgusting: -3, pathetic: -3, abysmal: -3,
  deplorable: -3
};

function _aoScoreText(text) {
  var words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  var score = 0;
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (!w || w.length < 2) continue;
    if (Object.prototype.hasOwnProperty.call(_aoLexicon, w)) score += _aoLexicon[w];
  }
  return score;
}

/* ── Date helpers ── */

function _aoParseDate(value) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return null;
  var m;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function _aoIsoDate(d) {
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function _aoAddUnit(date, amount, unit) {
  var d = new Date(date.getTime());
  if (unit === 'days')        d.setDate(d.getDate() + amount);
  else if (unit === 'months') d.setMonth(d.getMonth() + amount);
  else if (unit === 'years')  d.setFullYear(d.getFullYear() + amount);
  return d;
}

function _aoDiffUnit(d1, d2, unit) {
  if (unit === 'days')   return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  if (unit === 'months') return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (unit === 'years')  return d2.getFullYear() - d1.getFullYear();
  return 0;
}

/* ── CSV serializer ── */

function _aoRowsToCSV(rows) {
  if (!rows.length) return '';
  var headers = Object.keys(rows[0]);
  var esc = function(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  var lines = [headers.map(esc).join(',')];
  rows.forEach(function(row) {
    lines.push(headers.map(function(h) { return esc(row[h]); }).join(','));
  });
  return lines.join('\n');
}

function _aoTriggerDownload(rows, filename) {
  var csv = _aoRowsToCSV(rows);
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var fname = (filename || 'export').replace(/\.csv$/i, '') + '.csv';
  var a = Object.assign(document.createElement('a'), { href: url, download: fname });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ───────────────────────────────────────────────────────────
   SENTIMENT_ANALYSIS
   Lexicon-based per-row text scoring. Outputs the string
   'positive', 'neutral', or 'negative' to outputColumn.
   Output values match exactly what QUOTES_BOARD sentimentField
   expects (case-insensitive match in renderer).
─────────────────────────────────────────────────────────── */

window.DWBNodes.SENTIMENT_ANALYSIS = {
  label: 'Sentiment Analysis',
  icon: '😊',
  category: 'Advanced',
  defaultConfig: { textColumn: '', outputColumn: 'sentiment' },

  run: function(rows, config) {
    var col = config.textColumn;
    var outCol = (config.outputColumn || 'sentiment').trim() || 'sentiment';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      var text = String(row[col] == null ? '' : row[col]).trim();
      if (!text) { nr[outCol] = 'neutral'; return nr; }
      var score = _aoScoreText(text);
      nr[outCol] = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
      return nr;
    });
  },

  validate: function(config) {
    if (!config.textColumn) return 'Select a text column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    div.appendChild(_aoColSelect('Text Column', 'textColumn', config, currentRows, onChange));

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output Column</label>' +
      '<input type="text" style="width:100%" value="' + _aoEsc(config.outputColumn || 'sentiment') + '" placeholder="sentiment">';
    outRow.querySelector('input').addEventListener('input', function(e) {
      onChange('outputColumn', e.target.value.trim() || 'sentiment');
    });
    div.appendChild(outRow);

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--text-muted)';
    hint.textContent = 'Writes "positive", "neutral", or "negative" per row using a keyword lexicon.';
    div.appendChild(hint);

    return div;
  }
};

/* ───────────────────────────────────────────────────────────
   ARBITRARY_DATE
   Date arithmetic on an existing column: add/subtract a
   duration, or compute the difference between dates.
─────────────────────────────────────────────────────────── */

window.DWBNodes.ARBITRARY_DATE = {
  label: 'Date Arithmetic',
  icon: '📆',
  category: 'Advanced',
  defaultConfig: { column: '', mode: 'add', amount: 0, unit: 'days', outputColumn: '', compareColumn: '' },

  run: function(rows, config) {
    var col    = config.column;
    var mode   = config.mode || 'add';
    var amount = parseInt(config.amount, 10) || 0;
    var unit   = config.unit || 'days';
    var outCol = (config.outputColumn || '').trim() || col;
    var cmpCol = config.compareColumn || '';
    var today  = new Date(); today.setHours(0, 0, 0, 0);

    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var d = _aoParseDate(row[col]);
        if (!d) { nr[outCol] = ''; return nr; }

        if (mode === 'add') {
          nr[outCol] = _aoIsoDate(_aoAddUnit(d, amount, unit));
        } else if (mode === 'diff_from_today') {
          nr[outCol] = _aoDiffUnit(d, today, unit);
        } else if (mode === 'diff_from_column') {
          var d2 = _aoParseDate(row[cmpCol]);
          nr[outCol] = d2 != null ? _aoDiffUnit(d, d2, unit) : '';
        }
      } catch (e) {
        nr[outCol] = '';
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a date column';
    if (config.mode === 'diff_from_column' && !config.compareColumn) return 'Select a comparison column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    div.appendChild(_aoColSelect('Date Column', 'column', config, currentRows, onChange));

    var mode = config.mode || 'add';

    // Amount input (only for 'add') — declared before modeRow so the onChange closure captures it
    var amtRow = document.createElement('div');
    amtRow.className = 'form-row';
    amtRow.style.display = mode === 'add' ? '' : 'none';
    amtRow.innerHTML = '<label>Amount</label>' +
      '<input type="number" style="width:100%" value="' + (config.amount || 0) + '">';
    amtRow.querySelector('input').addEventListener('input', function(e) {
      onChange('amount', parseInt(e.target.value, 10) || 0);
    });

    // Compare column (only for diff_from_column) — declared before modeRow for same reason
    var cmpRow = _aoColSelect('Compare Column', 'compareColumn', config, currentRows, onChange);
    cmpRow.style.display = mode === 'diff_from_column' ? '' : 'none';

    // Mode radio group
    var modeRow = document.createElement('div');
    modeRow.className = 'form-row';
    var modeRowLbl = document.createElement('label');
    modeRowLbl.textContent = 'Mode';
    modeRow.appendChild(modeRowLbl);
    modeRow.appendChild(_coreRadioGroup('ao-dt-mode',
      [
        { value: 'add',              label: 'Add to date' },
        { value: 'diff_from_today',  label: 'Days until today' },
        { value: 'diff_from_column', label: 'Compare to column' }
      ],
      mode,
      function(val) {
        onChange('mode', val);
        amtRow.style.display = val === 'add' ? '' : 'none';
        cmpRow.style.display  = val === 'diff_from_column' ? '' : 'none';
      }
    ));
    div.appendChild(modeRow);
    div.appendChild(amtRow);

    // Unit select
    var unitRow = document.createElement('div');
    unitRow.className = 'form-row';
    var unit = config.unit || 'days';
    unitRow.innerHTML = '<label>Unit</label>' +
      '<select style="width:100%">' +
      ['days', 'months', 'years'].map(function(u) {
        return '<option value="' + u + '"' + (unit === u ? ' selected' : '') + '>' +
          u.charAt(0).toUpperCase() + u.slice(1) + '</option>';
      }).join('') + '</select>';
    unitRow.querySelector('select').addEventListener('change', function(e) { onChange('unit', e.target.value); });
    div.appendChild(unitRow);

    div.appendChild(cmpRow);

    // Output column
    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output Column</label>' +
      '<input type="text" style="width:100%" value="' + _aoEsc(config.outputColumn || '') + '" placeholder="(overwrite source column)">';
    outRow.querySelector('input').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.appendChild(outRow);

    return div;
  }
};

/* ───────────────────────────────────────────────────────────
   SET_TYPES
   Coerces column values to a target type (string, number,
   boolean, date). Writes a dynamic column→type mapping.
─────────────────────────────────────────────────────────── */

window.DWBNodes.SET_TYPES = {
  label: 'Set Types',
  icon: '🔢',
  category: 'Advanced',
  defaultConfig: { typeMap: {} },

  run: function(rows, config) {
    var typeMap = config.typeMap || {};
    if (!Object.keys(typeMap).length) return rows;

    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      Object.keys(typeMap).forEach(function(col) {
        var targetType = typeMap[col];
        var val = row[col];
        try {
          if (targetType === 'number') {
            nr[col] = parseFloat(val);
            if (isNaN(nr[col])) nr[col] = 0;
          } else if (targetType === 'string') {
            nr[col] = String(val == null ? '' : val);
          } else if (targetType === 'boolean') {
            if (typeof val === 'boolean') { nr[col] = val; }
            else {
              var s = String(val == null ? '' : val).toLowerCase().trim();
              nr[col] = s === 'true' || s === '1' || s === 'yes';
            }
          } else if (targetType === 'date') {
            var d = _aoParseDate(val);
            nr[col] = d ? _aoIsoDate(d) : '';
          }
        } catch (e) {
          nr[col] = val;
        }
      });
      return nr;
    });
  },

  validate: function(config) {
    if (!config.typeMap || !Object.keys(config.typeMap).length) return 'Add at least one column mapping';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var typeMap = config.typeMap || {};
    var allCols = _aoCols(currentRows);

    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    function renderRows() {
      div.innerHTML = '';

      var mappedCols = Object.keys(typeMap);

      if (!mappedCols.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'font-size:12px;color:var(--text-faint);padding:4px 0';
        empty.textContent = 'No columns mapped yet.';
        div.appendChild(empty);
      }

      mappedCols.forEach(function(col) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center';

        // Column selector (exclude columns already in other rows)
        var otherMapped = mappedCols.filter(function(c) { return c !== col; });
        var availCols = allCols.filter(function(c) { return c === col || !otherMapped.includes(c); });
        var colSel = document.createElement('select');
        colSel.style.cssText = 'flex:1;font-size:12px';
        colSel.innerHTML = _aoColOptHtml(availCols, col);
        colSel.addEventListener('change', function(e) {
          var newCol = e.target.value;
          if (!newCol || newCol === col) return;
          var savedType = typeMap[col];
          delete typeMap[col];
          typeMap[newCol] = savedType;
          onChange('typeMap', Object.assign({}, typeMap));
          renderRows();
        });

        // Type selector
        var typeSel = document.createElement('select');
        typeSel.style.cssText = 'flex:1;font-size:12px';
        typeSel.innerHTML = ['string', 'number', 'boolean', 'date'].map(function(t) {
          return '<option value="' + t + '"' + (typeMap[col] === t ? ' selected' : '') + '>' +
            t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
        }).join('');
        typeSel.addEventListener('change', function(e) {
          typeMap[col] = e.target.value;
          onChange('typeMap', Object.assign({}, typeMap));
        });

        // Delete button
        var del = document.createElement('button');
        del.style.cssText = 'background:transparent;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:0 4px;flex-shrink:0';
        del.textContent = '✕';
        del.title = 'Remove';
        del.addEventListener('click', function() {
          delete typeMap[col];
          onChange('typeMap', Object.assign({}, typeMap));
          renderRows();
        });

        row.appendChild(colSel);
        row.appendChild(typeSel);
        row.appendChild(del);
        div.appendChild(row);
      });

      // "+ Add column" button
      var addBtn = document.createElement('button');
      addBtn.style.cssText = 'margin-top:4px;padding:4px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;font-size:12px;cursor:pointer';
      addBtn.textContent = '+ Add column';
      var unmapped = allCols.filter(function(c) { return !mappedCols.includes(c); });
      if (!unmapped.length) addBtn.disabled = true;
      addBtn.addEventListener('click', function() {
        var next = unmapped[0];
        if (!next) return;
        typeMap[next] = 'string';
        onChange('typeMap', Object.assign({}, typeMap));
        renderRows();
      });
      div.appendChild(addBtn);
    }

    renderRows();
    return div;
  }
};

/* ───────────────────────────────────────────────────────────
   EXPORT_CSV
   Terminal/output node. run() is a pass-through — it does NOT
   transform rows. The pipeline treats this node as non-
   transformative; the actual CSV download is triggered by a
   UI button in configUI, not during pipeline execution. This
   matches the v1.0 pattern where execute() called
   DWB.passthroughCopy() and the download was a separate action.
─────────────────────────────────────────────────────────── */

window.DWBNodes.EXPORT_CSV = {
  label: 'Export CSV',
  icon: '💾',
  category: 'Input & Output',
  defaultConfig: { filename: 'export.csv' },

  // Pass-through: rows are not modified. The download is a UI action in configUI.
  run: function(rows, config) {
    return rows;
  },

  validate: function(config) { return null; },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    var hasData = !!(currentRows && currentRows.length);
    var rowCount = hasData ? currentRows.length : 0;
    var colCount = hasData ? Object.keys(currentRows[0]).length : 0;

    var fnRow = document.createElement('div');
    fnRow.className = 'form-row';
    fnRow.innerHTML = '<label>Filename</label>' +
      '<input type="text" style="width:100%" value="' + _aoEsc(config.filename || 'export.csv') + '" placeholder="export.csv">';
    fnRow.querySelector('input').addEventListener('input', function(e) {
      onChange('filename', e.target.value.trim() || 'export.csv');
    });
    div.appendChild(fnRow);

    var info = document.createElement('div');
    info.style.cssText = 'font-size:12px;color:var(--text-muted)';
    info.textContent = hasData
      ? rowCount.toLocaleString() + ' rows × ' + colCount + ' columns ready'
      : 'No data — run an upstream node first.';
    div.appendChild(info);

    var dlBtn = document.createElement('button');
    dlBtn.style.cssText = 'margin-top:4px;padding:8px 14px;font-size:13px;font-weight:600;border-radius:5px;cursor:' +
      (hasData ? 'pointer' : 'not-allowed') + ';background:' +
      (hasData ? 'var(--accent)' : 'var(--bg-raised)') + ';color:' +
      (hasData ? '#fff' : 'var(--text-faint)') + ';border:1px solid ' +
      (hasData ? 'transparent' : 'var(--border)');
    dlBtn.textContent = '⬇ Download Now';
    if (!hasData) dlBtn.disabled = true;
    dlBtn.addEventListener('click', function() {
      _aoTriggerDownload(currentRows, config.filename || 'export.csv');
    });
    div.appendChild(dlBtn);

    return div;
  }
};

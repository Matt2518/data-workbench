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

function _aoUpdateSentimentWarning(el, labelOn, scoreOn) {
  el.style.display = (!labelOn && !scoreOn) ? '' : 'none';
}

/* ───────────────────────────────────────────────────────────
   SENTIMENT_ANALYSIS
   Lexicon-based per-row text scoring. Independently outputs
   a text label ('positive'/'neutral'/'negative') and/or a
   normalized numeric score, each behind its own toggle.
   Label output matches what QUOTES_BOARD sentimentField
   expects (case-insensitive match in renderer).
─────────────────────────────────────────────────────────── */

window.DWBNodes.SENTIMENT_ANALYSIS = {
  label: 'Sentiment Analysis',
  icon: '😊',
  category: 'Advanced',
  defaultConfig: {
    textColumn: '',
    outputLabelEnabled: true,
    outputLabelColumn: 'sentiment',
    outputScoreEnabled: false,
    outputScoreColumn: 'sentiment_score'
  },

  run: function(rows, config) {
    // Backward compat: migrate old single outputColumn field
    if (config.outputColumn && !config.outputLabelColumn) {
      config.outputLabelColumn = config.outputColumn;
      config.outputLabelEnabled = true;
    }
    var col          = config.textColumn;
    var labelEnabled = config.outputLabelEnabled !== false;
    var labelCol     = (config.outputLabelColumn || 'sentiment').trim() || 'sentiment';
    var scoreEnabled = !!config.outputScoreEnabled;
    var scoreCol     = (config.outputScoreColumn || 'sentiment_score').trim() || 'sentiment_score';
    return rows.map(function(row) {
      var nr   = Object.assign({}, row);
      var text = String(row[col] == null ? '' : row[col]).trim();
      if (!text) {
        if (labelEnabled) nr[labelCol] = '';
        if (scoreEnabled) nr[scoreCol] = '';
        return nr;
      }
      var raw = _aoScoreText(text);
      if (labelEnabled) {
        nr[labelCol] = raw > 0 ? 'positive' : raw < 0 ? 'negative' : 'neutral';
      }
      if (scoreEnabled) {
        var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
        var norm  = words.length > 0 ? raw / words.length : 0;
        nr[scoreCol] = Math.round(norm * 100) / 100;
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.textColumn) return 'Select a text column';
    if (!config.outputLabelEnabled && !config.outputScoreEnabled) return 'Enable at least one output';
    if (config.outputLabelEnabled && !(config.outputLabelColumn || '').trim()) return 'Enter a label column name';
    if (config.outputScoreEnabled && !(config.outputScoreColumn || '').trim()) return 'Enter a score column name';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    // SOURCE
    div.appendChild(_aoColSelect('Text Column', 'textColumn', config, currentRows, onChange));

    // LABEL OUTPUT
    var labelGroup = document.createElement('div');
    labelGroup.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    var labelCbWrap = document.createElement('label');
    labelCbWrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:13px';
    var labelCb = document.createElement('input');
    labelCb.type = 'checkbox';
    labelCb.style.cssText = 'padding:0;width:14px;height:14px;accent-color:var(--accent);cursor:pointer';
    labelCb.checked = config.outputLabelEnabled !== false;
    labelCbWrap.appendChild(labelCb);
    labelCbWrap.appendChild(document.createTextNode('Output sentiment label'));
    labelGroup.appendChild(labelCbWrap);

    var labelColRow = document.createElement('div');
    labelColRow.className = 'form-row';
    labelColRow.style.display = config.outputLabelEnabled !== false ? '' : 'none';
    labelColRow.innerHTML = '<label>Column name</label>' +
      '<input type="text" style="width:100%" value="' + _aoEsc(config.outputLabelColumn || 'sentiment') + '" placeholder="sentiment">';
    labelColRow.querySelector('input').addEventListener('input', function(e) {
      onChange('outputLabelColumn', e.target.value);
    });
    labelGroup.appendChild(labelColRow);

    var labelHint = document.createElement('div');
    labelHint.style.cssText = 'font-size:var(--text-xs,11px);color:var(--text-faint)';
    labelHint.textContent = "Writes 'positive', 'neutral', or 'negative'";
    labelGroup.appendChild(labelHint);

    div.appendChild(labelGroup);

    // SCORE OUTPUT
    var scoreGroup = document.createElement('div');
    scoreGroup.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    var scoreCbWrap = document.createElement('label');
    scoreCbWrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:13px';
    var scoreCb = document.createElement('input');
    scoreCb.type = 'checkbox';
    scoreCb.style.cssText = 'padding:0;width:14px;height:14px;accent-color:var(--accent);cursor:pointer';
    scoreCb.checked = !!config.outputScoreEnabled;
    scoreCbWrap.appendChild(scoreCb);
    scoreCbWrap.appendChild(document.createTextNode('Output normalized sentiment score'));
    scoreGroup.appendChild(scoreCbWrap);

    var scoreColRow = document.createElement('div');
    scoreColRow.className = 'form-row';
    scoreColRow.style.display = config.outputScoreEnabled ? '' : 'none';
    scoreColRow.innerHTML = '<label>Column name</label>' +
      '<input type="text" style="width:100%" value="' + _aoEsc(config.outputScoreColumn || 'sentiment_score') + '" placeholder="sentiment_score">';
    scoreColRow.querySelector('input').addEventListener('input', function(e) {
      onChange('outputScoreColumn', e.target.value);
    });
    scoreGroup.appendChild(scoreColRow);

    var scoreHint = document.createElement('div');
    scoreHint.style.cssText = 'font-size:var(--text-xs,11px);color:var(--text-faint)';
    scoreHint.textContent = 'Writes a score from roughly −3 to +3 (lexicon weight average per word) — suitable for averaging and charting';
    scoreGroup.appendChild(scoreHint);

    div.appendChild(scoreGroup);

    // Warning shown when neither output is enabled
    var warningEl = document.createElement('div');
    warningEl.style.cssText = 'font-size:var(--text-xs,11px);color:var(--warning)';
    warningEl.textContent = '⚠️ Enable at least one output.';
    _aoUpdateSentimentWarning(warningEl, labelCb.checked, scoreCb.checked);
    div.appendChild(warningEl);

    // Checkbox listeners (declared after warningEl so closures capture it)
    labelCb.addEventListener('change', function() {
      onChange('outputLabelEnabled', labelCb.checked);
      labelColRow.style.display = labelCb.checked ? '' : 'none';
      _aoUpdateSentimentWarning(warningEl, labelCb.checked, scoreCb.checked);
    });
    scoreCb.addEventListener('change', function() {
      onChange('outputScoreEnabled', scoreCb.checked);
      scoreColRow.style.display = scoreCb.checked ? '' : 'none';
      _aoUpdateSentimentWarning(warningEl, labelCb.checked, scoreCb.checked);
    });

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

/* ── Likert templates ── */
var _aoLikertTemplates = {
  numeric_5: {
    label: '5-Point Numeric (1–5)',
    scale: ['1','2','3','4','5'],
    displayLabels: { '1':'Strongly Disagree','2':'Disagree','3':'Neutral','4':'Agree','5':'Strongly Agree' },
    weights: { '1':-2,'2':-1,'3':0,'4':1,'5':2 }
  },
  agree_5: {
    label: '5-Point Agreement',
    scale: ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'],
    displayLabels: {},
    weights: { 'Strongly Disagree':-2,'Disagree':-1,'Neutral':0,'Agree':1,'Strongly Agree':2 }
  },
  satisfy_5: {
    label: '5-Point Satisfaction',
    scale: ['Very Dissatisfied','Dissatisfied','Neutral','Satisfied','Very Satisfied'],
    displayLabels: {},
    weights: { 'Very Dissatisfied':-2,'Dissatisfied':-1,'Neutral':0,'Satisfied':1,'Very Satisfied':2 }
  },
  always_never: {
    label: 'Always/Never (5-point)',
    scale: ['Never','Rarely','Sometimes','Often','Always'],
    displayLabels: {},
    weights: { 'Never':-2,'Rarely':-1,'Sometimes':0,'Often':1,'Always':2 }
  },
  numeric_4: {
    label: '4-Point Numeric (1–4)',
    scale: ['1','2','3','4'],
    displayLabels: { '1':'Strongly Disagree','2':'Disagree','3':'Agree','4':'Strongly Agree' },
    weights: { '1':-2,'2':-1,'3':1,'4':2 }
  },
  custom: {
    label: 'Custom',
    scale: [],
    displayLabels: {},
    weights: {}
  }
};

function _aoAutoDetectLikertTemplate(colName, currentRows) {
  if (!currentRows || !currentRows.length) return null;
  var seen = {};
  currentRows.forEach(function(row) {
    var v = row[colName];
    if (v != null && v !== '') seen[String(v).trim()] = true;
  });
  var dataVals = Object.keys(seen);
  if (!dataVals.length) return null;
  var tplKeys = ['numeric_5','agree_5','satisfy_5','always_never','numeric_4'];
  for (var i = 0; i < tplKeys.length; i++) {
    var tpl = _aoLikertTemplates[tplKeys[i]];
    var tplLower = tpl.scale.map(function(v) { return v.toLowerCase().trim(); });
    var match = dataVals.every(function(dv) { return tplLower.indexOf(dv.toLowerCase().trim()) >= 0; });
    if (match) return tplKeys[i];
  }
  return null;
}

/* ───────────────────────────────────────────────────────────
   SET_TYPES
   Marks columns with semantic types. string/number/boolean/date
   coerce values. categorical and likert are metadata-only:
   run() passes rows through unchanged, and the pipeline
   executor captures the column metadata into snapshotMeta.
─────────────────────────────────────────────────────────── */

window.DWBNodes.SET_TYPES = {
  label: 'Set Types',
  icon: '🔢',
  category: 'Advanced',
  defaultConfig: { columns: {} },

  run: function(rows, config) {
    var columns = config.columns || {};
    if (!Object.keys(columns).length) return rows;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      Object.keys(columns).forEach(function(col) {
        var colCfg = columns[col];
        var type = colCfg.type || 'string';
        if (type === 'categorical' || type === 'likert') return;
        var val = row[col];
        try {
          if (type === 'number') {
            nr[col] = parseFloat(val);
            if (isNaN(nr[col])) nr[col] = 0;
          } else if (type === 'string') {
            nr[col] = String(val == null ? '' : val);
          } else if (type === 'boolean') {
            if (typeof val === 'boolean') { nr[col] = val; }
            else {
              var s = String(val == null ? '' : val).toLowerCase().trim();
              nr[col] = s === 'true' || s === '1' || s === 'yes';
            }
          } else if (type === 'date') {
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
    if (!config.columns || !Object.keys(config.columns).length) return 'Add at least one column mapping';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var columns = config.columns || {};
    var allCols = _aoCols(currentRows);

    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    function renderRows() {
      div.innerHTML = '';
      var mappedCols = Object.keys(columns);

      if (!mappedCols.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'font-size:12px;color:var(--text-faint);padding:4px 0';
        empty.textContent = 'No columns mapped yet.';
        div.appendChild(empty);
      }

      mappedCols.forEach(function(col) {
        var colCfg = columns[col];
        var type = colCfg.type || 'string';

        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border);border-radius:4px;padding:6px 8px;background:var(--bg-raised);margin-bottom:2px';

        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;gap:6px;align-items:center' + (type === 'likert' ? ';margin-bottom:6px' : '');

        var otherMapped = mappedCols.filter(function(c) { return c !== col; });
        var availCols = allCols.filter(function(c) { return c === col || otherMapped.indexOf(c) < 0; });
        var colSel = document.createElement('select');
        colSel.style.cssText = 'flex:1;font-size:12px';
        colSel.innerHTML = _aoColOptHtml(availCols, col);
        colSel.addEventListener('change', function(e) {
          var newCol = e.target.value;
          if (!newCol || newCol === col) return;
          var savedCfg = Object.assign({}, columns[col]);
          delete columns[col];
          columns[newCol] = savedCfg;
          onChange('columns', Object.assign({}, columns));
          renderRows();
        });

        var typeSel = document.createElement('select');
        typeSel.style.cssText = 'flex:1;font-size:12px';
        ['string','number','boolean','date','categorical','likert'].forEach(function(t) {
          var opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
          if (type === t) opt.selected = true;
          typeSel.appendChild(opt);
        });
        typeSel.addEventListener('change', function(e) {
          var newType = e.target.value;
          columns[col].type = newType;
          if (newType === 'likert' && !columns[col].scale) {
            columns[col].scale = [];
            columns[col].displayLabels = {};
            columns[col].weights = {};
            columns[col].template = 'custom';
          }
          onChange('columns', Object.assign({}, columns));
          renderRows();
        });

        var del = document.createElement('button');
        del.style.cssText = 'background:transparent;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:0 4px;flex-shrink:0';
        del.textContent = '✕';
        del.title = 'Remove';
        del.addEventListener('click', function() {
          delete columns[col];
          onChange('columns', Object.assign({}, columns));
          renderRows();
        });

        hdr.appendChild(colSel);
        hdr.appendChild(typeSel);
        hdr.appendChild(del);
        card.appendChild(hdr);

        if (type === 'likert') {
          var panel = document.createElement('div');
          panel.style.cssText = 'display:flex;flex-direction:column;gap:4px';

          var tplRow = document.createElement('div');
          tplRow.style.cssText = 'display:flex;align-items:center;gap:6px';
          var tplLbl = document.createElement('span');
          tplLbl.style.cssText = 'font-size:11px;color:var(--text-muted);flex-shrink:0';
          tplLbl.textContent = 'Template:';
          var tplSel = document.createElement('select');
          tplSel.style.cssText = 'flex:1;font-size:12px';
          ['numeric_5','agree_5','satisfy_5','always_never','numeric_4','custom'].forEach(function(tk) {
            var opt = document.createElement('option');
            opt.value = tk;
            opt.textContent = _aoLikertTemplates[tk].label;
            if ((colCfg.template || 'custom') === tk) opt.selected = true;
            tplSel.appendChild(opt);
          });
          tplSel.addEventListener('change', function(e) {
            var tk = e.target.value;
            var tpl = _aoLikertTemplates[tk];
            columns[col].template = tk;
            columns[col].scale = tpl.scale.slice();
            columns[col].displayLabels = Object.assign({}, tpl.displayLabels);
            columns[col].weights = Object.assign({}, tpl.weights);
            onChange('columns', Object.assign({}, columns));
            renderRows();
          });
          tplRow.appendChild(tplLbl);
          tplRow.appendChild(tplSel);
          panel.appendChild(tplRow);

          var scale = colCfg.scale || [];
          if (scale.length) {
            var scaleHdr = document.createElement('div');
            scaleHdr.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 56px 20px;gap:4px;font-size:10px;color:var(--text-muted);font-weight:600;margin-top:4px';
            scaleHdr.innerHTML = '<span>Raw value</span><span>Display label</span><span>Weight</span><span></span>';
            panel.appendChild(scaleHdr);

            scale.forEach(function(rawVal, idx) {
              var sr = document.createElement('div');
              sr.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 56px 20px;gap:4px;align-items:center';

              var rawIn = document.createElement('input');
              rawIn.type = 'text';
              rawIn.style.cssText = 'font-size:11px;padding:2px 4px;width:100%;box-sizing:border-box';
              rawIn.value = rawVal;
              rawIn.addEventListener('change', function() {
                var oldVal = rawVal;
                var newVal = rawIn.value;
                scale[idx] = newVal;
                if (oldVal !== newVal) {
                  var savedLbl = colCfg.displayLabels[oldVal];
                  var savedWt = colCfg.weights[oldVal];
                  delete colCfg.displayLabels[oldVal];
                  delete colCfg.weights[oldVal];
                  colCfg.displayLabels[newVal] = savedLbl !== undefined ? savedLbl : newVal;
                  colCfg.weights[newVal] = savedWt !== undefined ? savedWt : 0;
                }
                onChange('columns', Object.assign({}, columns));
                renderRows();
              });

              var dispIn = document.createElement('input');
              dispIn.type = 'text';
              dispIn.style.cssText = 'font-size:11px;padding:2px 4px;width:100%;box-sizing:border-box';
              dispIn.value = colCfg.displayLabels[rawVal] !== undefined ? colCfg.displayLabels[rawVal] : rawVal;
              dispIn.addEventListener('input', function() {
                colCfg.displayLabels[rawVal] = dispIn.value;
                onChange('columns', Object.assign({}, columns));
              });

              var wtIn = document.createElement('input');
              wtIn.type = 'number';
              wtIn.style.cssText = 'font-size:11px;padding:2px 4px;width:100%;box-sizing:border-box';
              wtIn.value = colCfg.weights[rawVal] !== undefined ? colCfg.weights[rawVal] : 0;
              wtIn.addEventListener('input', function() {
                colCfg.weights[rawVal] = parseInt(wtIn.value, 10) || 0;
                onChange('columns', Object.assign({}, columns));
              });

              var delS = document.createElement('button');
              delS.style.cssText = 'background:transparent;border:none;font-size:11px;color:var(--text-faint);cursor:pointer;padding:0';
              delS.textContent = '✕';
              delS.addEventListener('click', function() {
                scale.splice(idx, 1);
                delete colCfg.displayLabels[rawVal];
                delete colCfg.weights[rawVal];
                onChange('columns', Object.assign({}, columns));
                renderRows();
              });

              sr.appendChild(rawIn);
              sr.appendChild(dispIn);
              sr.appendChild(wtIn);
              sr.appendChild(delS);
              panel.appendChild(sr);
            });
          }

          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px';

          var detectBtn = document.createElement('button');
          detectBtn.style.cssText = 'font-size:11px;padding:3px 8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);border-radius:3px;cursor:pointer';
          detectBtn.textContent = '⚡ Auto-detect';
          detectBtn.addEventListener('click', function() {
            var detected = _aoAutoDetectLikertTemplate(col, currentRows);
            if (detected) {
              var tpl = _aoLikertTemplates[detected];
              columns[col].template = detected;
              columns[col].scale = tpl.scale.slice();
              columns[col].displayLabels = Object.assign({}, tpl.displayLabels);
              columns[col].weights = Object.assign({}, tpl.weights);
              onChange('columns', Object.assign({}, columns));
              renderRows();
            } else {
              alert('No matching Likert template detected for "' + col + '".');
            }
          });

          var addScaleBtn = document.createElement('button');
          addScaleBtn.style.cssText = 'font-size:11px;padding:3px 8px;border:1px dashed var(--accent);background:transparent;color:var(--accent);border-radius:3px;cursor:pointer';
          addScaleBtn.textContent = '+ Add point';
          addScaleBtn.addEventListener('click', function() {
            var newVal = 'Value ' + ((colCfg.scale || []).length + 1);
            if (!colCfg.scale) colCfg.scale = [];
            colCfg.scale.push(newVal);
            if (!colCfg.displayLabels) colCfg.displayLabels = {};
            colCfg.displayLabels[newVal] = newVal;
            if (!colCfg.weights) colCfg.weights = {};
            colCfg.weights[newVal] = 0;
            onChange('columns', Object.assign({}, columns));
            renderRows();
          });

          btnRow.appendChild(detectBtn);
          btnRow.appendChild(addScaleBtn);
          panel.appendChild(btnRow);
          card.appendChild(panel);
        }

        div.appendChild(card);
      });

      var addBtn = document.createElement('button');
      addBtn.style.cssText = 'margin-top:4px;padding:4px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;font-size:12px;cursor:pointer';
      addBtn.textContent = '+ Add column';
      var unmapped = allCols.filter(function(c) { return Object.keys(columns).indexOf(c) < 0; });
      if (!unmapped.length) addBtn.disabled = true;
      addBtn.addEventListener('click', function() {
        var next = unmapped[0];
        if (!next) return;
        columns[next] = { type: 'string' };
        onChange('columns', Object.assign({}, columns));
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

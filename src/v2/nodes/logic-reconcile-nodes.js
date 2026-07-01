/* === DWBNodes: Logic & Reconcile category (5 nodes) === */
window.DWBNodes = window.DWBNodes || {};

/* ── Shared helpers (_lr prefix) ── */

function _lrEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _lrCols(currentRows) {
  return (currentRows && currentRows.length) ? Object.keys(currentRows[0]) : [];
}

function _lrColOptHtml(cols, selected) {
  return cols.length
    ? '<option value="">-- select --</option>' + cols.map(function(c) {
        return '<option value="' + _lrEsc(c) + '"' + (selected === c ? ' selected' : '') + '>' + _lrEsc(c) + '</option>';
      }).join('')
    : '<option value="" disabled selected>Run pipeline to see columns</option>';
}

/* Bigram similarity: returns 0–1 */
function _lrBigramSim(a, b) {
  a = String(a || '').toLowerCase().trim();
  b = String(b || '').toLowerCase().trim();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  var biA = [];
  for (var i = 0; i < a.length - 1; i++) biA.push(a.slice(i, i + 2));
  var biB = {};
  for (var j = 0; j < b.length - 1; j++) biB[b.slice(j, j + 2)] = 1;
  var matches = 0;
  biA.forEach(function(bi) { if (biB[bi]) matches++; });
  return (2 * matches) / (biA.length + Object.keys(biB).length);
}

function _lrSnapshotNames() {
  var st = window.DWBState;
  return (st && st.snapshots) ? Object.keys(st.snapshots) : [];
}

function _lrSnapshotRows(name) {
  var st = window.DWBState;
  return (st && st.snapshots && st.snapshots[name]) ? st.snapshots[name] : null;
}

function _lrSnapshotCols(name) {
  var rows = _lrSnapshotRows(name);
  return (rows && rows.length) ? Object.keys(rows[0]) : [];
}

function _lrSnapOptHtml(names, selected) {
  if (!names.length) return '<option value="" disabled selected>No snapshots — add Push to Viz first</option>';
  return '<option value="">-- select --</option>' + names.map(function(n) {
    return '<option value="' + _lrEsc(n) + '"' + (selected === n ? ' selected' : '') + '>' + _lrEsc(n) + '</option>';
  }).join('');
}

/* ── IF_THEN_ELSE ── */

window.DWBNodes.IF_THEN_ELSE = {
  label: 'If / Then / Else',
  icon: '🔀',
  category: 'Logic & Reconcile',
  defaultConfig: {
    conditionColumn: '',
    operator: 'equals',
    compareValue: '',
    thenValue: '',
    elseValue: '',
    outputColumn: 'result'
  },

  run: function(rows, config) {
    var col    = config.conditionColumn;
    var outCol = (config.outputColumn || 'result').trim() || 'result';
    var op     = config.operator || 'equals';
    var cmpVal = String(config.compareValue != null ? config.compareValue : '');
    var thenVal = String(config.thenValue != null ? config.thenValue : '');
    var elseVal = String(config.elseValue != null ? config.elseValue : '');

    function _test(cell) {
      if (op === 'is_empty')     return cell.trim() === '';
      if (op === 'is_not_empty') return cell.trim() !== '';
      if (op === 'greater_than') {
        var cn = parseFloat(cell), vn = parseFloat(cmpVal);
        return (!isNaN(cn) && !isNaN(vn)) ? cn > vn : cell > cmpVal;
      }
      if (op === 'greater_equal') {
        var cn3 = parseFloat(cell), vn3 = parseFloat(cmpVal);
        return (!isNaN(cn3) && !isNaN(vn3)) ? cn3 >= vn3 : cell >= cmpVal;
      }
      if (op === 'less_than') {
        var cn2 = parseFloat(cell), vn2 = parseFloat(cmpVal);
        return (!isNaN(cn2) && !isNaN(vn2)) ? cn2 < vn2 : cell < cmpVal;
      }
      if (op === 'less_equal') {
        var cn4 = parseFloat(cell), vn4 = parseFloat(cmpVal);
        return (!isNaN(cn4) && !isNaN(vn4)) ? cn4 <= vn4 : cell <= cmpVal;
      }
      if (op === 'equals')     return cell === cmpVal;
      if (op === 'not_equals') return cell !== cmpVal;
      if (op === 'contains')   return cell.indexOf(cmpVal) !== -1;
      return false;
    }

    return rows.map(function(row) {
      var nr   = Object.assign({}, row);
      var cell = String(row[col] != null ? row[col] : '');
      nr[outCol] = _test(cell) ? thenVal : elseVal;
      return nr;
    });
  },

  validate: function(config) {
    if (!config.conditionColumn) return 'Select a condition column';
    if (!(config.outputColumn || '').trim()) return 'Enter an output column name';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div  = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var cols = _lrCols(currentRows);
    var NO_VAL = { is_empty: 1, is_not_empty: 1 };
    var OPERATORS = [
      ['equals','equals'], ['not_equals','not equals'], ['contains','contains'],
      ['greater_than','greater than'], ['greater_equal','greater than or equal to'],
      ['less_than','less than'], ['less_equal','less than or equal to'],
      ['is_empty','is empty'], ['is_not_empty','is not empty']
    ];
    var curOp = config.operator || 'equals';

    div.innerHTML =
      '<div class="form-row"><label>Condition Column</label>' +
        '<select id="lr-ite-col" style="width:100%">' + _lrColOptHtml(cols, config.conditionColumn) + '</select></div>' +
      '<div class="form-row"><label>Operator</label>' +
        '<select id="lr-ite-op" style="width:100%">' +
          OPERATORS.map(function(p) {
            return '<option value="' + p[0] + '"' + (curOp === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
          }).join('') +
        '</select></div>' +
      '<div class="form-row" id="lr-ite-cmprow"' + (NO_VAL[curOp] ? ' style="display:none"' : '') + '>' +
        '<label>Compare Value</label>' +
        '<input type="text" id="lr-ite-cmp" value="' + _lrEsc(config.compareValue || '') + '" style="width:100%"></div>' +
      '<div class="form-row"><label>Then (if true)</label>' +
        '<input type="text" id="lr-ite-then" value="' + _lrEsc(config.thenValue || '') + '" style="width:100%"></div>' +
      '<div class="form-row"><label>Else (if false)</label>' +
        '<input type="text" id="lr-ite-else" value="' + _lrEsc(config.elseValue || '') + '" style="width:100%"></div>' +
      '<div class="form-row"><label>Output Column Name</label>' +
        '<input type="text" id="lr-ite-out" value="' + _lrEsc(config.outputColumn || 'result') + '" style="width:100%"></div>';

    div.querySelector('#lr-ite-col').addEventListener('change', function(e) { onChange('conditionColumn', e.target.value); });
    div.querySelector('#lr-ite-op').addEventListener('change', function(e) {
      onChange('operator', e.target.value);
      var row = div.querySelector('#lr-ite-cmprow');
      if (row) row.style.display = NO_VAL[e.target.value] ? 'none' : '';
    });
    div.querySelector('#lr-ite-cmp').addEventListener('input', function(e) { onChange('compareValue', e.target.value); });
    div.querySelector('#lr-ite-then').addEventListener('input', function(e) { onChange('thenValue', e.target.value); });
    div.querySelector('#lr-ite-else').addEventListener('input', function(e) { onChange('elseValue', e.target.value); });
    div.querySelector('#lr-ite-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });

    return div;
  }
};

/* ── FUZZY_MATCH ── */

window.DWBNodes.FUZZY_MATCH = {
  label: 'Fuzzy Match',
  icon: '🔍',
  category: 'Logic & Reconcile',
  defaultConfig: { sourceColumn: '', referenceColumn: '', threshold: 0.7, matches: [] },

  run: function(rows, config) {
    var matches = config.matches || [];
    if (!config.sourceColumn || !matches.length) return rows;
    var matchMap = {};
    matches.forEach(function(m) { matchMap[m.sourceValue] = m.matchedValue; });
    var outCol = config.sourceColumn + '_matched';
    return rows.map(function(row) {
      var nr     = Object.assign({}, row);
      var srcVal = String(row[config.sourceColumn] != null ? row[config.sourceColumn] : '');
      nr[outCol] = matchMap.hasOwnProperty(srcVal) ? matchMap[srcVal] : '';
      return nr;
    });
  },

  validate: function(config) {
    if (!config.sourceColumn)    return 'Select a source column';
    if (!config.referenceColumn) return 'Select a reference column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div  = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var cols = _lrCols(currentRows);
    var thresh = config.threshold !== undefined ? config.threshold : 0.7;

    div.innerHTML =
      '<div class="form-row"><label>Source Column</label>' +
        '<select id="lr-fm-src" style="width:100%">' + _lrColOptHtml(cols, config.sourceColumn) + '</select></div>' +
      '<div class="form-row"><label>Reference Column</label>' +
        '<select id="lr-fm-ref" style="width:100%">' + _lrColOptHtml(cols, config.referenceColumn) + '</select></div>' +
      '<div class="form-row"><label>Match Threshold: <span id="lr-fm-tval">' + Math.round(thresh * 100) + '%</span></label>' +
        '<input type="range" id="lr-fm-thresh" min="0" max="100" value="' + Math.round(thresh * 100) + '" style="width:100%"></div>' +
      '<button id="lr-fm-run-btn" style="padding:7px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit">🔍 Run Matching</button>' +
      '<div id="lr-fm-prog" style="display:none;flex-direction:column;gap:4px">' +
        '<div style="height:6px;border-radius:3px;background:var(--bg-raised);overflow:hidden">' +
          '<div id="lr-fm-pbar" style="height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width 0.2s"></div></div>' +
        '<div id="lr-fm-ptxt" style="font-size:11px;color:var(--text-muted)">Running…</div></div>' +
      '<div id="lr-fm-cards"></div>';

    if (config.matches && config.matches.length) {
      _lrFmRenderCards(div, config, onChange, currentRows);
    }

    div.querySelector('#lr-fm-src').addEventListener('change', function(e) {
      onChange('sourceColumn', e.target.value);
      onChange('matches', []);
      config.matches = [];
      div.querySelector('#lr-fm-cards').innerHTML = '';
    });
    div.querySelector('#lr-fm-ref').addEventListener('change', function(e) {
      onChange('referenceColumn', e.target.value);
      onChange('matches', []);
      config.matches = [];
      div.querySelector('#lr-fm-cards').innerHTML = '';
    });
    div.querySelector('#lr-fm-thresh').addEventListener('input', function(e) {
      var pct = parseInt(e.target.value, 10);
      var sp = div.querySelector('#lr-fm-tval');
      if (sp) sp.textContent = pct + '%';
      onChange('threshold', pct / 100);
      config.threshold = pct / 100;
    });

    div.querySelector('#lr-fm-run-btn').addEventListener('click', function() {
      var srcCol = config.sourceColumn;
      var refCol = config.referenceColumn;
      if (!srcCol || !refCol || !currentRows || !currentRows.length) return;
      var threshold = config.threshold !== undefined ? config.threshold : 0.7;

      var srcMap = {}, refMap = {};
      currentRows.forEach(function(row) {
        var sv = row[srcCol]; if (sv != null && sv !== '') srcMap[String(sv)] = 1;
        var rv = row[refCol]; if (rv != null && rv !== '') refMap[String(rv)] = 1;
      });
      var srcValues = Object.keys(srcMap);
      var refValues = Object.keys(refMap);
      if (!srcValues.length || !refValues.length) return;

      var progDiv = div.querySelector('#lr-fm-prog');
      var pbar    = div.querySelector('#lr-fm-pbar');
      var ptxt    = div.querySelector('#lr-fm-ptxt');
      var runBtn  = div.querySelector('#lr-fm-run-btn');
      progDiv.style.display = 'flex';
      runBtn.style.display  = 'none';

      var results = [];
      var idx     = 0;
      var CHUNK   = 50;

      function _chunk() {
        var end = Math.min(idx + CHUNK, srcValues.length);
        for (var i = idx; i < end; i++) {
          var sv = srcValues[i];
          var bestScore = -1, bestRef = '';
          refValues.forEach(function(rv) {
            var s = _lrBigramSim(sv, rv);
            if (s > bestScore) { bestScore = s; bestRef = rv; }
          });
          results.push({
            sourceValue: sv,
            matchedValue: bestScore >= threshold ? bestRef : '',
            confidence: bestScore
          });
        }
        idx = end;
        var pct = Math.round(idx / srcValues.length * 100);
        pbar.style.width = pct + '%';
        ptxt.textContent = 'Processed ' + idx + ' / ' + srcValues.length + ' values…';
        if (idx < srcValues.length) {
          setTimeout(_chunk, 0);
        } else {
          onChange('matches', results);
          config.matches = results;
          progDiv.style.display = 'none';
          runBtn.style.display  = '';
          _lrFmRenderCards(div, config, onChange, currentRows);
        }
      }

      setTimeout(_chunk, 0);
    });

    return div;
  }
};

function _lrFmRenderCards(div, config, onChange, currentRows) {
  var cardsDiv = div.querySelector('#lr-fm-cards');
  if (!cardsDiv) return;
  var matches  = config.matches || [];
  if (!matches.length) { cardsDiv.innerHTML = ''; return; }

  var refMap = {};
  if (currentRows && currentRows.length && config.referenceColumn) {
    currentRows.forEach(function(row) {
      var v = row[config.referenceColumn];
      if (v != null) refMap[String(v)] = 1;
    });
  }
  var refValues = Object.keys(refMap).sort();

  var html = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:6px">' +
    matches.length + ' unique values</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' +
    matches.map(function(m, idx) {
      var pct        = Math.round(m.confidence * 100);
      var badgeColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      var refOpts    = '<option value="">— no match —</option>' + refValues.map(function(rv) {
        return '<option value="' + _lrEsc(rv) + '"' + (m.matchedValue === rv ? ' selected' : '') + '>' + _lrEsc(rv) + '</option>';
      }).join('');
      return '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface)">' +
        '<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + _lrEsc(m.sourceValue) + '">' + _lrEsc(m.sourceValue) + '</div>' +
        '<span style="color:var(--text-faint)">→</span>' +
        '<div style="display:flex;align-items:center;gap:4px">' +
          '<select class="lr-fm-sel" data-idx="' + idx + '" style="flex:1;font-size:12px">' + refOpts + '</select>' +
          '<span style="padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700;background:' + badgeColor + ';color:#fff">' + pct + '%</span>' +
        '</div></div>';
    }).join('') + '</div>';

  cardsDiv.innerHTML = html;
  cardsDiv.querySelectorAll('.lr-fm-sel').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var i       = parseInt(sel.dataset.idx, 10);
      var updated = (config.matches || []).slice();
      updated[i]  = Object.assign({}, updated[i], { matchedValue: sel.value });
      onChange('matches', updated);
      config.matches = updated;
    });
  });
}

/* ── DATA_VALIDATION ── */

window.DWBNodes.DATA_VALIDATION = {
  label: 'Data Validation',
  icon: '✅',
  category: 'Logic & Reconcile',
  defaultConfig: {
    rules: [{ column: '', type: 'not_empty', param: '' }],
    outputColumn: 'validation_status'
  },

  run: function(rows, config) {
    var rules  = config.rules || [];
    var outCol = (config.outputColumn || 'validation_status').trim() || 'validation_status';

    function _evalRule(rule, row) {
      var cell  = String(row[rule.column] != null ? row[rule.column] : '');
      var param = String(rule.param || '');
      switch (rule.type) {
        case 'not_empty':
          return cell.trim() !== '' ? null : 'Column "' + rule.column + '" must not be empty';
        case 'is_number':
          return (!isNaN(parseFloat(cell)) && isFinite(cell)) ? null : 'Column "' + rule.column + '" must be a number';
        case 'is_email':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell) ? null : 'Column "' + rule.column + '" must be a valid email';
        case 'min_length': {
          var min = parseInt(param, 10) || 0;
          return cell.length >= min ? null : 'Column "' + rule.column + '" must be at least ' + min + ' chars';
        }
        case 'max_length': {
          var max = parseInt(param, 10) || 0;
          return (max <= 0 || cell.length <= max) ? null : 'Column "' + rule.column + '" must be at most ' + max + ' chars';
        }
        case 'matches_pattern': {
          try { return new RegExp(param).test(cell) ? null : 'Column "' + rule.column + '" must match pattern: ' + param; }
          catch (e) { return null; }
        }
        default: return null;
      }
    }

    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      var firstErr = null;
      for (var i = 0; i < rules.length; i++) {
        if (!rules[i].column) continue;
        var err = _evalRule(rules[i], row);
        if (err) { firstErr = err; break; }
      }
      nr[outCol] = firstErr ? 'invalid: ' + firstErr : 'valid';
      return nr;
    });
  },

  validate: function(config) {
    if (!config.rules || !config.rules.length) return 'Add at least one rule';
    if (!(config.outputColumn || '').trim()) return 'Enter an output column name';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div  = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var cols  = _lrCols(currentRows);
    var rules = (config.rules || []);

    var RULE_TYPES = [
      ['not_empty','Not empty'], ['is_number','Is number'], ['is_email','Is email'],
      ['min_length','Min length'], ['max_length','Max length'], ['matches_pattern','Matches pattern']
    ];
    var NEEDS_PARAM = { min_length: 1, max_length: 1, matches_pattern: 1 };

    function _ruleTypeOpts(sel) {
      return RULE_TYPES.map(function(p) {
        return '<option value="' + p[0] + '"' + (sel === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('');
    }

    function renderRules() {
      var wrap = div.querySelector('#lr-dv-rules');
      if (!wrap) return;
      if (!rules.length) {
        wrap.innerHTML = '<div style="font-size:11px;color:var(--text-faint);padding:6px">No rules yet.</div>';
        return;
      }
      wrap.innerHTML = rules.map(function(r, i) {
        var np = NEEDS_PARAM[r.type];
        return '<div style="display:grid;grid-template-columns:1fr 1fr ' + (np ? '1fr ' : '') + 'auto;gap:4px;align-items:center;padding:5px 6px;border-bottom:1px solid var(--border)">' +
          '<select class="lr-dv-col" data-idx="' + i + '" style="font-size:12px">' + _lrColOptHtml(cols, r.column) + '</select>' +
          '<select class="lr-dv-type" data-idx="' + i + '" style="font-size:12px">' + _ruleTypeOpts(r.type) + '</select>' +
          (np ? '<input type="text" class="lr-dv-param" data-idx="' + i + '" value="' + _lrEsc(r.param || '') + '" placeholder="' + (r.type === 'matches_pattern' ? 'regex' : 'number') + '" style="font-size:12px">' : '') +
          '<button class="lr-dv-rm" data-idx="' + i + '" style="padding:1px 6px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px;color:var(--danger)">✕</button>' +
        '</div>';
      }).join('');

      wrap.querySelectorAll('.lr-dv-col').forEach(function(sel) {
        sel.addEventListener('change', function() {
          rules[parseInt(sel.dataset.idx, 10)].column = sel.value;
          onChange('rules', rules.slice());
        });
      });
      wrap.querySelectorAll('.lr-dv-type').forEach(function(sel) {
        sel.addEventListener('change', function() {
          rules[parseInt(sel.dataset.idx, 10)].type = sel.value;
          onChange('rules', rules.slice());
          renderRules();
        });
      });
      wrap.querySelectorAll('.lr-dv-param').forEach(function(inp) {
        inp.addEventListener('input', function() {
          rules[parseInt(inp.dataset.idx, 10)].param = inp.value;
          onChange('rules', rules.slice());
        });
      });
      wrap.querySelectorAll('.lr-dv-rm').forEach(function(btn) {
        btn.addEventListener('click', function() {
          rules.splice(parseInt(btn.dataset.idx, 10), 1);
          onChange('rules', rules.slice());
          renderRules();
        });
      });
    }

    div.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:var(--text-muted)">Validation Rules</div>' +
      '<div id="lr-dv-rules" style="border:1px solid var(--border);border-radius:4px;overflow:hidden"></div>' +
      '<button id="lr-dv-add" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit">＋ Add Rule</button>' +
      '<div class="form-row"><label>Output Column</label>' +
        '<input type="text" id="lr-dv-out" value="' + _lrEsc(config.outputColumn || 'validation_status') + '" style="width:100%"></div>';

    renderRules();

    div.querySelector('#lr-dv-add').addEventListener('click', function() {
      rules.push({ column: cols[0] || '', type: 'not_empty', param: '' });
      onChange('rules', rules.slice());
      renderRules();
    });
    div.querySelector('#lr-dv-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });

    return div;
  }
};

/* ── LEFT_JOIN ── */

window.DWBNodes.LEFT_JOIN = {
  label: 'Left Join',
  icon: '🔗',
  category: 'Logic & Reconcile',
  defaultConfig: { leftKey: '', rightSnapshot: '', rightKey: '', includeColumns: [] },

  run: function(rows, config) {
    if (!config.leftKey || !config.rightSnapshot) return rows;
    var rightRows = _lrSnapshotRows(config.rightSnapshot);
    if (!rightRows) {
      console.warn('[LEFT_JOIN] Snapshot "' + config.rightSnapshot + '" not found — pass-through');
      return rows;
    }
    var rightKey  = config.rightKey;
    var incCols   = config.includeColumns || [];

    var rightMap = {};
    rightRows.forEach(function(rr) {
      var k = String(rr[rightKey] != null ? rr[rightKey] : '');
      if (!rightMap.hasOwnProperty(k)) rightMap[k] = rr;
    });

    return rows.map(function(row) {
      var nr      = Object.assign({}, row);
      var key     = String(row[config.leftKey] != null ? row[config.leftKey] : '');
      var matched = rightMap[key] || null;
      incCols.forEach(function(col) {
        nr[col] = matched ? (matched[col] != null ? matched[col] : '') : '';
      });
      return nr;
    });
  },

  validate: function(config) {
    if (!config.leftKey)       return 'Select a left key column';
    if (!config.rightSnapshot) return 'Select a snapshot to join against';
    if (!config.rightKey)      return 'Select a right key column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div       = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var leftCols  = _lrCols(currentRows);
    var snapNames = _lrSnapshotNames();
    var rightCols = config.rightSnapshot ? _lrSnapshotCols(config.rightSnapshot) : [];

    function renderChecklist() {
      var cl = div.querySelector('#lr-lj-chklist');
      if (!cl) return;
      if (!rightCols.length) {
        cl.innerHTML = '<span style="font-size:11px;color:var(--text-faint)">Select a snapshot to see columns</span>';
        return;
      }
      var inc = config.includeColumns || [];
      cl.innerHTML = rightCols.map(function(c) {
        return '<label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer">' +
          '<input type="checkbox" class="lr-lj-chk" value="' + _lrEsc(c) + '"' + (inc.indexOf(c) !== -1 ? ' checked' : '') + '> ' + _lrEsc(c) + '</label>';
      }).join('');
      cl.querySelectorAll('.lr-lj-chk').forEach(function(chk) {
        chk.addEventListener('change', function() {
          var updated = (config.includeColumns || []).slice();
          if (chk.checked) { if (updated.indexOf(chk.value) === -1) updated.push(chk.value); }
          else updated = updated.filter(function(x) { return x !== chk.value; });
          onChange('includeColumns', updated);
          config.includeColumns = updated;
        });
      });
    }

    function updateRightSection(snapName) {
      rightCols = snapName ? _lrSnapshotCols(snapName) : [];
      var rkEl = div.querySelector('#lr-lj-rkey');
      if (rkEl) rkEl.innerHTML = _lrColOptHtml(rightCols, '');
      onChange('rightKey', '');
      onChange('includeColumns', []);
      config.rightKey = '';
      config.includeColumns = [];
      renderChecklist();
    }

    var noSnapNote = !snapNames.length
      ? '<div style="font-size:11px;color:var(--text-faint);padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-raised)">No snapshots available. Add a Push to Viz node upstream and run the pipeline first.</div>'
      : '';

    div.innerHTML =
      noSnapNote +
      '<div class="form-row"><label>Left Key Column</label>' +
        '<select id="lr-lj-lkey" style="width:100%">' + _lrColOptHtml(leftCols, config.leftKey) + '</select></div>' +
      '<div class="form-row"><label>Right Snapshot</label>' +
        '<select id="lr-lj-snap" style="width:100%">' + _lrSnapOptHtml(snapNames, config.rightSnapshot) + '</select></div>' +
      '<div class="form-row"><label>Right Key Column</label>' +
        '<select id="lr-lj-rkey" style="width:100%">' + _lrColOptHtml(rightCols, config.rightKey) + '</select></div>' +
      '<div class="form-row"><label>Columns to Include</label>' +
        '<div id="lr-lj-chklist" style="border:1px solid var(--border);border-radius:4px;padding:4px 8px;max-height:130px;overflow-y:auto;margin-top:3px"></div></div>';

    renderChecklist();

    div.querySelector('#lr-lj-lkey').addEventListener('change', function(e) { onChange('leftKey', e.target.value); });
    div.querySelector('#lr-lj-snap').addEventListener('change', function(e) {
      onChange('rightSnapshot', e.target.value);
      config.rightSnapshot = e.target.value;
      updateRightSection(e.target.value);
    });
    div.querySelector('#lr-lj-rkey').addEventListener('change', function(e) { onChange('rightKey', e.target.value); });

    return div;
  }
};

/* ── DIFF_TABLES ── */

window.DWBNodes.DIFF_TABLES = {
  label: 'Diff Tables',
  icon: '📊',
  category: 'Logic & Reconcile',
  defaultConfig: { keyColumn: '', compareSnapshot: '' },

  run: function(rows, config) {
    if (!config.keyColumn || !config.compareSnapshot) return rows;
    var cmpRows = _lrSnapshotRows(config.compareSnapshot);
    if (!cmpRows) {
      console.warn('[DIFF_TABLES] Snapshot "' + config.compareSnapshot + '" not found — pass-through');
      return rows;
    }

    var keyCol  = config.keyColumn;
    var cmpMap  = {};
    cmpRows.forEach(function(cr) {
      var k = String(cr[keyCol] != null ? cr[keyCol] : '').trim();
      if (k) cmpMap[k] = cr;
    });

    var seenKeys = {};
    var outRows  = [];

    rows.forEach(function(row) {
      var nr  = Object.assign({}, row);
      var key = String(row[keyCol] != null ? row[keyCol] : '').trim();
      if (!key) { nr._diff_status = 'unchanged'; outRows.push(nr); return; }
      seenKeys[key] = 1;
      if (!cmpMap.hasOwnProperty(key)) {
        nr._diff_status = 'added';
      } else {
        var cmpRow  = cmpMap[key];
        var changed = false;
        var keys    = Object.keys(row);
        for (var i = 0; i < keys.length; i++) {
          var c = keys[i];
          if (String(row[c] != null ? row[c] : '') !== String(cmpRow[c] != null ? cmpRow[c] : '')) {
            changed = true; break;
          }
        }
        nr._diff_status = changed ? 'changed' : 'unchanged';
      }
      outRows.push(nr);
    });

    Object.keys(cmpMap).forEach(function(key) {
      if (!seenKeys[key]) {
        var removedRow = Object.assign({}, cmpMap[key], { _diff_status: 'removed' });
        outRows.push(removedRow);
      }
    });

    return outRows;
  },

  validate: function(config) {
    if (!config.keyColumn)        return 'Select a key column';
    if (!config.compareSnapshot)  return 'Select a snapshot to compare against';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div       = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var cols      = _lrCols(currentRows);
    var snapNames = _lrSnapshotNames();

    var noSnapNote = !snapNames.length
      ? '<div style="font-size:11px;color:var(--text-faint);padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-raised)">No snapshots available. Add a Push to Viz node upstream and run the pipeline first.</div>'
      : '';

    div.innerHTML =
      noSnapNote +
      '<div class="form-row"><label>Key Column</label>' +
        '<select id="lr-dt-key" style="width:100%">' + _lrColOptHtml(cols, config.keyColumn) + '</select></div>' +
      '<div class="form-row"><label>Compare Against Snapshot</label>' +
        '<select id="lr-dt-snap" style="width:100%">' + _lrSnapOptHtml(snapNames, config.compareSnapshot) + '</select></div>' +
      '<div style="font-size:11px;color:var(--text-muted)">Adds a <strong>_diff_status</strong> column: <em>added</em>, <em>removed</em>, <em>changed</em>, <em>unchanged</em>.</div>';

    div.querySelector('#lr-dt-key').addEventListener('change', function(e) { onChange('keyColumn', e.target.value); });
    div.querySelector('#lr-dt-snap').addEventListener('change', function(e) { onChange('compareSnapshot', e.target.value); });

    return div;
  }
};

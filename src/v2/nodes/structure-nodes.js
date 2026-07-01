/* === DWBNodes: Structure category (6 nodes) === */
window.DWBNodes = window.DWBNodes || {};

/* ── Shared helpers ── */

function _stEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _stCols(currentRows) {
  return (currentRows && currentRows.length) ? Object.keys(currentRows[0]) : [];
}

function _stColumnSelect(label, key, config, currentRows, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var cols = _stCols(currentRows);
  var opts = cols.length
    ? '<option value="">-- select --</option>' +
      cols.map(function(c) {
        return '<option value="' + _stEsc(c) + '"' + (config[key] === c ? ' selected' : '') + '>' + _stEsc(c) + '</option>';
      }).join('')
    : '<option value="" disabled selected>Run pipeline to see columns</option>';
  wrap.innerHTML = '<label>' + _stEsc(label) + '</label><select style="width:100%">' + opts + '</select>';
  wrap.querySelector('select').addEventListener('change', function(e) { onChange(key, e.target.value); });
  return wrap;
}

/* Scrollable checkbox list. onToggle(col, checked) fires on each change. */
function _stChecklist(label, cols, selected, onToggle) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.appendChild(lbl);

  var list = document.createElement('div');
  list.style.cssText = 'border:1px solid var(--border);border-radius:4px;padding:4px 8px;max-height:130px;overflow-y:auto;margin-top:3px';

  if (!cols.length) {
    list.innerHTML = '<span style="font-size:11px;color:var(--text-faint)">Run pipeline to see columns</span>';
  } else {
    cols.forEach(function(col) {
      var rowLbl = document.createElement('label');
      rowLbl.style.cssText = 'display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = col;
      chk.checked = selected.indexOf(col) !== -1;
      chk.addEventListener('change', function() { onToggle(col, chk.checked); });
      rowLbl.appendChild(chk);
      rowLbl.appendChild(document.createTextNode(col));
      list.appendChild(rowLbl);
    });
  }

  wrap.appendChild(list);
  return wrap;
}

/* Find a checkbox in a checklist element by its column value */
function _stFindChk(wrapEl, col) {
  var inputs = wrapEl.querySelectorAll('input[type=checkbox]');
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].value === col) return inputs[i];
  }
  return null;
}

/* ── SPLIT_COL ── */

function _stCollapseDelimiter(str, delimiter) {
  if (!delimiter) return str;
  var escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp('(' + escaped + ')+', 'g'), delimiter);
}

window.DWBNodes.SPLIT_COL = {
  label: 'Split Column',
  icon: '✂️',
  category: 'Structure',
  defaultConfig: { column: '', delimiter: ',', outputColumns: ['part1', 'part2'], trimParts: true, collapseDelimiters: true },

  run: function(rows, config) {
    if (!config.column) return rows;
    var delim = config.delimiter != null ? config.delimiter : ',';
    var outCols = (config.outputColumns || []).filter(function(c) { return (c || '').trim(); });
    if (!outCols.length) return rows;
    var trim = !!config.trimParts;
    var collapse = config.collapseDelimiters !== false;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      try {
        var s = String(row[config.column] == null ? '' : row[config.column]);
        if (collapse && delim) s = _stCollapseDelimiter(s.trim(), delim);
        var parts = s.split(delim);
        outCols.forEach(function(outCol, i) {
          var part = parts[i] !== undefined ? parts[i] : '';
          nr[outCol] = trim ? part.trim() : part;
        });
      } catch (e) {
        outCols.forEach(function(outCol) { nr[outCol] = ''; });
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    var valid = (config.outputColumns || []).filter(function(c) { return (c || '').trim(); });
    if (!valid.length) return 'Add at least one output column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    div.appendChild(_stColumnSelect('Column', 'column', config, currentRows, onChange));

    var delimRow = document.createElement('div');
    delimRow.className = 'form-row';
    delimRow.innerHTML = '<label>Delimiter</label>' +
      '<input type="text" id="st-sp-delim" value="' + _stEsc(config.delimiter != null ? config.delimiter : ',') + '" style="width:100%">';
    delimRow.querySelector('#st-sp-delim').addEventListener('input', function(e) { onChange('delimiter', e.target.value); });
    div.appendChild(delimRow);

    /* Dynamic output columns list */
    var outSection = document.createElement('div');
    outSection.className = 'form-row';
    outSection.innerHTML = '<label>Output columns</label>';
    var outList = document.createElement('div');
    outList.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:4px';

    function _spRenderOutCols() {
      outList.innerHTML = '';
      (config.outputColumns || []).forEach(function(col, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px';
        var numSpan = document.createElement('span');
        numSpan.textContent = i + 1;
        numSpan.style.cssText = 'font-size:11px;color:var(--text-faint);min-width:16px';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = col;
        inp.style.cssText = 'flex:1;font-size:12px';
        inp.dataset.idx = i;
        inp.addEventListener('input', function(e) {
          var arr = (config.outputColumns || []).slice();
          arr[parseInt(e.target.dataset.idx, 10)] = e.target.value;
          onChange('outputColumns', arr);
        });
        var rmv = document.createElement('button');
        rmv.textContent = '×';
        rmv.dataset.rmvidx = i;
        rmv.style.cssText = 'padding:1px 6px;font-size:11px;cursor:pointer;border:1px solid var(--border);border-radius:3px;background:transparent;flex-shrink:0';
        rmv.addEventListener('click', function(e) {
          var arr = (config.outputColumns || []).slice();
          arr.splice(parseInt(e.target.dataset.rmvidx, 10), 1);
          onChange('outputColumns', arr);
          _spRenderOutCols();
        });
        row.appendChild(numSpan);
        row.appendChild(inp);
        row.appendChild(rmv);
        outList.appendChild(row);
      });
    }

    _spRenderOutCols();
    outSection.appendChild(outList);

    var addColBtn = document.createElement('button');
    addColBtn.textContent = '+ Add column';
    addColBtn.style.cssText = 'margin-top:6px;font-size:12px;padding:3px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;cursor:pointer';
    addColBtn.addEventListener('click', function() {
      var arr = (config.outputColumns || []).slice();
      arr.push('part' + (arr.length + 1));
      onChange('outputColumns', arr);
      _spRenderOutCols();
    });
    outSection.appendChild(addColBtn);
    div.appendChild(outSection);

    div.appendChild(_coreCheckboxRow('Trim whitespace from each part', !!config.trimParts, function(v) { onChange('trimParts', v); }));
    div.appendChild(_coreCheckboxRow('Collapse repeated delimiters (e.g. multiple spaces treated as one)', config.collapseDelimiters !== false, function(v) { onChange('collapseDelimiters', v); }));

    return div;
  }
};

/* ── ADD_COL ── */

window.DWBNodes.ADD_COL = {
  label: 'Add Column',
  icon: '➕',
  category: 'Structure',
  defaultConfig: { outputColumn: 'new_column', defaultValue: '' },

  run: function(rows, config) {
    var col = (config.outputColumn || '').trim() || 'new_column';
    var val = config.defaultValue != null ? config.defaultValue : '';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      nr[col] = val;
      return nr;
    });
  },

  validate: function(config) {
    if (!(config.outputColumn || '').trim()) return 'Output column name is required';
    return null;
  },

  configUI: function(config, onChange) {
    var div = document.createElement('div');

    var colRow = document.createElement('div');
    colRow.className = 'form-row';
    colRow.innerHTML = '<label>Column name</label>' +
      '<input type="text" id="st-ac-col" value="' + _stEsc(config.outputColumn || '') + '" placeholder="new_column" style="width:100%">';
    colRow.querySelector('#st-ac-col').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.appendChild(colRow);

    var valRow = document.createElement('div');
    valRow.className = 'form-row';
    valRow.innerHTML = '<label>Default value</label>' +
      '<input type="text" id="st-ac-val" value="' + _stEsc(config.defaultValue != null ? config.defaultValue : '') + '" placeholder="" style="width:100%">';
    valRow.querySelector('#st-ac-val').addEventListener('input', function(e) { onChange('defaultValue', e.target.value); });
    div.appendChild(valRow);

    return div;
  }
};

/* ── DROP_COLS ── */

window.DWBNodes.DROP_COLS = {
  label: 'Drop Columns',
  icon: '🗑️',
  category: 'Structure',
  defaultConfig: { columns: [] },

  run: function(rows, config) {
    var drop = config.columns || [];
    if (!drop.length) return rows;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      drop.forEach(function(col) { delete nr[col]; });
      return nr;
    });
  },

  validate: function(config) {
    if (!(config.columns && config.columns.length)) return 'Select at least one column to drop';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _stCols(currentRows);

    div.appendChild(_stChecklist('Columns to drop', cols, config.columns || [], function(col, checked) {
      var arr = (config.columns || []).slice();
      if (checked) { if (arr.indexOf(col) === -1) arr.push(col); }
      else { arr = arr.filter(function(c) { return c !== col; }); }
      onChange('columns', arr);
    }));

    return div;
  }
};

/* ── RENAME_COL ── */

window.DWBNodes.RENAME_COL = {
  label: 'Rename Column',
  icon: '✏️',
  category: 'Structure',
  defaultConfig: { renames: [{ from: '', to: '' }] },

  run: function(rows, config) {
    var renames = (config.renames || []).filter(function(r) {
      return r.from && r.to && r.from !== r.to;
    });
    if (!renames.length) return rows;
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      renames.forEach(function(r) {
        if (Object.prototype.hasOwnProperty.call(nr, r.from)) {
          nr[r.to] = nr[r.from];
          delete nr[r.from];
        }
      });
      return nr;
    });
  },

  validate: function(config) {
    var valid = (config.renames || []).filter(function(r) { return r.from && r.to; });
    if (!valid.length) return 'Add at least one rename pair with both From and To filled in';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _stCols(currentRows);

    var section = document.createElement('div');
    section.className = 'form-row';
    section.innerHTML = '<label>Renames</label>';
    var pairList = document.createElement('div');
    pairList.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:4px';

    function _rnRenderPairs() {
      pairList.innerHTML = '';
      (config.renames || []).forEach(function(pair, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px';

        var fromSel = document.createElement('select');
        fromSel.style.cssText = 'flex:1;font-size:12px';
        fromSel.innerHTML = '<option value="">-- from --</option>' +
          cols.map(function(c) {
            return '<option value="' + _stEsc(c) + '"' + (pair.from === c ? ' selected' : '') + '>' + _stEsc(c) + '</option>';
          }).join('');

        var arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.cssText = 'font-size:13px;color:var(--text-muted);flex-shrink:0';

        var toInp = document.createElement('input');
        toInp.type = 'text';
        toInp.placeholder = 'new name';
        toInp.value = pair.to || '';
        toInp.style.cssText = 'flex:1;font-size:12px';

        fromSel.addEventListener('change', function() {
          var arr = (config.renames || []).slice();
          arr[i] = { from: fromSel.value, to: toInp.value };
          onChange('renames', arr);
        });
        toInp.addEventListener('input', function() {
          var arr = (config.renames || []).slice();
          arr[i] = { from: fromSel.value, to: toInp.value };
          onChange('renames', arr);
        });

        var rmv = document.createElement('button');
        rmv.textContent = '×';
        rmv.style.cssText = 'padding:1px 6px;font-size:11px;cursor:pointer;border:1px solid var(--border);border-radius:3px;background:transparent;flex-shrink:0';
        rmv.addEventListener('click', function() {
          var arr = (config.renames || []).slice();
          arr.splice(i, 1);
          onChange('renames', arr);
          _rnRenderPairs();
        });

        row.appendChild(fromSel);
        row.appendChild(arrow);
        row.appendChild(toInp);
        row.appendChild(rmv);
        pairList.appendChild(row);
      });
    }

    _rnRenderPairs();
    section.appendChild(pairList);

    var addBtn = document.createElement('button');
    addBtn.textContent = '+ Add rename';
    addBtn.style.cssText = 'margin-top:6px;font-size:12px;padding:3px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;cursor:pointer';
    addBtn.addEventListener('click', function() {
      var arr = (config.renames || []).slice();
      arr.push({ from: '', to: '' });
      onChange('renames', arr);
      _rnRenderPairs();
    });
    section.appendChild(addBtn);
    div.appendChild(section);

    return div;
  }
};

/* ── UNPIVOT ── */

function _stUnpivot(rows, idColumns, valueColumns, nameLabel, valueLabel) {
  var out = [];
  rows.forEach(function(row) {
    valueColumns.forEach(function(col) {
      var newRow = {};
      idColumns.forEach(function(id) { newRow[id] = row[id]; });
      newRow[nameLabel] = col;
      newRow[valueLabel] = row[col];
      out.push(newRow);
    });
  });
  return out;
}

window.DWBNodes.UNPIVOT = {
  label: 'Unpivot',
  icon: '🔄',
  category: 'Structure',
  defaultConfig: { idColumns: [], valueColumns: [], nameColumnLabel: 'variable', valueColumnLabel: 'value' },

  run: function(rows, config) {
    var valCols = config.valueColumns || [];
    if (!valCols.length) return rows;
    var idCols    = config.idColumns || [];
    var nameLabel = config.nameColumnLabel  || 'variable';
    var valLabel  = config.valueColumnLabel || 'value';
    try {
      return _stUnpivot(rows, idCols, valCols, nameLabel, valLabel);
    } catch (e) {
      return rows;
    }
  },

  validate: function(config) {
    if (!(config.valueColumns && config.valueColumns.length)) return 'Select at least one value column to unpivot';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _stCols(currentRows);

    var noteDiv = document.createElement('div');
    noteDiv.style.cssText = 'font-size:11px;color:var(--text-muted);display:none;padding:3px 0';
    noteDiv.textContent = 'A column cannot appear in both lists — it was removed from Value columns.';

    /* idWrap and valWrap are referenced by each other's callbacks; both are var-hoisted */
    var idWrap = _stChecklist('ID columns (keep as-is)', cols, config.idColumns || [], function(col, checked) {
      var idArr  = (config.idColumns  || []).slice();
      var valArr = (config.valueColumns || []).slice();
      if (checked) {
        if (idArr.indexOf(col) === -1) idArr.push(col);
        var viIdx = valArr.indexOf(col);
        if (viIdx !== -1) {
          valArr.splice(viIdx, 1);
          onChange('valueColumns', valArr);
          var valChk = _stFindChk(valWrap, col);
          if (valChk) valChk.checked = false;
          noteDiv.style.display = '';
        } else {
          noteDiv.style.display = 'none';
        }
      } else {
        idArr = idArr.filter(function(c) { return c !== col; });
        noteDiv.style.display = 'none';
      }
      onChange('idColumns', idArr);
    });

    /* valWrap assigned after idWrap so idWrap's callback can reference it */
    var valWrap = _stChecklist('Value columns (unpivot)', cols, config.valueColumns || [], function(col, checked) {
      var idArr  = (config.idColumns  || []).slice();
      var valArr = (config.valueColumns || []).slice();
      if (checked) {
        if (valArr.indexOf(col) === -1) valArr.push(col);
        var iiIdx = idArr.indexOf(col);
        if (iiIdx !== -1) {
          idArr.splice(iiIdx, 1);
          onChange('idColumns', idArr);
          var idChk = _stFindChk(idWrap, col);
          if (idChk) idChk.checked = false;
          noteDiv.style.display = '';
        } else {
          noteDiv.style.display = 'none';
        }
      } else {
        valArr = valArr.filter(function(c) { return c !== col; });
        noteDiv.style.display = 'none';
      }
      onChange('valueColumns', valArr);
    });

    div.appendChild(idWrap);
    div.appendChild(valWrap);
    div.appendChild(noteDiv);

    var nameLblRow = document.createElement('div');
    nameLblRow.className = 'form-row';
    nameLblRow.innerHTML = '<label>Variable column name</label>' +
      '<input type="text" id="st-up-name" value="' + _stEsc(config.nameColumnLabel || 'variable') + '" style="width:100%">';
    nameLblRow.querySelector('#st-up-name').addEventListener('input', function(e) { onChange('nameColumnLabel', e.target.value); });
    div.appendChild(nameLblRow);

    var valLblRow = document.createElement('div');
    valLblRow.className = 'form-row';
    valLblRow.innerHTML = '<label>Value column name</label>' +
      '<input type="text" id="st-up-val" value="' + _stEsc(config.valueColumnLabel || 'value') + '" style="width:100%">';
    valLblRow.querySelector('#st-up-val').addEventListener('input', function(e) { onChange('valueColumnLabel', e.target.value); });
    div.appendChild(valLblRow);

    return div;
  }
};

/* ── PIVOT ── */

function _stPivot(rows, idColumns, nameColumn, valueColumn, aggregation) {
  var groups = {};
  var groupOrder = [];
  rows.forEach(function(row) {
    var key = idColumns.map(function(id) { return row[id]; }).join('||');
    if (!groups[key]) {
      groups[key] = { idVals: {}, cells: {} };
      idColumns.forEach(function(id) { groups[key].idVals[id] = row[id]; });
      groupOrder.push(key);
    }
    var nameVal = String(row[nameColumn]);
    var val = row[valueColumn];
    if (!groups[key].cells[nameVal]) groups[key].cells[nameVal] = [];
    groups[key].cells[nameVal].push(val);
  });
  return groupOrder.map(function(key) {
    var g = groups[key];
    var out = Object.assign({}, g.idVals);
    Object.keys(g.cells).forEach(function(nameVal) {
      var vals = g.cells[nameVal];
      var resolved;
      if (aggregation === 'count') {
        resolved = vals.length;
      } else if (aggregation === 'sum') {
        resolved = vals.reduce(function(s, v) { return s + (parseFloat(v) || 0); }, 0);
      } else if (aggregation === 'average') {
        resolved = vals.length
          ? +(vals.reduce(function(s, v) { return s + (parseFloat(v) || 0); }, 0) / vals.length).toFixed(2)
          : 0;
      } else {
        resolved = vals[0]; // 'first'
      }
      out[nameVal] = resolved;
    });
    return out;
  });
}

window.DWBNodes.PIVOT = {
  label: 'Pivot',
  icon: '🔃',
  category: 'Structure',
  defaultConfig: { idColumns: [], nameColumn: '', valueColumn: '', aggregation: 'first' },

  run: function(rows, config) {
    if (!config.nameColumn || !config.valueColumn) return rows;
    try {
      return _stPivot(rows, config.idColumns || [], config.nameColumn, config.valueColumn, config.aggregation || 'first');
    } catch (e) {
      return rows;
    }
  },

  validate: function(config) {
    if (!config.nameColumn)  return 'Select a name column';
    if (!config.valueColumn) return 'Select a value column';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _stCols(currentRows);

    div.appendChild(_stChecklist('ID columns (kept as rows)', cols, config.idColumns || [], function(col, checked) {
      var arr = (config.idColumns || []).slice();
      if (checked) { if (arr.indexOf(col) === -1) arr.push(col); }
      else { arr = arr.filter(function(c) { return c !== col; }); }
      onChange('idColumns', arr);
    }));

    div.appendChild(_stColumnSelect('Name column', 'nameColumn', config, currentRows, onChange));
    div.appendChild(_stColumnSelect('Value column', 'valueColumn', config, currentRows, onChange));

    var aggRow = document.createElement('div');
    aggRow.className = 'form-row';
    var aggLbl = document.createElement('label');
    aggLbl.textContent = 'Aggregation';
    aggRow.appendChild(aggLbl);
    aggRow.appendChild(_coreRadioGroup('st-pv-agg',
      [
        { value: 'first',   label: 'First' },
        { value: 'sum',     label: 'Sum' },
        { value: 'count',   label: 'Count' },
        { value: 'average', label: 'Average' }
      ],
      config.aggregation || 'first',
      function(val) { onChange('aggregation', val); }
    ));
    var aggHint = document.createElement('div');
    aggHint.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px';
    aggHint.textContent = 'Used when multiple rows would map to the same cell.';
    aggRow.appendChild(aggHint);
    div.appendChild(aggRow);

    return div;
  }
};

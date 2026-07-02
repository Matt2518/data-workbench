/* === Core Node Registrations === */
window.DWBNodes = window.DWBNodes || {};

window.DWBNodes.INGEST = {
  label: 'Ingest CSV',
  icon: '📁',
  category: 'Input & Output',
  defaultConfig: { csvText: '', filename: '' },
  run: function(rows, config) { return rows; }, // handled by pipeline executor
  validate: function(config) { return null; },
  configUI: function(config, onChange, node) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:10px';

    const status = (config.filename || (node && node.config && node.config.filename))
      ? '<div style="font-size:12px;color:var(--success)">✓ Loaded: ' + (config.filename || node.config.filename) + '</div>'
      : '';

    div.innerHTML = `
      <div id="ingest-dz" style="border:2px dashed var(--border-strong);border-radius:6px;padding:20px;text-align:center;cursor:pointer;transition:all 0.15s">
        <div style="font-size:28px;margin-bottom:6px">📁</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Drop a CSV file here, or click Browse</div>
        <label style="display:inline-block;padding:5px 16px;background:var(--accent);color:#fff;border-radius:4px;font-size:12px;cursor:pointer">
          Browse…
          <input type="file" accept=".csv,.tsv,.txt" style="display:none" id="ingest-file-input">
        </label>
      </div>
      ${status}`;

    const input = div.querySelector('#ingest-file-input');
    const dz = div.querySelector('#ingest-dz');

    function handleFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        // Parse CSV and store as sourceData
        const parsed = window.DWBPipeline.parseCSV(ev.target.result);
        const state = window.DWBState;
        const selectedId = state.selectedNodeId;
        const flowNode = state.flow.pipeline.nodes.find(function(n) { return n.id === selectedId; });
        if (!flowNode) return;

        // Find or create sourceData entry
        let sd = state.flow.pipeline.sourceData.find(function(s) { return s.id === flowNode.sourceId; });
        if (!sd) {
          sd = window.DWBSchema.createSourceData(file.name);
          state.flow.pipeline.sourceData.push(sd);
          flowNode.sourceId = sd.id;
        }
        sd.filename = file.name;
        sd.rows = parsed.rows;
        flowNode.label = file.name;
        window.DWBShell.markDirty();
        window.DWBPipeline.run().then(function() {
          window.DWBPipelineTab && window.DWBPipelineTab.refresh();
        });
      };
      reader.readAsText(file);
    }

    input.addEventListener('change', function(e) { handleFile(e.target.files[0]); });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; });
    dz.addEventListener('dragleave', function() { dz.style.borderColor = 'var(--border-strong)'; });
    dz.addEventListener('drop', function(e) {
      e.preventDefault(); dz.style.borderColor = 'var(--border-strong)';
      handleFile(e.dataTransfer.files[0]);
    });

    return div;
  }
};

window.DWBNodes.PUSH_TO_VIZ = {
  label: 'Push to Viz',
  icon: '📊',
  category: 'Input & Output',
  defaultConfig: {},
  run: function(rows, config) { return rows; }, // handled by executor
  validate: function(config) { return null; } // name lives on node.promotedAs, not in config
};

function _coreNormalizeWhitespace(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\s ]+/g, ' ').trim();
}

window.DWBNodes.TRIM_WHITESPACE = {
  label: 'Trim Whitespace',
  icon: '✂',
  category: 'Text Cleaning',
  defaultConfig: { columns: [], normalizeInternal: false },
  run: function(rows, config) {
    const cols = config.columns && config.columns.length > 0 ? config.columns : null;
    const normalize = !!config.normalizeInternal;
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      Object.keys(nr).forEach(function(k) {
        if (!cols || cols.includes(k)) {
          if (typeof nr[k] === 'string') {
            nr[k] = normalize ? _coreNormalizeWhitespace(nr[k]) : nr[k].trim();
          }
        }
      });
      return nr;
    });
  },
  validate: function() { return null; },
  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _getColumns(currentRows);
    div.appendChild(_coreChecklist('Columns (empty = all)', cols, (config.columns || []).slice(), function(newSel) {
      onChange('columns', newSel);
    }));
    div.appendChild(_coreCheckboxRow(
      'Also collapse internal whitespace (tabs, line breaks, repeated spaces → single space)',
      config.normalizeInternal,
      function(v) { onChange('normalizeInternal', v); }
    ));
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:2px;padding:0 2px';
    hint.textContent = 'Useful for messy text with tabs, non-breaking spaces, or double spaces';
    div.appendChild(hint);
    return div;
  }
};

window.DWBNodes.FILTER = {
  label: 'Filter Rows',
  icon: '🔍',
  category: 'Row Operations',
  defaultConfig: { column: '', operator: 'equals', value: '', caseSensitive: false },
  run: function(rows, config) {
    if (!config.column) return rows;
    const col = config.column;
    const val = config.value || '';
    const cs = config.caseSensitive;
    return rows.filter(function(row) {
      const cell = String(row[col] !== undefined ? row[col] : '');
      const a = cs ? cell : cell.toLowerCase();
      const b = cs ? val  : val.toLowerCase();
      switch (config.operator) {
        case 'equals':         return a === b;
        case 'not_equals':     return a !== b;
        case 'contains':       return a.includes(b);
        case 'not_contains':   return !a.includes(b);
        case 'starts_with':    return a.startsWith(b);
        case 'ends_with':      return a.endsWith(b);
        case 'is_empty':       return cell.trim() === '';
        case 'is_not_empty':   return cell.trim() !== '';
        case 'gt': return parseFloat(cell) > parseFloat(val);
        case 'lt': return parseFloat(cell) < parseFloat(val);
        default: return true;
      }
    });
  },
  validate: function(config) { return config.column ? null : 'Select a column'; },
  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = _getColumns(currentRows);
    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="f-col" style="width:100%">
          <option value="">-- select --</option>
          ${cols.map(function(c) { return '<option value="' + _esc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _esc(c) + '</option>'; }).join('')}
        </select></div>
      <div class="form-row"><label>Operator</label>
        <select id="f-op" style="width:100%">
          ${[['equals','Equals'],['not_equals','Not equals'],['contains','Contains'],['not_contains','Does not contain'],['starts_with','Starts with'],['ends_with','Ends with'],['is_empty','Is empty'],['is_not_empty','Is not empty'],['gt','Greater than'],['lt','Less than']].map(function(o) { return '<option value="' + o[0] + '"' + (config.operator === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')}
        </select></div>
      <div class="form-row"><label>Value</label>
        <input type="text" id="f-val" value="${_esc(config.value||'')}" style="width:100%"></div>`;
    div.querySelector('#f-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#f-op').addEventListener('change', function(e) { onChange('operator', e.target.value); });
    div.querySelector('#f-val').addEventListener('input', function(e) { onChange('value', e.target.value); });
    div.appendChild(_coreCheckboxRow('Case sensitive', config.caseSensitive, function(v) { onChange('caseSensitive', v); }));
    return div;
  }
};

function _cnToNameCase(str) {
  var s = str.replace(/\w\S*/g, function(w) { return w.charAt(0).toUpperCase() + w.substr(1).toLowerCase(); });
  s = s.replace(/\bMc(\w)/g, function(m, c) { return 'Mc' + c.toUpperCase(); });
  s = s.replace(/\bMac(\w)/g, function(m, c) { return 'Mac' + c.toUpperCase(); });
  s = s.replace(/\bO'(\w)/g, function(m, c) { return "O'" + c.toUpperCase(); });
  s = s.replace(/\bSt\.?\s*(\w)/g, function(m, c) { return 'St. ' + c.toUpperCase(); });
  s = s.replace(/-(\w)/g, function(m, c) { return '-' + c.toUpperCase(); });
  return s;
}
function _cnToSentenceCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

window.DWBNodes.CASE_NORMALIZE = {
  label: 'Case Normalize',
  icon: 'Aa',
  category: 'Text Cleaning',
  defaultConfig: { columns: [], mode: 'lower' },
  run: function(rows, config) {
    var targetCols;
    if (Array.isArray(config.columns) && config.columns.length > 0) {
      targetCols = config.columns;
    } else if (!config.columns && config.column) {
      targetCols = [config.column];
    } else {
      targetCols = null;
    }
    var mode = config.mode || config.caseType || 'lower';
    return rows.map(function(row) {
      var nr = Object.assign({}, row);
      Object.keys(nr).forEach(function(key) {
        if (targetCols && targetCols.indexOf(key) === -1) return;
        var v = String(nr[key] == null ? '' : nr[key]);
        if (mode === 'upper')         { nr[key] = v.toUpperCase(); }
        else if (mode === 'title')    { nr[key] = v.replace(/\b\w/g, function(c) { return c.toUpperCase(); }); }
        else if (mode === 'name')     { nr[key] = _cnToNameCase(v); }
        else if (mode === 'sentence') { nr[key] = _cnToSentenceCase(v); }
        else                          { nr[key] = v.toLowerCase(); }
      });
      return nr;
    });
  },
  validate: function() { return null; },
  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _getColumns(currentRows);
    var initSelected = Array.isArray(config.columns) ? config.columns.slice() : (config.column ? [config.column] : []);
    div.appendChild(_coreChecklist('Columns (empty = all)', cols, initSelected, function(newSel) {
      onChange('columns', newSel);
    }));
    var modeRow = document.createElement('div');
    modeRow.className = 'form-row';
    var modeLbl = document.createElement('label');
    modeLbl.textContent = 'Mode';
    modeRow.appendChild(modeLbl);
    var currentMode = config.mode || config.caseType || 'lower';
    modeRow.appendChild(_coreRadioGroup('cn-mode',
      [
        { value: 'upper',    label: 'UPPERCASE' },
        { value: 'lower',    label: 'lowercase' },
        { value: 'title',    label: 'Title Case' },
        { value: 'name',     label: 'Name Case' },
        { value: 'sentence', label: 'Sentence case' }
      ],
      currentMode,
      function(val) { onChange('mode', val); }
    ));
    div.appendChild(modeRow);
    return div;
  }
};

window.DWBNodes.FIND_REPLACE = {
  label: 'Find & Replace',
  icon: '🔄',
  category: 'Text Cleaning',
  defaultConfig: { column: '', find: '', replaceType: 'static', replaceValue: '', replaceColumn: '', useRegex: false, caseSensitive: false },
  run: function(rows, config) {
    if (!config.column || !config.find) return rows;
    // Backward compat: old flows stored replacement in 'replace'
    if (config.replace !== undefined && config.replaceValue === undefined) {
      config.replaceValue = config.replace;
    }
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      let v = String(nr[config.column] || '');
      const repl = _coreResolveValue(config.replaceType || 'static', config.replaceValue, config.replaceColumn, row);
      if (config.useRegex) {
        try {
          const flags = config.caseSensitive ? 'g' : 'gi';
          v = v.replace(new RegExp(config.find, flags), repl);
        } catch (e) { /* invalid regex - pass through */ }
      } else {
        const flags = config.caseSensitive ? 'g' : 'gi';
        v = v.replace(new RegExp(config.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), repl);
      }
      nr[config.column] = v;
      return nr;
    });
  },
  validate: function(config) { return config.column ? null : 'Select a column'; },
  configUI: function(config, onChange, currentRows) {
    // Backward compat: migrate old 'replace' field on open
    if (config.replace !== undefined && config.replaceValue === undefined) {
      config.replaceValue = config.replace;
    }
    const div = document.createElement('div');
    const cols = _getColumns(currentRows);
    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="fr-col" style="width:100%"><option value="">-- select --</option>${cols.map(function(c) { return '<option value="' + _esc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _esc(c) + '</option>'; }).join('')}</select></div>
      <div class="form-row"><label>Find</label><input type="text" id="fr-find" value="${_esc(config.find||'')}" style="width:100%"></div>
      <div class="form-row"><label>Replace with</label><div id="fr-rep-wrap"></div></div>`;
    div.querySelector('#fr-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#fr-find').addEventListener('input', function(e) { onChange('find', e.target.value); });
    div.querySelector('#fr-rep-wrap').appendChild(
      _coreValueSource('fr-rep', config, 'replace', cols, onChange, false)
    );
    div.appendChild(_coreCheckboxRow('Use regex', config.useRegex, function(v) { onChange('useRegex', v); }));
    div.appendChild(_coreCheckboxRow('Case sensitive', config.caseSensitive, function(v) { onChange('caseSensitive', v); }));
    return div;
  }
};

window.DWBNodes.SORT = {
  label: 'Sort',
  icon: '⇅',
  category: 'Row Operations',
  defaultConfig: { column: '', direction: 'asc', numeric: false },
  run: function(rows, config) {
    if (!config.column) return rows;
    const col = config.column;
    const dir = config.direction === 'desc' ? -1 : 1;
    return rows.slice().sort(function(a, b) {
      const av = a[col] !== undefined ? a[col] : '';
      const bv = b[col] !== undefined ? b[col] : '';
      if (config.numeric) {
        return (parseFloat(av) - parseFloat(bv)) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  },
  validate: function(config) { return config.column ? null : 'Select a column'; },
  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = _getColumns(currentRows);
    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="sort-col" style="width:100%"><option value="">-- select --</option>${cols.map(function(c) { return '<option value="' + _esc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _esc(c) + '</option>'; }).join('')}</select></div>
      <div class="form-row"><label>Direction</label>
        <select id="sort-dir" style="width:100%">
          <option value="asc" ${config.direction === 'asc' ? 'selected' : ''}>Ascending A→Z</option>
          <option value="desc" ${config.direction === 'desc' ? 'selected' : ''}>Descending Z→A</option>
        </select></div>
`;
    div.querySelector('#sort-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#sort-dir').addEventListener('change', function(e) { onChange('direction', e.target.value); });
    div.appendChild(_coreCheckboxRow('Numeric sort', config.numeric, function(v) { onChange('numeric', v); }));
    return div;
  }
};

window.DWBNodes.REMOVE_DUPS = {
  label: 'Remove Duplicates',
  icon: '🚫',
  category: 'Row Operations',
  defaultConfig: { columns: [] },
  run: function(rows, config) {
    const cols = config.columns && config.columns.length > 0 ? config.columns : null;
    const seen = new Set();
    return rows.filter(function(row) {
      const key = cols
        ? cols.map(function(c) { return row[c]; }).join('|||')
        : JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  validate: function() { return null; },
  configUI: _coreColumnsUI('dups', 'Key columns (leave empty for whole row)')
};

window.DWBNodes.REARRANGE_COLS = {
  label: 'Rearrange Columns',
  icon: '↔',
  category: 'Column Operations',
  defaultConfig: { order: [] },
  run: function(rows, config) {
    if (!config.order || config.order.length === 0) return rows;
    const order = config.order;
    return rows.map(function(row) {
      const nr = {};
      order.forEach(function(k) { if (k in row) nr[k] = row[k]; });
      Object.keys(row).forEach(function(k) { if (!(k in nr)) nr[k] = row[k]; });
      return nr;
    });
  },
  validate: function() { return null; },
  configUI: function(config, onChange, currentRows) {
    var cols = _getColumns(currentRows);
    var order = (config.order && config.order.length) ? config.order : cols.slice();
    return _coreDragChecklist('Column order', cols, order, function(newOrder) {
      onChange('order', newOrder);
    });
  }
};

window.DWBNodes.CONCAT_COLS = {
  label: 'Concat Columns',
  icon: '🔗',
  category: 'Column Operations',
  defaultConfig: { columns: [], separator: ' ', outputColumn: 'concat_result' },
  run: function(rows, config) {
    if (!config.columns || config.columns.length < 2) return rows;
    const sep = config.separator !== undefined ? config.separator : ' ';
    const out = config.outputColumn || 'concat_result';
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      nr[out] = config.columns.map(function(c) { return row[c] !== undefined ? row[c] : ''; }).join(sep);
      return nr;
    });
  },
  validate: function(config) { return (config.columns && config.columns.length >= 2) ? null : 'Select at least 2 columns'; },
  configUI: function(config, onChange, currentRows) {
    var div = document.createElement('div');
    var cols = _getColumns(currentRows);
    div.appendChild(_coreDragChecklist('Columns to join (drag to reorder)', cols, config.columns || [], function(newCols) {
      onChange('columns', newCols);
    }));

    var sepRow = document.createElement('div');
    sepRow.className = 'form-row';
    sepRow.innerHTML = '<label>Separator</label>' +
      '<input type="text" id="cc-sep" value="' + _esc(config.separator !== undefined ? config.separator : ' ') + '" style="width:100%">';
    sepRow.querySelector('#cc-sep').addEventListener('input', function(e) { onChange('separator', e.target.value); });
    div.appendChild(sepRow);

    var outRow = document.createElement('div');
    outRow.className = 'form-row';
    outRow.innerHTML = '<label>Output column name</label>' +
      '<input type="text" id="cc-out" value="' + _esc(config.outputColumn || 'concat_result') + '" style="width:100%">';
    outRow.querySelector('#cc-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.appendChild(outRow);

    return div;
  }
};

window.DWBNodes.STASH_SAVE = {
  label: 'Stash Save',
  icon: '💾',
  category: 'Flow Control',
  defaultConfig: { name: 'my_stash' },
  run: function(rows) { return rows; }, // handled by executor
  validate: function(config) { return (config.name||'').trim() ? null : 'Stash name required'; },
  configUI: function(config, onChange) {
    const div = document.createElement('div');
    div.innerHTML = '<div class="form-row"><label>Stash Name</label><input type="text" id="ss-name" value="' + _esc(config.name||'my_stash') + '" style="width:100%"></div>';
    div.querySelector('#ss-name').addEventListener('input', function(e) { onChange('name', e.target.value.trim()); });
    return div;
  }
};

window.DWBNodes.STASH_RESTORE = {
  label: 'Stash Restore',
  icon: '📤',
  category: 'Flow Control',
  defaultConfig: { name: 'my_stash' },
  run: function(rows) { return rows; }, // handled by executor
  validate: function(config) { return (config.name||'').trim() ? null : 'Stash name required'; },
  configUI: function(config, onChange, currentRows, node) {
    var div = document.createElement('div');
    var row = document.createElement('div');
    row.className = 'form-row';
    var lbl = document.createElement('label');
    lbl.textContent = 'Stash Name';
    row.appendChild(lbl);

    var sel = document.createElement('select');
    sel.style.cssText = 'width:100%;box-sizing:border-box;';

    var available = node ? _coreGetUpstreamStashNames(node) : [];
    var current = (config.name || '').trim();

    if (available.length === 0 && !current) {
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'No stashes available upstream — add a Stash Save node first';
      placeholder.disabled = true;
      placeholder.selected = true;
      sel.appendChild(placeholder);
    } else {
      if (current && available.indexOf(current) === -1) {
        var warn = document.createElement('option');
        warn.value = current;
        warn.textContent = '⚠️ ' + current + ' (not found upstream)';
        warn.selected = true;
        sel.appendChild(warn);
      }
      available.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === current) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!current) sel.selectedIndex = 0;
    }

    sel.addEventListener('change', function() { onChange('name', sel.value); });
    row.appendChild(sel);

    var hint = document.createElement('div');
    hint.textContent = 'Only stashes created earlier in this pipeline are available.';
    hint.style.cssText = 'font-size:var(--text-xs,11px);color:var(--text-faint);margin-top:3px;';
    row.appendChild(hint);

    div.appendChild(row);
    return div;
  }
};

// ---- helpers used by configUI functions above ----
function _getColumns(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]);
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _coreColumnsUI(prefix, hint) {
  return function(config, onChange, currentRows) {
    var cols = _getColumns(currentRows);
    var selected = (config.columns || []).slice();
    return _coreChecklist(hint, cols, selected, function(newSel) {
      onChange('columns', newSel);
    });
  };
}

/* Checkbox-only checklist. onChange(newSelectedArray) fires on every change. */
function _coreChecklist(label, cols, selected, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.appendChild(lbl);

  var box = document.createElement('div');
  box.className = 'pt-checklist';
  box.style.cssText = 'max-width:100%;width:100%;box-sizing:border-box;';

  var hdr = document.createElement('div');
  hdr.className = 'pt-checklist-hdr';
  hdr.innerHTML = '<a class="pt-checklist-all">Select all</a><a class="pt-checklist-clear">Clear all</a>';
  box.appendChild(hdr);

  var list = document.createElement('div');
  list.className = 'pt-checklist-list';
  list.style.cssText = 'width:100%;';

  function render() {
    list.innerHTML = '';
    if (!cols.length) {
      list.innerHTML = '<div style="padding:8px;font-size:11px;color:var(--text-faint)">Run pipeline to see columns</div>';
      return;
    }
    cols.forEach(function(item) {
      var checked = selected.indexOf(item) !== -1;
      var row = document.createElement('label');
      row.className = 'pt-checklist-row' + (checked ? ' checked' : '');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;width:100%;box-sizing:border-box;justify-content:flex-start;text-align:left;font-weight:normal;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.style.cssText = 'flex-shrink:0;margin:0;padding:0;width:14px;height:14px;';
      cb.addEventListener('change', function() {
        if (this.checked) {
          if (selected.indexOf(item) === -1) selected.push(item);
        } else {
          selected = selected.filter(function(s) { return s !== item; });
        }
        row.className = 'pt-checklist-row' + (this.checked ? ' checked' : '');
        onChange(selected.slice());
      });
      row.appendChild(cb);
      var span = document.createElement('span');
      span.textContent = item;
      span.style.cssText = 'flex:1;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;text-align:left;';
      row.appendChild(span);
      list.appendChild(row);
    });
  }

  render();
  box.appendChild(list);

  hdr.querySelector('.pt-checklist-all').addEventListener('click', function() {
    var scrollTop = list.scrollTop;
    selected = cols.slice();
    onChange(selected.slice());
    render();
    list.scrollTop = scrollTop;
  });
  hdr.querySelector('.pt-checklist-clear').addEventListener('click', function() {
    var scrollTop = list.scrollTop;
    selected = [];
    onChange([]);
    render();
    list.scrollTop = scrollTop;
  });

  wrap.appendChild(box);
  return wrap;
}

/* Draggable checklist (order matters). onChange(newOrderedSelectedArray) fires on every change. */
function _coreDragChecklist(label, allCols, selected, onChange) {
  var wrap = document.createElement('div');
  wrap.className = 'form-row';
  var lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.appendChild(lbl);

  var box = document.createElement('div');
  box.className = 'pt-checklist';
  box.style.cssText = 'max-width:100%;width:100%;box-sizing:border-box;';

  var hdr = document.createElement('div');
  hdr.className = 'pt-checklist-hdr';
  hdr.innerHTML = '<a class="pt-checklist-all">Select all</a><a class="pt-checklist-clear">Clear all</a>';
  box.appendChild(hdr);

  var list = document.createElement('div');
  list.className = 'pt-checklist-list';
  list.style.cssText = 'width:100%;';

  // Build display order: selected cols first (in their order), then remaining cols
  var selSet = {};
  selected.forEach(function(c) { selSet[c] = true; });
  var remaining = allCols.filter(function(c) { return !selSet[c]; });
  var displayOrder = selected.filter(function(c) { return allCols.indexOf(c) !== -1; }).concat(remaining);
  var checkedSet = {};
  selected.forEach(function(c) { if (allCols.indexOf(c) !== -1) checkedSet[c] = true; });

  var dragSrcIdx = null;

  function getResult() {
    return displayOrder.filter(function(c) { return checkedSet[c]; });
  }

  function render() {
    list.innerHTML = '';
    if (!allCols.length) {
      list.innerHTML = '<div style="padding:8px;font-size:11px;color:var(--text-faint)">Run pipeline to see columns</div>';
      return;
    }
    displayOrder.forEach(function(item, i) {
      var checked = !!checkedSet[item];
      var row = document.createElement('label');
      row.className = 'pt-checklist-row' + (checked ? ' checked' : '');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;width:100%;box-sizing:border-box;justify-content:flex-start;text-align:left;font-weight:normal;';
      row.draggable = true;
      row.dataset.idx = i;

      var handle = document.createElement('span');
      handle.className = 'pt-checklist-drag';
      handle.textContent = '⠿';
      handle.style.cssText = 'flex-shrink:0;';
      row.appendChild(handle);

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.style.cssText = 'flex-shrink:0;margin:0;padding:0;width:14px;height:14px;';
      cb.addEventListener('change', function(e) {
        e.stopPropagation();
        if (cb.checked) { checkedSet[item] = true; }
        else { delete checkedSet[item]; }
        row.className = 'pt-checklist-row' + (cb.checked ? ' checked' : '');
        onChange(getResult());
      });
      row.appendChild(cb);

      var span = document.createElement('span');
      span.textContent = item;
      span.style.cssText = 'flex:1;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;text-align:left;';
      row.appendChild(span);

      row.addEventListener('dragstart', function(e) {
        dragSrcIdx = i;
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.4';
      });
      row.addEventListener('dragend', function() {
        row.style.opacity = '';
        list.querySelectorAll('.pt-checklist-row').forEach(function(r) { r.classList.remove('drag-over'); });
      });
      row.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.pt-checklist-row').forEach(function(r) { r.classList.remove('drag-over'); });
        row.classList.add('drag-over');
      });
      row.addEventListener('drop', function(e) {
        e.preventDefault();
        if (dragSrcIdx === null || dragSrcIdx === i) return;
        var scrollTop = list.scrollTop;
        var moved = displayOrder.splice(dragSrcIdx, 1)[0];
        displayOrder.splice(i, 0, moved);
        dragSrcIdx = null;
        onChange(getResult());
        render();
        list.scrollTop = scrollTop;
      });

      list.appendChild(row);
    });
  }

  render();
  box.appendChild(list);

  hdr.querySelector('.pt-checklist-all').addEventListener('click', function() {
    var scrollTop = list.scrollTop;
    allCols.forEach(function(c) { checkedSet[c] = true; });
    onChange(getResult());
    render();
    list.scrollTop = scrollTop;
  });
  hdr.querySelector('.pt-checklist-clear').addEventListener('click', function() {
    var scrollTop = list.scrollTop;
    checkedSet = {};
    onChange([]);
    render();
    list.scrollTop = scrollTop;
  });

  wrap.appendChild(box);
  return wrap;
}

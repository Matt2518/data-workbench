/* Shared UI helpers for node configUI functions.
   Must load before all other node files — filename prefix guarantees sort order. */

function _coreCheckboxRow(label, checked, onChange) {
  var row = document.createElement('div');
  row.className = 'form-row';
  var lbl = document.createElement('label');
  lbl.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;width:100%;box-sizing:border-box;';
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!checked;
  cb.style.cssText = 'flex-shrink:0;margin:0;width:14px;height:14px;padding:0;accent-color:var(--accent);';
  cb.addEventListener('change', function() { onChange(cb.checked); });
  var span = document.createElement('span');
  span.style.cssText = 'font-size:13px;color:var(--text-main);text-align:left;';
  span.textContent = label;
  lbl.appendChild(cb);
  lbl.appendChild(span);
  row.appendChild(lbl);
  return row;
}

function _coreRadioGroup(name, options, currentValue, onChange, direction) {
  var wrap = document.createElement('div');
  wrap.style.cssText = direction === 'vertical'
    ? 'display:flex;flex-direction:column;gap:6px;padding:4px 0;'
    : 'display:flex;flex-wrap:wrap;gap:8px 16px;padding:4px 0;';
  options.forEach(function(opt) {
    var lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main);white-space:nowrap;';
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = opt.value;
    radio.checked = currentValue === opt.value;
    radio.style.cssText = 'flex-shrink:0;margin:0;padding:0;width:14px;height:14px;accent-color:var(--accent);';
    radio.addEventListener('change', function() {
      if (radio.checked) onChange(opt.value);
    });
    var span = document.createElement('span');
    span.textContent = opt.label;
    lbl.appendChild(radio);
    lbl.appendChild(span);
    wrap.appendChild(lbl);
  });
  return wrap;
}

/* Shared value-source selector: radio group (Static / Column / optionally Empty)
   + a conditional text input or column dropdown beneath.
   prefix: string prepended to 'Type', 'Value', 'Column' to form config keys.
   columns: array of column name strings for the column dropdown.
   onChange(key, value): called whenever config is mutated.
   allowEmpty: whether to show the "Empty" third option. */
function _coreValueSource(name, config, prefix, columns, onChange, allowEmpty) {
  var typeKey  = prefix + 'Type';
  var valueKey = prefix + 'Value';
  var colKey   = prefix + 'Column';

  var wrap = document.createElement('div');

  var modes = [
    { value: 'static', label: 'Static text' },
    { value: 'column', label: 'Column value' }
  ];
  if (allowEmpty) modes.push({ value: 'empty', label: 'Empty' });

  var currentType = config[typeKey] || 'static';

  var radioRow = _coreRadioGroup(name, modes, currentType, function(val) {
    config[typeKey] = val;
    onChange(typeKey, val);
    rebuildControl();
  });
  wrap.appendChild(radioRow);

  var controlWrap = document.createElement('div');
  controlWrap.style.cssText = 'margin-top:6px;';
  wrap.appendChild(controlWrap);

  function rebuildControl() {
    controlWrap.innerHTML = '';
    var type = config[typeKey] || 'static';
    if (type === 'static') {
      var input = document.createElement('input');
      input.type = 'text';
      input.value = config[valueKey] || '';
      input.placeholder = 'Enter value…';
      input.style.cssText = 'width:100%;box-sizing:border-box;';
      input.addEventListener('input', function() {
        config[valueKey] = input.value;
        onChange(valueKey, input.value);
      });
      controlWrap.appendChild(input);
    } else if (type === 'column') {
      var sel = document.createElement('select');
      sel.style.cssText = 'width:100%;box-sizing:border-box;';
      var blank = document.createElement('option');
      blank.value = ''; blank.textContent = '— select column —';
      sel.appendChild(blank);
      (columns || []).forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        if (config[colKey] === c) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function() {
        config[colKey] = sel.value;
        onChange(colKey, sel.value);
      });
      controlWrap.appendChild(sel);
    }
    // 'empty' mode: no control rendered
  }

  rebuildControl();
  return wrap;
}

/* Returns unique STASH_SAVE names that appear before the given node in the pipeline. */
function _coreGetUpstreamStashNames(node) {
  var flow = window.DWBState && window.DWBState.flow;
  if (!flow) return [];
  var nodes = flow.pipeline.nodes;
  var myIndex = nodes.findIndex(function(n) { return n.id === node.id; });
  if (myIndex === -1) return [];
  var names = [];
  for (var i = 0; i < myIndex; i++) {
    if (nodes[i].type === 'STASH_SAVE' && nodes[i].config && nodes[i].config.name) {
      if (names.indexOf(nodes[i].config.name) === -1) names.push(nodes[i].config.name);
    }
  }
  return names;
}

/* Resolve a value-source config at run() time.
   type: 'static' | 'column' | 'empty'
   staticVal: the stored string for static mode.
   colName: the column name key for column mode.
   row: the current data row object. */
function _coreResolveValue(type, staticVal, colName, row) {
  if (type === 'column') return String(row[colName] !== undefined ? row[colName] : '');
  if (type === 'empty')  return '';
  return staticVal || '';
}

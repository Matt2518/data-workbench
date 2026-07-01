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

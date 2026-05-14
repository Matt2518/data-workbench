// Right panel — context-sensitive properties for selected element
function initProperties() {
  window._onSelectionChange = renderProperties;
}

function renderProperties() {
  const panel = document.getElementById('props-panel');
  if (!panel) return;
  panel.innerHTML = '';

  const el = state.selectedId ? getElement(state.selectedId) : null;
  if (!el) {
    panel.innerHTML = '<p class="props-empty">Select an element to edit its properties.</p>';
    return;
  }

  const sections = [];

  // --- Position & Size ---
  sections.push(makePropSection('Position & Size', [
    makeNumberRow('X', el.x, v => setProp(el, null, 'x', v)),
    makeNumberRow('Y', el.y, v => setProp(el, null, 'y', v)),
    makeNumberRow('Width', el.width, v => setProp(el, null, 'width', Math.max(1, v))),
    makeNumberRow('Height', el.height, v => setProp(el, null, 'height', Math.max(1, v))),
  ]));

  // --- Type-specific ---
  if (el.type === 'static-text' || el.type === 'bound-text') {
    const rows = [];
    if (el.type === 'static-text') {
      rows.push(makeTextRow('Content', el.style.content || '', v => setProp(el, 'style', 'content', v)));
    } else {
      const fieldOpts = state.fields.map(f => ({ value: f.id, label: f.label }));
      rows.push(makeSelectRow('Field', el.fieldId || '', fieldOpts, v => {
        applyChange(s => { const t = s.elements.find(e => e.id === el.id); if (t) t.fieldId = v; });
        renderCanvas(); renderProperties();
      }));
    }
    const fonts = ['Georgia','Times New Roman','Arial','Helvetica','Courier New','Trebuchet MS'];
    rows.push(makeSelectRow('Font', el.style.fontFamily || 'Arial', fonts.map(f => ({ value: f, label: f })), v => setProp(el, 'style', 'fontFamily', v)));
    rows.push(makeNumberRow('Font Size', el.style.fontSize || 16, v => setProp(el, 'style', 'fontSize', Math.max(4, v))));
    rows.push(makeSelectRow('Weight', el.style.fontWeight || 'normal', [
      { value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' },
    ], v => setProp(el, 'style', 'fontWeight', v)));
    rows.push(makeSelectRow('Style', el.style.fontStyle || 'normal', [
      { value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' },
    ], v => setProp(el, 'style', 'fontStyle', v)));
    rows.push(makeSelectRow('Align', el.style.textAnchor || 'start', [
      { value: 'start', label: 'Left' }, { value: 'middle', label: 'Center' }, { value: 'end', label: 'Right' },
    ], v => setProp(el, 'style', 'textAnchor', v)));
    rows.push(makeColorRow('Color', el.style.fill || '#000000', v => setProp(el, 'style', 'fill', v)));
    sections.push(makePropSection('Text', rows));
  }

  if (el.type === 'image') {
    const assetOpts = Object.entries(state.assets).map(([id, a]) => ({ value: id, label: a.name }));
    assetOpts.unshift({ value: '', label: '— none —' });
    sections.push(makePropSection('Image', [
      makeSelectRow('Asset', el.assetId || '', assetOpts, v => {
        applyChange(s => { const t = s.elements.find(e => e.id === el.id); if (t) t.assetId = v || null; });
        renderCanvas(); renderProperties();
      }),
      makeNumberRow('Opacity %', el.style.opacity !== undefined ? el.style.opacity : 100, v => setProp(el, 'style', 'opacity', Math.min(100, Math.max(0, v)))),
    ]));
  }

  if (el.type === 'rect') {
    sections.push(makePropSection('Rectangle', [
      makeColorNoneRow('Fill', el.style.fill, v => setProp(el, 'style', 'fill', v)),
      makeColorNoneRow('Stroke', el.style.stroke, v => setProp(el, 'style', 'stroke', v)),
      makeNumberRow('Stroke Width', el.style.strokeWidth || 1, v => setProp(el, 'style', 'strokeWidth', Math.max(0, v))),
      makeNumberRow('Corner Radius', el.style.rx || 0, v => setProp(el, 'style', 'rx', Math.max(0, v))),
    ]));
  }

  for (const s of sections) panel.appendChild(s);
}

function setProp(el, group, key, value) {
  applyChange(s => {
    const target = s.elements.find(e => e.id === el.id);
    if (!target) return;
    if (group) target[group][key] = value;
    else target[key] = value;
  });
  renderCanvas();
  renderProperties();
}

function makePropSection(title, rows) {
  const sec = document.createElement('div');
  sec.className = 'prop-section';
  const h = document.createElement('div');
  h.className = 'prop-section-title'; h.textContent = title;
  sec.appendChild(h);
  for (const r of rows) sec.appendChild(r);
  return sec;
}

function makeRow(label) {
  const row = document.createElement('div'); row.className = 'prop-row';
  const lbl = document.createElement('label'); lbl.className = 'prop-label'; lbl.textContent = label;
  row.appendChild(lbl);
  return row;
}

function makeNumberRow(label, value, onChange) {
  const row = makeRow(label);
  const inp = document.createElement('input');
  inp.type = 'number'; inp.className = 'prop-input'; inp.value = value;
  inp.addEventListener('change', () => onChange(parseFloat(inp.value) || 0));
  inp.addEventListener('input', () => onChange(parseFloat(inp.value) || 0));
  row.appendChild(inp);
  return row;
}

function makeTextRow(label, value, onChange) {
  const row = makeRow(label);
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'prop-input'; inp.value = value;
  inp.addEventListener('input', () => onChange(inp.value));
  row.appendChild(inp);
  return row;
}

function makeSelectRow(label, value, options, onChange) {
  const row = makeRow(label);
  const sel = document.createElement('select'); sel.className = 'prop-input';
  for (const opt of options) {
    const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  row.appendChild(sel);
  return row;
}

function makeColorRow(label, value, onChange) {
  const row = makeRow(label);
  const inp = document.createElement('input');
  inp.type = 'color'; inp.className = 'prop-color'; inp.value = value || '#000000';
  inp.addEventListener('input', () => onChange(inp.value));
  row.appendChild(inp);
  return row;
}

function makeColorNoneRow(label, value, onChange) {
  const row = makeRow(label);
  const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.gap = '4px'; wrap.style.alignItems = 'center';
  const isNone = !value || value === 'none';
  const inp = document.createElement('input');
  inp.type = 'color'; inp.className = 'prop-color'; inp.value = isNone ? '#cccccc' : value;
  inp.disabled = isNone;
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.title = 'None'; cb.checked = isNone;
  const cbLbl = document.createElement('span'); cbLbl.textContent = 'none'; cbLbl.style.fontSize = '11px';
  cb.addEventListener('change', () => {
    inp.disabled = cb.checked;
    onChange(cb.checked ? 'none' : inp.value);
  });
  inp.addEventListener('input', () => { if (!cb.checked) onChange(inp.value); });
  wrap.appendChild(inp); wrap.appendChild(cb); wrap.appendChild(cbLbl);
  row.appendChild(wrap);
  return row;
}

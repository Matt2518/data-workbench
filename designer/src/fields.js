// Fields tab — schema manager for template field declarations
function initFields() {
  document.getElementById('btn-add-field').addEventListener('click', addField);
  renderFieldsList();
}

function renderFieldsList() {
  const list = document.getElementById('fields-list');
  if (!list) return;
  list.innerHTML = '';
  for (const field of state.fields) {
    const row = document.createElement('div'); row.className = 'field-row';

    const labelInp = document.createElement('input');
    labelInp.type = 'text'; labelInp.className = 'field-label-input'; labelInp.value = field.label;
    labelInp.addEventListener('change', () => {
      const newLabel = labelInp.value.trim();
      if (!newLabel) return;
      const newId = slugify(newLabel);
      applyChange(s => {
        const f = s.fields.find(x => x.id === field.id);
        if (f) { f.label = newLabel; f.id = newId; }
        // Update bound elements
        s.elements.forEach(el => { if (el.fieldId === field.id) el.fieldId = newId; });
      });
      renderFieldsList();
      renderCanvas();
    });

    const typeSelect = document.createElement('select'); typeSelect.className = 'field-type-select';
    for (const t of ['text', 'date', 'number']) {
      const o = document.createElement('option'); o.value = t; o.textContent = t;
      if (t === field.type) o.selected = true;
      typeSelect.appendChild(o);
    }
    typeSelect.addEventListener('change', () => {
      applyChange(s => { const f = s.fields.find(x => x.id === field.id); if (f) f.type = typeSelect.value; });
    });

    const slug = document.createElement('div'); slug.className = 'field-slug'; slug.textContent = field.id;

    const delBtn = document.createElement('button'); delBtn.className = 'field-del-btn'; delBtn.textContent = '✕';
    delBtn.title = 'Delete field';
    delBtn.addEventListener('click', () => {
      applyChange(s => {
        s.fields = s.fields.filter(x => x.id !== field.id);
        // Unlink but keep bound elements — they will show as unbound
      });
      renderFieldsList();
      renderCanvas();
      renderProperties();
    });

    row.appendChild(labelInp); row.appendChild(typeSelect); row.appendChild(slug); row.appendChild(delBtn);
    list.appendChild(row);
  }
}

function addField() {
  const id = genId('fld');
  applyChange(s => { s.fields.push({ id: 'field_' + s.fields.length + 1, label: 'New Field ' + (s.fields.length + 1), type: 'text' }); });
  renderFieldsList();
}

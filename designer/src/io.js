// File I/O — load/save JSON, preview SVG export
function initIO() {
  document.getElementById('btn-new').addEventListener('click', newTemplate);
  document.getElementById('btn-load').addEventListener('click', loadJSON);
  document.getElementById('btn-save').addEventListener('click', saveJSON);
  document.getElementById('btn-preview').addEventListener('click', previewSVG);
}

function newTemplate() {
  if (!confirm('Create a new template? Unsaved changes will be lost.')) return;
  applyChange(s => {
    s.meta = { name: 'Untitled Template', version: '1.0', pageWidth: 1056, pageHeight: 816 };
    s.assets = {};
    s.fields = [];
    s.elements = [];
    s.background = { assetId: null };
    s.selectedId = null;
    s._dirty = false;
  });
  renderCanvas();
  renderFieldsList();
  renderAssets();
  renderProperties();
  document.getElementById('template-name').value = 'Untitled Template';
}

function loadJSON() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.addEventListener('change', () => {
    if (!inp.files || !inp.files.length) return;
    const reader = new FileReader();
    reader.onload = () => {
      let tpl;
      try { tpl = JSON.parse(reader.result); }
      catch(e) { alert('Invalid JSON file.'); return; }
      importTemplate(tpl);
    };
    reader.readAsText(inp.files[0]);
  });
  inp.click();
}

function importTemplate(tpl) {
  const elements = (tpl.elements || []).map(el => {
    if (el.type === 'static-text' && el.content === undefined && el.style && el.style.content !== undefined) {
      const { content: _c, ...styleWithout } = el.style;
      return Object.assign({}, el, { content: el.style.content, style: styleWithout });
    }
    return el;
  });
  applyChange(s => {
    s.meta = tpl.meta || s.meta;
    s.assets = tpl.assets || {};
    s.fields = tpl.fields || [];
    s.elements = elements;
    s.background = tpl.background || { assetId: null };
    s.selectedId = null;
    s._dirty = false;
  });
  renderCanvas();
  renderFieldsList();
  renderAssets();
  renderProperties();
  const nameEl = document.getElementById('template-name');
  if (nameEl) nameEl.value = state.meta.name || 'Untitled Template';
}

function saveJSON() {
  const name = (document.getElementById('template-name')?.value || 'template').trim();
  applyChange(s => { s.meta.name = name; s._dirty = false; });
  const tpl = {
    meta: state.meta,
    assets: state.assets,
    fields: state.fields,
    elements: state.elements,
    background: state.background,
  };
  const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
  triggerDownload(blob, (name.replace(/[^a-z0-9_\-]/gi, '_') || 'template') + '.json');
}

function previewSVG() {
  const svgEl = document.getElementById('svg-canvas');
  if (!svgEl) return;

  // Clone exportable canvas only (not the overlay)
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');
  clone.setAttribute('width', PAGE_W);
  clone.setAttribute('height', PAGE_H);

  const serializer = new XMLSerializer();
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);

  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const name = (state.meta.name || 'template').replace(/[^a-z0-9_\-]/gi, '_') || 'template';
  triggerDownload(blob, name + '_preview.svg');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

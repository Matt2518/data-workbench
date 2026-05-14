// Central application state — all mutations must go through applyChange()
const state = {
  meta: { name: 'Untitled Template', version: '1.0', pageWidth: 1056, pageHeight: 816 },
  assets: {},       // { assetId: { name, type, data } }
  fields: [],       // [{ id, label, type }]
  elements: [],     // [{ id, type, x, y, width, height, style, fieldId?, assetId? }]
  background: { assetId: null },
  selectedId: null,
  gridOn: false,
  zoom: 1,
  _dirty: false,
};

// Single mutation point — future undo/redo hooks here
function applyChange(fn) {
  fn(state);
  state._dirty = true;
  if (typeof window._onStateChange === 'function') window._onStateChange();
}

function genId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
}

function getElement(id) {
  return state.elements.find(el => el.id === id) || null;
}

function getField(id) {
  return state.fields.find(f => f.id === id) || null;
}

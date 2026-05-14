// Canvas — live SVG representation of the template page
const PAGE_W = 1056;
const PAGE_H = 816;
const GRID_SIZE = 8;
const HANDLE_SIZE = 8;

let svgCanvas, svgOverlay, canvasWrap;
let dragState = null;  // { type:'move'|'resize', elId, handle, startX, startY, origX, origY, origW, origH }

function initCanvas() {
  canvasWrap = document.getElementById('canvas-wrap');

  svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgCanvas.setAttribute('id', 'svg-canvas');
  svgCanvas.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgCanvas.setAttribute('width', PAGE_W);
  svgCanvas.setAttribute('height', PAGE_H);
  svgCanvas.setAttribute('viewBox', `0 0 ${PAGE_W} ${PAGE_H}`);

  svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('id', 'svg-overlay');
  svgOverlay.setAttribute('width', PAGE_W);
  svgOverlay.setAttribute('height', PAGE_H);
  svgOverlay.setAttribute('viewBox', `0 0 ${PAGE_W} ${PAGE_H}`);
  svgOverlay.style.position = 'absolute';
  svgOverlay.style.top = '0';
  svgOverlay.style.left = '0';
  svgOverlay.style.pointerEvents = 'none';

  canvasWrap.appendChild(svgCanvas);
  canvasWrap.appendChild(svgOverlay);

  svgCanvas.addEventListener('mousedown', onCanvasMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  renderCanvas();
}

function renderCanvas() {
  // Clear canvas
  while (svgCanvas.firstChild) svgCanvas.removeChild(svgCanvas.firstChild);

  // White page background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', 0); bg.setAttribute('y', 0);
  bg.setAttribute('width', PAGE_W); bg.setAttribute('height', PAGE_H);
  bg.setAttribute('fill', '#ffffff');
  svgCanvas.appendChild(bg);

  // Background asset
  if (state.background.assetId && state.assets[state.background.assetId]) {
    const a = state.assets[state.background.assetId];
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('x', 0); img.setAttribute('y', 0);
    img.setAttribute('width', PAGE_W); img.setAttribute('height', PAGE_H);
    img.setAttribute('href', `data:${a.type};base64,${a.data}`);
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgCanvas.appendChild(img);
  }

  // Elements
  for (const el of state.elements) {
    const node = buildSvgElement(el);
    if (node) svgCanvas.appendChild(node);
  }

  renderOverlay();
  updateZoom();
}

function buildSvgElement(el) {
  if (el.type === 'rect') {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', el.x); r.setAttribute('y', el.y);
    r.setAttribute('width', el.width); r.setAttribute('height', el.height);
    r.setAttribute('fill', el.style.fill || '#cccccc');
    r.setAttribute('stroke', el.style.stroke || 'none');
    r.setAttribute('stroke-width', el.style.strokeWidth || 1);
    r.setAttribute('rx', el.style.rx || 0);
    r.dataset.elId = el.id;
    return r;
  }

  if (el.type === 'static-text' || el.type === 'bound-text') {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', el.x + (el.style.textAnchor === 'middle' ? el.width / 2 : el.style.textAnchor === 'end' ? el.width : 0));
    t.setAttribute('y', el.y + (el.style.fontSize || 16));
    t.setAttribute('font-family', el.style.fontFamily || 'Arial');
    t.setAttribute('font-size', el.style.fontSize || 16);
    t.setAttribute('font-weight', el.style.fontWeight || 'normal');
    t.setAttribute('font-style', el.style.fontStyle || 'normal');
    t.setAttribute('text-anchor', el.style.textAnchor || 'start');
    t.setAttribute('fill', el.style.fill || '#000000');
    if (el.type === 'bound-text') {
      const field = getField(el.fieldId);
      const unbound = !field;
      t.textContent = unbound ? `⚠ {{${el.fieldId || '?'}}}` : `{{${field.label}}}`;
      if (unbound) t.setAttribute('fill', '#cc3300');
      if (el.fieldId) t.setAttribute('data-field-id', el.fieldId);
    } else {
      t.textContent = el.content !== undefined ? el.content : (el.style.content !== undefined ? el.style.content : 'Text');
    }
    t.dataset.elId = el.id;
    return t;
  }

  if (el.type === 'image') {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (el.assetId && state.assets[el.assetId]) {
      const a = state.assets[el.assetId];
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('x', el.x); img.setAttribute('y', el.y);
      img.setAttribute('width', el.width); img.setAttribute('height', el.height);
      img.setAttribute('href', `data:${a.type};base64,${a.data}`);
      img.setAttribute('opacity', (el.style.opacity !== undefined ? el.style.opacity : 100) / 100);
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      g.appendChild(img);
    } else {
      const ph = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      ph.setAttribute('x', el.x); ph.setAttribute('y', el.y);
      ph.setAttribute('width', el.width); ph.setAttribute('height', el.height);
      ph.setAttribute('fill', '#e2e8f0'); ph.setAttribute('stroke', '#94a3b8'); ph.setAttribute('stroke-width', 1);
      const pt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pt.setAttribute('x', el.x + el.width / 2); pt.setAttribute('y', el.y + el.height / 2 + 5);
      pt.setAttribute('text-anchor', 'middle'); pt.setAttribute('fill', '#94a3b8'); pt.setAttribute('font-size', 12);
      pt.textContent = 'Image';
      g.appendChild(ph); g.appendChild(pt);
    }
    g.dataset.elId = el.id;
    return g;
  }

  return null;
}

function renderOverlay() {
  while (svgOverlay.firstChild) svgOverlay.removeChild(svgOverlay.firstChild);

  // Grid
  if (state.gridOn) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pat = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pat.setAttribute('id', 'grid-pat'); pat.setAttribute('width', GRID_SIZE); pat.setAttribute('height', GRID_SIZE);
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pl.setAttribute('d', `M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`);
    pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#b0c4de'); pl.setAttribute('stroke-width', '0.5');
    pat.appendChild(pl); defs.appendChild(pat); svgOverlay.appendChild(defs);
    const gr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gr.setAttribute('width', PAGE_W); gr.setAttribute('height', PAGE_H);
    gr.setAttribute('fill', 'url(#grid-pat)');
    svgOverlay.appendChild(gr);
  }

  // Selection handles
  if (state.selectedId) {
    const el = getElement(state.selectedId);
    if (el) drawSelectionHandles(el);
  }
}

function drawSelectionHandles(el) {
  const { x, y, width, height } = el;
  const selRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  selRect.setAttribute('x', x - 1); selRect.setAttribute('y', y - 1);
  selRect.setAttribute('width', width + 2); selRect.setAttribute('height', height + 2);
  selRect.setAttribute('fill', 'none'); selRect.setAttribute('stroke', '#005EB8'); selRect.setAttribute('stroke-width', 1.5);
  selRect.setAttribute('stroke-dasharray', '4 2');
  svgOverlay.appendChild(selRect);

  const handles = [
    { id: 'nw', cx: x,           cy: y },
    { id: 'n',  cx: x + width/2, cy: y },
    { id: 'ne', cx: x + width,   cy: y },
    { id: 'e',  cx: x + width,   cy: y + height/2 },
    { id: 'se', cx: x + width,   cy: y + height },
    { id: 's',  cx: x + width/2, cy: y + height },
    { id: 'sw', cx: x,           cy: y + height },
    { id: 'w',  cx: x,           cy: y + height/2 },
  ];

  for (const h of handles) {
    const hr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hr.setAttribute('x', h.cx - HANDLE_SIZE/2); hr.setAttribute('y', h.cy - HANDLE_SIZE/2);
    hr.setAttribute('width', HANDLE_SIZE); hr.setAttribute('height', HANDLE_SIZE);
    hr.setAttribute('fill', '#ffffff'); hr.setAttribute('stroke', '#005EB8'); hr.setAttribute('stroke-width', 1.5);
    hr.setAttribute('data-handle', h.id);
    hr.style.pointerEvents = 'all';
    hr.style.cursor = getCursorForHandle(h.id);
    hr.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startResize(e, h.id, el);
    });
    svgOverlay.appendChild(hr);
  }
}

function getCursorForHandle(h) {
  const map = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize', se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' };
  return map[h] || 'default';
}

function updateZoom() {
  const wrap = document.getElementById('canvas-outer');
  if (!wrap) return;
  const availW = wrap.clientWidth - 40;
  const availH = wrap.clientHeight - 40;
  const scaleX = availW / PAGE_W;
  const scaleY = availH / PAGE_H;
  const fit = Math.min(scaleX, scaleY, 1);
  state.zoom = fit;
  const scaledW = Math.round(PAGE_W * fit);
  const scaledH = Math.round(PAGE_H * fit);
  canvasWrap.style.width = scaledW + 'px';
  canvasWrap.style.height = scaledH + 'px';
  svgCanvas.style.width = scaledW + 'px';
  svgCanvas.style.height = scaledH + 'px';
  svgOverlay.style.width = scaledW + 'px';
  svgOverlay.style.height = scaledH + 'px';
  const pct = Math.round(fit * 100);
  const zoomEl = document.getElementById('zoom-label');
  if (zoomEl) zoomEl.textContent = pct + '%';
}

// Convert mouse event coords to SVG user units
function mouseToSvg(e) {
  const rect = svgCanvas.getBoundingClientRect();
  const scaleX = PAGE_W / rect.width;
  const scaleY = PAGE_H / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function snapToGrid(v) {
  if (!state.gridOn) return v;
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function snapCoords(x, y) {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

function onCanvasMouseDown(e) {
  e.preventDefault();
  const target = e.target;
  const elId = target.dataset.elId || target.closest('[data-el-id]')?.dataset.elId;

  if (!elId) {
    applyChange(s => { s.selectedId = null; });
    if (typeof window._onSelectionChange === 'function') window._onSelectionChange();
    renderOverlay();
    return;
  }

  applyChange(s => { s.selectedId = elId; });
  if (typeof window._onSelectionChange === 'function') window._onSelectionChange();

  const el = getElement(elId);
  const pt = mouseToSvg(e);
  dragState = {
    type: 'move', elId,
    startX: pt.x, startY: pt.y,
    origX: el.x, origY: el.y,
    origW: el.width, origH: el.height,
  };
  renderOverlay();
}

function startResize(e, handle, el) {
  const pt = mouseToSvg(e);
  dragState = {
    type: 'resize', elId: el.id, handle,
    startX: pt.x, startY: pt.y,
    origX: el.x, origY: el.y,
    origW: el.width, origH: el.height,
  };
}

function onMouseMove(e) {
  if (!dragState) return;
  const pt = mouseToSvg(e);
  const dx = pt.x - dragState.startX;
  const dy = pt.y - dragState.startY;
  const el = getElement(dragState.elId);
  if (!el) return;

  if (dragState.type === 'move') {
    const snapped = snapCoords(dragState.origX + dx, dragState.origY + dy);
    applyChange(s => {
      const target = s.elements.find(el => el.id === dragState.elId);
      if (target) { target.x = snapped.x; target.y = snapped.y; }
    });
  } else if (dragState.type === 'resize') {
    const h = dragState.handle;
    let nx = dragState.origX, ny = dragState.origY, nw = dragState.origW, nh = dragState.origH;
    if (h.includes('e')) nw = Math.max(8, dragState.origW + dx);
    if (h.includes('s')) nh = Math.max(8, dragState.origH + dy);
    if (h.includes('w')) { nx = dragState.origX + dx; nw = Math.max(8, dragState.origW - dx); }
    if (h.includes('n')) { ny = dragState.origY + dy; nh = Math.max(8, dragState.origH - dy); }
    const snappedPos = snapCoords(nx, ny);
    const snappedSize = snapCoords(nw, nh);
    applyChange(s => {
      const target = s.elements.find(el => el.id === dragState.elId);
      if (target) { target.x = snappedPos.x; target.y = snappedPos.y; target.width = snappedSize.x; target.height = snappedSize.y; }
    });
  }

  renderCanvas();
  if (typeof window._onSelectionChange === 'function') window._onSelectionChange();
}

function onMouseUp() {
  dragState = null;
}

function onKeyDown(e) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    if (state.selectedId) {
      applyChange(s => {
        s.elements = s.elements.filter(el => el.id !== s.selectedId);
        s.selectedId = null;
      });
      renderCanvas();
      if (typeof window._onSelectionChange === 'function') window._onSelectionChange();
    }
  }
}

function addElement(el) {
  applyChange(s => { s.elements.push(el); s.selectedId = el.id; });
  renderCanvas();
  if (typeof window._onSelectionChange === 'function') window._onSelectionChange();
}

function addBoundText(fieldId) {
  const id = genId('el');
  addElement({ id, type: 'bound-text', x: 328, y: 388, width: 400, height: 40,
    style: { fontFamily: 'Georgia', fontSize: 24, fontWeight: 'normal', fontStyle: 'normal', textAnchor: 'middle', fill: '#000000' },
    fieldId: fieldId || (state.fields[0] && state.fields[0].id) || null,
  });
}

function addStaticText() {
  const id = genId('el');
  addElement({ id, type: 'static-text', x: 328, y: 388, width: 400, height: 40,
    content: 'Text',
    style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'normal', fontStyle: 'normal', textAnchor: 'start', fill: '#000000' },
  });
}

function addImageAsset(assetId) {
  const id = genId('el');
  addElement({ id, type: 'image', x: 378, y: 308, width: 300, height: 200,
    style: { opacity: 100 },
    assetId: assetId || null,
  });
}

function addRect() {
  const id = genId('el');
  addElement({ id, type: 'rect', x: 378, y: 358, width: 300, height: 100,
    style: { fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 1, rx: 0 },
  });
}

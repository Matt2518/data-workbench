/* === DWBPresentation: slide-based presentation display === */

window.DWBPresentation = (function() {
  let _presActiveIdx = 0;
  let _presPptxPromise = null;

  function _presLoadPptx() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (_presPptxPromise) return _presPptxPromise;
    _presPptxPromise = new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3/dist/pptxgen.bundled.js';
      s.onload = function() { resolve(window.PptxGenJS); };
      s.onerror = function() { _presPptxPromise = null; reject(new Error('PptxGenJS failed')); };
      document.head.appendChild(s);
      setTimeout(function() { if (!window.PptxGenJS) { _presPptxPromise = null; reject(new Error('PptxGenJS timeout')); } }, 8000);
    });
    return _presPptxPromise;
  }

  function mount(container, display) {
    if (!container || !display) return;
    const placements = display.placements || [];
    if (_presActiveIdx >= placements.length && placements.length > 0) _presActiveIdx = placements.length - 1;

    container.innerHTML = `<div class="pres-root">
      <div class="pres-toolbar">
        <span style="font-size:13px;font-weight:600;color:var(--text-main);flex:1">${_presEsc(display.label)}</span>
        <button class="tb-btn" id="pres-add-slide-tb">＋ Add Slide</button>
        <button class="tb-btn" id="pres-export-btn">↓ Export PPTX</button>
      </div>
      <div class="pres-body">
        <div class="pres-strip" id="pres-strip"></div>
        <div class="pres-canvas" id="pres-canvas"></div>
      </div>
    </div>`;

    container.querySelector('#pres-add-slide-tb').addEventListener('click', function() {
      _presAddSlide(display, container);
    });
    container.querySelector('#pres-export-btn').addEventListener('click', function() {
      _presExportPptx(display);
    });

    _presRenderStrip(display, container);
    _presRenderSlide(display, container);
  }

  function _presRenderStrip(display, container) {
    const strip = container.querySelector('#pres-strip');
    if (!strip) return;
    const placements = display.placements || [];

    strip.innerHTML = '';
    placements.forEach(function(p, idx) {
      const thumb = document.createElement('div');
      thumb.className = 'pres-slide-thumb' + (idx === _presActiveIdx ? ' active' : '');
      thumb.innerHTML = '<div class="pres-slide-num">Slide ' + (idx + 1) + '</div>' +
        '<div style="font-size:10px;font-weight:600">' + _presEsc(p.slideTitle || 'Untitled') + '</div>';
      thumb.addEventListener('click', function() {
        _presActiveIdx = idx;
        _presRenderStrip(display, container);
        _presRenderSlide(display, container);
      });
      strip.appendChild(thumb);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'pres-add-slide-btn';
    addBtn.textContent = '＋ Add Slide';
    addBtn.addEventListener('click', function() { _presAddSlide(display, container); });
    strip.appendChild(addBtn);
  }

  function _presRenderSlide(display, container) {
    const canvas = container.querySelector('#pres-canvas');
    if (!canvas) return;
    const placements = display.placements || [];

    if (placements.length === 0) {
      canvas.innerHTML = '<div class="empty-state"><div class="es-icon">🎭</div><div class="es-title">No slides yet</div><div class="es-desc">Add a slide to get started.</div></div>';
      return;
    }

    const p = placements[_presActiveIdx];
    if (!p) return;

    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];
    const viz = vizList.find(function(v) { return v.id === p.vizId; });
    const rows = viz ? (snapshots[viz.snapshotName] || []) : [];

    canvas.innerHTML = `<div style="width:100%;max-width:900px">
      <div class="pres-slide">
        <div class="pres-slide-title-bar" contenteditable="true" id="pres-slide-title" spellcheck="false">${_presEsc(p.slideTitle || 'Slide ' + (_presActiveIdx+1))}</div>
        <div class="pres-slide-content" id="pres-slide-body"></div>
        ${p.notes ? '<div class="pres-slide-notes">Notes: ' + _presEsc(p.notes) + '</div>' : ''}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
        <button class="tb-btn" id="pres-del-slide">✕ Delete Slide</button>
        <button class="btn-primary" id="pres-bind-viz">📊 Bind Visualization</button>
        <input type="text" id="pres-notes-input" value="${_presEsc(p.notes||'')}" placeholder="Speaker notes…" style="flex:1">
      </div>
    </div>`;

    const titleEl = canvas.querySelector('#pres-slide-title');
    titleEl.addEventListener('input', function() {
      p.slideTitle = titleEl.textContent.trim();
      window.DWBShell.markDirty();
      _presRenderStrip(display, container);
    });

    canvas.querySelector('#pres-notes-input').addEventListener('input', function(e) {
      p.notes = e.target.value;
      window.DWBShell.markDirty();
    });

    canvas.querySelector('#pres-del-slide').addEventListener('click', function() {
      display.placements.splice(_presActiveIdx, 1);
      if (_presActiveIdx >= display.placements.length) _presActiveIdx = Math.max(0, display.placements.length - 1);
      window.DWBShell.markDirty();
      _presRenderStrip(display, container);
      _presRenderSlide(display, container);
    });

    canvas.querySelector('#pres-bind-viz').addEventListener('click', function() {
      _presBindViz(p, display, container);
    });

    const body = canvas.querySelector('#pres-slide-body');
    if (viz && body && window.DWBVizTab) {
      window.DWBVizTab.renderViz(viz, rows, body);
    } else if (body) {
      body.innerHTML = '<div class="empty-state"><div class="es-icon">📊</div><div class="es-desc">Bind a visualization to this slide.</div></div>';
    }
  }

  function _presAddSlide(display, container) {
    const placement = window.DWBSchema.createPlacement(null, 'PRESENTATION');
    placement.slideTitle = 'Slide ' + ((display.placements||[]).length + 1);
    display.placements = display.placements || [];
    display.placements.push(placement);
    _presActiveIdx = display.placements.length - 1;
    window.DWBShell.markDirty();
    _presRenderStrip(display, container);
    _presRenderSlide(display, container);
  }

  function _presBindViz(placement, display, container) {
    const state = window.DWBState;
    const vizList = (state.flow && state.flow.visualizations) || [];
    if (vizList.length === 0) { alert('No visualizations. Create some in the Viz tab first.'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';
    overlay.innerHTML = `<div class="modal" style="width:360px">
      <div class="modal-header"><span>Bind Visualization</span><button class="modal-close" id="pres-bind-close">✕</button></div>
      <div style="padding:16px">
        <div class="form-row"><label>Visualization</label>
          <select id="pres-bind-sel" style="width:100%">
            <option value="">-- None --</option>
            ${vizList.map(function(v) { return '<option value="' + _presEsc(v.id) + '"' + (placement.vizId === v.id ? ' selected' : '') + '>' + _presEsc(v.label) + '</option>'; }).join('')}
          </select></div>
        <button class="btn-primary" id="pres-bind-ok" style="width:100%;margin-top:8px;padding:7px">OK</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#pres-bind-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.querySelector('#pres-bind-ok').addEventListener('click', function() {
      placement.vizId = overlay.querySelector('#pres-bind-sel').value || null;
      window.DWBShell.markDirty();
      document.body.removeChild(overlay);
      _presRenderSlide(display, container);
    });
  }

  function _presExportPptx(display) {
    _presLoadPptx().then(function(PptxGenJS) {
      const pptx = new PptxGenJS();
      const state = window.DWBState;
      const snapshots = state.snapshots || {};
      const vizList = (state.flow && state.flow.visualizations) || [];

      (display.placements || []).forEach(function(p) {
        const slide = pptx.addSlide();
        const title = p.slideTitle || '';
        if (title) {
          slide.addText(title, { x: 0.5, y: 0.3, fontSize: 24, bold: true, color: '002244' });
        }
        if (p.notes) slide.addNotes(p.notes);
      });

      pptx.writeFile({ fileName: (display.label || 'presentation') + '.pptx' });
      window.DWBShell && window.DWBShell.log('Exported PPTX: ' + display.label, 'success');
    }).catch(function(e) {
      alert('PPTX export failed: ' + e.message);
    });
  }

  function _presEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount };
})();

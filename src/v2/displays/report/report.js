/* === DWBReport: paginated report display === */

window.DWBReport = (function() {
  let _rJsPDFPromise = null;

  function _rLoadJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (_rJsPDFPromise) return _rJsPDFPromise;
    _rJsPDFPromise = new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js';
      s.onload = function() { resolve(window.jspdf); };
      s.onerror = function() { _rJsPDFPromise = null; reject(new Error('jsPDF load failed')); };
      document.head.appendChild(s);
      setTimeout(function() { if (!window.jspdf) { _rJsPDFPromise = null; reject(new Error('jsPDF timeout')); } }, 8000);
    });
    return _rJsPDFPromise;
  }

  function mount(container, display) {
    if (!container || !display) return;
    const cfg = display.config || {};

    container.innerHTML = `<div class="report-root">
      <div class="report-toolbar">
        <span style="font-size:13px;font-weight:600;color:var(--text-main);flex:1">${_rEsc(display.label)}</span>
        <button class="tb-btn" id="r-add-section">＋ Add Section</button>
        <button class="tb-btn" id="r-export-pdf">↓ Export PDF</button>
      </div>
      <div class="report-canvas" id="r-canvas"></div>
    </div>`;

    container.querySelector('#r-add-section').addEventListener('click', function() {
      _rAddPlacement(display, container);
    });
    container.querySelector('#r-export-pdf').addEventListener('click', function() {
      _rExportPDF(display, container);
    });

    _rRenderPages(display, container);
  }

  function _rRenderPages(display, container) {
    const canvas = container.querySelector('#r-canvas');
    if (!canvas) return;
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];
    const cfg = display.config || {};
    const placements = display.placements || [];

    canvas.innerHTML = '';

    // Cover page
    const cover = document.createElement('div');
    cover.className = 'report-page';
    cover.innerHTML = `<div class="report-cover">
      <div class="report-cover-title">${_rEsc(display.label)}</div>
      <div class="report-cover-sub">${new Date().toLocaleDateString()}</div>
    </div>`;
    canvas.appendChild(cover);

    // Content pages
    if (placements.length === 0) {
      const emptyPage = document.createElement('div');
      emptyPage.className = 'report-page';
      emptyPage.innerHTML = `<div class="report-page-header"><span>${_rEsc(display.label)}</span><span>${new Date().toLocaleDateString()}</span></div>
        <div class="empty-state"><div class="es-icon">📄</div><div class="es-desc">Click ＋ Add Section to add content.</div></div>
        <div class="report-page-footer"><span>${_rEsc(display.label)}</span><span>Page 2</span></div>
        <button class="report-add-btn" id="r-first-add">＋ Add first section</button>`;
      emptyPage.querySelector('#r-first-add').addEventListener('click', function() {
        _rAddPlacement(display, container);
      });
      canvas.appendChild(emptyPage);
      return;
    }

    let currentPage = null;
    let pageNum = 2;

    placements.forEach(function(placement) {
      if (!currentPage || placement.pageBreakBefore) {
        currentPage = document.createElement('div');
        currentPage.className = 'report-page';
        currentPage.innerHTML = `<div class="report-page-header"><span>${_rEsc(display.label)}</span><span>${new Date().toLocaleDateString()}</span></div>
          <div class="r-page-content" id="r-page-content-${pageNum}"></div>
          <div class="report-page-footer"><span>${_rEsc(display.label)}</span><span>Page ${pageNum}</span></div>`;
        canvas.appendChild(currentPage);
        pageNum++;
      }

      const pageContent = currentPage.querySelector('.r-page-content') || currentPage;
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      const rows = viz ? (snapshots[viz.snapshotName] || []) : [];

      const section = document.createElement('div');
      section.className = 'report-section';
      section.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
        <div class="report-section-title">${viz ? _rEsc(viz.label) : 'Section'}</div>
        <button class="tb-btn" data-del-id="${placement.id}" style="font-size:10px;padding:2px 7px">✕</button>
      </div>
      <div class="r-section-body" id="r-sb-${placement.id}"></div>
      ${placement.caption ? '<div class="report-caption">' + _rEsc(placement.caption) + '</div>' : ''}`;

      section.querySelector('[data-del-id]').addEventListener('click', function() {
        display.placements = display.placements.filter(function(p) { return p.id !== placement.id; });
        window.DWBShell.markDirty();
        _rRenderPages(display, container);
      });

      pageContent.appendChild(section);

      const body = section.querySelector('#r-sb-' + placement.id);
      if (viz && body && window.DWBVizTab) {
        window.DWBVizTab.renderViz(viz, rows, body);
      } else if (body) {
        body.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:16px 0">No visualization bound.</div>';
      }
    });

    // Add section button at end
    const lastPage = canvas.lastElementChild;
    if (lastPage) {
      const addBtn = document.createElement('button');
      addBtn.className = 'report-add-btn';
      addBtn.textContent = '＋ Add Section';
      addBtn.addEventListener('click', function() { _rAddPlacement(display, container); });
      lastPage.querySelector('.r-page-content') ? lastPage.querySelector('.r-page-content').appendChild(addBtn) : lastPage.appendChild(addBtn);
    }
  }

  function _rAddPlacement(display, container) {
    const state = window.DWBState;
    const vizList = (state.flow && state.flow.visualizations) || [];
    if (vizList.length === 0) { alert('No visualizations exist. Create some in the Viz tab first.'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';
    overlay.innerHTML = `<div class="modal" style="width:360px">
      <div class="modal-header"><span>Add Report Section</span><button class="modal-close" id="r-modal-close">✕</button></div>
      <div style="padding:16px">
        <div class="form-row"><label>Visualization</label>
          <select id="r-viz-sel" style="width:100%">
            <option value="">-- None --</option>
            ${vizList.map(function(v) { return '<option value="' + _rEsc(v.id) + '">' + _rEsc(v.label) + '</option>'; }).join('')}
          </select></div>
        <div class="form-row"><label>Caption (optional)</label>
          <input type="text" id="r-caption" style="width:100%" placeholder="Figure caption…"></div>
        <div class="form-row-inline form-row"><label><input type="checkbox" id="r-pagebreak"> Page break before</label></div>
        <button class="btn-primary" id="r-modal-ok" style="width:100%;margin-top:8px;padding:7px">Add</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#r-modal-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.querySelector('#r-modal-ok').addEventListener('click', function() {
      const vizId = overlay.querySelector('#r-viz-sel').value || null;
      const p = window.DWBSchema.createPlacement(vizId, 'REPORT');
      p.caption = overlay.querySelector('#r-caption').value;
      p.pageBreakBefore = overlay.querySelector('#r-pagebreak').checked;
      display.placements = display.placements || [];
      display.placements.push(p);
      window.DWBShell.markDirty();
      document.body.removeChild(overlay);
      _rRenderPages(display, container);
    });
  }

  function _rExportPDF(display, container) {
    const canvas = container.querySelector('#r-canvas');
    if (!canvas) return;

    Promise.all([
      _rLoadJsPDF(),
      new Promise(function(resolve, reject) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1/dist/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        if (window.html2canvas) { resolve(); return; }
        document.head.appendChild(s);
        setTimeout(reject, 8000);
      })
    ]).then(function() {
      const jspdf = window.jspdf;
      if (!jspdf || !window.html2canvas) { alert('PDF dependencies not loaded.'); return; }
      const { jsPDF } = jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pages = canvas.querySelectorAll('.report-page');
      let promise = Promise.resolve();

      pages.forEach(function(page, idx) {
        promise = promise.then(function() {
          return window.html2canvas(page, { scale: 1.5, useCORS: true }).then(function(cvs) {
            if (idx > 0) pdf.addPage();
            const imgData = cvs.toDataURL('image/jpeg', 0.85);
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          });
        });
      });

      promise.then(function() {
        pdf.save((display.label || 'report') + '.pdf');
        window.DWBShell && window.DWBShell.log('Exported PDF', 'success');
      });
    }).catch(function(e) {
      alert('PDF export failed. Make sure you are online to load dependencies.\n' + e.message);
    });
  }

  function _rEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount };
})();

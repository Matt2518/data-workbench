// merge.js — Merge tab: template binding, SVG renderer, PDF generation
(function () {
  'use strict';

  const merge = DWB.merge;

  // ================================================================
  //  UI RENDERING
  // ================================================================

  merge.renderTab = function () {
    const el = document.getElementById('merge-mode');
    if (!el) return;
    el.innerHTML = '<div class="merge-body">' +
      _buildDataSourceSection() +
      _buildTemplateSection() +
      _buildOutputSection() +
      '</div>';
  };

  function _buildDataSourceSection() {
    const datasets = Object.keys(DWB.promotedDatasets);
    const selected = merge.outputSettings.selectedSnapshot;

    let inner;
    if (datasets.length === 0) {
      inner = '<div class="merge-empty-state">' +
        '<span class="merge-empty-icon">📊</span>' +
        '<span>No datasets promoted yet.</span>' +
        '<span class="merge-empty-hint">Use <strong>Push to Viz / Merge</strong> in the Pipeline tab to promote a dataset.</span>' +
        '</div>';
    } else {
      const opts = datasets.map(function (n) {
        return '<option value="' + _ea(n) + '"' + (n === selected ? ' selected' : '') + '>' + _eh(n) + '</option>';
      }).join('');
      inner = '<div class="merge-row">' +
        '<span class="merge-label">Snapshot</span>' +
        '<select class="merge-snapshot-select" id="merge-snapshot-picker" ' +
          'onchange="DWB.merge._onSnapshotChange(this.value)">' +
          '<option value="">— select snapshot —</option>' +
          opts +
        '</select>' +
        '</div>';
    }

    return '<div class="merge-section">' +
      '<div class="merge-section-hdr"><span>Data Source</span></div>' +
      '<div class="merge-section-inner">' + inner + '</div>' +
      '</div>';
  }

  function _buildTemplateSection() {
    const template = merge.template;

    const actionBtns = '<div class="merge-section-hdr-actions">' +
      '<button class="merge-btn" onclick="DWB.merge.loadTemplate()">Load Template</button>' +
      (template ? '<button class="merge-btn merge-btn-danger" onclick="DWB.merge.clearTemplate()">Clear</button>' : '') +
      '</div>';

    let content;
    if (!template) {
      content = '<div class="merge-empty-state">' +
        '<span class="merge-empty-icon">📋</span>' +
        '<span>No template loaded.</span>' +
        '<span class="merge-empty-hint">Click <strong>Load Template</strong> to import a .json file from the DWB Template Designer.</span>' +
        '<button class="merge-btn" onclick="DWB.merge.loadTemplate()" style="margin-top:8px">Load Template</button>' +
        '</div>';
    } else {
      const meta = template.meta || {};
      const fields = template.fields || [];

      const infoHTML = '<div class="merge-template-info">' +
        '<div class="merge-template-info-item">' +
          '<span class="merge-template-info-label">Template</span>' +
          '<span class="merge-template-info-value">' + _eh(meta.name || 'Untitled') + '</span>' +
        '</div>' +
        '<div class="merge-template-info-item">' +
          '<span class="merge-template-info-label">Page Size</span>' +
          '<span class="merge-template-info-value">' + (meta.pageWidth || 0) + ' × ' + (meta.pageHeight || 0) + ' px</span>' +
        '</div>' +
        '<div class="merge-template-info-item">' +
          '<span class="merge-template-info-label">Fields</span>' +
          '<span class="merge-template-info-value">' + fields.length + '</span>' +
        '</div>' +
        '</div>';

      const snapshotName = merge.outputSettings.selectedSnapshot;
      const snapshot = snapshotName ? DWB.promotedDatasets[snapshotName] : null;

      let bindingHTML;
      if (!snapshot) {
        bindingHTML = '<div class="merge-binding-hint">Select a snapshot above to configure field bindings.</div>';
      } else if (fields.length === 0) {
        bindingHTML = '<div class="merge-binding-hint">This template declares no fields.</div>';
      } else {
        const cols = snapshot.headers || [];
        const fieldRows = fields.map(function (field) {
          const bound = merge.bindings[field.id] || '';
          const colMissing = bound && !cols.includes(bound);
          const warnHTML = colMissing
            ? '<span class="merge-binding-warn" title="Column \'' + _ea(bound) + '\' not found in snapshot">⚠</span>'
            : '';

          const colOpts = '<option value="">— unbound —</option>' +
            cols.map(function (c) {
              return '<option value="' + _ea(c) + '"' + (c === bound ? ' selected' : '') + '>' + _eh(c) + '</option>';
            }).join('') +
            (colMissing ? '<option value="' + _ea(bound) + '" selected>' + _eh(bound) + ' ⚠ missing</option>' : '');

          return '<tr>' +
            '<td>' + _eh(field.label || field.id) +
              '<span class="merge-field-type-badge">' + _eh(field.type || 'text') + '</span>' +
            '</td>' +
            '<td>' +
              '<select class="merge-binding-select" ' +
                'data-field-id="' + _ea(field.id) + '" ' +
                'onchange="DWB.merge._onBindingChange(\'' + _ea(field.id) + '\', this.value)">' +
                colOpts +
              '</select>' +
              warnHTML +
            '</td>' +
            '</tr>';
        }).join('');

        bindingHTML = '<table class="merge-binding-table">' +
          '<thead><tr><th>Template Field</th><th>Pipeline Column</th></tr></thead>' +
          '<tbody>' + fieldRows + '</tbody>' +
          '</table>';
      }

      content = infoHTML + bindingHTML;
    }

    return '<div class="merge-section">' +
      '<div class="merge-section-hdr"><span>Template</span>' + actionBtns + '</div>' +
      '<div class="merge-section-inner">' + content + '</div>' +
      '</div>';
  }

  function _buildOutputSection() {
    const os = merge.outputSettings;
    const snapshotName = os.selectedSnapshot;
    const snapshot = snapshotName ? DWB.promotedDatasets[snapshotName] : null;
    const totalRows = snapshot ? snapshot.rowCount : 0;
    const res = os.resolution || 2;

    const fromVal = os.rowFrom != null ? os.rowFrom : '';
    const toVal   = os.rowTo   != null ? os.rowTo   : '';

    let certCount = totalRows;
    if (fromVal !== '' || toVal !== '') {
      const f = parseInt(fromVal) || 1;
      const t = parseInt(toVal)   || totalRows;
      certCount = Math.max(0, Math.min(t, totalRows) - f + 1);
    }

    const canGenerate = !!(snapshot && merge.template);

    const resPills = [1, 2, 3].map(function (r) {
      return '<button class="merge-res-pill' + (res === r ? ' active' : '') + '" ' +
        'onclick="DWB.merge._onResChange(' + r + ')">' + r + 'x</button>';
    }).join('');

    const warnNote = res === 3
      ? '<div class="merge-warn-note">⚠ 3× resolution may be slow for large datasets.</div>'
      : '';

    const rowCountHTML = snapshot
      ? (totalRows.toLocaleString() + ' rows in selected snapshot — <strong>' +
         certCount.toLocaleString() + '</strong> certificate' + (certCount !== 1 ? 's' : '') +
         ' will be generated')
      : 'No snapshot selected';

    return '<div class="merge-section">' +
      '<div class="merge-section-hdr"><span>Output</span></div>' +
      '<div class="merge-section-inner">' +
        '<div class="merge-row">' +
          '<span class="merge-label">Filename</span>' +
          '<input type="text" id="merge-filename-input" ' +
            'value="' + _ea(os.filename || 'certificates') + '" ' +
            'placeholder="certificates" ' +
            'oninput="DWB.merge._onFilenameChange(this.value)" ' +
            'style="flex:1;max-width:260px">' +
          '<span style="font-size:11px;color:var(--text-faint)">.pdf</span>' +
        '</div>' +
        '<div class="merge-row">' +
          '<span class="merge-label">Resolution</span>' +
          '<div class="merge-res-pills">' + resPills + '</div>' +
        '</div>' +
        warnNote +
        '<div class="merge-row" style="margin-top:4px">' +
          '<span class="merge-label">Row Range</span>' +
          '<input type="number" id="merge-row-from" value="' + _ea(String(fromVal)) + '" ' +
            'placeholder="From" min="1" style="width:70px" ' +
            'oninput="DWB.merge._onRowRangeChange()">' +
          '<span style="font-size:12px;color:var(--text-muted);margin:0 4px">to</span>' +
          '<input type="number" id="merge-row-to" value="' + _ea(String(toVal)) + '" ' +
            'placeholder="To" min="1" style="width:70px" ' +
            'oninput="DWB.merge._onRowRangeChange()">' +
          '<span style="font-size:11px;color:var(--text-faint);margin-left:8px">blank = all rows</span>' +
        '</div>' +
        '<div class="merge-row-count" id="merge-row-count">' + rowCountHTML + '</div>' +
        '<button class="merge-generate-btn" id="merge-generate-btn" ' +
          (canGenerate ? '' : 'disabled ') +
          'onclick="DWB.merge.generate()">▶ Generate PDF</button>' +
      '</div>' +
      '</div>';
  }

  // ================================================================
  //  EVENT HANDLERS
  // ================================================================

  merge._onSnapshotChange = function (name) {
    merge.outputSettings.selectedSnapshot = name || null;
    if (name && merge.template) _tryAutoBindNew(name);
    merge.renderTab();
    DWB.workflow.markDirty();
  };

  merge._onBindingChange = function (fieldId, columnName) {
    if (columnName) {
      merge.bindings[fieldId] = columnName;
    } else {
      delete merge.bindings[fieldId];
    }
    DWB.workflow.markDirty();
    _updateRowCount();
  };

  merge._onFilenameChange = function (val) {
    merge.outputSettings.filename = val;
    DWB.workflow.markDirty();
  };

  merge._onResChange = function (res) {
    merge.outputSettings.resolution = res;
    merge.renderTab();
    DWB.workflow.markDirty();
  };

  merge._onRowRangeChange = function () {
    const fromEl = document.getElementById('merge-row-from');
    const toEl   = document.getElementById('merge-row-to');
    const fromVal = fromEl ? fromEl.value.trim() : '';
    const toVal   = toEl   ? toEl.value.trim()   : '';
    merge.outputSettings.rowFrom = fromVal !== '' ? parseInt(fromVal) : null;
    merge.outputSettings.rowTo   = toVal   !== '' ? parseInt(toVal)   : null;
    DWB.workflow.markDirty();
    _updateRowCount();
  };

  function _updateRowCount() {
    const el = document.getElementById('merge-row-count');
    if (!el) return;
    const os = merge.outputSettings;
    const snapshotName = os.selectedSnapshot;
    const snapshot = snapshotName ? DWB.promotedDatasets[snapshotName] : null;
    if (!snapshot) { el.innerHTML = 'No snapshot selected'; return; }

    const totalRows = snapshot.rowCount;
    let certCount = totalRows;
    const f = os.rowFrom != null ? os.rowFrom : null;
    const t = os.rowTo   != null ? os.rowTo   : null;
    if (f !== null || t !== null) {
      const fromIdx = f || 1;
      const toIdx   = t || totalRows;
      certCount = Math.max(0, Math.min(toIdx, totalRows) - fromIdx + 1);
    }
    el.innerHTML = totalRows.toLocaleString() + ' rows in selected snapshot — <strong>' +
      certCount.toLocaleString() + '</strong> certificate' + (certCount !== 1 ? 's' : '') +
      ' will be generated';
  }

  // ================================================================
  //  TEMPLATE LOAD / CLEAR
  // ================================================================

  merge.loadTemplate = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function () {
      const f = this.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const tpl = JSON.parse(e.target.result);
          if (!tpl.meta || !Array.isArray(tpl.elements)) {
            throw new Error('Missing required fields: meta and elements.');
          }
          merge.template = tpl;
          merge.bindings = {};
          const snapshotName = merge.outputSettings.selectedSnapshot;
          if (snapshotName) _tryAutoBindNew(snapshotName);
          DWB.workflow.markDirty();
          merge.renderTab();
          DWB.log('Template loaded: "' + (tpl.meta.name || 'Untitled') + '" (' + (tpl.fields || []).length + ' fields)', 'success');
        } catch (err) {
          DWB.log('Template load failed: ' + err.message, 'error');
          alert('Failed to load template: ' + err.message);
        }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  merge.clearTemplate = function () {
    if (!confirm('Clear the loaded template? All field bindings will also be cleared.')) return;
    merge.template = null;
    merge.bindings = {};
    DWB.workflow.markDirty();
    merge.renderTab();
    DWB.log('Template cleared.');
  };

  // ================================================================
  //  AUTO-BINDING
  // ================================================================

  function _tryAutoBindNew(snapshotName) {
    const snapshot = DWB.promotedDatasets[snapshotName];
    if (!snapshot || !merge.template) return;
    const cols   = snapshot.headers || [];
    const fields = merge.template.fields || [];
    fields.forEach(function (field) {
      if (!merge.bindings[field.id] && cols.includes(field.id)) {
        merge.bindings[field.id] = field.id;
      }
    });
  }

  // ================================================================
  //  DATASET PROMOTION CALLBACK
  // ================================================================

  merge.onDatasetPromoted = function (name) {
    // Auto-select first promoted dataset
    if (!merge.outputSettings.selectedSnapshot) {
      merge.outputSettings.selectedSnapshot = name;
      if (merge.template) _tryAutoBindNew(name);
    }
    // Re-render if merge tab is active
    const mergeEl = document.getElementById('merge-mode');
    if (mergeEl && !mergeEl.classList.contains('hidden')) {
      merge.renderTab();
    }
  };

  // ================================================================
  //  PDF GENERATION
  // ================================================================

  merge.generate = async function () {
    const os       = merge.outputSettings;
    const snapshot = DWB.promotedDatasets[os.selectedSnapshot];
    const template = merge.template;

    if (!snapshot) { DWB.log('Merge: no snapshot selected.', 'error'); return; }
    if (!template)  { DWB.log('Merge: no template loaded.',  'error'); return; }

    const btn = document.getElementById('merge-generate-btn');
    const setBtn = function (text, disabled) {
      if (!btn) return;
      btn.textContent = text;
      btn.disabled = disabled;
    };

    setBtn('Loading libraries…', true);

    try {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/canvg/3.0.4/umd.min.js');
    } catch (err) {
      DWB.log('Failed to load PDF libraries: ' + err.message, 'error');
      alert('Could not load PDF generation libraries. Please check your internet connection.\n\n' + err.message);
      setBtn('▶ Generate PDF', false);
      return;
    }

    const jsPDFLib = window.jspdf;
    const canvgLib  = window.canvg;

    if (!jsPDFLib || !jsPDFLib.jsPDF) {
      DWB.log('jsPDF failed to initialize.', 'error');
      setBtn('▶ Generate PDF', false);
      return;
    }
    const Canvg = canvgLib && (canvgLib.Canvg || canvgLib);
    if (!Canvg || typeof Canvg.fromString !== 'function') {
      DWB.log('canvg failed to initialize.', 'error');
      setBtn('▶ Generate PDF', false);
      return;
    }

    const resolution = os.resolution || 2;
    const pageW = template.meta.pageWidth;
    const pageH = template.meta.pageHeight;

    const allObjects = DWB.toObjects(snapshot);
    const fromIdx = (os.rowFrom != null ? os.rowFrom : 1) - 1;
    const toIdx   =  os.rowTo   != null ? os.rowTo   : allObjects.length;
    const rows = allObjects.slice(fromIdx, toIdx);

    if (rows.length === 0) {
      DWB.log('Merge: no rows in specified range.', 'error');
      setBtn('▶ Generate PDF', false);
      return;
    }

    if (resolution === 3 && rows.length > 100) {
      DWB.log('⚠ 3× resolution with ' + rows.length + ' rows may be slow.', 'warn');
    }

    DWB.log('Generating ' + rows.length + ' certificate' + (rows.length !== 1 ? 's' : '') + '…');
    setBtn('Generating…', true);

    const { jsPDF } = jsPDFLib;
    const pdf  = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const canvas = document.createElement('canvas');
    canvas.width  = pageW * resolution;
    canvas.height = pageH * resolution;
    const ctx = canvas.getContext('2d');

    try {
      for (let i = 0; i < rows.length; i++) {
        setBtn('Generating… ' + (i + 1) + '/' + rows.length, true);

        const rowData = rows[i];
        const resolvedEls = template.elements.map(function (el) {
          if (el.type !== 'bound-text') return Object.assign({}, el);
          const col = merge.bindings[el.fieldId] || null;
          const val = (col && rowData[col] !== undefined) ? rowData[col] : '';
          return Object.assign({}, el, { content: String(val) });
        });

        const svgStr = renderTemplateToSVG(resolvedEls, template.assets || {}, template.meta);

        // Scale SVG width/height to canvas while keeping viewBox for proper scaling
        const scaledSvg = svgStr
          .replace('width="' + pageW + '"', 'width="' + canvas.width + '"')
          .replace('height="' + pageH + '"', 'height="' + canvas.height + '"');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const v = Canvg.fromString(ctx, scaledSvg);
        await v.render();

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

        // Yield to keep UI responsive
        if (i % 5 === 4) await new Promise(function (r) { setTimeout(r, 0); });
      }

      const dateStr   = new Date().toISOString().slice(0, 10);
      const basename  = (os.filename || 'certificates').replace(/[^\w\-_.]/g, '_');
      const filename  = basename + '-' + dateStr + '.pdf';
      pdf.save(filename);
      DWB.log('Generated ' + rows.length + ' certificate' + (rows.length !== 1 ? 's' : '') +
        ' → ' + filename, 'success');

    } catch (err) {
      DWB.log('Generation failed: ' + err.message, 'error');
      alert('PDF generation failed: ' + err.message);
    }

    setBtn('▶ Generate PDF', false);
  };

  // ================================================================
  //  SVG RENDERER  (pure function — no side effects)
  // ================================================================

  function renderTemplateToSVG(elements, assets, meta) {
    const w = meta.pageWidth;
    const h = meta.pageHeight;

    var parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ' width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
    ];

    // Background asset
    if (meta.background && meta.background.assetId && assets[meta.background.assetId]) {
      parts.push('<image href="' + assets[meta.background.assetId] +
        '" x="0" y="0" width="' + w + '" height="' + h + '"/>');
    }

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      switch (el.type) {

        case 'rect': {
          var s  = el.style || {};
          var rx = s.cornerRadius || 0;
          var fill   = (s.fill   === 'none' || s.fill   == null) ? 'none' : s.fill;
          var stroke = (s.stroke === 'none' || s.stroke == null) ? 'none' : s.stroke;
          var sw = s.strokeWidth || 0;
          parts.push(
            '<rect x="' + el.x + '" y="' + el.y + '"' +
            ' width="' + el.width + '" height="' + el.height + '"' +
            ' rx="' + rx + '" ry="' + rx + '"' +
            ' fill="' + fill + '"' +
            (stroke !== 'none' ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : '') +
            ' data-field-id="' + _ea(el.id) + '"/>'
          );
          break;
        }

        case 'static-text':
        case 'bound-text': {
          var ts     = el.style || {};
          var anchor = ts.textAnchor || 'start';
          var tx;
          if (anchor === 'middle') tx = el.x + el.width / 2;
          else if (anchor === 'end') tx = el.x + el.width;
          else tx = el.x;
          var ty      = el.y + el.height;
          var content = _ex(el.content || '');
          var fieldId = el.fieldId || el.id;
          parts.push(
            '<text x="' + tx + '" y="' + ty + '"' +
            ' font-family="' + (ts.fontFamily || 'sans-serif') + '"' +
            ' font-size="' + (ts.fontSize || 14) + '"' +
            ' font-weight="' + (ts.fontWeight || 'normal') + '"' +
            ' font-style="' + (ts.fontStyle || 'normal') + '"' +
            ' text-anchor="' + anchor + '"' +
            ' fill="' + (ts.fill || '#000000') + '"' +
            (ts.letterSpacing ? ' letter-spacing="' + ts.letterSpacing + '"' : '') +
            ' data-field-id="' + _ea(fieldId) + '">' +
            content + '</text>'
          );
          break;
        }

        case 'image': {
          var assetData = el.assetId ? assets[el.assetId] : null;
          if (assetData) {
            parts.push(
              '<image href="' + assetData + '"' +
              ' x="' + el.x + '" y="' + el.y + '"' +
              ' width="' + el.width + '" height="' + el.height + '"' +
              ' data-field-id="' + _ea(el.id) + '"/>'
            );
          }
          break;
        }
      }
    }

    parts.push('</svg>');
    return parts.join('');
  }

  // ================================================================
  //  UTILITIES
  // ================================================================

  function _eh(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _ea(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _ex(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload  = resolve;
      s.onerror = function () { reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(s);
    });
  }

  // Initial render (populates hidden panel so it's ready on first switch)
  merge.renderTab();

})();

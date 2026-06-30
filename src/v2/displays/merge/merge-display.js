/* === DWBMerge: certificate/document merge display === */

window.DWBMerge = (function() {
  'use strict';

  var _mgPreviewRow = 0;
  var _mgPdfPromise = null;

  // ================================================================
  // Public API
  // ================================================================

  function render(container, display, flow) {
    if (!container || !display) return;
    display.config = display.config || {};
    if (!display.config.bindings) display.config.bindings = {};
    if (display.config.snapshotName === undefined) display.config.snapshotName = '';

    var rows = _mgGetRows(display);
    if (rows.length === 0) _mgPreviewRow = 0;
    else if (_mgPreviewRow >= rows.length) _mgPreviewRow = rows.length - 1;

    container.innerHTML =
      '<div class="mg-root">' +
        '<div class="mg-left">' +
          _mgBuildLeftCol(display) +
        '</div>' +
        '<div class="mg-right">' +
          '<div class="mg-preview-hdr" id="mg-preview-hdr">' +
            _mgBuildPreviewHdr(display, rows) +
          '</div>' +
          '<div class="mg-preview-body" id="mg-preview-body">' +
            _mgBuildPreviewBody(display, rows) +
          '</div>' +
        '</div>' +
      '</div>';

    _mgWire(container, display, flow);
  }

  // ================================================================
  // Left column
  // ================================================================

  function _mgBuildLeftCol(display) {
    var cfg = display.config;
    var parts = [
      _mgBuildTemplateSection(cfg),
      _mgBuildDataSourceSection(cfg)
    ];

    if (cfg.template && cfg.template.meta && cfg.snapshotName) {
      var rows = _mgGetRows(display);
      parts.push(_mgBuildBindingsSection(cfg, rows));
      parts.push(
        '<div class="mg-gen-pad">' +
          '<button class="btn-primary" id="mg-gen-left" style="width:100%;padding:8px">Generate PDFs</button>' +
        '</div>'
      );
    }

    return parts.join('');
  }

  function _mgBuildTemplateSection(cfg) {
    var template = cfg.template;
    var body;

    if (!template || !template.meta) {
      body =
        '<div class="mg-empty-state">' +
          '<div class="mg-empty-icon">🔖</div>' +
          '<div class="mg-empty-title">No template attached</div>' +
          '<div class="mg-empty-desc">Attach a template from the Designer to get started</div>' +
          '<button class="btn-primary" id="mg-attach-btn" style="margin-top:10px;padding:6px 14px">Attach Template</button>' +
        '</div>';
    } else {
      var meta = template.meta;
      body =
        '<div class="mg-template-name">' + _mgEh(meta.name || 'Untitled Template') + '</div>' +
        '<div class="mg-template-meta">' + _mgEh(_mgPageSizeLabel(meta)) + '</div>' +
        '<div class="mg-btn-row">' +
          '<button class="tb-btn" id="mg-replace-btn">Replace Template</button>' +
          '<button class="mg-remove-btn" id="mg-remove-btn">Remove Template</button>' +
        '</div>';
    }

    return '<div class="mg-section"><div class="mg-section-title">TEMPLATE</div><div class="mg-section-body">' + body + '</div></div>';
  }

  function _mgBuildDataSourceSection(cfg) {
    var snapshots = (window.DWBState && window.DWBState.snapshots) || {};
    var names = Object.keys(snapshots);
    var selected = cfg.snapshotName || '';

    var opts = '<option value="">— select snapshot —</option>' +
      names.map(function(n) {
        return '<option value="' + _mgEa(n) + '"' + (n === selected ? ' selected' : '') + '>' + _mgEh(n) + '</option>';
      }).join('');

    var rowCount = '';
    if (selected && snapshots[selected]) {
      var n = (snapshots[selected] || []).length;
      rowCount = '<div class="mg-row-count">' + n + ' row' + (n !== 1 ? 's' : '') + ' — ' + n + ' PDF' + (n !== 1 ? 's' : '') + ' will be generated</div>';
    }

    return '<div class="mg-section"><div class="mg-section-title">DATA SOURCE</div><div class="mg-section-body">' +
      '<select id="mg-snapshot-sel" style="width:100%">' + opts + '</select>' +
      rowCount +
      '</div></div>';
  }

  function _mgBuildBindingsSection(cfg, rows) {
    var template = cfg.template;
    var fields = (template && template.fields) || [];
    var bindings = cfg.bindings || {};
    var columns = (rows.length > 0) ? Object.keys(rows[0]) : [];

    if (fields.length === 0) {
      return '<div class="mg-section"><div class="mg-section-title">FIELD BINDINGS</div>' +
        '<div class="mg-section-body"><div class="mg-hint">This template has no fields.</div></div></div>';
    }

    var colOpts = function(bound) {
      return '<option value="">— not mapped —</option>' +
        columns.map(function(c) {
          return '<option value="' + _mgEa(c) + '"' + (c === bound ? ' selected' : '') + '>' + _mgEh(c) + '</option>';
        }).join('');
    };

    var fieldRows = fields.map(function(field) {
      var bound = bindings[field.id] || '';
      return '<div class="mg-binding-row">' +
        '<span class="mg-binding-label" title="' + _mgEa(field.label || field.id) + '">' + _mgEh(field.label || field.id) + '</span>' +
        '<select class="mg-binding-sel" data-field-id="' + _mgEa(field.id) + '">' + colOpts(bound) + '</select>' +
        '</div>';
    }).join('');

    return '<div class="mg-section"><div class="mg-section-title">FIELD BINDINGS</div>' +
      '<div class="mg-section-body">' + fieldRows + '</div></div>';
  }

  // ================================================================
  // Right column
  // ================================================================

  function _mgBuildPreviewHdr(display, rows) {
    var n = rows.length;
    var hasTpl = !!(display.config.template && display.config.template.meta);
    var label = (hasTpl && n > 0)
      ? 'PREVIEW — Row ' + (_mgPreviewRow + 1) + ' of ' + n
      : 'PREVIEW';

    return '<div class="mg-prev-nav">' +
        '<button class="tb-btn" id="mg-prev-row"' + (_mgPreviewRow > 0 ? '' : ' disabled') + '>←</button>' +
        '<span class="mg-prev-label">' + label + '</span>' +
        '<button class="tb-btn" id="mg-next-row"' + (_mgPreviewRow < n - 1 ? '' : ' disabled') + '>→</button>' +
      '</div>' +
      '<button class="btn-primary" id="mg-gen-right" style="padding:5px 14px;margin-left:auto">Generate PDFs</button>';
  }

  function _mgBuildPreviewBody(display, rows) {
    var cfg = display.config;
    var template = cfg.template;

    if (!template || !template.meta) {
      return '<div class="mg-preview-placeholder">' +
        '<div style="font-size:36px">🔖</div>' +
        '<div style="color:var(--text-muted);font-size:13px;margin-top:8px">Configure a template and data source to see a preview.</div>' +
        '</div>';
    }

    if (rows.length === 0) {
      return '<div class="mg-preview-placeholder">' +
        '<div style="font-size:36px">📊</div>' +
        '<div style="color:var(--text-muted);font-size:13px;margin-top:8px">Select a data source with rows to see a preview.</div>' +
        '</div>';
    }

    var row = rows[_mgPreviewRow] || rows[0];
    var svgStr = _mgRenderTemplateSVG(template, cfg.bindings || {}, row);

    return '<div class="mg-svg-wrap"><div class="mg-svg-inner">' + svgStr + '</div></div>';
  }

  // ================================================================
  // Event wiring
  // ================================================================

  function _mgWire(container, display, flow) {
    // Attach template
    var attachBtn = container.querySelector('#mg-attach-btn');
    if (attachBtn) {
      attachBtn.addEventListener('click', function() { _mgPickTemplate(container, display, flow); });
    }

    // Replace template
    var replaceBtn = container.querySelector('#mg-replace-btn');
    if (replaceBtn) {
      replaceBtn.addEventListener('click', function() { _mgPickTemplate(container, display, flow); });
    }

    // Remove template — inline two-click confirmation
    var removeBtn = container.querySelector('#mg-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        if (removeBtn.dataset.confirm) {
          display.config.template = null;
          display.config.bindings = {};
          _mgMarkDirty();
          _mgPreviewRow = 0;
          render(container, display, flow);
        } else {
          removeBtn.dataset.confirm = '1';
          removeBtn.textContent = 'Confirm remove?';
          removeBtn.classList.add('mg-confirm');
          setTimeout(function() {
            if (removeBtn.dataset.confirm) {
              delete removeBtn.dataset.confirm;
              removeBtn.textContent = 'Remove Template';
              removeBtn.classList.remove('mg-confirm');
            }
          }, 3000);
        }
      });
    }

    // Snapshot selector
    var snapSel = container.querySelector('#mg-snapshot-sel');
    if (snapSel) {
      snapSel.addEventListener('change', function() {
        display.config.snapshotName = snapSel.value || '';
        _mgMarkDirty();
        _mgPreviewRow = 0;
        render(container, display, flow);
      });
    }

    // Binding selects — partial re-render on change
    container.querySelectorAll('.mg-binding-sel').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var fieldId = sel.dataset.fieldId;
        if (sel.value) {
          display.config.bindings[fieldId] = sel.value;
        } else {
          delete display.config.bindings[fieldId];
        }
        _mgMarkDirty();
        _mgRefreshPreview(container, display);
      });
    });

    // Preview navigation
    _mgWireNavAndGen(container, display, flow);
  }

  function _mgWireNavAndGen(container, display, flow) {
    var prevBtn = container.querySelector('#mg-prev-row');
    var nextBtn = container.querySelector('#mg-next-row');

    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        if (_mgPreviewRow > 0) {
          _mgPreviewRow--;
          _mgRefreshPreviewAndHdr(container, display, flow);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        var rows = _mgGetRows(display);
        if (_mgPreviewRow < rows.length - 1) {
          _mgPreviewRow++;
          _mgRefreshPreviewAndHdr(container, display, flow);
        }
      });
    }

    ['#mg-gen-left', '#mg-gen-right'].forEach(function(sel) {
      var btn = container.querySelector(sel);
      if (btn) btn.addEventListener('click', function() { _mgGenerate(display); });
    });
  }

  function _mgRefreshPreview(container, display) {
    var body = container.querySelector('#mg-preview-body');
    if (body) body.innerHTML = _mgBuildPreviewBody(display, _mgGetRows(display));
  }

  function _mgRefreshPreviewAndHdr(container, display, flow) {
    var rows = _mgGetRows(display);
    var hdr = container.querySelector('#mg-preview-hdr');
    if (hdr) {
      hdr.innerHTML = _mgBuildPreviewHdr(display, rows);
      _mgWireNavAndGen(hdr, display, flow);
    }
    var body = container.querySelector('#mg-preview-body');
    if (body) body.innerHTML = _mgBuildPreviewBody(display, rows);
  }

  // ================================================================
  // Template file picker
  // ================================================================

  function _mgPickTemplate(container, display, flow) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function() {
      var f = this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var tpl = JSON.parse(e.target.result);
          if (!tpl.meta) throw new Error('Missing required field: meta.');
          if (!Array.isArray(tpl.elements)) throw new Error('Missing required field: elements (must be array).');
          display.config.template = tpl;
          display.config.bindings = {};
          _mgMarkDirty();
          _mgPreviewRow = 0;
          render(container, display, flow);
        } catch (err) {
          _mgToast('Template error: ' + err.message, true);
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  // ================================================================
  // SVG renderer — ported faithfully from src/merge/merge.js
  // ================================================================

  function _mgRenderTemplateSVG(template, bindings, row) {
    var meta = template.meta || {};
    var w = meta.width || meta.pageWidth || 792;
    var h = meta.height || meta.pageHeight || 612;
    var elements = template.elements || [];
    var assets = template.assets || {};
    bindings = bindings || {};
    row = row || {};

    // Resolve bound-text elements with actual row values
    var resolved = elements.map(function(el) {
      if (el.type !== 'bound-text') return el;
      var col = bindings[el.fieldId] || null;
      var val = (col && row[col] !== undefined) ? row[col] : '';
      return Object.assign({}, el, { content: String(val) });
    });

    var parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ' width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
    ];

    // Background asset
    if (meta.background && meta.background.assetId && assets[meta.background.assetId]) {
      parts.push(
        '<image href="' + assets[meta.background.assetId] + '" x="0" y="0" width="' + w + '" height="' + h + '"/>'
      );
    }

    for (var i = 0; i < resolved.length; i++) {
      var el = resolved[i];
      switch (el.type) {
        case 'rect': {
          var s = el.style || {};
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
            '/>'
          );
          break;
        }
        case 'static-text':
        case 'bound-text': {
          var ts = el.style || {};
          var anchor = ts.textAnchor || 'start';
          var tx;
          if (anchor === 'middle') tx = el.x + el.width / 2;
          else if (anchor === 'end') tx = el.x + el.width;
          else tx = el.x;
          var ty = el.y + el.height;
          var content = _mgEx(el.content || '');
          parts.push(
            '<text x="' + tx + '" y="' + ty + '"' +
            ' font-family="' + (ts.fontFamily || 'sans-serif') + '"' +
            ' font-size="' + (ts.fontSize || 14) + '"' +
            ' font-weight="' + (ts.fontWeight || 'normal') + '"' +
            ' font-style="' + (ts.fontStyle || 'normal') + '"' +
            ' text-anchor="' + anchor + '"' +
            ' fill="' + (ts.fill || '#000000') + '"' +
            (ts.letterSpacing ? ' letter-spacing="' + ts.letterSpacing + '"' : '') +
            '>' + content + '</text>'
          );
          break;
        }
        case 'image':
          // Skipped in SVG string — image elements drawn via canvas overlay in _mgSvgToCanvas
          // because Chrome's SVG-as-image blob URL sandbox blocks embedded <image> refs.
          break;
      }
    }

    parts.push('</svg>');
    return parts.join('');
  }

  // ================================================================
  // SVG → canvas — ported faithfully from src/merge/merge.js
  // ================================================================

  function _mgSvgToCanvas(svgString, width, height, elements, assets) {
    return new Promise(function(resolve, reject) {
      var scale  = 2;
      var canvas = document.createElement('canvas');
      canvas.width  = width  * scale;
      canvas.height = height * scale;
      var ctx = canvas.getContext('2d');

      var blob = new Blob([svgString], { type: 'image/svg+xml' });
      var url  = URL.createObjectURL(blob);
      var img  = new Image();

      img.onload = function() {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        // Draw image-type elements on top of the SVG render.
        // Chrome's blob-URL sandbox prevents <image> inside SVG from loading,
        // so we draw them directly onto the canvas using data URIs.
        var imageEls = (elements || []).filter(function(el) { return el.type === 'image'; });
        var proms = imageEls.map(function(el) {
          return new Promise(function(res) {
            var asset = assets && assets[el.assetId];
            if (!asset) { res(); return; }
            var uri = 'data:' + asset.type + ';base64,' + asset.data;
            var imgEl = new Image();
            imgEl.onload  = function() {
              ctx.drawImage(imgEl, el.x * scale, el.y * scale, el.width * scale, el.height * scale);
              res();
            };
            imgEl.onerror = function() { res(); };
            imgEl.src = uri;
          });
        });

        Promise.all(proms).then(function() { resolve(canvas); });
      };

      img.onerror = function() {
        URL.revokeObjectURL(url);
        reject(new Error('SVG render failed'));
      };

      img.src = url;
    });
  }

  // ================================================================
  // PDF generation
  // ================================================================

  function _mgLoadJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (_mgPdfPromise) return _mgPdfPromise;
    _mgPdfPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js';
      s.onload  = function() { resolve(window.jspdf); };
      s.onerror = function() { _mgPdfPromise = null; reject(new Error('jsPDF load failed')); };
      document.head.appendChild(s);
      setTimeout(function() {
        if (!window.jspdf) { _mgPdfPromise = null; reject(new Error('jsPDF timeout')); }
      }, 8000);
    });
    return _mgPdfPromise;
  }

  function _mgSetBtns(text, disabled) {
    ['mg-gen-left', 'mg-gen-right'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) { btn.textContent = text; btn.disabled = disabled; }
    });
  }

  function _mgGenerate(display) {
    var cfg = display.config || {};
    var template = cfg.template;
    var rows = _mgGetRows(display);

    if (!template || !template.meta) {
      _mgToast('No template attached. Attach a template before generating.', true);
      return;
    }
    if (rows.length === 0) {
      _mgToast('No data rows. Select a snapshot with data.', true);
      return;
    }

    _mgSetBtns('Generating...', true);

    _mgLoadJsPDF().then(function(jspdf) {
      var meta = template.meta;
      var w = meta.width || meta.pageWidth || 792;
      var h = meta.height || meta.pageHeight || 612;
      var elements = template.elements || [];
      var assets   = template.assets   || {};
      var bindings = cfg.bindings || {};

      var pdf = new jspdf.jsPDF({
        orientation: meta.orientation || 'landscape',
        unit: 'pt',
        format: [w, h]
      });
      var pdfW = pdf.internal.pageSize.getWidth();
      var pdfH = pdf.internal.pageSize.getHeight();

      var chain = Promise.resolve();

      rows.forEach(function(row, idx) {
        chain = chain.then(function() {
          _mgSetBtns('Generating page ' + (idx + 1) + ' of ' + rows.length + '…', true);

          var svgStr = _mgRenderTemplateSVG(template, bindings, row);
          return _mgSvgToCanvas(svgStr, w, h, elements, assets).then(function(canvas) {
            var imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (idx > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            if (idx % 5 === 4) return new Promise(function(r) { setTimeout(r, 0); });
          });
        });
      });

      chain.then(function() {
        var tplName  = (meta.name       || 'certificates').replace(/[^\w\-_.]/g, '_');
        var dispName = (display.label   || 'merge').replace(/[^\w\-_.]/g, '_');
        pdf.save(tplName + ' - ' + dispName + '.pdf');
        _mgSetBtns('✓ Downloaded', true);
        setTimeout(function() { _mgSetBtns('Generate PDFs', false); }, 2000);
      }).catch(function(err) {
        _mgSetBtns('⚠ Export failed', false);
        setTimeout(function() { _mgSetBtns('Generate PDFs', false); }, 3000);
        _mgToast('PDF export failed: ' + err.message, true);
      });

    }).catch(function(err) {
      _mgSetBtns('⚠ Export failed', false);
      setTimeout(function() { _mgSetBtns('Generate PDFs', false); }, 3000);
      _mgToast('Failed to load jsPDF: ' + err.message, true);
    });
  }

  // ================================================================
  // Utilities
  // ================================================================

  function _mgGetRows(display) {
    var cfg = display.config || {};
    var name = cfg.snapshotName;
    if (!name) return [];
    return ((window.DWBState && window.DWBState.snapshots) || {})[name] || [];
  }

  function _mgPageSizeLabel(meta) {
    if (meta.pageSize && meta.orientation) {
      return meta.pageSize.charAt(0).toUpperCase() + meta.pageSize.slice(1) + ' ' + meta.orientation;
    }
    var w = meta.width || meta.pageWidth || 0;
    var h = meta.height || meta.pageHeight || 0;
    return w + ' × ' + h + ' pt';
  }

  function _mgMarkDirty() {
    if (window.DWBShell && window.DWBShell.markDirty) window.DWBShell.markDirty();
  }

  function _mgToast(msg, isError) {
    var existing = document.getElementById('mg-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'mg-toast';
    toast.className = 'mg-toast' + (isError ? ' mg-toast-error' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, isError ? 4000 : 2500);
  }

  function _mgEh(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _mgEa(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _mgEx(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render: render };
})();

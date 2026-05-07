// export.js — Interactive HTML, PDF, and PPTX export for the viz canvas
(function () {
  'use strict';
  const viz = DWB.viz;

  // ─── Modal ───────────────────────────────────────────────────────────────────

  viz.showExportModal = function () {
    const ov = document.getElementById('export-overlay');
    if (ov) ov.classList.remove('hidden');
  };

  viz.closeExportModal = function () {
    const ov = document.getElementById('export-overlay');
    if (ov) ov.classList.add('hidden');
  };

  viz.triggerExport = function (format) {
    viz.closeExportModal();
    if      (format === 'html') viz._exportHTML();
    else if (format === 'pdf')  viz._exportPDF();
    else if (format === 'pptx') viz._exportPPTX();
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function _dateStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function _serializeBlocks() {
    return viz.blocks.map(b => ({
      id:       b.id,
      layout:   b.layout,
      title:    b.title || null,
      colRatios: b.colRatios,
      slots: b.slots.map(s => ({
        id: s.id,
        elements: s.elements.map(e => ({
          id:          e.id,
          type:        e.type,
          title:       e.title || '',
          datasetName: e.datasetName || null,
          config:      JSON.parse(JSON.stringify(e.config || {}))
        }))
      }))
    }));
  }

  function _serializeDatasets() {
    const out = {};
    for (const [name, ds] of Object.entries(DWB.promotedDatasets)) {
      out[name] = {
        headers:        ds.headers,
        rows:           ds.rows,
        columnTypes:    ds.columnTypes    || [],
        columnTypeMeta: ds.columnTypeMeta || {}
      };
    }
    return out;
  }

  // ─── HTML Export ─────────────────────────────────────────────────────────────

  viz._exportHTML = function () {
    const html = viz._buildHTMLExport(false);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'dashboard-' + _dateStr() + '.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // ─── PDF Export ──────────────────────────────────────────────────────────────

  viz._exportPDF = function () {
    const html = viz._buildHTMLExport(true);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
    if (!w) {
      URL.revokeObjectURL(url);
      alert('Pop-up blocked. Allow pop-ups for this page and try again.');
    }
  };

  // ─── PPTX Export ─────────────────────────────────────────────────────────────

  viz._exportPPTX = async function () {
    if (typeof PptxGenJS === 'undefined') {
      DWB.log('PptxGenJS not loaded — cannot export PPTX.', 'error');
      alert('PowerPoint library not loaded. Check your internet connection and try again.');
      return;
    }
    if (!viz.blocks.length) {
      alert('No blocks to export. Add some elements to the canvas first.');
      return;
    }

    DWB.log('Building PPTX…', 'info');

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
    pptx.layout = 'WIDE';

    const MARGIN   = 0.15;   // each side, inches
    const GAP      = 0.1;    // between columns
    const ELEM_GAP = 0.08;   // between stacked elements
    const SLIDE_H  = 5.625;
    const USABLE_W = 10 - 2 * MARGIN;

    for (const block of viz.blocks) {
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      const hasTitle = !!block.title;
      const TITLE_Y  = 0.2;
      const TITLE_H  = 0.22;

      if (hasTitle) {
        slide.addText(block.title, {
          x: MARGIN, y: TITLE_Y, w: USABLE_W, h: TITLE_H,
          fontSize: 18, bold: true, color: '002244', fontFace: 'Calibri'
        });
      }

      const contentY = hasTitle ? TITLE_Y + TITLE_H + 0.05 : 0.1;
      const contentH = SLIDE_H - contentY - 0.1;

      // Column geometry per spec: w_i = usableWidth * (ratio/100) - gap/2
      const nCols    = block.slots.length;
      const ratios   = block.colRatios || Array(nCols).fill(Math.floor(100 / nCols));
      const colWidths = ratios.map(r =>
        nCols > 1 ? USABLE_W * (r / 100) - GAP / 2 : USABLE_W
      );
      const colXs = [];
      let cx = MARGIN;
      for (let i = 0; i < nCols; i++) {
        colXs.push(cx);
        cx += colWidths[i] + (i < nCols - 1 ? GAP : 0);
      }

      for (let si = 0; si < block.slots.length; si++) {
        const slot   = block.slots[si];
        const bColX  = colXs[si];
        const bColW  = colWidths[si];
        const nElems = slot.elements.length;
        if (!nElems) continue;

        const elemH = nElems === 1
          ? contentH
          : (contentH - (nElems - 1) * ELEM_GAP) / nElems;

        for (let ei = 0; ei < slot.elements.length; ei++) {
          const element = slot.elements[ei];
          const elemY   = contentY + ei * (elemH + ELEM_GAP);
          const def     = viz._elementRegistry[element.type];

          if (element._instance && !element._instance.isDisposed()) {
            const base64 = await _captureChartPng(element);
            if (base64) {
              if (element.title) {
                slide.addText(element.title, {
                  x: bColX, y: elemY, w: bColW, h: 0.2,
                  fontSize: 10, color: '64748b', fontFace: 'Calibri', italic: true
                });
              }
              const imgY = element.title ? elemY + 0.2 : elemY;
              const imgH = element.title ? elemH - 0.2   : elemH;
              slide.addImage({ data: base64, x: bColX, y: imgY, w: bColW, h: imgH });
            } else {
              slide.addText('[Chart render failed]', {
                x: bColX, y: elemY, w: bColW, h: elemH,
                fontSize: 11, color: '94a3b8', align: 'center', valign: 'middle',
                fontFace: 'Calibri'
              });
            }
          } else if (element.type === 'DATA_TABLE') {
            _addPptxTable(slide, element, bColX, elemY, bColW, elemH);
          } else if (element.type === 'KPI_STAT') {
            _addPptxKpi(slide, element, bColX, elemY, bColW, elemH);
          } else {
            slide.addText('[' + (def ? def.title : element.type) + ' — not exported]', {
              x: bColX, y: elemY, w: bColW, h: elemH,
              fontSize: 11, color: '94a3b8', align: 'center', valign: 'middle',
              fontFace: 'Calibri'
            });
          }
        }
      }
    }

    try {
      await pptx.writeFile({ fileName: 'dashboard-' + _dateStr() + '.pptx' });
      DWB.log('PPTX export complete.', 'success');
    } catch (e) {
      DWB.log('PPTX write failed: ' + e.message, 'error');
    }
  };

  // Render ECharts element into a hidden 800×450 div → base64 PNG
  async function _captureChartPng(element) {
    if (!element._instance || element._instance.isDisposed()) return null;
    let option;
    try { option = element._instance.getOption(); } catch (_) { return null; }

    const tmpDiv = document.createElement('div');
    tmpDiv.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:450px;background:#fff;';
    document.body.appendChild(tmpDiv);
    let base64 = null;
    try {
      const chart = echarts.init(tmpDiv, null, { renderer: 'canvas' });
      chart.setOption(option);
      chart.resize();
      base64 = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      chart.dispose();
    } finally {
      document.body.removeChild(tmpDiv);
    }
    return base64;
  }

  function _addPptxTable(slide, element, x, y, w, h) {
    const ds = viz.getFilteredData(element.datasetName);
    if (!ds || !ds.rows.length) return;

    const cfg     = element.config || {};
    const selCols = (cfg.selectedColumns && cfg.selectedColumns.length)
      ? cfg.selectedColumns.filter(i => i < ds.headers.length)
      : ds.headers.map((_, i) => i);
    const maxRows  = Math.min(30, ds.rows.length);
    const showMore = ds.rows.length > maxRows;
    const rows     = ds.rows.slice(0, maxRows);
    const colW     = selCols.map(() => w / selCols.length);

    const tableRows = [
      selCols.map(ci => ({
        text: ds.headers[ci] || '',
        options: { bold: true, fontSize: 10, fontFace: 'Calibri', color: '1e293b', fill: { color: 'F0F0F0' } }
      }))
    ];
    rows.forEach((row, ri) => {
      tableRows.push(selCols.map(ci => ({
        text: String(row[ci] == null ? '' : row[ci]),
        options: { fontSize: 9, fontFace: 'Calibri', color: '1e293b', fill: { color: ri % 2 === 0 ? 'FFFFFF' : 'FAFAFA' } }
      })));
    });
    if (showMore) {
      const extra = ds.rows.length - maxRows;
      tableRows.push([{
        text: '… and ' + extra + ' more rows. See full data in the HTML export.',
        options: { colspan: selCols.length, fontSize: 9, fontFace: 'Calibri', color: '64748b', italic: true }
      }]);
    }

    slide.addTable(tableRows, { x, y, colW, border: { type: 'solid', pt: 0.5, color: 'e2e8f0' } });
  }

  function _addPptxKpi(slide, element, x, y, w, h) {
    const ds = viz.getFilteredData(element.datasetName);
    if (!ds || !ds.rows.length) return;

    const cfg    = element.config || {};
    const valIdx = (cfg.valueCol !== null && cfg.valueCol !== undefined) ? cfg.valueCol : null;
    const agg    = cfg.aggregation || 'count';
    let value;

    if (valIdx === null) {
      value = ds.rows.length;
    } else {
      const nums = ds.rows.map(r => parseFloat(r[valIdx])).filter(n => !isNaN(n));
      if (!nums.length) value = 0;
      else if (agg === 'sum')      value = nums.reduce((a, b) => a + b, 0);
      else if (agg === 'avg')      value = nums.reduce((a, b) => a + b, 0) / nums.length;
      else if (agg === 'min')      value = Math.min(...nums);
      else if (agg === 'max')      value = Math.max(...nums);
      else if (agg === 'distinct') value = new Set(ds.rows.map(r => r[valIdx])).size;
      else                         value = ds.rows.length;
    }

    const fmt = cfg.format || 'auto', pfx = cfg.prefix || '', sfx = cfg.suffix || '';
    let fmtd;
    if (fmt === 'currency')
      fmtd = pfx + '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + sfx;
    else if (fmt === 'percent')
      fmtd = pfx + (value * 100).toFixed(1) + '%' + sfx;
    else if (fmt === 'compact') {
      if      (Math.abs(value) >= 1e9) fmtd = pfx + (value / 1e9).toFixed(1) + 'B' + sfx;
      else if (Math.abs(value) >= 1e6) fmtd = pfx + (value / 1e6).toFixed(1) + 'M' + sfx;
      else if (Math.abs(value) >= 1e3) fmtd = pfx + (value / 1e3).toFixed(1) + 'K' + sfx;
      else                             fmtd = pfx + value + sfx;
    } else {
      fmtd = pfx + (Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 })) + sfx;
    }

    slide.addText(fmtd, {
      x, y: y + h * 0.15, w, h: h * 0.55,
      fontSize: 40, bold: true, color: '005EB8',
      align: 'center', valign: 'middle', fontFace: 'Calibri'
    });
    if (cfg.showLabel !== false && valIdx !== null) {
      slide.addText(ds.headers[valIdx] || '', {
        x, y: y + h * 0.72, w, h: h * 0.2,
        fontSize: 11, color: '64748b', align: 'center', fontFace: 'Calibri'
      });
    }
  }

  // ─── HTML export builder ──────────────────────────────────────────────────────

  viz._buildHTMLExport = function (forPrint) {
    const datasets          = _serializeDatasets();
    const blocks            = _serializeBlocks();
    const activeDatasetName = viz.activeDatasetName || Object.keys(datasets)[0] || null;
    const exportTheme       = forPrint ? 'light' : (document.documentElement.dataset.theme || 'light');
    const dsNames           = Object.keys(datasets);

    // Escape </script> sequences in JSON blobs to prevent premature tag close
    const dataJson   = JSON.stringify(datasets).replace(/<\/script>/gi, '<\\/script>');
    const layoutJson = JSON.stringify({ blocks, activeDatasetName }).replace(/<\/script>/gi, '<\\/script>');

    const dsPicker = dsNames.length > 1
      ? '<label style="color:rgba(255,255,255,0.65);font-size:11px;margin-right:4px">Dataset:</label>' +
        '<select id="exp-ds-picker" onchange="window._expChangeDataset(this.value)" ' +
        'style="padding:3px 8px;font-size:11px;border-radius:4px;border:none">' +
        dsNames.map(n => '<option value="' + n + '"' + (n === activeDatasetName ? ' selected' : '') + '>' + n + '</option>').join('') +
        '</select>'
      : '';

    // The auto-print block is included verbatim — no dynamic insertion needed
    const autoPrintBlock = forPrint
      ? `<script>
window.addEventListener('load', function() {
  setTimeout(function() {
    if (window._prepForPrint) window._prepForPrint();
    window.print();
    setTimeout(function() { window.close(); }, 1500);
  }, 2000);
});
<\/script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en" data-theme="${exportTheme}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dashboard Export</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js"><\/script>
<style>
${_exportCSS()}
</style>
</head>
<body>
<div id="exp-toolbar">
  <span class="exp-title">Dashboard</span>
  <div class="exp-spacer"></div>
  ${dsPicker}
  <button class="exp-tb-btn" id="exp-theme-btn" onclick="window._expToggleTheme && _expToggleTheme()">🌙</button>
</div>
<div id="exp-filter-bar" style="display:none">
  <span class="exp-filter-label">Filters:</span>
  <div id="exp-chips"></div>
  <button class="exp-clear-btn" onclick="window._expClearFilters && _expClearFilters()">Clear all</button>
</div>
<div id="exp-canvas"></div>
<script type="application/json" id="dwb-data">${dataJson}<\/script>
<script type="application/json" id="dwb-layout">${layoutJson}<\/script>
${autoPrintBlock}
<script>
${EXPORT_RUNTIME}
<\/script>
</body>
</html>`;
  };

  // ─── Export CSS (inlined into exported HTML) ──────────────────────────────────

  function _exportCSS() {
    return [
      ':root{--bg-main:#f8fafc;--bg-surface:#fff;--bg-raised:#f1f5f9;--border:#e2e8f0;',
      '--text-main:#1e293b;--text-muted:#64748b;--accent:#005EB8;--accent-light:#EAF2FB;',
      '--navy-midnight:#002244;--navy-gold:#C5B230}',
      '[data-theme="dark"]{--bg-main:#0a1628;--bg-surface:#0f2040;--bg-raised:#1a3056;',
      '--border:#1e3a5f;--text-main:#e2eaf4;--text-muted:#7ea3c4;--accent-light:#112244}',
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
      'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;',
      'background:var(--bg-main);color:var(--text-main);display:flex;flex-direction:column;min-height:100vh}',
      '#exp-toolbar{display:flex;align-items:center;gap:8px;padding:0 16px;height:44px;',
      'background:var(--navy-midnight);border-bottom:2px solid var(--navy-gold);flex-shrink:0}',
      '.exp-title{font-size:14px;font-weight:700;color:#fff}',
      '.exp-spacer{flex:1}',
      '.exp-tb-btn{padding:4px 10px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);',
      'border-radius:4px;color:#c8d8e8;font-size:13px;cursor:pointer}',
      '.exp-tb-btn:hover{background:rgba(255,255,255,.2);color:#fff}',
      '#exp-filter-bar{display:flex;align-items:center;gap:6px;padding:6px 16px;',
      'background:var(--accent-light);border-bottom:1px solid rgba(0,94,184,.2);flex-wrap:wrap}',
      '.exp-filter-label{font-size:11px;font-weight:600;color:var(--text-muted)}',
      '.exp-filter-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;',
      'background:var(--accent);color:#fff;border-radius:12px;font-size:11px}',
      '.exp-chip-remove{background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;font-size:12px;padding:0 2px;line-height:1}',
      '.exp-chip-remove:hover{color:#fff}',
      '.exp-clear-btn{background:none;border:1px solid rgba(0,94,184,.3);border-radius:4px;',
      'padding:2px 8px;font-size:11px;color:var(--accent);cursor:pointer}',
      '#exp-canvas{flex:1;overflow-y:auto;padding:24px 32px}',
      '.exp-block{background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;margin-bottom:20px;overflow:hidden}',
      '.exp-slots{display:flex}',
      '.exp-slot{padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0;flex:1}',
      '.exp-element{display:flex;flex-direction:column}',
      '.exp-el-title{font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;padding:0 2px}',
      '.exp-el-content{min-height:260px;position:relative}',
      '.exp-empty{display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;',
      'color:var(--text-muted);font-size:12px;font-style:italic}',
      '.exp-kpi-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:120px}',
      '.exp-kpi-val{font-size:2.8em;font-weight:700;color:var(--accent)}',
      '.exp-kpi-lbl{font-size:12px;color:var(--text-muted);margin-top:4px}',
      '.exp-tbl-wrap{overflow:auto;max-height:400px}',
      '.exp-tbl{border-collapse:collapse;font-size:12px;min-width:100%}',
      '.exp-tbl th{position:sticky;top:0;background:var(--bg-raised);border:1px solid var(--border);',
      'padding:6px 10px;font-weight:600;color:var(--text-main);z-index:1}',
      '.exp-tbl td{border:1px solid var(--border);padding:5px 10px;color:var(--text-main)}',
      '.exp-tbl tbody tr:hover{background:var(--accent-light)}',
      '@media print{',
      '#exp-toolbar,#exp-filter-bar{display:none!important}',
      '#exp-canvas{padding:.25in}',
      '.exp-block{page-break-inside:avoid;margin-bottom:.15in;border:none}',
      '.exp-el-content{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '@page{margin:.5in}}'
    ].join('');
  }

  // ─── Export Runtime ───────────────────────────────────────────────────────────
  // Written as a template literal — no escaping tricks needed.
  // This string is injected verbatim into the exported HTML's <script> block.

  const EXPORT_RUNTIME = `(function () {
  var DATA   = JSON.parse(document.getElementById("dwb-data").textContent);
  var LAYOUT = JSON.parse(document.getElementById("dwb-layout").textContent);

  window._expState = { datasets: DATA, blocks: LAYOUT.blocks, filters: [], activeDs: LAYOUT.activeDatasetName };
  var S = window._expState;

  var SCHEMES = {
    navy:   ["#1B3A6B","#005EB8","#4A90D9","#7BB3E8","#A8CFEF","#C8E0F7"],
    warm:   ["#C0392B","#E67E22","#F1C40F","#27AE60","#2980B9","#8E44AD"],
    cool:   ["#2C3E50","#2980B9","#1ABC9C","#3498DB","#27AE60","#16A085"],
    mono:   ["#1B3A6B","#2D5FA0","#4A82C8","#6FA0D8","#96BBE4","#BDD3F0"],
    golden: ["#B8860B","#DAA520","#F0C040","#C8A200","#A07800","#805800"]
  };

  function getDs(name) { var n = name || S.activeDs; return n ? S.datasets[n] : null; }

  function applyFilters(ds) {
    if (!ds || !S.filters.length) return ds;
    var rows = ds.rows.filter(function(row) {
      return S.filters.every(function(f) {
        var ci = ds.headers.indexOf(f.column);
        if (ci < 0) return true;
        return String(row[ci] == null ? "" : row[ci]).toLowerCase() === f.value.toLowerCase();
      });
    });
    return { headers: ds.headers, rows: rows, columnTypes: ds.columnTypes, columnTypeMeta: ds.columnTypeMeta };
  }

  function doAgg(rows, catIdx, valIdx, aggType) {
    var b = {};
    rows.forEach(function(r) {
      var key = String(r[catIdx] == null ? "(blank)" : r[catIdx]);
      var num = (valIdx !== null && valIdx !== undefined) ? parseFloat(r[valIdx]) : NaN;
      if (!b[key]) b[key] = { s: 0, c: 0, lo: Infinity, hi: -Infinity };
      var bk = b[key]; bk.c++;
      if (!isNaN(num)) { bk.s += num; bk.lo = Math.min(bk.lo, num); bk.hi = Math.max(bk.hi, num); }
    });
    return Object.keys(b).map(function(label) {
      var bk = b[label], v;
      if      (aggType === "sum") v = bk.s;
      else if (aggType === "avg") v = bk.c ? bk.s / bk.c : 0;
      else if (aggType === "min") v = isFinite(bk.lo) ? bk.lo : 0;
      else if (aggType === "max") v = isFinite(bk.hi) ? bk.hi : 0;
      else                        v = bk.c;
      return { label: label, value: v };
    });
  }

  function doSort(data, s) {
    if      (s === "value-desc")  data.sort(function(a,b){ return b.value - a.value; });
    else if (s === "value-asc")   data.sort(function(a,b){ return a.value - b.value; });
    else if (s === "label-asc")   data.sort(function(a,b){ return a.label.localeCompare(b.label); });
    else if (s === "label-desc")  data.sort(function(a,b){ return b.label.localeCompare(a.label); });
    return data;
  }

  function lc() { return document.documentElement.dataset.theme === "dark" ? "#e2eaf4" : "#1e293b"; }

  var _charts = {};
  function disposeChart(id) { if (_charts[id]) { try { _charts[id].dispose(); } catch(e){} delete _charts[id]; } }

  function mkChart(el, c, option) {
    disposeChart(el.id);
    var chart = echarts.init(c);
    _charts[el.id] = chart;
    option.animation = false;
    chart.setOption(option);
    new ResizeObserver(function() { if (!chart.isDisposed()) chart.resize(); }).observe(c);
    c.dataset.chartId = el.id;
    return chart;
  }

  function renderBarV(el, ds, c) {
    var cfg = el.config || {};
    var catIdx = (cfg.categoryCol !== null && cfg.categoryCol !== undefined) ? cfg.categoryCol : null;
    if (catIdx === null || !ds || !ds.rows.length) { c.innerHTML = '<div class="exp-empty">No data</div>'; return; }
    var valIdx = (cfg.valueCol !== null && cfg.valueCol !== undefined) ? cfg.valueCol : null;
    var data = doSort(doAgg(ds.rows, catIdx, valIdx, cfg.aggregation || "count"), cfg.sort || "value-desc").slice(0, cfg.maxItems || 20);
    var scheme = SCHEMES[cfg.colorScheme || "navy"];
    var rot = cfg.labelRotate !== undefined ? cfg.labelRotate : 45;
    var chart = mkChart(el, c, {
      tooltip: { trigger: "axis" },
      grid: { left:"2%", right:"2%", top: cfg.showValues !== false ? 28 : 12, bottom: rot > 0 ? Math.round(rot*1.4) : 24, containLabel: true },
      xAxis: { type:"category", data: data.map(function(d){ return d.label; }), axisLabel: { color: lc(), fontSize: 11, rotate: rot, overflow:"truncate", interval: 0 } },
      yAxis: { type:"value", axisLabel: { color: lc(), fontSize: 11 } },
      series: [{ type:"bar", data: data.map(function(d,i){ return { value: d.value, itemStyle: { color: scheme[i % scheme.length] } }; }),
        label: cfg.showValues !== false ? { show:true, position:"top", fontSize:10, color:lc() } : { show:false } }]
    });
    var catCol = ds.headers[catIdx];
    chart.on("click", function(p) { if (p.componentType === "series") toggleFilter(catCol, p.name, el.id); });
  }

  function renderBarH(el, ds, c) {
    var cfg = el.config || {};
    var catIdx = (cfg.categoryCol !== null && cfg.categoryCol !== undefined) ? cfg.categoryCol : null;
    if (catIdx === null || !ds || !ds.rows.length) { c.innerHTML = '<div class="exp-empty">No data</div>'; return; }
    var valIdx = (cfg.valueCol !== null && cfg.valueCol !== undefined) ? cfg.valueCol : null;
    var data = doSort(doAgg(ds.rows, catIdx, valIdx, cfg.aggregation || "count"), cfg.sort || "value-desc").slice(0, cfg.maxItems || 20).reverse();
    var scheme = SCHEMES[cfg.colorScheme || "navy"];
    var chart = mkChart(el, c, {
      tooltip: { trigger: "axis" },
      grid: { left:"2%", right: cfg.showValues !== false ? "10%" : "2%", top:8, bottom:8, containLabel:true },
      xAxis: { type:"value", axisLabel: { color:lc(), fontSize:11 } },
      yAxis: { type:"category", data: data.map(function(d){ return d.label; }), axisLabel: { color:lc(), fontSize:11, overflow:"truncate", width:120 } },
      series: [{ type:"bar", data: data.map(function(d,i){ return { value:d.value, itemStyle:{ color:scheme[i % scheme.length] } }; }),
        label: cfg.showValues !== false ? { show:true, position:"right", fontSize:10, color:lc() } : { show:false } }]
    });
    var catCol = ds.headers[catIdx];
    chart.on("click", function(p) { if (p.componentType === "series") toggleFilter(catCol, p.name, el.id); });
  }

  function renderPie(el, ds, c) {
    var cfg = el.config || {};
    var catIdx = (cfg.categoryCol !== null && cfg.categoryCol !== undefined) ? cfg.categoryCol : null;
    if (catIdx === null || !ds || !ds.rows.length) { c.innerHTML = '<div class="exp-empty">No data</div>'; return; }
    var valIdx = (cfg.valueCol !== null && cfg.valueCol !== undefined) ? cfg.valueCol : null;
    var data = doSort(doAgg(ds.rows, catIdx, valIdx, cfg.aggregation || "count"), "value-desc").slice(0, cfg.maxSlices || 12);
    var scheme = SCHEMES[cfg.colorScheme || "navy"];
    var radius = cfg.radius !== undefined ? cfg.radius : 0;
    var chart = mkChart(el, c, {
      tooltip: { trigger:"item", formatter:"{b}: {c} ({d}%)" },
      legend: { type:"scroll", orient:"vertical", right:8, top:"center", textStyle:{ color:lc(), fontSize:11 } },
      series: [{ type:"pie",
        radius: radius > 0 ? [radius + "%", "70%"] : "70%",
        data: data.map(function(d,i){ return { name:d.label, value:d.value, itemStyle:{ color:scheme[i % scheme.length] } }; }),
        label: cfg.showLabels !== false ? { show:true, color:lc(), fontSize:11 } : { show:false },
        emphasis: { itemStyle: { shadowBlur:6, shadowColor:"rgba(0,0,0,0.3)" } }
      }]
    });
    var catCol = ds.headers[catIdx];
    chart.on("click", function(p) { if (p.componentType === "series") toggleFilter(catCol, p.name, el.id); });
  }

  function renderKpi(el, ds, c) {
    if (!ds || !ds.rows.length) { c.innerHTML = '<div class="exp-empty">No data</div>'; return; }
    var cfg = el.config || {};
    var valIdx = (cfg.valueCol !== null && cfg.valueCol !== undefined) ? cfg.valueCol : null;
    var agg = cfg.aggregation || "count";
    var value;
    if (valIdx === null) { value = ds.rows.length; }
    else {
      var nums = ds.rows.map(function(r){ return parseFloat(r[valIdx]); }).filter(function(n){ return !isNaN(n); });
      if (!nums.length) value = 0;
      else if (agg === "sum")      value = nums.reduce(function(a,b){ return a+b; }, 0);
      else if (agg === "avg")      value = nums.reduce(function(a,b){ return a+b; }, 0) / nums.length;
      else if (agg === "min")      value = Math.min.apply(null, nums);
      else if (agg === "max")      value = Math.max.apply(null, nums);
      else if (agg === "distinct") { var seen={}; ds.rows.forEach(function(r){ seen[r[valIdx]]=1; }); value = Object.keys(seen).length; }
      else value = ds.rows.length;
    }
    var fmt = cfg.format || "auto", pfx = cfg.prefix || "", sfx = cfg.suffix || "", fmtd;
    if (fmt === "currency") fmtd = pfx + "$" + value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + sfx;
    else if (fmt === "percent") fmtd = pfx + (value*100).toFixed(1) + "%" + sfx;
    else if (fmt === "compact") {
      if      (Math.abs(value)>=1e9) fmtd = pfx + (value/1e9).toFixed(1) + "B" + sfx;
      else if (Math.abs(value)>=1e6) fmtd = pfx + (value/1e6).toFixed(1) + "M" + sfx;
      else if (Math.abs(value)>=1e3) fmtd = pfx + (value/1e3).toFixed(1) + "K" + sfx;
      else fmtd = pfx + value + sfx;
    } else {
      fmtd = pfx + (Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined,{maximumFractionDigits:2})) + sfx;
    }
    var lbl = (cfg.showLabel !== false && valIdx !== null) ? (ds.headers[valIdx] || "") : "";
    c.innerHTML = '<div class="exp-kpi-wrap"><div class="exp-kpi-val">' + fmtd + "</div>" +
      (lbl ? '<div class="exp-kpi-lbl">' + lbl + "</div>" : "") + "</div>";
  }

  function renderTable(el, ds, c) {
    if (!ds || !ds.rows.length) { c.innerHTML = '<div class="exp-empty">No data</div>'; return; }
    var cfg = el.config || {};
    var selCols = (cfg.selectedColumns && cfg.selectedColumns.length)
      ? cfg.selectedColumns.filter(function(i){ return i < ds.headers.length; })
      : ds.headers.map(function(_,i){ return i; });
    var rows = ds.rows.slice(0, cfg.maxRows || 100);
    var html = '<div class="exp-tbl-wrap"><table class="exp-tbl"><thead><tr>';
    selCols.forEach(function(ci){ html += "<th>" + (ds.headers[ci] || "") + "</th>"; });
    html += "</tr></thead><tbody>";
    rows.forEach(function(row){
      html += "<tr>";
      selCols.forEach(function(ci){
        var v = row[ci] == null ? "" : String(row[ci]).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        html += "<td>" + v + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    c.innerHTML = html;
  }

  function renderElement(el) {
    var c = document.getElementById("ec-" + el.id);
    if (!c) return;
    var ds = applyFilters(getDs(el.datasetName));
    if      (el.type === "BAR_V")      renderBarV(el, ds, c);
    else if (el.type === "BAR_H")      renderBarH(el, ds, c);
    else if (el.type === "PIE")        renderPie(el, ds, c);
    else if (el.type === "KPI_STAT")   renderKpi(el, ds, c);
    else if (el.type === "DATA_TABLE") renderTable(el, ds, c);
    else c.innerHTML = '<div class="exp-empty">' + el.type + " not available in export</div>";
  }

  window._expRenderAll = function() {
    S.blocks.forEach(function(block) {
      block.slots.forEach(function(slot) { slot.elements.forEach(renderElement); });
    });
  };

  function toggleFilter(column, value, sourceId) {
    var sv = String(value);
    var idx = -1;
    S.filters.forEach(function(f, i) { if (f.column === column && f.value.toLowerCase() === sv.toLowerCase()) idx = i; });
    if (idx >= 0) S.filters.splice(idx, 1);
    else S.filters.push({ column: column, value: sv, source: sourceId });
    updateFilterBar();
    window._expRenderAll();
  }

  function updateFilterBar() {
    var bar = document.getElementById("exp-filter-bar");
    var chips = document.getElementById("exp-chips");
    if (!bar || !chips) return;
    bar.style.display = S.filters.length ? "flex" : "none";
    chips.innerHTML = S.filters.map(function(f) {
      return '<span class="exp-filter-chip">' + f.column + ": " + f.value +
        ' <button class="exp-chip-remove" data-col="' + encodeURIComponent(f.column) +
        '" data-val="' + encodeURIComponent(f.value) + '">&#x2715;</button></span>';
    }).join("");
  }

  window._expRemoveFilter = function(column, value) {
    var sv = String(value);
    S.filters = S.filters.filter(function(f){ return !(f.column === column && f.value.toLowerCase() === sv.toLowerCase()); });
    updateFilterBar();
    window._expRenderAll();
  };

  window._expClearFilters = function() {
    S.filters = [];
    updateFilterBar();
    window._expRenderAll();
  };

  window._expChangeDataset = function(name) {
    S.activeDs = name;
    window._expRenderAll();
  };

  window._expToggleTheme = function() {
    var html = document.documentElement;
    var isDark = html.dataset.theme === "dark";
    html.dataset.theme = isDark ? "light" : "dark";
    var btn = document.getElementById("exp-theme-btn");
    if (btn) btn.textContent = isDark ? "\\uD83C\\uDF19" : "\\u2600\\uFE0F";
    Object.keys(_charts).forEach(disposeChart);
    window._expRenderAll();
  };

  window._prepForPrint = function() {
    S.blocks.forEach(function(block) {
      block.slots.forEach(function(slot) {
        slot.elements.forEach(function(el) {
          var chart = _charts[el.id];
          if (!chart || chart.isDisposed()) return;
          var c = document.getElementById("ec-" + el.id);
          if (!c) return;
          try {
            chart.resize();
            var url = chart.getDataURL({ type:"png", pixelRatio:2, backgroundColor:"#ffffff" });
            var img = document.createElement("img");
            img.src = url; img.style.cssText = "width:100%;display:block;";
            c.style.display = "none";
            c.parentNode.insertBefore(img, c.nextSibling);
            c._printImg = img;
          } catch(e) {}
        });
      });
    });
  };

  window.addEventListener("afterprint", function() {
    S.blocks.forEach(function(block) {
      block.slots.forEach(function(slot) {
        slot.elements.forEach(function(el) {
          var c = document.getElementById("ec-" + el.id);
          if (c && c._printImg) { c._printImg.remove(); c.style.display = ""; c._printImg = null; }
        });
      });
    });
  });

  function buildCanvas() {
    var canvas = document.getElementById("exp-canvas");
    if (!canvas) return;
    var html = "";
    S.blocks.forEach(function(block) {
      html += '<div class="exp-block"><div class="exp-slots">';
      block.slots.forEach(function(slot, si) {
        var pct = (block.colRatios && block.colRatios[si] != null) ? block.colRatios[si] : Math.floor(100 / block.slots.length);
        html += '<div class="exp-slot" style="flex:0 0 ' + pct + "%;max-width:" + pct + '%">';
        slot.elements.forEach(function(el) {
          html += '<div class="exp-element">';
          if (el.title) html += '<div class="exp-el-title">' + el.title.replace(/</g,"&lt;") + "</div>";
          html += '<div class="exp-el-content" id="ec-' + el.id + '"></div></div>';
        });
        html += "</div>";
      });
      html += "</div></div>";
    });
    canvas.innerHTML = html;
    window._expRenderAll();
  }

  // Event delegation for filter chip remove buttons
  document.addEventListener("click", function(e) {
    var btn = e.target.closest ? e.target.closest(".exp-chip-remove") : (e.target.classList.contains("exp-chip-remove") ? e.target : null);
    if (btn && btn.dataset.col) {
      window._expRemoveFilter(decodeURIComponent(btn.dataset.col), decodeURIComponent(btn.dataset.val));
    }
  });

  document.addEventListener("DOMContentLoaded", function() {
    var themeBtn = document.getElementById("exp-theme-btn");
    if (themeBtn) themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "\\u2600\\uFE0F" : "\\uD83C\\uDF19";
    buildCanvas();
  });

})();`;

  DWB.log('Export system ready.', 'success');
})();

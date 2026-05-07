(function () {
  'use strict';

  const viz = DWB.viz;
  if (!viz) return;

  // ───────────────────────────── CONSTANTS ─────────────────────────────

  const PRESETS = {
    Corporate: {
      cardBg: '#ffffff', cardBorder: '#e2e8f0', cardRadius: '8px',
      titleSize: '13px', spacing: '16px',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      colors: ['#1B3A6B', '#005EB8', '#4A90D9', '#7BB3E8', '#A8CFEF', '#C8E0F7']
    },
    Modern: {
      cardBg: '#fafafa', cardBorder: '#d1d5db', cardRadius: '12px',
      titleSize: '14px', spacing: '20px',
      fontFamily: "'Inter', system-ui, sans-serif",
      colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
    },
    Infographic: {
      cardBg: '#fffef7', cardBorder: '#fde68a', cardRadius: '10px',
      titleSize: '14px', spacing: '16px',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      colors: ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#2980B9', '#8E44AD']
    },
    Editorial: {
      cardBg: '#fafafa', cardBorder: '#cbd5e1', cardRadius: '4px',
      titleSize: '15px', spacing: '12px',
      fontFamily: "'Roboto Mono', 'Courier New', monospace",
      colors: ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#f1f5f9']
    }
  };

  const ACCENT_PALETTE = [
    '#005EB8', '#1B3A6B', '#0ea5e9', '#6366f1', '#8b5cf6',
    '#ec4899', '#059669', '#f59e0b', '#dc2626', '#64748b'
  ];

  const FONT_OPTS = [
    { label: 'System',  value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { label: 'Inter',   value: "'Inter', system-ui, sans-serif" },
    { label: 'Mono',    value: "'Roboto Mono', 'Courier New', monospace" },
    { label: 'Serif',   value: "'Georgia', 'Times New Roman', serif" }
  ];

  const BG_TYPES   = ['flat', 'gradient', 'bold-gradient'];
  const BG_LABELS  = { flat: 'Flat', gradient: 'Gradient', 'bold-gradient': 'Bold' };
  const H_SIZES    = { S: '180px', M: '280px', L: '572px' };
  const H_TITLES   = { S: 'Short (180px)', M: 'Medium (280px)', L: 'Tall (572px)' };
  const H_SVGS = {
    S: `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="5" width="10" height="5" rx="1.5"/></svg>`,
    M: `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="2" width="10" height="8" rx="1.5"/></svg>`,
    L: `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="0.5" width="10" height="11" rx="1.5"/></svg>`
  };

  const DEFAULT_THEME = {
    preset: 'Corporate',
    accent: '#005EB8',
    background: { type: 'flat', startColor: '#f8fafc', endColor: '#e2e8f0', direction: '135deg' },
    typography: { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", baseSize: 13, titleWeight: 600 }
  };

  // ───────────────────────────── STATE ─────────────────────────────────

  viz.dashboardTheme     = Object.assign({}, DEFAULT_THEME, {
    background: Object.assign({}, DEFAULT_THEME.background),
    typography: Object.assign({}, DEFAULT_THEME.typography)
  });
  viz._sidebarTab        = 'element';
  viz._sidebarTabLocked  = false;
  viz._sidebarCollapsed  = {};

  // ───────────────────────── SIDEBAR TAB SYSTEM ────────────────────────

  viz.renderSidebar = function (elementId) {
    viz.activeElementId = elementId;
    if (!elementId && !viz._sidebarTabLocked) {
      viz._sidebarTab = 'dashboard';
    } else if (elementId && !viz._sidebarTabLocked) {
      viz._sidebarTab = 'element';
    }
    viz._renderSidebarContent();
  };

  viz.selectElement = function (elementId) {
    viz.activeElementId = elementId;
    document.querySelectorAll('.dwb-element-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('elcard-' + elementId);
    if (card) card.classList.add('selected');
    viz._sidebarTabLocked = false;
    viz._sidebarTab = 'element';
    viz._renderSidebarContent();
  };

  viz._switchSidebarTab = function (tab) {
    viz._sidebarTab = tab;
    viz._sidebarTabLocked = true;
    viz._renderSidebarContent();
  };

  viz._renderSidebarContent = function () {
    const sidebar = document.getElementById('viz-config-sidebar');
    if (!sidebar) return;

    const isDash = viz._sidebarTab === 'dashboard';

    let html = `<div class="viz-sidebar-tabs">
      <button class="viz-sidebar-tab${!isDash ? ' active' : ''}" onclick="DWB.viz._switchSidebarTab('element')">Element</button>
      <button class="viz-sidebar-tab${isDash ? ' active' : ''}" onclick="DWB.viz._switchSidebarTab('dashboard')">Dashboard</button>
    </div>`;

    if (isDash) {
      sidebar.innerHTML = html + viz._buildDashboardPanel();
      return;
    }

    // Element tab
    const elementId = viz.activeElementId;
    if (!elementId) {
      sidebar.innerHTML = html + '<div class="sidebar-empty-msg">Select an element to configure</div>';
      return;
    }

    const found = viz.findElement(elementId);
    if (!found) {
      sidebar.innerHTML = html + '<div class="sidebar-empty-msg">Element not found</div>';
      return;
    }

    const { element } = found;
    const def = viz._elementRegistry[element.type];
    if (!def) {
      sidebar.innerHTML = html + '<div class="sidebar-empty-msg">Unknown element type</div>';
      return;
    }

    const dataset   = viz.getActiveDataset(element);
    const datasets  = Object.keys(DWB.promotedDatasets);
    const dsOptions = '<option value="">Use canvas dataset</option>' +
      datasets.map(n =>
        `<option value="${n}"${element.datasetName === n ? ' selected' : ''}>${n}</option>`
      ).join('');

    html += `
      <div class="sidebar-section">
        <label class="sidebar-label">Title</label>
        <input type="text" class="sidebar-input"
          value="${(element.title || '').replace(/"/g, '&quot;')}"
          oninput="DWB.viz._updateElementTitle('${elementId}',this.value)">
        <label class="sidebar-label">Dataset override</label>
        <select class="sidebar-input"
          onchange="DWB.viz._updateElementDataset('${elementId}',this.value)">
          ${dsOptions}
        </select>
      </div>
      <div class="sidebar-section" id="sidebar-element-config"></div>
      <div style="padding:12px">
        <button class="sidebar-apply-btn"
          onclick="DWB.viz.renderElement('${elementId}')">▶ Apply / Re-render</button>
      </div>`;

    sidebar.innerHTML = html;

    if (def.renderConfig) {
      const configContainer = document.getElementById('sidebar-element-config');
      try {
        const cfgHtml = def.renderConfig(element, dataset);
        if (typeof cfgHtml === 'string' && configContainer) configContainer.innerHTML = cfgHtml;
      } catch (e) {
        if (configContainer) configContainer.innerHTML =
          `<div style="color:var(--danger);font-size:12px;padding:8px">Config error: ${e.message}</div>`;
      }
    }
  };

  // ───────────────────────── DASHBOARD PANEL ───────────────────────────

  viz._buildDashboardPanel = function () {
    const t = viz.dashboardTheme;
    const thumbHeights = [60, 85, 55, 75];

    // ── Preset grid ──
    const presetCards = Object.keys(PRESETS).map(name => {
      const p    = PRESETS[name];
      const bars = p.colors.slice(0, 4).map((c, i) =>
        `<div style="flex:1;background:${c};height:${thumbHeights[i]}%;border-radius:1px;align-self:flex-end"></div>`
      ).join('');
      const isCol = viz._sidebarCollapsed['theme'];
      return `<button class="dash-preset-card${t.preset === name ? ' active' : ''}"
        onclick="DWB.viz.updateTheme('preset','${name}')">
        <div class="dash-preset-thumb">${bars}</div>
        ${name}
      </button>`;
    }).join('');

    // ── Accent swatches ──
    const swatches = ACCENT_PALETTE.map(c =>
      `<button class="dash-accent-swatch${t.accent === c ? ' active' : ''}"
        style="background:${c}" title="${c}"
        onclick="DWB.viz.updateTheme('accent','${c}')"></button>`
    ).join('');

    // ── Background cards ──
    const bgCards = BG_TYPES.map(type => {
      let thumb;
      if (type === 'flat')        thumb = t.background.startColor;
      else if (type === 'gradient') thumb = `linear-gradient(135deg,${t.background.startColor},${t.background.endColor})`;
      else                        thumb = `radial-gradient(ellipse at top left,${t.background.startColor},${t.background.endColor})`;
      return `<button class="dash-bg-card${t.background.type === type ? ' active' : ''}"
        onclick="DWB.viz.updateTheme('background.type','${type}')">
        <div class="dash-bg-thumb" style="background:${thumb}"></div>
        ${BG_LABELS[type]}
      </button>`;
    }).join('');

    // ── Gradient controls ──
    const showGrad = t.background.type !== 'flat';
    const dirOpts  = [
      { v: '135deg', l: '↘ Diagonal' },
      { v: '90deg',  l: '↓ Down' },
      { v: '45deg',  l: '↗ Reverse diag' },
      { v: '180deg', l: '→ Horizontal' }
    ].map(d =>
      `<option value="${d.v}"${t.background.direction === d.v ? ' selected' : ''}>${d.l}</option>`
    ).join('');
    const gradBg = `linear-gradient(${t.background.direction},${t.background.startColor},${t.background.endColor})`;

    // ── Font pills ──
    const fontPills = FONT_OPTS.map((f, i) =>
      `<button class="dash-font-pill${t.typography.fontFamily === f.value ? ' active' : ''}"
        style="font-family:${f.value}"
        onclick="DWB.viz._setFontFamily(${i})">${f.label}</button>`
    ).join('');

    // ── Weight pills ──
    const weightPills = [400, 500, 600, 700].map(w =>
      `<button class="dash-weight-pill${t.typography.titleWeight === w ? ' active' : ''}"
        style="font-weight:${w}"
        onclick="DWB.viz.updateTheme('typography.titleWeight',${w})">${w}</button>`
    ).join('');

    const _section = (id, icon, title, body) => {
      const collapsed = viz._sidebarCollapsed[id] ? ' collapsed' : '';
      return `<div class="dash-section${collapsed}" data-section-id="${id}">
        <button class="dash-section-header" onclick="DWB.viz._toggleDashSection('${id}')">
          <span>${icon} ${title}</span>
          <span class="dash-section-chevron">▾</span>
        </button>
        <div class="dash-section-body">${body}</div>
      </div>`;
    };

    const themeBody = `
      <div class="dash-preset-grid">${presetCards}</div>
      <div class="sidebar-label" style="margin-bottom:6px;margin-top:4px">Accent color</div>
      <div class="dash-accent-row">
        ${swatches}
        <input type="color" class="dash-accent-custom" value="${t.accent}" title="Custom color"
          oninput="DWB.viz.updateTheme('accent',this.value,false)">
      </div>`;

    const canvasBody = `
      <div class="dash-bg-grid">${bgCards}</div>
      <div class="dash-gradient-controls${showGrad ? ' visible' : ''}" id="dash-grad-ctrls">
        <div class="dash-gradient-row">
          <label>From</label>
          <input type="color" value="${t.background.startColor}" style="flex:1;height:26px"
            oninput="DWB.viz.updateTheme('background.startColor',this.value,false);DWB.viz._updateGradientPreview()">
        </div>
        <div class="dash-gradient-row">
          <label>To</label>
          <input type="color" value="${t.background.endColor}" style="flex:1;height:26px"
            oninput="DWB.viz.updateTheme('background.endColor',this.value,false);DWB.viz._updateGradientPreview()">
        </div>
        <div class="dash-gradient-row">
          <label>Direction</label>
          <select style="flex:1" onchange="DWB.viz.updateTheme('background.direction',this.value,false);DWB.viz._updateGradientPreview()">${dirOpts}</select>
        </div>
        <div class="dash-gradient-preview" id="dash-grad-preview" style="background:${gradBg}"></div>
      </div>`;

    const typoBody = `
      <div class="sidebar-label">Font family</div>
      <div class="dash-font-pills">${fontPills}</div>
      <div class="sidebar-label" style="margin-top:10px">Base size</div>
      <div class="dash-size-slider">
        <input type="range" min="11" max="20" value="${t.typography.baseSize}"
          oninput="DWB.viz.updateTheme('typography.baseSize',parseInt(this.value),false);document.getElementById('dash-size-val').textContent=this.value+'px'">
        <span class="dash-size-label" id="dash-size-val">${t.typography.baseSize}px</span>
      </div>
      <div class="sidebar-label" style="margin-top:10px">Title weight</div>
      <div class="dash-weight-pills">${weightPills}</div>`;

    return (
      _section('theme',  '🎨', 'Theme Preset',       themeBody) +
      _section('canvas', '🖼',  'Canvas Background',   canvasBody) +
      _section('typo',   '🔤', 'Typography',           typoBody)
    );
  };

  viz._toggleDashSection = function (id) {
    viz._sidebarCollapsed[id] = !viz._sidebarCollapsed[id];
    const sec = document.querySelector('.dash-section[data-section-id="' + id + '"]');
    if (sec) sec.classList.toggle('collapsed', !!viz._sidebarCollapsed[id]);
  };

  // ───────────────────────── UPDATE THEME ──────────────────────────────

  viz.updateTheme = function (path, value, rerender) {
    const parts = path.split('.');
    let obj = viz.dashboardTheme;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    viz.applyTheme();
    if (rerender !== false) viz._renderSidebarContent();
  };

  viz._setFontFamily = function (i) {
    if (FONT_OPTS[i]) viz.updateTheme('typography.fontFamily', FONT_OPTS[i].value);
  };

  viz._updateGradientPreview = function () {
    const t = viz.dashboardTheme;
    const bg = `linear-gradient(${t.background.direction},${t.background.startColor},${t.background.endColor})`;
    const prev = document.getElementById('dash-grad-preview');
    if (prev) prev.style.background = bg;
    const ctrls = document.getElementById('dash-grad-ctrls');
    if (ctrls) ctrls.classList.toggle('visible', t.background.type !== 'flat');
    viz.applyTheme();
  };

  // ───────────────────────── APPLY THEME CSS ───────────────────────────

  viz.applyTheme = function () {
    const t = viz.dashboardTheme;
    if (!t) return;
    const canvas = document.getElementById('viz-canvas');
    if (!canvas) return;

    const p = PRESETS[t.preset] || PRESETS.Corporate;

    canvas.style.setProperty('--theme-card-bg',       p.cardBg);
    canvas.style.setProperty('--theme-card-border',   p.cardBorder);
    canvas.style.setProperty('--theme-card-radius',   p.cardRadius);
    canvas.style.setProperty('--theme-title-size',    p.titleSize);
    canvas.style.setProperty('--theme-spacing',       p.spacing);
    canvas.style.setProperty('--theme-font-family',   t.typography.fontFamily);
    canvas.style.setProperty('--theme-body-size',     t.typography.baseSize + 'px');
    canvas.style.setProperty('--theme-title-weight',  String(t.typography.titleWeight));
    canvas.style.setProperty('--theme-accent',        t.accent);
    p.colors.forEach((c, i) =>
      canvas.style.setProperty('--theme-chart-' + (i + 1), c)
    );

    const bg = t.background;
    if (bg.type === 'flat') {
      canvas.style.background = bg.startColor;
    } else if (bg.type === 'bold-gradient') {
      canvas.style.background =
        `radial-gradient(ellipse at top left, ${bg.startColor} 20%, ${bg.endColor} 80%)`;
    } else {
      canvas.style.background =
        `linear-gradient(${bg.direction}, ${bg.startColor}, ${bg.endColor})`;
    }

    if (DWB.workflow) DWB.workflow.markDirty();
  };

  // ─────────────────────── HEIGHT CONTROLS ─────────────────────────────

  viz._renderElementCardHtml = function (element, slotId) {
    const def      = viz._elementRegistry[element.type] || {};
    const selected = viz.activeElementId === element.id ? ' selected' : '';
    const h        = (element.config && element.config.height) || 'M';
    const hStyle   = `min-height:${H_SIZES[h] || H_SIZES.M}`;

    const heightBtns = ['S', 'M', 'L'].map(s =>
      `<button class="dwb-height-btn${h === s ? ' active' : ''}" id="height-btn-${s}-${element.id}"
        title="${H_TITLES[s]}"
        onclick="event.stopPropagation();DWB.viz.setElementHeight('${element.id}','${s}')">${H_SVGS[s]}</button>`
    ).join('');

    return `<div class="dwb-element-card${selected}" id="elcard-${element.id}"
      onclick="DWB.viz.selectElement('${element.id}')">
      <div class="dwb-element-header">
        <span>${def.icon || '📦'}</span>
        <input type="text" class="dwb-element-title-input" id="el-title-${element.id}"
          value="${(element.title || '').replace(/"/g, '&quot;')}"
          oninput="DWB.viz._updateElementTitle('${element.id}',this.value)"
          onclick="event.stopPropagation()">
        <div class="dwb-height-controls">${heightBtns}</div>
        <span class="dwb-element-type-badge">${def.title || element.type}</span>
        <button class="dwb-element-menu-btn"
          onclick="event.stopPropagation();DWB.viz._showElementMenu(event,'${element.id}','${slotId}')">⋯</button>
      </div>
      <div class="dwb-element-content" id="element-content-${element.id}" style="${hStyle}">
        <div class="dwb-empty-state" style="min-height:80px">Loading…</div>
      </div>
    </div>`;
  };

  viz.setElementHeight = function (elementId, size) {
    const found = viz.findElement(elementId);
    if (!found) return;
    found.element.config       = found.element.config || {};
    found.element.config.height = size;

    const contentEl = document.getElementById('element-content-' + elementId);
    if (contentEl) contentEl.style.minHeight = H_SIZES[size] || H_SIZES.M;

    ['S', 'M', 'L'].forEach(s => {
      const btn = document.getElementById('height-btn-' + s + '-' + elementId);
      if (btn) btn.classList.toggle('active', s === size);
    });

    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderElement(elementId);
  };

  // ─────────────────────── INITIAL APPLY ───────────────────────────────

  viz.applyTheme();
  DWB.log('Theme system ready.', 'success');
})();

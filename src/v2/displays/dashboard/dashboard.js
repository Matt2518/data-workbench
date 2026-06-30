/* === DWBDashboard: dashboard display renderer === */

window.DWBDashboard = (function() {
  const _dLayouts = [
    { key: '1col',    label: '1 Col' },
    { key: '2col',    label: '2 Col' },
    { key: '3col',    label: '3 Col' },
    { key: '2col-6040', label: '60/40' },
    { key: '2col-7030', label: '70/30' }
  ];

  function _dActiveFilters(display) {
    return (display.filterContext && display.filterContext.activeFilters) || {};
  }

  function mount(container, display) {
    if (!container || !display) return;

    const cfg = display.config || {};
    const layout = cfg.layout || '2col';
    const filters = _dActiveFilters(display);
    const filterKeys = Object.keys(filters);

    container.innerHTML = `
      <div class="dash-root">
        <div class="dash-toolbar">
          <span class="dash-toolbar-label">${_dEsc(display.label)}</span>
          <div style="display:flex;gap:4px">
            ${_dLayouts.map(function(l) {
              return '<button class="dash-layout-btn' + (layout === l.key ? ' active' : '') + '" data-layout="' + l.key + '">' + l.label + '</button>';
            }).join('')}
          </div>
          <div class="flex-spacer"></div>
          <button class="tb-btn" id="dash-add-viz-btn">＋ Add Viz</button>
          <button class="tb-btn" id="dash-fullscreen-btn">⛶ Present</button>
        </div>
        <div class="dash-filter-bar${filterKeys.length ? '' : ' hidden'}" id="dash-filter-bar">
          <span class="dash-filter-label">Filters</span>
          ${filterKeys.map(function(k) {
            return '<span class="dash-filter-chip">' + _dEsc(k) + ': ' + _dEsc(String(filters[k])) + '<button class="dash-filter-chip-remove" data-filter-key="' + _dEsc(k) + '">✕</button></span>';
          }).join('')}
          <button class="dash-clear-filters">Clear all</button>
        </div>
        <div class="dash-canvas" id="dash-canvas">
          <div class="dash-grid layout-${layout}" id="dash-grid"></div>
        </div>
      </div>`;

    // Wire layout buttons
    container.querySelectorAll('.dash-layout-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        display.config = display.config || {};
        display.config.layout = btn.dataset.layout;
        window.DWBShell.markDirty();
        mount(container, display);
      });
    });

    // Wire add viz
    container.querySelector('#dash-add-viz-btn').addEventListener('click', function() {
      _dShowAddPlacementModal(container, display);
    });

    // Wire fullscreen
    container.querySelector('#dash-fullscreen-btn').addEventListener('click', function() {
      _dEnterFullscreen(display);
    });

    // Wire filter chip removes
    container.querySelectorAll('.dash-filter-chip-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (display.filterContext) delete display.filterContext.activeFilters[btn.dataset.filterKey];
        window.DWBShell.markDirty();
        mount(container, display);
      });
    });
    const clearBtn = container.querySelector('.dash-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      display.filterContext = { activeFilters: {} };
      window.DWBShell.markDirty();
      mount(container, display);
    });

    _dRenderPlacements(display, container.querySelector('#dash-grid'), filters);
  }

  function _dRenderPlacements(display, grid, filters) {
    if (!grid) return;
    const placements = (display.placements || []);
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];

    if (placements.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1"><button class="dash-add-placement-btn" id="dash-first-add">＋ Add your first visualization</button></div>';
      const firstAdd = grid.querySelector('#dash-first-add');
      if (firstAdd) firstAdd.addEventListener('click', function() {
        _dShowAddPlacementModal(grid.closest('.dash-root').parentElement, display);
      });
      return;
    }

    placements.forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      const card = document.createElement('div');
      card.className = 'dash-placement';

      if (!viz) {
        card.innerHTML = '<div class="dash-placement-body" style="display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:12px">Visualization not found</div>';
        grid.appendChild(card);
        return;
      }

      const rows = _dGetFilteredRows(viz, snapshots, filters);

      card.innerHTML = `<div class="dash-placement-header">
        <span class="dash-placement-title">${_dEsc(viz.label)}</span>
        <button class="dash-fullscreen-btn" style="margin-left:auto" data-placement-id="${placement.id}" title="Remove">✕</button>
      </div>
      <div class="dash-placement-body" id="dash-pb-${placement.id}"></div>`;

      card.querySelector('.dash-fullscreen-btn').addEventListener('click', function() {
        display.placements = display.placements.filter(function(p) { return p.id !== placement.id; });
        window.DWBShell.markDirty();
        const gridEl = grid;
        _dRenderPlacements(display, gridEl, filters);
      });

      grid.appendChild(card);

      // Render viz into placement body
      const body = card.querySelector('#dash-pb-' + placement.id);
      if (body && window.DWBVizTab) {
        window.DWBVizTab.renderViz(viz, rows, body);
      }
    });
  }

  function _dGetFilteredRows(viz, snapshots, filters) {
    let rows = snapshots[viz.snapshotName] || [];
    if (!viz.linkToDisplayFilters) return rows;
    const filterKeys = Object.keys(filters);
    if (filterKeys.length === 0) return rows;
    return rows.filter(function(row) {
      return filterKeys.every(function(k) {
        return String(row[k] !== undefined ? row[k] : '') === String(filters[k]);
      });
    });
  }

  function _dShowAddPlacementModal(container, display) {
    const state = window.DWBState;
    const vizList = (state.flow && state.flow.visualizations) || [];

    if (vizList.length === 0) {
      alert('No visualizations exist yet. Create some in the Viz tab first.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';
    overlay.innerHTML = `<div class="modal" style="width:400px">
      <div class="modal-header">
        <span>Add to Dashboard</span>
        <button class="modal-close" id="dash-modal-close">✕</button>
      </div>
      <div style="padding:16px">
        <div class="form-row">
          <label>Select Visualization</label>
          <select id="dash-viz-select" style="width:100%">
            ${vizList.map(function(v) { return '<option value="' + _dEsc(v.id) + '">' + _dEsc(v.label) + ' (' + v.type + ')</option>'; }).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Column (for multi-column layouts)</label>
          <select id="dash-col-select" style="width:100%">
            <option value="1">Column 1</option>
            <option value="2">Column 2</option>
            <option value="3">Column 3</option>
          </select>
        </div>
        <button class="btn-primary" id="dash-add-confirm" style="width:100%;padding:8px;margin-top:8px">Add to Dashboard</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#dash-modal-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelector('#dash-add-confirm').addEventListener('click', function() {
      const vizId = overlay.querySelector('#dash-viz-select').value;
      const col   = parseInt(overlay.querySelector('#dash-col-select').value, 10) || 1;
      const placement = window.DWBSchema.createPlacement(vizId, 'DASHBOARD');
      placement.column = col;
      display.placements = display.placements || [];
      display.placements.push(placement);
      window.DWBShell.markDirty();
      document.body.removeChild(overlay);
      // Re-mount
      window.DWBDisplaysTab && window.DWBDisplaysTab.mount();
    });
  }

  function _dEnterFullscreen(display) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:800;background:var(--bg-main);overflow:auto;padding:32px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Exit';
    closeBtn.style.cssText = 'position:fixed;top:12px;right:16px;padding:6px 14px;background:var(--navy-midnight);color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:801;font-size:12px';
    closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });

    const inner = document.createElement('div');
    const cfg = display.config || {};
    const layout = cfg.layout || '2col';
    const state = window.DWBState;
    const snapshots = state.snapshots || {};
    const vizList = (state.flow && state.flow.visualizations) || [];

    inner.className = 'dash-grid layout-' + layout;
    inner.style.cssText = 'gap:20px;max-width:1400px;margin:0 auto';

    (display.placements || []).forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      if (!viz) return;
      const rows = snapshots[viz.snapshotName] || [];
      const card = document.createElement('div');
      card.className = 'dash-placement';
      card.innerHTML = '<div class="dash-placement-header"><span class="dash-placement-title">' + _dEsc(viz.label) + '</span></div><div class="dash-placement-body" id="fs-pb-' + placement.id + '"></div>';
      inner.appendChild(card);
      overlay.appendChild(card);
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(inner);

    // Re-render placements into fullscreen
    (display.placements || []).forEach(function(placement) {
      const viz = vizList.find(function(v) { return v.id === placement.vizId; });
      if (!viz) return;
      const rows = snapshots[viz.snapshotName] || [];
      const body = overlay.querySelector('#fs-pb-' + placement.id);
      if (body && window.DWBVizTab) window.DWBVizTab.renderViz(viz, rows, body);
    });

    document.body.appendChild(overlay);
  }

  function _dEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount };
})();

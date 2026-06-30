/* === DWBDisplaysTab: displays management and canvas === */

window.DWBDisplaysTab = (function() {
  const _dtTypeIcons = { DASHBOARD: '🖥', REPORT: '📄', PRESENTATION: '🎭', MERGE: '🔗' };
  const _dtTypeLabels = { DASHBOARD: 'Dashboard', REPORT: 'Report', PRESENTATION: 'Presentation', MERGE: 'Merge' };

  function _dtActiveDisplay() {
    const state = window.DWBState;
    if (!state.flow || !state.activeDisplayId) return null;
    return state.flow.displays.find(function(d) { return d.id === state.activeDisplayId; }) || null;
  }

  function mount() {
    const panel = document.getElementById('panel-displays');
    if (!panel) return;

    panel.innerHTML = `
      <div id="dt-rail">
        <div id="dt-rail-header">
          <span>Displays</span>
          <span style="margin-left:auto;font-size:10px;color:var(--text-faint)" id="dt-count"></span>
        </div>
        <div id="dt-display-list"></div>
        <button class="dt-add-btn" id="dt-add-display-btn">＋ Add Display</button>
      </div>
      <div id="dt-canvas-area" id="dt-canvas-area"></div>`;

    document.getElementById('dt-add-display-btn').addEventListener('click', _dtShowAddModal);
    _dtRenderRail();
    _dtRenderCanvas();
  }

  function _dtRenderRail() {
    const list = document.getElementById('dt-display-list');
    if (!list) return;
    const state = window.DWBState;
    const displays = (state.flow && state.flow.displays) || [];
    const countEl = document.getElementById('dt-count');
    if (countEl) countEl.textContent = displays.length;

    if (displays.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-faint);font-size:11px">No displays yet.</div>';
      return;
    }

    list.innerHTML = displays.map(function(d) {
      const icon = _dtTypeIcons[d.type] || '📊';
      const isSelected = d.id === state.activeDisplayId;
      return `<div class="dt-display-item${isSelected ? ' selected' : ''}" data-disp-id="${d.id}">
        <span class="dt-display-icon">${icon}</span>
        <div class="dt-display-info">
          <div class="dt-display-label" title="${_dtEsc(d.label)}">${_dtEsc(d.label)}</div>
          <div class="dt-display-type">${d.type}</div>
        </div>
        <button class="dt-display-del" data-del-id="${d.id}" title="Delete">✕</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.dt-display-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.dt-display-del')) return;
        window.DWBState.activeDisplayId = item.dataset.dispId;
        _dtRenderRail();
        _dtRenderCanvas();
      });
    });

    list.querySelectorAll('.dt-display-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _dtDeleteDisplay(btn.dataset.delId);
      });
    });
  }

  function _dtRenderCanvas() {
    const area = document.getElementById('dt-canvas-area');
    if (!area) return;

    const display = _dtActiveDisplay();
    if (!display) {
      area.innerHTML = '<div class="empty-state"><div class="es-icon">🖥</div><div class="es-title">No display selected</div><div class="es-desc">Select or create a display from the rail.</div></div>';
      return;
    }

    switch (display.type) {
      case 'DASHBOARD':     window.DWBDashboard    && window.DWBDashboard.mount(area, display);    break;
      case 'REPORT':        window.DWBReport       && window.DWBReport.mount(area, display);       break;
      case 'PRESENTATION':  window.DWBPresentation && window.DWBPresentation.mount(area, display); break;
      default:
        area.innerHTML = '<div class="empty-state"><div class="es-icon">🔧</div><div class="es-title">' + _dtEsc(display.type) + '</div><div class="es-desc">Coming soon</div></div>';
    }
  }

  function _dtDeleteDisplay(dispId) {
    const state = window.DWBState;
    if (!state.flow) return;
    if (state.flow.displays.length <= 1) { alert('Cannot delete the only display.'); return; }
    state.flow.displays = state.flow.displays.filter(function(d) { return d.id !== dispId; });
    if (state.activeDisplayId === dispId) {
      state.activeDisplayId = state.flow.displays[0] ? state.flow.displays[0].id : null;
    }
    window.DWBShell.markDirty();
    mount();
  }

  function _dtShowAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = '600';

    const types = ['DASHBOARD', 'REPORT', 'PRESENTATION'];
    overlay.innerHTML = `<div class="modal" style="width:420px">
      <div class="modal-header">
        <span>Add Display</span>
        <button class="modal-close" id="dt-modal-close">✕</button>
      </div>
      <div style="padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          ${types.map(function(t) {
            return '<button class="dt-type-card" data-type="' + t + '" style="padding:16px 10px;border:2px solid var(--border);border-radius:8px;background:var(--bg-raised);cursor:pointer;text-align:center;font-family:inherit">' +
              '<div style="font-size:28px;margin-bottom:6px">' + _dtTypeIcons[t] + '</div>' +
              '<div style="font-weight:700;font-size:13px">' + _dtTypeLabels[t] + '</div>' +
              '</button>';
          }).join('')}
        </div>
        <div class="form-row"><label>Display name</label><input type="text" id="dt-new-name" value="New Display" style="width:100%"></div>
        <button class="btn-primary" id="dt-create-btn" style="width:100%;padding:8px;margin-top:8px">Create</button>
      </div>
    </div>`;

    let selectedType = 'DASHBOARD';
    document.body.appendChild(overlay);

    overlay.querySelector('#dt-modal-close').addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelectorAll('.dt-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        selectedType = card.dataset.type;
        overlay.querySelectorAll('.dt-type-card').forEach(function(c) {
          c.style.borderColor = c.dataset.type === selectedType ? 'var(--accent)' : 'var(--border)';
          c.style.background  = c.dataset.type === selectedType ? 'var(--accent-light)' : 'var(--bg-raised)';
        });
      });
      if (card.dataset.type === selectedType) {
        card.style.borderColor = 'var(--accent)';
        card.style.background  = 'var(--accent-light)';
      }
    });

    overlay.querySelector('#dt-create-btn').addEventListener('click', function() {
      const name = overlay.querySelector('#dt-new-name').value.trim() || _dtTypeLabels[selectedType];
      _dtAddDisplay(selectedType, name);
      document.body.removeChild(overlay);
    });
  }

  function _dtAddDisplay(type, label) {
    const state = window.DWBState;
    if (!state.flow) return;
    const d = window.DWBSchema.createDisplay(type, label);
    state.flow.displays.push(d);
    state.activeDisplayId = d.id;
    window.DWBShell.markDirty();
    mount();
  }

  function _dtEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount };
})();

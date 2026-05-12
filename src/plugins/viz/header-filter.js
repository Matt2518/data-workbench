'use strict';
(function () {

  const _hfState          = new Map();
  const _hfClickListeners = new Map();

  function _hfGetUniqueValues(ds, colName) {
    if (!ds) return [];
    const ci = ds.headers.indexOf(colName);
    if (ci === -1) return [];
    return [...new Set(ds.rows.map(r => String(r[ci] ?? '').trim()))]
      .filter(v => v !== '')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function _hfFormatLabel(selectedValues, allValues, label) {
    if (selectedValues.length === allValues.length || selectedValues.length === 0) return label;
    if (selectedValues.length <= 2) return label + ': ' + selectedValues.join(', ');
    const shown = selectedValues.slice(0, 2).join(', ');
    const extra = selectedValues.length - 2;
    return label + ': ' + shown + ' +' + extra + ' more';
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _hfApplyFilter(element) {
    const state = _hfState.get(element.id);
    if (!state) return;
    const colName = (element.config || {}).colName || '';
    if (!colName) return;
    if (state.selectedValues.length === 0 || state.selectedValues.length === state.uniqueVals.length) {
      DWB.viz.clearHeaderFilter(element.id);
    } else {
      DWB.viz.setHeaderFilter(colName, [...state.selectedValues], element.id);
    }
  }

  DWB.registerElement('HEADER_FILTER', {
    title: 'Header Filter',
    icon: '🔽',
    category: 'Presentation',
    desc: 'A compact multi-select dropdown filter pill that filters all canvas elements by a single column. Stack multiple horizontally for dashboard-style filtering.',
    headerCompatible: true,

    renderConfig(element, dataset) {
      const cfg      = element.config || {};
      const colName  = cfg.colName  || '';
      const label    = cfg.label    || '';
      const defaultAll = cfg.defaultAll !== false;

      return `
        <div style="padding:8px 12px 0">
          <div class="sidebar-label">Column</div>
          <input type="text" class="sidebar-input"
            value="${_escHtml(colName)}"
            placeholder="Enter exact column name"
            oninput="DWB.viz._hfUpdateConfig('${element.id}','colName',this.value)">
          <div style="font-size:11px;color:var(--text-faint);margin-top:2px;margin-bottom:10px">
            Must match a column name in your dataset exactly.
          </div>

          <div class="sidebar-label">Display Label</div>
          <input type="text" class="sidebar-input"
            value="${_escHtml(label)}"
            placeholder="${_escHtml(colName) || 'Label'}"
            oninput="DWB.viz._hfUpdateConfig('${element.id}','label',this.value)">
          <div style="font-size:11px;color:var(--text-faint);margin-top:2px;margin-bottom:10px">
            Label shown on the filter pill.
          </div>

          <label class="sidebar-checkbox-item">
            <input type="checkbox" ${defaultAll ? 'checked' : ''}
              onchange="DWB.viz._hfUpdateConfig('${element.id}','defaultAll',this.checked)">
            Select all values by default
          </label>
          <div style="font-size:11px;color:var(--text-faint);margin-top:2px">
            When unchecked, filter starts with nothing selected (shows no data until user selects values).
          </div>
        </div>`;
    },

    render(element, dataset, filters) {
      const container = document.getElementById('element-content-' + element.id);
      if (container) {
        container.innerHTML = '<div class="dwb-empty-state" style="min-height:60px;font-size:12px">Header Filter renders in the filter bar above the canvas.</div>';
      }
    },

    renderHeader(element, ds, activeFilters) {
      const cfg        = element.config || {};
      const colName    = cfg.colName    || '';
      const label      = cfg.label || colName || 'Filter';
      const defaultAll = cfg.defaultAll !== false;

      // Get or initialize state; reset when colName changes
      let state = _hfState.get(element.id);
      if (!state || state._colName !== colName) {
        const uniqueVals = _hfGetUniqueValues(ds, colName);
        state = {
          selectedValues: defaultAll ? [...uniqueVals] : [],
          isOpen:         false,
          uniqueVals,
          _colName:       colName
        };
        _hfState.set(element.id, state);
      } else {
        state.uniqueVals = _hfGetUniqueValues(ds, colName);
      }

      const { selectedValues, isOpen, uniqueVals } = state;
      const isFiltering = selectedValues.length > 0 && selectedValues.length < uniqueVals.length;
      const pillLabel   = _hfFormatLabel(selectedValues, uniqueVals, label);

      // Create or reuse wrapper div
      const hfc = document.getElementById('canvas-header-filters');
      if (!hfc) return;
      let wrapper = document.getElementById('hf-wrap-' + element.id);
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id    = 'hf-wrap-' + element.id;
        wrapper.style.position = 'relative';
        hfc.appendChild(wrapper);
      }

      const pillBg    = isFiltering ? 'var(--accent,#2563eb)' : 'var(--card-bg,#fff)';
      const pillColor = isFiltering ? '#fff' : 'var(--text-main,#1e293b)';

      let html = `<div id="hf-pill-${element.id}"
        style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;
               border-radius:20px;border:1px solid var(--border);
               background:${pillBg};color:${pillColor};cursor:pointer;
               font-size:0.8rem;white-space:nowrap;user-select:none;
               box-shadow:0 1px 2px rgba(0,0,0,0.08);"
        onclick="DWB.viz._hfToggle('${element.id}')">
        ${_escHtml(pillLabel)}
        <span style="font-size:0.7rem;opacity:0.7;">${isOpen ? '▲' : '▼'}</span>`;

      if (isFiltering) {
        html += `<span style="margin-left:2px;opacity:0.8;font-size:0.75rem;line-height:1;"
          onclick="event.stopPropagation();DWB.viz._hfClear('${element.id}')">✕</span>`;
      }

      html += '</div>';

      if (isOpen) {
        html += `<div style="position:absolute;top:calc(100% + 4px);left:0;z-index:1000;
          min-width:200px;max-height:280px;overflow-y:auto;
          background:var(--card-bg,#fff);border:1px solid var(--border);
          border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:6px 0;">`;

        html += `<div style="display:flex;gap:4px;padding:4px 8px 6px;border-bottom:1px solid var(--border);">
          <button style="font-size:11px;padding:2px 8px;border:1px solid var(--border);
                         border-radius:4px;background:transparent;color:var(--text-main);cursor:pointer;"
            onclick="DWB.viz._hfSelectAll('${element.id}')">All</button>
          <button style="font-size:11px;padding:2px 8px;border:1px solid var(--border);
                         border-radius:4px;background:transparent;color:var(--text-main);cursor:pointer;"
            onclick="DWB.viz._hfClearSel('${element.id}')">Clear</button>
        </div>`;

        for (const val of uniqueVals) {
          const checked  = selectedValues.includes(val) ? 'checked' : '';
          const dispVal  = val === '' ? '(Blank)' : _escHtml(val);
          const safeVal  = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          html += `<label style="display:flex;align-items:center;gap:8px;padding:5px 12px;
                                 cursor:pointer;font-size:0.82rem;">
            <input type="checkbox" ${checked}
              onchange="DWB.viz._hfToggleVal('${element.id}','${safeVal}',this.checked)">
            ${dispVal}
          </label>`;
        }

        html += '</div>';
      }

      wrapper.innerHTML = html;

      // Manage outside-click listener
      if (_hfClickListeners.has(element.id)) {
        document.removeEventListener('click', _hfClickListeners.get(element.id));
        _hfClickListeners.delete(element.id);
      }
      if (isOpen) {
        setTimeout(() => {
          const handler = (e) => {
            const wrap = document.getElementById('hf-wrap-' + element.id);
            if (wrap && !wrap.contains(e.target)) {
              const s = _hfState.get(element.id);
              if (s) { s.isOpen = false; _hfApplyFilter(element); }
              document.removeEventListener('click', handler);
              _hfClickListeners.delete(element.id);
              DWB.viz.renderHeaderElement(element.id);
            }
          };
          _hfClickListeners.set(element.id, handler);
          document.addEventListener('click', handler);
        }, 0);
      }
    },

    onThemeChange(element) {
      DWB.viz.renderHeaderElement(element.id);
    },

    getPromptContext(element, dataset, filters) {
      const cfg = element.config || {};
      return `Header Filter: column=${cfg.colName || '(unset)'}, label=${cfg.label || cfg.colName || ''}.`;
    },

    getEchartsInstance() { return null; }
  });

  // ---- Header filter helpers (called from inline HTML) ----

  DWB.viz._hfUpdateConfig = function (elementId, key, value) {
    const el = DWB.viz.headerElements.find(e => e.id === elementId);
    if (!el) return;
    if (!el.config) el.config = {};
    el.config[key] = value;
    _hfState.delete(elementId);
    DWB.viz.renderHeaderElement(elementId);
  };

  DWB.viz._hfToggle = function (elementId) {
    const state = _hfState.get(elementId);
    if (!state) return;
    state.isOpen = !state.isOpen;
    DWB.viz.renderHeaderElement(elementId);
  };

  DWB.viz._hfToggleVal = function (elementId, val, checked) {
    const state = _hfState.get(elementId);
    if (!state) return;
    if (checked) {
      if (!state.selectedValues.includes(val)) state.selectedValues.push(val);
    } else {
      state.selectedValues = state.selectedValues.filter(v => v !== val);
    }
    const el = DWB.viz.headerElements.find(e => e.id === elementId);
    if (!el) return;
    _hfApplyFilter(el);
    DWB.viz.renderHeaderElement(elementId);
  };

  DWB.viz._hfSelectAll = function (elementId) {
    const state = _hfState.get(elementId);
    if (!state) return;
    state.selectedValues = [...state.uniqueVals];
    const el = DWB.viz.headerElements.find(e => e.id === elementId);
    if (!el) return;
    _hfApplyFilter(el);
    DWB.viz.renderHeaderElement(elementId);
  };

  DWB.viz._hfClearSel = function (elementId) {
    const state = _hfState.get(elementId);
    if (!state) return;
    state.selectedValues = [];
    const el = DWB.viz.headerElements.find(e => e.id === elementId);
    if (!el) return;
    _hfApplyFilter(el);
    DWB.viz.renderHeaderElement(elementId);
  };

  DWB.viz._hfClear = function (elementId) {
    const state = _hfState.get(elementId);
    if (!state) return;
    state.selectedValues = [...state.uniqueVals];
    const el = DWB.viz.headerElements.find(e => e.id === elementId);
    if (!el) return;
    _hfApplyFilter(el);
    DWB.viz.renderHeaderElement(elementId);
  };

})();

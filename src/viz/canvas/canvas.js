// canvas.js — Block/slot/element model, filter coordinator, canvas rendering
(function () {
  'use strict';

  const viz = DWB.viz;

  // ---- Full state on vizState ----
  viz.blocks            = [];
  viz.headerElements    = [];
  viz.activeDatasetName = null;
  viz.activeElementId   = null;
  viz.filters           = [];

  // ---- Add-block dialog internal state ----
  let _addBlockLayout       = '1col';
  let _addBlockSelectedRatio = null;
  let _addBlockTargetIdx    = null;
  let _addBlockChangeId     = null;

  // ---- Element picker internal state ----
  let _pickerSlotId          = null;
  let _pickerInsertAfterId   = null;

  // ---- ID generation ----
  viz.generateId = function () {
    return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 6);
  };

  // ---- Dataset picker ----
  viz.onDatasetPickerChange = function (name) {
    viz.activeDatasetName = name || null;
    viz.renderAllElements();
  };

  viz.onDatasetPromoted = function (name) {
    const picker = document.getElementById('viz-dataset-picker');
    if (!picker) return;

    // Drop the "no datasets" placeholder once we have real data
    if (Object.keys(DWB.promotedDatasets).length === 1) {
      const placeholder = picker.querySelector('option[value=""]');
      if (placeholder) placeholder.remove();
    }

    // Add option if not already present
    const already = Array.from(picker.options).find(o => o.value === name);
    if (!already) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      picker.appendChild(opt);
    }

    // Auto-select if first dataset
    if (viz.activeDatasetName === null) {
      viz.activeDatasetName = name;
      picker.value = name;
    }

    viz.renderAllElements();
  };

  // ---- Finders ----
  viz.findElement = function (elementId) {
    for (const block of viz.blocks) {
      for (const slot of block.slots) {
        for (const element of slot.elements) {
          if (element.id === elementId) return { block, slot, element };
        }
      }
    }
    return null;
  };

  viz.getActiveDataset = function (element) {
    const name = (element && element.datasetName) || viz.activeDatasetName;
    return name ? DWB.promotedDatasets[name] : null;
  };

  // ---- Filter coordinator ----
  viz.addFilter = function (column, value, sourceElementId) {
    const strVal = String(value);
    const idx = viz.filters.findIndex(
      f => f.column === column && String(f.value).toLowerCase() === strVal.toLowerCase()
    );
    if (idx >= 0) {
      viz.filters.splice(idx, 1);
    } else {
      viz.filters.push({ column, value: strVal, source: sourceElementId });
    }
    viz._updateFilterBar();
    viz.onFiltersChanged();
  };

  viz.removeFilter = function (column, value) {
    viz.filters = viz.filters.filter(
      f => !(f.column === column && String(f.value).toLowerCase() === String(value).toLowerCase())
    );
    viz._updateFilterBar();
    viz.onFiltersChanged();
  };

  viz.clearFilters = function () {
    viz.filters = [];
    viz._updateFilterBar();
    viz.onFiltersChanged();
  };

  viz._updateFilterBar = function () {
    const bar   = document.getElementById('viz-filter-bar');
    const chips = document.getElementById('viz-filter-chips');
    if (!bar || !chips) return;
    if (viz.filters.length === 0) {
      bar.classList.add('hidden');
      chips.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    chips.innerHTML = viz.filters.map(f => {
      const col = f.column.replace(/'/g, "\\'");
      const val = String(f.value).replace(/'/g, "\\'");
      return `<span class="dwb-filter-chip">
        ${f.column}: ${f.value}
        <button class="dwb-filter-chip-remove"
          onclick="DWB.viz.removeFilter('${col}','${val}')">✕</button>
      </span>`;
    }).join('');
  };

  viz.onFiltersChanged = function () {
    viz.renderAllElements();
  };

  viz.getFilteredData = function (datasetName) {
    const ds = DWB.promotedDatasets[datasetName || viz.activeDatasetName];
    if (!ds) return null;
    if (viz.filters.length === 0) return ds;
    const filtered = ds.rows.filter(row =>
      viz.filters.every(f => {
        const ci = ds.headers.indexOf(f.column);
        if (ci < 0) return true;
        return String(row[ci] ?? '').toLowerCase() === String(f.value).toLowerCase();
      })
    );
    return { ...ds, rows: filtered, rowCount: filtered.length };
  };

  // ---- Render all / single element ----
  viz.renderAllElements = function () {
    for (const block of viz.blocks) {
      for (const slot of block.slots) {
        for (const element of slot.elements) {
          viz.renderElement(element.id);
        }
      }
    }
  };

  viz.renderElement = function (elementId) {
    const found = viz.findElement(elementId);
    if (!found) return;
    const { element } = found;
    const def = viz._elementRegistry[element.type];
    if (!def) return;
    const dataset = viz.getFilteredData(element.datasetName);
    try {
      def.render(element, dataset, viz.filters);
    } catch (e) {
      const c = document.getElementById('element-content-' + elementId);
      if (c) c.innerHTML = `<div class="dwb-empty-state" style="color:var(--danger)">Render error: ${e.message}</div>`;
    }
  };

  // ---- Sidebar ----
  viz.renderSidebar = function (elementId) {
    viz.activeElementId = elementId;
    const sidebar = document.getElementById('viz-config-sidebar');
    if (!sidebar) return;

    if (!elementId) {
      sidebar.innerHTML = '<div class="sidebar-empty-msg">Select an element to configure</div>';
      return;
    }

    const found = viz.findElement(elementId);
    if (!found) { sidebar.innerHTML = '<div class="sidebar-empty-msg">Element not found</div>'; return; }

    const { element } = found;
    const def = viz._elementRegistry[element.type];
    if (!def) { sidebar.innerHTML = '<div class="sidebar-empty-msg">Unknown element type</div>'; return; }

    const dataset  = viz.getActiveDataset(element);
    const datasets = Object.keys(DWB.promotedDatasets);
    const dsOptions = '<option value="">Use canvas dataset</option>' +
      datasets.map(n =>
        `<option value="${n}"${element.datasetName === n ? ' selected' : ''}>${n}</option>`
      ).join('');

    sidebar.innerHTML = `
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

    if (def.renderConfig) {
      const configContainer = document.getElementById('sidebar-element-config');
      try {
        const html = def.renderConfig(element, dataset);
        if (typeof html === 'string' && configContainer) configContainer.innerHTML = html;
      } catch (e) {
        if (configContainer) configContainer.innerHTML =
          `<div style="color:var(--danger);font-size:12px;padding:8px">Config error: ${e.message}</div>`;
      }
    }
  };

  viz._updateElementTitle = function (elementId, title) {
    const found = viz.findElement(elementId);
    if (!found) return;
    found.element.title = title;
    const inp = document.getElementById('el-title-' + elementId);
    if (inp && inp !== document.activeElement) inp.value = title;
  };

  viz._updateElementDataset = function (elementId, datasetName) {
    const found = viz.findElement(elementId);
    if (!found) return;
    found.element.datasetName = datasetName || null;
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderSidebar(elementId);
    viz.renderElement(elementId);
  };

  // ---- Canvas rendering ----
  viz.renderCanvas = function () {
    const canvas = document.getElementById('viz-canvas');
    if (!canvas) return;

    if (viz.blocks.length === 0) {
      canvas.innerHTML = `
        <div class="dwb-empty-state" style="flex-direction:column;gap:16px;min-height:300px">
          <div style="font-size:40px">📊</div>
          <div>No blocks yet.<br>Click <strong>＋ Add Block</strong> in the toolbar to start.</div>
        </div>
        <div class="dwb-add-block-row">
          <button class="dwb-add-block-btn" onclick="DWB.viz.showAddBlockDialog(0)">＋ Add Block</button>
        </div>`;
      return;
    }

    let html = '';
    viz.blocks.forEach((block, bi) => {
      html += viz._renderBlockHtml(block, bi);
      html += `<div class="dwb-add-block-row">
        <button class="dwb-add-block-btn" onclick="DWB.viz.showAddBlockDialog(${bi + 1})">＋ Add Block</button>
      </div>`;
    });
    canvas.innerHTML = html;

    viz.renderAllElements();
  };

  viz._renderBlockHtml = function (block, bi) {
    const labels = { '1col': '1 Column', '2col': '2 Columns', '3col': '3 Columns' };
    let slotsHtml = '';
    block.slots.forEach((slot, si) => {
      const pct = block.colRatios[si] || Math.floor(100 / block.slots.length);
      slotsHtml += `<div class="dwb-slot" style="flex:0 0 ${pct}%;max-width:${pct}%" data-slot-id="${slot.id}">`;
      slot.elements.forEach(el => { slotsHtml += viz._renderElementCardHtml(el, slot.id); });
      slotsHtml += `<button class="dwb-add-element-btn"
        onclick="DWB.viz.showElementPicker('${slot.id}',null)">＋ Add Element</button>`;
      slotsHtml += '</div>';
    });
    return `<div class="dwb-block" data-block-id="${block.id}">
      <div class="dwb-block-header">
        <span class="dwb-block-handle">⠿</span>
        <span class="dwb-block-label">${labels[block.layout] || block.layout}</span>
        <button class="dwb-block-menu-btn"
          onclick="DWB.viz._showBlockMenu(event,'${block.id}')">⋯</button>
      </div>
      <div class="dwb-block-slots" data-block-title="${labels[block.layout] || block.layout}">${slotsHtml}</div>
    </div>`;
  };

  viz._renderElementCardHtml = function (element, slotId) {
    const def      = viz._elementRegistry[element.type] || {};
    const selected = viz.activeElementId === element.id ? ' selected' : '';
    return `<div class="dwb-element-card${selected}" id="elcard-${element.id}"
      onclick="DWB.viz.selectElement('${element.id}')">
      <div class="dwb-element-header">
        <span>${def.icon || '📦'}</span>
        <input type="text" class="dwb-element-title-input" id="el-title-${element.id}"
          value="${(element.title || '').replace(/"/g, '&quot;')}"
          oninput="DWB.viz._updateElementTitle('${element.id}',this.value)"
          onclick="event.stopPropagation()">
        <span class="dwb-element-type-badge">${def.title || element.type}</span>
        <button class="dwb-element-menu-btn"
          onclick="event.stopPropagation();DWB.viz._showElementMenu(event,'${element.id}','${slotId}')">⋯</button>
      </div>
      <div class="dwb-element-content" id="element-content-${element.id}">
        <div class="dwb-empty-state" style="min-height:80px">Loading…</div>
      </div>
    </div>`;
  };

  viz.selectElement = function (elementId) {
    viz.activeElementId = elementId;
    document.querySelectorAll('.dwb-element-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('elcard-' + elementId);
    if (card) card.classList.add('selected');
    viz.renderSidebar(elementId);
  };

  // ---- Block context menu ----
  viz._showBlockMenu = function (e, blockId) {
    e.stopPropagation();
    viz._closeCtxMenu();
    const bi = viz.blocks.findIndex(b => b.id === blockId);
    const items = [
      { label: 'Move Up',       fn: () => viz._moveBlock(bi, -1),           off: bi === 0 },
      { label: 'Move Down',     fn: () => viz._moveBlock(bi, 1),            off: bi === viz.blocks.length - 1 },
      { label: 'Change Layout', fn: () => viz.showAddBlockDialog(null, blockId) },
      { label: 'Delete Block',  fn: () => viz._deleteBlock(blockId), danger: true }
    ];
    viz._openCtxMenu(e, items);
  };

  viz._showElementMenu = function (e, elementId, slotId) {
    e.stopPropagation();
    viz._closeCtxMenu();
    const found = viz.findElement(elementId);
    if (!found) return;
    const { slot, element } = found;
    const ei = slot.elements.indexOf(element);
    const items = [
      { label: 'Edit Config',   fn: () => viz.selectElement(elementId) },
      { label: 'Move Up',       fn: () => viz._moveElement(elementId, -1), off: ei === 0 },
      { label: 'Move Down',     fn: () => viz._moveElement(elementId, 1),  off: ei === slot.elements.length - 1 },
      { label: 'Duplicate',     fn: () => viz._duplicateElement(elementId) },
      { label: 'Delete',        fn: () => viz._deleteElement(elementId), danger: true }
    ];
    viz._openCtxMenu(e, items);
  };

  viz._openCtxMenu = function (e, items) {
    const menu = document.createElement('div');
    menu.className = 'dwb-ctx-menu';
    menu.id = 'dwb-ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    menu.innerHTML = items.map((item, i) =>
      `<button class="dwb-ctx-item${item.danger ? ' danger' : ''}"
        ${item.off ? 'disabled style="opacity:0.4"' : ''}
        data-i="${i}">${item.label}</button>`
    ).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('[data-i]').forEach(btn => {
      btn.addEventListener('click', () => {
        viz._closeCtxMenu();
        items[parseInt(btn.dataset.i)].fn();
      });
    });
    setTimeout(() => document.addEventListener('click', viz._closeCtxMenu, { once: true }), 0);
  };

  viz._closeCtxMenu = function () {
    const m = document.getElementById('dwb-ctx-menu');
    if (m) m.remove();
  };

  // ---- Block operations ----
  viz._moveBlock = function (idx, dir) {
    const ni = idx + dir;
    if (ni < 0 || ni >= viz.blocks.length) return;
    [viz.blocks[idx], viz.blocks[ni]] = [viz.blocks[ni], viz.blocks[idx]];
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
  };

  viz._deleteBlock = function (blockId) {
    if (!confirm('Delete this block and all its elements?')) return;
    const idx = viz.blocks.findIndex(b => b.id === blockId);
    if (idx < 0) return;
    viz.blocks.splice(idx, 1);
    if (viz.activeElementId && !viz.findElement(viz.activeElementId)) {
      viz.activeElementId = null;
      viz.renderSidebar(null);
    }
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
  };

  // ---- Element operations ----
  viz._moveElement = function (elementId, dir) {
    const found = viz.findElement(elementId);
    if (!found) return;
    const { slot, element } = found;
    const idx = slot.elements.indexOf(element);
    const ni  = idx + dir;
    if (ni < 0 || ni >= slot.elements.length) return;
    slot.elements.splice(idx, 1);
    slot.elements.splice(ni, 0, element);
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
  };

  viz._duplicateElement = function (elementId) {
    const found = viz.findElement(elementId);
    if (!found) return;
    const { slot, element } = found;
    const copy = JSON.parse(JSON.stringify(element));
    copy.id = 'element-' + viz.generateId();
    copy._instance = null;
    slot.elements.splice(slot.elements.indexOf(element) + 1, 0, copy);
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
  };

  viz._deleteElement = function (elementId) {
    for (const block of viz.blocks) {
      for (const slot of block.slots) {
        const idx = slot.elements.findIndex(el => el.id === elementId);
        if (idx >= 0) {
          slot.elements.splice(idx, 1);
          if (viz.activeElementId === elementId) {
            viz.activeElementId = null;
            viz.renderSidebar(null);
          }
          if (DWB.workflow) DWB.workflow.markDirty();
          viz.renderCanvas();
          return;
        }
      }
    }
  };

  // ---- Add Block Dialog ----
  viz.showAddBlockDialog = function (insertAfterIdx, changeBlockId) {
    _addBlockTargetIdx     = (insertAfterIdx !== null && insertAfterIdx !== undefined) ? insertAfterIdx : null;
    _addBlockChangeId      = changeBlockId || null;
    _addBlockLayout        = '1col';
    _addBlockSelectedRatio = null;

    // Reset layout button states
    document.querySelectorAll('.layout-opt-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.layout === '1col');
    });
    document.getElementById('add-block-ratio-section').style.display = 'none';
    document.getElementById('add-block-ratio-btns').innerHTML = '';

    document.getElementById('add-block-overlay').classList.remove('hidden');
  };

  viz.closeAddBlockDialog = function () {
    document.getElementById('add-block-overlay').classList.add('hidden');
  };

  viz._selectBlockLayout = function (layout, btn) {
    _addBlockLayout = layout;
    document.querySelectorAll('.layout-opt-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');

    const presets = {
      '1col': [],
      '2col': [[30, 70], [40, 60], [50, 50], [60, 40], [70, 30]],
      '3col': [[33, 34, 33], [50, 25, 25]]
    };

    const ps            = presets[layout] || [];
    const ratioSection  = document.getElementById('add-block-ratio-section');
    const ratioBtns     = document.getElementById('add-block-ratio-btns');

    if (ps.length) {
      ratioSection.style.display = '';
      _addBlockSelectedRatio = ps[0];
      ratioBtns.innerHTML = ps.map((p, i) => {
        const diagCols = p.map(v => `<div class="rd-col" style="flex:${v}"></div>`).join('');
        return `<button class="ratio-opt-btn${i === 0 ? ' selected' : ''}"
          onclick="DWB.viz._selectRatio(this,[${p}])">
          <div class="ratio-diagram">${diagCols}</div>
          ${p.join('/')}%
        </button>`;
      }).join('');
    } else {
      ratioSection.style.display = 'none';
      _addBlockSelectedRatio = null;
    }
  };

  viz._selectRatio = function (btn, ratios) {
    _addBlockSelectedRatio = ratios;
    document.querySelectorAll('.ratio-opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  viz.confirmAddBlock = function () {
    const layout   = _addBlockLayout || '1col';
    const colCount = layout === '1col' ? 1 : layout === '2col' ? 2 : 3;
    let ratios     = _addBlockSelectedRatio;

    if (!ratios) {
      const even = Math.floor(100 / colCount);
      ratios = Array(colCount).fill(even);
      ratios[0] += 100 - even * colCount;
    }

    if (_addBlockChangeId) {
      const block = viz.blocks.find(b => b.id === _addBlockChangeId);
      if (block) {
        block.layout   = layout;
        block.colRatios = ratios;
        while (block.slots.length < colCount)
          block.slots.push({ id: 'slot-' + viz.generateId(), elements: [] });
        // Merge excess slots into slot[0] before trimming
        while (block.slots.length > colCount) {
          const extra = block.slots.pop();
          extra.elements.forEach(el => block.slots[0].elements.push(el));
        }
      }
    } else {
      const block = {
        id: 'block-' + viz.generateId(),
        layout,
        colRatios: ratios,
        slots: Array.from({ length: colCount }, () => ({
          id: 'slot-' + viz.generateId(),
          elements: []
        }))
      };
      if (_addBlockTargetIdx !== null) {
        viz.blocks.splice(_addBlockTargetIdx, 0, block);
      } else {
        viz.blocks.push(block);
      }
    }

    viz.closeAddBlockDialog();
    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
  };

  // ---- Element Picker ----
  viz.showElementPicker = function (slotId, insertAfterElementId) {
    _pickerSlotId        = slotId;
    _pickerInsertAfterId = insertAfterElementId;

    const list = document.getElementById('element-picker-list');
    if (!list) return;

    const ds          = viz.getActiveDataset(null);
    const activeTypes = ds ? (ds.columnTypes || []) : [];

    const byCat = {};
    for (const [key, def] of Object.entries(viz._elementRegistry)) {
      const cat = def.category || 'Other';
      (byCat[cat] = byCat[cat] || []).push({ key, def });
    }

    if (!Object.keys(byCat).length) {
      list.innerHTML = '<div class="sidebar-empty-msg">No elements registered yet.</div>';
    } else {
      list.innerHTML = Object.entries(byCat).map(([cat, items]) =>
        `<div class="element-picker-cat">${cat}</div>` +
        `<div class="element-picker-grid">` +
        items.map(({ key, def }) => {
          const rec = def.columnAffinity && def.columnAffinity.primary
            ? def.columnAffinity.primary.some(t => activeTypes.includes(t))
            : false;
          return `<div class="element-picker-item" onclick="DWB.viz._pickElement('${key}')">
            <span class="element-picker-icon">${def.icon || '📦'}</span>
            <div>
              <div class="element-picker-title" style="position:relative">${def.title}${rec ? '<span class="element-recommended">Recommended</span>' : ''}</div>
              <div class="element-picker-desc">${def.desc || ''}</div>
            </div>
          </div>`;
        }).join('') +
        `</div>`
      ).join('');
    }

    document.getElementById('element-picker-overlay').classList.remove('hidden');
  };

  viz.closeElementPicker = function () {
    document.getElementById('element-picker-overlay').classList.add('hidden');
  };

  viz._pickElement = function (type) {
    viz.closeElementPicker();
    if (!_pickerSlotId) return;

    let targetSlot = null;
    for (const block of viz.blocks) {
      for (const slot of block.slots) {
        if (slot.id === _pickerSlotId) { targetSlot = slot; break; }
      }
      if (targetSlot) break;
    }
    if (!targetSlot) return;

    const def = viz._elementRegistry[type];
    const element = {
      id: 'element-' + viz.generateId(),
      type,
      title: def ? def.title : type,
      datasetName: null,
      config: {},
      _instance: null
    };

    if (_pickerInsertAfterId) {
      const idx = targetSlot.elements.findIndex(el => el.id === _pickerInsertAfterId);
      targetSlot.elements.splice(idx + 1, 0, element);
    } else {
      targetSlot.elements.push(element);
    }

    if (DWB.workflow) DWB.workflow.markDirty();
    viz.renderCanvas();
    viz.selectElement(element.id);
  };

  // ---- Presentation Mode ----
  viz.togglePresentation = function () {
    document.documentElement.classList.toggle('presentation-mode');
    const on  = document.documentElement.classList.contains('presentation-mode');
    const btn = document.getElementById('btn-presentation');
    if (btn) btn.textContent = on ? '✕ Exit' : '⛶ Presentation';
  };

  // ---- Theme change ----
  new MutationObserver(() => {
    for (const block of viz.blocks) {
      for (const slot of block.slots) {
        for (const element of slot.elements) {
          const def = viz._elementRegistry[element.type];
          if (def && def.onThemeChange) def.onThemeChange(element);
        }
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---- Table search utility (used by DATA_TABLE element) ----
  viz.tableSearch = function (elementId) {
    const inp   = document.getElementById('search-' + elementId);
    const table = document.getElementById('table-' + elementId);
    if (!inp || !table) return;
    const term = inp.value.toLowerCase();
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells   = row.querySelectorAll('td');
      const matches = !term || [...cells].some(c => c.textContent.toLowerCase().includes(term));
      row.style.display = matches ? '' : 'none';
      cells.forEach(cell => {
        const val = cell.dataset.val || '';
        if (term && val.toLowerCase().includes(term)) {
          const i = val.toLowerCase().indexOf(term);
          cell.innerHTML =
            val.slice(0, i) +
            '<mark>' + val.slice(i, i + term.length) + '</mark>' +
            val.slice(i + term.length);
        } else {
          cell.textContent = val;
        }
      });
    });
  };

  // ---- Initial canvas render ----
  viz.renderCanvas();

  DWB.log('Canvas engine ready.', 'success');
})();

/* === DWBPipelineTab: pipeline UI (node list right, inspector left) === */

window.DWBPipelineTab = (function() {
  let _ptCurrentRows = [];
  let _ptPreviewRows = null; // null = show final output
  let _ptRefreshTimer = null;

  // Node categories for the picker
  const _ptNodeCats = [
    { cat: 'Input & Output', nodes: ['INGEST','PUSH_TO_VIZ','STASH_SAVE','STASH_RESTORE','EXPORT_CSV'] },
    { cat: 'Text Cleaning',  nodes: ['TRIM_WHITESPACE','CASE_NORMALIZE','FIND_REPLACE','FORMULA'] },
    { cat: 'Row Operations', nodes: ['FILTER','SORT','REMOVE_DUPS'] },
    { cat: 'Column Operations', nodes: ['REARRANGE_COLS','CONCAT_COLS'] },
    { cat: 'Validation',     nodes: ['REGEX_VALIDATE','REGEX_EXTRACT','FUZZY_STANDARDIZE'] },
    { cat: 'Transform',      nodes: ['PAD_TEXT','SUBSTRING','DATE_FORMAT','FORMAT_PHONE','URL_SAFE','BASIC_MATH','AUTOINCREMENT'] },
    { cat: 'Structure',      nodes: ['SPLIT_COL','ADD_COL','DROP_COLS','RENAME_COL','UNPIVOT','PIVOT'] },
    { cat: 'Logic & Reconcile', nodes: ['IF_THEN_ELSE','CASE_WHEN','FUZZY_MATCH','DATA_VALIDATION','LEFT_JOIN','DIFF_TABLES'] },
    { cat: 'Advanced',       nodes: ['SENTIMENT_ANALYSIS','ARBITRARY_DATE','SET_TYPES'] }
  ];

  function _ptNodeIcon(type) {
    const n = window.DWBNodes && window.DWBNodes[type];
    return n ? n.icon : '⚙';
  }
  function _ptNodeLabel(type) {
    const n = window.DWBNodes && window.DWBNodes[type];
    return n ? n.label : type;
  }

  function mount() {
    const panel = document.getElementById('panel-pipeline');
    if (!panel) return;
    panel.innerHTML = `
      <div class="pt-main">
        <div id="pt-config-panel">
          <div class="panel-header" id="pt-config-header">
            <span>Node Config</span><em class="ph-arrow">▾</em>
          </div>
          <div id="pt-config-body">
            <div style="color:var(--text-faint);font-size:12px;padding:8px 0">Select a node to configure it.</div>
          </div>
        </div>
        <div id="pt-resize-divider"></div>
        <div id="pt-inspector">
          <div id="pt-inspector-meta">
            <span id="pt-meta-text">No data — add an INGEST node</span>
            <span class="flex-spacer"></span>
            <button class="tb-btn" id="pt-run-btn" style="font-size:11px;padding:2px 8px">▶ Run</button>
          </div>
          <div id="pt-table-wrap">
            <div class="pt-inspector-empty"><div class="ei-icon">📊</div><div>Add an INGEST node to load data</div></div>
          </div>
        </div>
      </div>
      <div id="pt-sidebar">
        <div class="panel-header" style="cursor:default">
          <span>Nodes</span>
          <span style="margin-left:auto;font-size:10px;color:var(--text-faint)" id="pt-node-count"></span>
        </div>
        <div id="pt-node-list"></div>
        <button class="pt-add-node-btn" id="pt-add-node-btn">＋ Add Node</button>
        <div id="pt-stash-panel">
          <div class="panel-header" id="pt-stash-header">
            <span>Stashes</span><em class="ph-arrow">▾</em>
          </div>
          <div id="pt-stash-list"></div>
        </div>
        <div id="pt-console">
          <div id="pt-console-header">
            <span class="clabel">Console</span>
            <button class="pt-console-clear" id="pt-console-clear">Clear</button>
            <span id="pt-console-arrow">▾</span>
          </div>
          <div id="pt-console-log"></div>
        </div>
      </div>`;

    // Wire run button
    document.getElementById('pt-run-btn').addEventListener('click', function() {
      window.DWBPipeline.run().then(function(result) {
        _ptCurrentRows = result ? result.rows : [];
        _ptRenderInspector(_ptCurrentRows);
        _ptRenderStashes();
        window.DWBPipelineTab.renderNodeList();
      });
    });

    // Wire config panel collapse
    document.getElementById('pt-config-header').addEventListener('click', function() {
      document.getElementById('pt-config-panel').classList.toggle('collapsed');
    });

    // Wire stash panel collapse
    document.getElementById('pt-stash-header').addEventListener('click', function() {
      document.getElementById('pt-stash-panel').classList.toggle('collapsed');
    });

    // Wire console collapse
    document.getElementById('pt-console-header').addEventListener('click', function() {
      document.getElementById('pt-console').classList.toggle('collapsed');
    });

    // Wire console clear
    document.getElementById('pt-console-clear').addEventListener('click', function() {
      window.DWBState.consoleLogs = [];
      document.getElementById('pt-console-log').innerHTML = '';
    });

    // Wire resize divider
    _ptWireResize();

    // Wire add node button
    document.getElementById('pt-add-node-btn').addEventListener('click', _ptShowNodePicker);

    // Wire file picker for node picker modal (if exists)
    _ptWireNodePickerModal();

    // Restore existing console logs
    const logEl = document.getElementById('pt-console-log');
    if (logEl) {
      window.DWBState.consoleLogs.forEach(function(entry) { _ptAppendLogDOM(logEl, entry); });
    }

    window.DWBState.pipelineTabMounted = true;
    refresh();
  }

  function refresh() {
    _ptRenderNodeList();
    // Run pipeline and refresh inspector
    window.DWBPipeline.run().then(function(result) {
      _ptCurrentRows = result ? result.rows : [];
      _ptRenderInspector(_ptCurrentRows);
      _ptRenderStashes();
      // Re-select currently selected node config
      if (window.DWBState.selectedNodeId) {
        _ptSelectNode(window.DWBState.selectedNodeId, false);
      }
    });
  }

  function _ptRenderNodeList() {
    const list = document.getElementById('pt-node-list');
    if (!list) return;
    const state = window.DWBState;
    const nodes = state.flow ? state.flow.pipeline.nodes : [];
    const countEl = document.getElementById('pt-node-count');
    if (countEl) countEl.textContent = nodes.length + ' node' + (nodes.length !== 1 ? 's' : '');

    list.innerHTML = nodes.map(function(node) {
      const icon = _ptNodeIcon(node.type);
      const label = node.label || _ptNodeLabel(node.type);
      const isSelected = node.id === state.selectedNodeId;
      return `<div class="pt-node-card${isSelected ? ' selected' : ''}" data-node-id="${node.id}">
        <div class="status-dot idle" data-status-dot="${node.id}"></div>
        <span class="pt-node-icon">${icon}</span>
        <div class="pt-node-info">
          <div class="pt-node-name" title="${_esc(label)}">${_esc(label)}</div>
          <div class="pt-node-type">${node.type}</div>
        </div>
        <button class="pt-node-del" data-del-id="${node.id}" title="Delete node">✕</button>
      </div>`;
    }).join('');

    if (nodes.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-faint);font-size:11px">No nodes yet.<br>Click ＋ Add Node to start.</div>';
    }

    list.querySelectorAll('.pt-node-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.pt-node-del')) return;
        _ptSelectNode(card.dataset.nodeId, false);
      });
    });
    list.querySelectorAll('.pt-node-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _ptDeleteNode(btn.dataset.delId);
      });
    });
  }

  function _ptSelectNode(nodeId, skipRun) {
    const state = window.DWBState;
    state.selectedNodeId = nodeId;
    _ptRenderNodeList();

    // Build config UI
    const configBody = document.getElementById('pt-config-body');
    if (!configBody) return;

    const node = state.flow && state.flow.pipeline.nodes.find(function(n) { return n.id === nodeId; });
    if (!node) { configBody.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:8px 0">Node not found.</div>'; return; }

    const nodeImpl = window.DWBNodes && window.DWBNodes[node.type];

    if (skipRun && _ptPreviewRows && _ptPreviewRows.length > 0) {
      _ptBuildConfigUI(configBody, node, nodeImpl, _ptPreviewRows);
      return;
    }

    // Run up to selected node for preview
    window.DWBPipeline.runToNode(nodeId).then(function(result) {
      _ptPreviewRows = result ? result.rows : [];
      _ptRenderInspector(_ptPreviewRows);
      _ptBuildConfigUI(configBody, node, nodeImpl, _ptPreviewRows);
    });
  }

  function _ptDebouncedRefresh(nodeId) {
    if (_ptRefreshTimer) clearTimeout(_ptRefreshTimer);
    _ptRefreshTimer = setTimeout(function() {
      window.DWBPipeline.runToNode(nodeId).then(function(result) {
        _ptPreviewRows = result ? result.rows : [];
        _ptRenderInspector(_ptPreviewRows);
        window.DWBShell.markDirty();
      });
    }, 400);
  }

  function _ptBuildConfigUI(configBody, node, nodeImpl, currentRows) {
    configBody.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px">${_esc(node.label || node.type)}</div>`;

    if (node.type === 'PUSH_TO_VIZ') {
      // promotedAs config
      const d = document.createElement('div');
      d.innerHTML = `<div class="form-row"><label>Snapshot name</label>
        <input type="text" id="pv-promoted" value="${_esc(node.promotedAs||'')}" placeholder="e.g. sales_data" style="width:100%"></div>`;
      d.querySelector('#pv-promoted').addEventListener('input', function(e) {
        node.promotedAs = e.target.value.trim();
        window.DWBShell.markDirty();
      });
      configBody.appendChild(d);
    }

    if (nodeImpl && typeof nodeImpl.configUI === 'function') {
      try {
        const uiEl = nodeImpl.configUI(
          node.config || {},
          function(key, val) {
            node.config = node.config || {};
            node.config[key] = val;
            _ptDebouncedRefresh(node.id);
          },
          currentRows,
          node
        );
        if (uiEl) configBody.appendChild(uiEl);
      } catch (e) {
        configBody.innerHTML += '<div style="color:var(--danger);font-size:11px">Config UI error: ' + _esc(e.message) + '</div>';
      }
    } else if (!nodeImpl) {
      configBody.innerHTML += '<div style="font-size:12px;color:var(--text-muted)">No config for ' + _esc(node.type) + '</div>';
    }

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn-primary';
    applyBtn.style.cssText = 'width:100%;margin-top:12px;padding:7px';
    applyBtn.textContent = '▶ Apply & Run';
    applyBtn.addEventListener('click', function() {
      window.DWBPipeline.run().then(function(result) {
        _ptCurrentRows = result ? result.rows : [];
        _ptRenderInspector(_ptCurrentRows);
        _ptRenderStashes();
        _ptRenderNodeList();
      });
    });
    configBody.appendChild(applyBtn);
  }

  function _ptDeleteNode(nodeId) {
    const state = window.DWBState;
    if (!state.flow) return;
    const nodes = state.flow.pipeline.nodes;
    const idx = nodes.findIndex(function(n) { return n.id === nodeId; });
    if (idx < 0) return;
    const removed = nodes.splice(idx, 1)[0];
    // Remove sourceData if it was INGEST
    if (removed.type === 'INGEST' && removed.sourceId) {
      state.flow.pipeline.sourceData = state.flow.pipeline.sourceData.filter(function(s) { return s.id !== removed.sourceId; });
    }
    if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
    window.DWBShell.markDirty();
    refresh();
  }

  function _ptRenderInspector(rows) {
    const wrap = document.getElementById('pt-table-wrap');
    const meta = document.getElementById('pt-meta-text');
    if (!wrap) return;

    if (!rows || rows.length === 0) {
      wrap.innerHTML = '<div class="pt-inspector-empty"><div class="ei-icon">📊</div><div>No data — add and configure nodes</div></div>';
      if (meta) meta.textContent = 'No data';
      return;
    }

    const cols = Object.keys(rows[0]);
    const previewRows = rows.slice(0, 200);

    // Column statistics
    const stats = {};
    cols.forEach(function(col) {
      let filled = 0;
      rows.forEach(function(r) { if (r[col] !== '' && r[col] !== null && r[col] !== undefined) filled++; });
      stats[col] = Math.round((filled / rows.length) * 100);
    });

    let html = '<table class="dwb-data-table" style="font-size:12px">';
    html += '<thead><tr><th style="width:40px"></th>';
    cols.forEach(function(col) {
      html += '<th><div class="col-header-name" style="padding:4px 8px;font-weight:600;font-size:12px">' + _esc(col) + '</div>';
      html += '<div class="vdp"><div class="vdp-stats"><span>' + stats[col] + '% filled</span></div>';
      html += '<div class="vdp-bar-track"><div class="vdp-bar-fill" style="width:' + stats[col] + '%"></div></div></div></th>';
    });
    html += '</tr></thead><tbody>';

    previewRows.forEach(function(row, i) {
      html += '<tr><td class="row-num-cell">' + (i + 1) + '</td>';
      cols.forEach(function(col) {
        const v = row[col] !== undefined ? String(row[col]) : '';
        html += '<td title="' + _esc(v) + '">' + _esc(v.length > 80 ? v.slice(0,80) + '…' : v) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    wrap.innerHTML = html;
    if (meta) {
      const preview = _ptPreviewRows !== null ? ' (preview to selected node)' : '';
      meta.textContent = rows.length.toLocaleString() + ' rows · ' + cols.length + ' columns' + preview;
    }

    // overflow hint
    const inspector = document.getElementById('pt-inspector');
    if (inspector) {
      inspector.classList.toggle('has-overflow', wrap.scrollHeight > wrap.clientHeight + 10);
    }
  }

  function _ptRenderStashes() {
    const list = document.getElementById('pt-stash-list');
    if (!list) return;
    const stashes = window.DWBState.stashes || {};
    const keys = Object.keys(stashes);
    if (keys.length === 0) {
      list.innerHTML = '<div style="padding:6px 10px;font-size:11px;color:var(--text-faint)">No stashes</div>';
      return;
    }
    list.innerHTML = keys.map(function(k) {
      return `<div class="pt-stash-item">
        <span class="pt-stash-name">${_esc(k)}</span>
        <span class="pt-stash-count">${(stashes[k]||[]).length} rows</span>
      </div>`;
    }).join('');
  }

  function _ptShowNodePicker() {
    const overlay = document.getElementById('node-picker-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    _ptBuildNodePicker();
  }

  function _ptBuildNodePicker() {
    const tabsEl = document.getElementById('picker-cat-tabs');
    const listEl = document.getElementById('picker-list');
    const searchEl = document.getElementById('picker-search');
    if (!tabsEl || !listEl) return;

    let activeCat = _ptNodeCats[0].cat;

    function renderList(query) {
      listEl.innerHTML = '';
      _ptNodeCats.forEach(function(catDef) {
        if (activeCat !== catDef.cat && !query) return;
        catDef.nodes.forEach(function(type) {
          const impl = window.DWBNodes && window.DWBNodes[type];
          const label = impl ? impl.label : type;
          const icon  = impl ? (impl.icon || '⚙') : '⚙';
          if (query && !label.toLowerCase().includes(query.toLowerCase()) && !type.toLowerCase().includes(query.toLowerCase())) return;
          const item = document.createElement('div');
          item.className = 'picker-item';
          item.innerHTML = `<span class="picker-item-icon">${icon}</span>
            <div><div class="picker-item-title">${_esc(label)}</div>
            <div class="picker-item-desc" style="font-size:11px;color:var(--text-muted)">${type}</div></div>`;
          item.addEventListener('click', function() {
            _ptAddNode(type, label);
            document.getElementById('node-picker-overlay').classList.add('hidden');
          });
          listEl.appendChild(item);
        });
      });
      if (!listEl.children.length) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:12px">No nodes found</div>';
      }
    }

    tabsEl.innerHTML = _ptNodeCats.map(function(c) {
      return '<button class="picker-tab" data-cat="' + _esc(c.cat) + '">' + _esc(c.cat) + '</button>';
    }).join('');

    tabsEl.querySelectorAll('.picker-tab').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.cat === activeCat);
      btn.addEventListener('click', function() {
        activeCat = btn.dataset.cat;
        tabsEl.querySelectorAll('.picker-tab').forEach(function(b) { b.classList.toggle('active', b.dataset.cat === activeCat); });
        if (searchEl) searchEl.value = '';
        renderList('');
      });
    });

    if (searchEl) {
      searchEl.value = '';
      searchEl.oninput = function() { renderList(searchEl.value.trim()); };
    }

    renderList('');
  }

  function _ptAddNode(type, label) {
    const state = window.DWBState;
    if (!state.flow) return;
    const node = window.DWBSchema.createNode(type, label);
    // Copy default config from implementation
    const impl = window.DWBNodes && window.DWBNodes[type];
    if (impl && impl.defaultConfig) {
      node.config = JSON.parse(JSON.stringify(impl.defaultConfig));
    }
    state.flow.pipeline.nodes.push(node);
    state.selectedNodeId = node.id;
    window.DWBShell.markDirty();
    refresh();
  }

  function _ptWireResize() {
    const divider = document.getElementById('pt-resize-divider');
    if (!divider) return;
    let startY, startH;
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startY = e.clientY;
      const panel = document.getElementById('pt-config-panel');
      startH = panel ? panel.offsetHeight : 220;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    function onMove(e) {
      const panel = document.getElementById('pt-config-panel');
      if (!panel) return;
      const delta = e.clientY - startY;
      const newH = Math.max(32, Math.min(600, startH + delta));
      panel.style.flexBasis = newH + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function _ptWireNodePickerModal() {
    // Nothing extra needed - picker is wired in _ptBuildNodePicker
  }

  function appendLog(entry) {
    const logEl = document.getElementById('pt-console-log');
    if (!logEl) return;
    _ptAppendLogDOM(logEl, entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function _ptAppendLogDOM(logEl, entry) {
    const line = document.createElement('div');
    line.className = 'log-line ' + (entry.level || 'info');
    line.innerHTML = '<span class="log-ts">' + _esc(entry.ts) + '</span><span class="log-msg">' + _esc(entry.msg) + '</span>';
    logEl.appendChild(line);
  }

  function renderNodeList() { _ptRenderNodeList(); }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount, refresh: refresh, appendLog: appendLog, renderNodeList: renderNodeList };
})();

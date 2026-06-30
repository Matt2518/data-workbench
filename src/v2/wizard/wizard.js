/* === DWBWizard / DWBPipelineDesigner: wizard and designer mode === */

window.DWBWizard = (function() {
  let _wzMode = 'wizard'; // 'wizard' | 'designer'
  let _wzActiveStep = 0;

  function mount() {
    const panel = document.getElementById('panel-wizard');
    if (!panel) return;

    const state = window.DWBState;
    const nodes = (state.flow && state.flow.pipeline.nodes) || [];

    panel.innerHTML = `<div class="wz-root">
      <div class="wz-toolbar">
        <span style="font-size:13px;font-weight:600;color:var(--text-main)">Wizard Mode</span>
        <div class="wz-toggle-group">
          <button class="wz-toggle-btn${_wzMode === 'wizard' ? ' active' : ''}" data-mode="wizard">📋 Guided Steps</button>
          <button class="wz-toggle-btn${_wzMode === 'designer' ? ' active' : ''}" data-mode="designer">⚙ Pipeline Designer</button>
        </div>
        <div class="flex-spacer"></div>
        <button class="tb-btn" id="wz-run-pipeline">▶ Run Pipeline</button>
      </div>
      <div class="wz-body" id="wz-body"></div>
    </div>`;

    panel.querySelectorAll('.wz-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _wzMode = btn.dataset.mode;
        panel.querySelectorAll('.wz-toggle-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === _wzMode); });
        _wzRenderBody(panel);
      });
    });

    panel.querySelector('#wz-run-pipeline').addEventListener('click', function() {
      window.DWBPipeline.run().then(function() {
        window.DWBShell.log('Pipeline executed from Wizard', 'success');
        _wzRenderBody(panel);
      });
    });

    _wzRenderBody(panel);
  }

  function _wzRenderBody(panel) {
    const body = panel.querySelector('#wz-body');
    if (!body) return;
    if (_wzMode === 'designer') {
      _wzRenderDesigner(body);
    } else {
      _wzRenderSteps(body);
    }
  }

  function _wzRenderDesigner(body) {
    const state = window.DWBState;
    const nodes = (state.flow && state.flow.pipeline.nodes) || [];

    body.innerHTML = '<div class="wz-designer">';
    const wrap = body.querySelector('.wz-designer');

    wrap.innerHTML = `<div class="wz-designer-hint">Visual overview of your pipeline. Manage nodes in the Pipeline tab.</div>
      <div class="wz-flow-nodes" id="wz-flow-nodes">
        ${nodes.length === 0
          ? '<div style="color:var(--text-faint);font-size:13px;padding:20px">No nodes in pipeline. Switch to the Pipeline tab to add nodes.</div>'
          : nodes.map(function(node, idx) {
            const impl = window.DWBNodes && window.DWBNodes[node.type];
            const icon  = impl ? impl.icon : '⚙';
            const label = node.label || (impl ? impl.label : node.type);
            return (idx > 0 ? '<div class="wz-flow-connector"></div>' : '') +
              `<div class="wz-flow-node">
                <span class="wz-flow-node-icon">${_wzEsc(icon)}</span>
                <div class="wz-flow-node-info">
                  <div class="wz-flow-node-name">${_wzEsc(label)}</div>
                  <div class="wz-flow-node-type">${_wzEsc(node.type)}</div>
                </div>
                ${node.promotedAs ? '<span style="font-size:11px;color:var(--success);white-space:nowrap">📊 ' + _wzEsc(node.promotedAs) + '</span>' : ''}
              </div>`;
          }).join('')
        }
      </div>
      <div style="margin-top:16px">
        <button class="btn-primary" onclick="DWBShell.switchTab('pipeline')" style="padding:8px 20px">Open Pipeline Tab →</button>
      </div>`;
  }

  function _wzRenderSteps(body) {
    const state = window.DWBState;
    const nodes = (state.flow && state.flow.pipeline.nodes) || [];

    // Build steps from nodes that have userStep set, or all nodes
    const steps = nodes.filter(function(n) { return n.userStep !== null && n.userStep !== undefined; });
    // If no userStep configured, show all nodes as steps
    const allSteps = steps.length > 0 ? steps : nodes;

    if (allSteps.length === 0) {
      body.innerHTML = '<div class="empty-state" style="flex:1"><div class="es-icon">✨</div><div class="es-title">No pipeline steps yet</div><div class="es-desc">Build your pipeline in the Pipeline tab, then come back here for a guided user experience.</div><button class="btn-primary" style="margin-top:16px;padding:8px 20px" onclick="DWBShell.switchTab(\'pipeline\')">Go to Pipeline Tab</button></div>';
      return;
    }

    if (_wzActiveStep >= allSteps.length) _wzActiveStep = 0;
    const activeNode = allSteps[_wzActiveStep];

    body.innerHTML = `<div class="wz-steps">
      <div class="wz-step-nav" id="wz-step-nav">
        ${allSteps.map(function(node, idx) {
          const impl = window.DWBNodes && window.DWBNodes[node.type];
          const label = node.label || (impl ? impl.label : node.type);
          return `<div class="wz-step-item${idx === _wzActiveStep ? ' active' : ''}" data-step-idx="${idx}">
            <span class="wz-step-num">${idx + 1}</span>
            <span>${_wzEsc(label)}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="wz-step-canvas">
        <div class="wz-step-header">
          <div class="wz-step-title">${_wzEsc(activeNode.label || activeNode.type)}</div>
          <div class="wz-step-desc">Step ${_wzActiveStep + 1} of ${allSteps.length} · Configure and preview</div>
        </div>
        <div class="wz-step-body">
          <div class="wz-step-config" id="wz-step-config"></div>
          <div class="wz-step-preview" id="wz-step-preview">
            <div class="wz-preview-label">Data Preview</div>
            <div id="wz-preview-table" style="font-size:11px"></div>
          </div>
        </div>
        <div class="wz-step-footer">
          <button class="btn-secondary" id="wz-step-prev" ${_wzActiveStep === 0 ? 'disabled' : ''}>← Previous</button>
          <div class="flex-spacer"></div>
          <button class="btn-primary" id="wz-step-next" ${_wzActiveStep === allSteps.length - 1 ? '' : ''}>
            ${_wzActiveStep === allSteps.length - 1 ? '✓ Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </div>`;

    body.querySelectorAll('.wz-step-item').forEach(function(item) {
      item.addEventListener('click', function() {
        _wzActiveStep = parseInt(item.dataset.stepIdx, 10);
        _wzRenderSteps(body);
      });
    });

    body.querySelector('#wz-step-prev').addEventListener('click', function() {
      if (_wzActiveStep > 0) { _wzActiveStep--; _wzRenderSteps(body); }
    });

    body.querySelector('#wz-step-next').addEventListener('click', function() {
      if (_wzActiveStep < allSteps.length - 1) {
        _wzActiveStep++;
        _wzRenderSteps(body);
      } else {
        // Run and switch to displays
        window.DWBPipeline.run().then(function() {
          window.DWBShell.switchTab('displays');
        });
      }
    });

    // Build config UI for active node
    const configEl = body.querySelector('#wz-step-config');
    const impl = window.DWBNodes && window.DWBNodes[activeNode.type];

    // Run up to this node for config UI context
    window.DWBPipeline.runToNode(activeNode.id).then(function(result) {
      const currentRows = result ? result.rows : [];

      if (impl && typeof impl.configUI === 'function') {
        try {
          const uiEl = impl.configUI(
            activeNode.config || {},
            function(key, val) {
              activeNode.config = activeNode.config || {};
              activeNode.config[key] = val;
              window.DWBShell.markDirty();
            },
            currentRows,
            activeNode
          );
          if (uiEl && configEl) configEl.appendChild(uiEl);
        } catch (e) {
          if (configEl) configEl.innerHTML = '<div style="color:var(--danger);font-size:12px">Config UI error: ' + _wzEsc(e.message) + '</div>';
        }
      } else if (configEl) {
        configEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">No configuration needed for this step.</div>';
      }

      // Show data preview
      const previewEl = body.querySelector('#wz-preview-table');
      if (previewEl && currentRows.length > 0) {
        const cols = Object.keys(currentRows[0]);
        const previewRows = currentRows.slice(0, 10);
        let html = '<table class="dwb-data-table">';
        html += '<thead><tr>' + cols.map(function(c) { return '<th>' + _wzEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        previewRows.forEach(function(row) {
          html += '<tr>' + cols.map(function(c) { return '<td>' + _wzEsc(String(row[c] !== undefined ? row[c] : '')) + '</td>'; }).join('') + '</tr>';
        });
        html += '</tbody></table>';
        if (currentRows.length > 10) html += '<div style="padding:4px 0;color:var(--text-faint)">' + currentRows.length + ' rows total</div>';
        previewEl.innerHTML = html;
      } else if (previewEl) {
        previewEl.innerHTML = '<div style="color:var(--text-faint);font-size:11px">No data yet</div>';
      }
    });
  }

  function _wzEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { mount: mount };
})();

/* DWBPipelineDesigner: minimal alias pointing at the pipeline tab for designer use */
window.DWBPipelineDesigner = {
  open: function() { window.DWBShell && window.DWBShell.switchTab('pipeline'); }
};

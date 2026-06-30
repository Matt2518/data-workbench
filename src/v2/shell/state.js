/* === DWBState / DWBShell: global state and shell coordination === */

window.DWBState = {
  flow: null,
  snapshots: {},
  stashes: {},
  selectedNodeId: null,
  selectedVizId: null,
  activeDisplayId: null,
  activeTab: 'pipeline',
  dirty: false,
  consoleLogs: [],
  pipelineTabMounted: false
};

window.DWBShell = {
  initNewFlow: function(name) {
    window.DWBState.flow = window.DWBSchema.createFlow(name || 'Untitled Flow');
    window.DWBState.snapshots = {};
    window.DWBState.stashes = {};
    window.DWBState.selectedNodeId = null;
    window.DWBState.selectedVizId = null;
    window.DWBState.activeDisplayId = window.DWBState.flow.displays[0]
      ? window.DWBState.flow.displays[0].id : null;
    window.DWBState.dirty = false;
    window.DWBState.consoleLogs = [];
    window.DWBTopbar && window.DWBTopbar.updateTitle();
  },

  loadFlow: function(flow) {
    window.DWBState.flow = flow;
    window.DWBState.snapshots = {};
    window.DWBState.stashes = {};
    window.DWBState.selectedNodeId = null;
    window.DWBState.selectedVizId = null;
    window.DWBState.activeDisplayId = flow.displays && flow.displays[0]
      ? flow.displays[0].id : null;
    window.DWBState.dirty = false;
    window.DWBState.consoleLogs = [];
    window.DWBTopbar && window.DWBTopbar.updateTitle();
  },

  markDirty: function() {
    window.DWBState.dirty = true;
    window.DWBTopbar && window.DWBTopbar.setDirty(true);
    window.DWBio && window.DWBio.autoSave();
  },

  switchTab: function(tabName) {
    window.DWBState.activeTab = tabName;
    const panels = ['pipeline', 'viz', 'displays', 'wizard'];
    panels.forEach(function(p) {
      const el = document.getElementById('panel-' + p);
      if (el) el.style.display = (p === tabName) ? 'flex' : 'none';
    });
    const btns = document.querySelectorAll('.tab-mode-btn');
    btns.forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    // Run pipeline first if snapshots empty and nodes exist
    const state = window.DWBState;
    const needsRun = Object.keys(state.snapshots).length === 0 &&
      state.flow && state.flow.pipeline.nodes.length > 0;

    if (tabName === 'viz') {
      const afterRun = function() { window.DWBVizTab && window.DWBVizTab.mount(); };
      needsRun ? window.DWBPipeline.run().then(afterRun) : afterRun();
    } else if (tabName === 'displays') {
      const afterRun = function() { window.DWBDisplaysTab && window.DWBDisplaysTab.mount(); };
      needsRun ? window.DWBPipeline.run().then(afterRun) : afterRun();
    } else if (tabName === 'wizard') {
      window.DWBWizard && window.DWBWizard.mount();
    } else if (tabName === 'pipeline') {
      if (state.pipelineTabMounted) {
        window.DWBPipelineTab && window.DWBPipelineTab.refresh();
      }
    }
  },

  log: function(msg, level) {
    const entry = { ts: new Date().toLocaleTimeString(), msg: String(msg), level: level || 'info' };
    window.DWBState.consoleLogs.push(entry);
    window.DWBPipelineTab && window.DWBPipelineTab.appendLog(entry);
  },

  confirm: function(title, body, onOk) {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body;
    overlay.classList.remove('hidden');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const close = function() { overlay.classList.add('hidden'); };
    ok.onclick = function() { close(); onOk && onOk(); };
    cancel.onclick = close;
  }
};

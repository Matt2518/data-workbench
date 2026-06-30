/* === DWBio: file I/O and autosave === */

window.DWBio = (function() {
  const AUTOSAVE_KEY = 'dwb2_autosave';

  function autoSave() {
    const state = window.DWBState;
    if (!state || !state.flow) return;
    try {
      const data = window.DWBSchema.serialize(state.flow);
      localStorage.setItem(AUTOSAVE_KEY, data);
    } catch (e) {
      // storage quota or serialization error - non-fatal
    }
  }

  function loadAutoSave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const flow = window.DWBSchema.deserialize(raw);
      window.DWBShell.loadFlow(flow);
      window.DWBShell.log('Resumed autosaved flow: ' + flow.meta.name, 'success');
      // Refresh pipeline tab if already mounted
      setTimeout(function() {
        if (window.DWBState.pipelineTabMounted) {
          window.DWBPipelineTab && window.DWBPipelineTab.refresh();
        }
      }, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function newFlow() {
    window.DWBShell.initNewFlow();
    window.DWBState.pipelineTabMounted = false;
    window.DWBPipelineTab && window.DWBPipelineTab.mount();
    window.DWBShell.switchTab('pipeline');
    window.DWBShell.log('New flow started', 'info');
  }

  function openFile(file) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const flow = window.DWBSchema.deserialize(ev.target.result);
        window.DWBShell.loadFlow(flow);
        window.DWBState.pipelineTabMounted = false;
        window.DWBPipelineTab && window.DWBPipelineTab.mount();
        window.DWBShell.switchTab('pipeline');
        window.DWBShell.log('Opened: ' + flow.meta.name, 'success');
      } catch (e) {
        window.DWBShell && window.DWBShell.log('Failed to open file: ' + e.message, 'error');
        alert('Could not open file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function saveFlow() {
    const state = window.DWBState;
    if (!state || !state.flow) return;
    try {
      const data = window.DWBSchema.serialize(state.flow);
      const name = (state.flow.meta.name || 'flow').replace(/[^a-zA-Z0-9_-]/g, '_');
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.dwbflow';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      state.dirty = false;
      window.DWBTopbar && window.DWBTopbar.setDirty(false);
      window.DWBShell.log('Saved: ' + a.download, 'success');
    } catch (e) {
      window.DWBShell && window.DWBShell.log('Save failed: ' + e.message, 'error');
    }
  }

  return { autoSave: autoSave, loadAutoSave: loadAutoSave, newFlow: newFlow, openFile: openFile, saveFlow: saveFlow };
})();

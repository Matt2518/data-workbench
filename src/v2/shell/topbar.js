/* === DWBTopbar: topbar rendering and events === */

window.DWBTopbar = (function() {
  function _tbBuildHTML() {
    return `
      <span class="app-title">⚓ DWB 2</span>
      <span class="title-sep">/</span>
      <span id="tb-flow-name" class="flow-name-field" contenteditable="true" spellcheck="false" placeholder="Untitled Flow"></span>
      <span id="tb-dirty-dot" class="dirty-dot" style="display:none">●</span>

      <div class="tab-mode-group">
        <button class="tab-mode-btn active" data-tab="pipeline" onclick="DWBShell.switchTab('pipeline')">⚙ Pipeline</button>
        <button class="tab-mode-btn" data-tab="viz" onclick="DWBShell.switchTab('viz')">📊 Viz</button>
        <button class="tab-mode-btn" data-tab="displays" onclick="DWBShell.switchTab('displays')">🖥 Displays</button>
        <button class="tab-mode-btn" data-tab="wizard" onclick="DWBShell.switchTab('wizard')">✨ Wizard</button>
      </div>

      <div class="flex-spacer"></div>

      <button class="tb-btn" id="tb-btn-new" title="New Flow">New</button>
      <button class="tb-btn" id="tb-btn-open" title="Open .dwbflow">Open</button>
      <button class="tb-btn" id="tb-btn-save" title="Save .dwbflow">Save</button>
      <button class="tb-btn" id="tb-btn-theme" title="Toggle theme" style="padding:4px 8px;font-size:15px">☀</button>
    `;
  }

  function init() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    bar.innerHTML = _tbBuildHTML();

    const nameEl = document.getElementById('tb-flow-name');
    if (nameEl) {
      nameEl.addEventListener('input', function() {
        const state = window.DWBState;
        if (state && state.flow) {
          state.flow.meta.name = nameEl.textContent.trim() || 'Untitled Flow';
          window.DWBShell.markDirty();
        }
      });
    }

    const btnNew = document.getElementById('tb-btn-new');
    if (btnNew) {
      btnNew.addEventListener('click', function() {
        const state = window.DWBState;
        if (state && state.dirty) {
          window.DWBShell.confirm('Discard Changes?', 'Current flow has unsaved changes. Start a new flow anyway?', function() {
            window.DWBio.newFlow();
          });
        } else {
          window.DWBio.newFlow();
        }
      });
    }

    const btnOpen = document.getElementById('tb-btn-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', function() {
        document.getElementById('file-open-overlay').classList.remove('hidden');
      });
    }

    const fileInput = document.getElementById('file-open-input');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) window.DWBio.openFile(file);
        fileInput.value = '';
        document.getElementById('file-open-overlay').classList.add('hidden');
      });
    }

    const btnSave = document.getElementById('tb-btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', function() { window.DWBio.saveFlow(); });
    }

    const btnTheme = document.getElementById('tb-btn-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', function() {
        const isDark = document.documentElement.dataset.theme === 'dark';
        document.documentElement.dataset.theme = isDark ? '' : 'dark';
        btnTheme.textContent = isDark ? '☀' : '🌙';
      });
    }

    _tbRefreshName();
  }

  function _tbRefreshName() {
    const nameEl = document.getElementById('tb-flow-name');
    if (!nameEl) return;
    const state = window.DWBState;
    const name = (state && state.flow && state.flow.meta && state.flow.meta.name) || 'Untitled Flow';
    if (nameEl.textContent !== name) nameEl.textContent = name;
  }

  function updateTitle() {
    _tbRefreshName();
    setDirty(window.DWBState && window.DWBState.dirty);
  }

  function setDirty(dirty) {
    const dot = document.getElementById('tb-dirty-dot');
    if (dot) dot.style.display = dirty ? '' : 'none';
  }

  return { init: init, updateTitle: updateTitle, setDirty: setDirty };
})();

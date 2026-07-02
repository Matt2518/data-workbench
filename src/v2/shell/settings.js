/* === DWBSettings: settings modal (_stg prefix) === */
window.DWBSettings = (function() {
  var _activeSection = 'validation-lists';

  function _stgEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _stgEnsureModal() {
    if (document.getElementById('stg-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'stg-overlay';
    overlay.className = 'overlay hidden';
    overlay.innerHTML =
      '<div class="modal" style="width:560px;max-height:80vh;display:flex;flex-direction:column">' +
        '<div class="modal-header">' +
          '<span>Settings</span>' +
          '<button class="modal-close" id="stg-close">✕</button>' +
        '</div>' +
        '<div style="display:flex;flex:1;min-height:0;overflow:hidden">' +
          '<div id="stg-rail" style="width:140px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;padding:6px 0;overflow-y:auto">' +
            '<button class="stg-rail-btn active" data-section="validation-lists">Validation Lists</button>' +
          '</div>' +
          '<div id="stg-panel" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;min-width:0"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('stg-close').addEventListener('click', _stgClose);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _stgClose();
    });
    overlay.querySelectorAll('.stg-rail-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        overlay.querySelectorAll('.stg-rail-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _activeSection = btn.dataset.section;
        _stgRenderSection();
      });
    });
  }

  function _stgClose() {
    var ov = document.getElementById('stg-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function _stgRenderSection() {
    var panel = document.getElementById('stg-panel');
    if (!panel) return;
    if (_activeSection === 'validation-lists') _stgRenderValidationLists(panel);
  }

  function _stgRenderValidationLists(panel) {
    var lists = window.DWBValidationLists ? window.DWBValidationLists.getAll() : [];
    var isEditing  = panel.dataset.isEditing === '1';
    var editingId  = panel.dataset.editingId || '';
    var deletingId = panel.dataset.deletingId || '';
    var collision  = panel.dataset.importCollision || '';

    panel.innerHTML = '';

    /* ── Header ── */
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0';
    header.innerHTML =
      '<div style="font-size:13px;font-weight:700;flex:1">Validation Lists</div>' +
      '<label style="display:inline-flex;align-items:center;padding:4px 10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;font-size:11px;cursor:pointer;gap:5px;font-family:inherit">' +
        '&#x2191; Import' +
        '<input type="file" id="stg-import-file" accept=".json" style="display:none">' +
      '</label>';
    panel.appendChild(header);

    /* ── Import collision banner ── */
    if (collision) {
      var colObj = null;
      try { colObj = JSON.parse(collision); } catch (e) {}
      if (colObj) {
        var banner = document.createElement('div');
        banner.style.cssText = 'padding:8px 14px;background:rgba(245,158,11,0.1);border-bottom:1px solid var(--warning);font-size:12px;flex-shrink:0';
        banner.innerHTML =
          '<strong>A list named \'' + _stgEsc(colObj.name) + '\' already exists.</strong>' +
          '<div style="display:flex;gap:6px;margin-top:6px">' +
            '<button id="stg-coll-replace" class="btn-secondary" style="font-size:11px;padding:3px 8px">Replace</button>' +
            '<button id="stg-coll-copy"    class="btn-secondary" style="font-size:11px;padding:3px 8px">Add as copy</button>' +
            '<button id="stg-coll-cancel"  class="btn-secondary" style="font-size:11px;padding:3px 8px">Cancel</button>' +
          '</div>';
        panel.appendChild(banner);

        banner.querySelector('#stg-coll-replace').addEventListener('click', function() {
          var existing = window.DWBValidationLists.getAll().find(function(l) { return l.name === colObj.name; });
          if (existing) window.DWBValidationLists.save({ id: existing.id, name: colObj.name, values: colObj.values });
          panel.dataset.importCollision = '';
          _stgRenderValidationLists(panel);
        });
        banner.querySelector('#stg-coll-copy').addEventListener('click', function() {
          var base = colObj.name;
          var allNames = window.DWBValidationLists.getAll().map(function(l) { return l.name; });
          var copyName = base + ' (copy)';
          var n = 2;
          while (allNames.indexOf(copyName) !== -1) { copyName = base + ' (copy ' + n + ')'; n++; }
          window.DWBValidationLists.save({ name: copyName, values: colObj.values });
          panel.dataset.importCollision = '';
          _stgRenderValidationLists(panel);
        });
        banner.querySelector('#stg-coll-cancel').addEventListener('click', function() {
          panel.dataset.importCollision = '';
          _stgRenderValidationLists(panel);
        });
      }
    }

    /* ── List rows ── */
    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'flex:1;overflow-y:auto';

    if (!lists.length && !isEditing) {
      listWrap.innerHTML = '<div style="padding:24px 14px;text-align:center;font-size:12px;color:var(--text-faint)">No validation lists yet.<br>Create one below or import a JSON file.</div>';
    } else {
      var container = document.createElement('div');
      container.style.borderBottom = '1px solid var(--border)';
      lists.forEach(function(list) {
        if (deletingId === list.id) {
          var delRow = document.createElement('div');
          delRow.className = 'stg-list-row';
          delRow.style.background = 'rgba(220,38,38,0.04)';
          delRow.innerHTML =
            '<span style="flex:1;font-size:11px;color:var(--danger)">Delete <strong>' + _stgEsc(list.name) + '</strong>? This cannot be undone.</span>' +
            '<button class="stg-icon-btn danger" id="stg-del-yes" style="border-color:var(--danger);color:var(--danger)">Delete</button>' +
            '<button class="stg-icon-btn" id="stg-del-no">Cancel</button>';
          container.appendChild(delRow);
          delRow.querySelector('#stg-del-yes').addEventListener('click', function() {
            window.DWBValidationLists.remove(list.id);
            panel.dataset.deletingId = '';
            _stgRenderValidationLists(panel);
          });
          delRow.querySelector('#stg-del-no').addEventListener('click', function() {
            panel.dataset.deletingId = '';
            _stgRenderValidationLists(panel);
          });
        } else {
          var row = document.createElement('div');
          row.className = 'stg-list-row';
          row.innerHTML =
            '<span class="stg-list-name">' + _stgEsc(list.name) + '</span>' +
            '<span class="stg-list-count">' + list.values.length + ' value' + (list.values.length !== 1 ? 's' : '') + '</span>' +
            '<button class="stg-icon-btn" data-action="edit"   data-id="' + _stgEsc(list.id) + '" title="Edit">&#x270F;</button>' +
            '<button class="stg-icon-btn" data-action="export" data-id="' + _stgEsc(list.id) + '" title="Export">&#x2193;</button>' +
            '<button class="stg-icon-btn danger" data-action="delete" data-id="' + _stgEsc(list.id) + '" title="Delete">&#x2715;</button>';
          container.appendChild(row);
        }
      });
      listWrap.appendChild(container);
    }
    panel.appendChild(listWrap);

    /* ── Inline editor ── */
    if (isEditing) {
      var editingList = editingId ? window.DWBValidationLists.get(editingId) : null;
      var editor = document.createElement('div');
      editor.style.cssText = 'border-top:1px solid var(--border);padding:12px 14px;flex-shrink:0;background:var(--bg-raised)';
      editor.innerHTML =
        '<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">' + (editingId ? 'Edit List' : 'New List') + '</div>' +
        '<div class="form-row"><label>List Name</label>' +
          '<input type="text" id="stg-ed-name" value="' + _stgEsc(editingList ? editingList.name : '') + '" placeholder="e.g. Valid Departments" style="width:100%"></div>' +
        '<div class="form-row"><label>Values (one per line)</label>' +
          '<textarea id="stg-ed-values" rows="6" style="width:100%;font-size:12px;resize:vertical">' +
            _stgEsc((editingList ? editingList.values : []).join('\n')) +
          '</textarea></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button id="stg-ed-save" class="btn-primary" style="font-size:12px">Save</button>' +
          '<button id="stg-ed-cancel" class="btn-secondary" style="font-size:12px">Cancel</button>' +
        '</div>';
      panel.appendChild(editor);

      editor.querySelector('#stg-ed-save').addEventListener('click', function() {
        var name = editor.querySelector('#stg-ed-name').value.trim();
        var raw  = editor.querySelector('#stg-ed-values').value;
        var values = raw.split(/\r?\n/).map(function(v) { return v.trim(); }).filter(Boolean);
        if (!name) { editor.querySelector('#stg-ed-name').focus(); return; }
        var listObj = { name: name, values: values };
        if (editingId) listObj.id = editingId;
        window.DWBValidationLists.save(listObj);
        panel.dataset.isEditing = '0';
        panel.dataset.editingId = '';
        _stgRenderValidationLists(panel);
      });
      editor.querySelector('#stg-ed-cancel').addEventListener('click', function() {
        panel.dataset.isEditing = '0';
        panel.dataset.editingId = '';
        _stgRenderValidationLists(panel);
      });
      setTimeout(function() {
        var nameEl = editor.querySelector('#stg-ed-name');
        if (nameEl) nameEl.focus();
      }, 0);
    }

    /* ── + New List button ── */
    if (!isEditing) {
      var newBtn = document.createElement('button');
      newBtn.style.cssText = 'margin:10px 14px;padding:6px 12px;background:none;border:1px solid var(--border);border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;color:var(--text-main);align-self:flex-start';
      newBtn.textContent = '+ New List';
      newBtn.addEventListener('click', function() {
        panel.dataset.isEditing = '1';
        panel.dataset.editingId = '';
        _stgRenderValidationLists(panel);
      });
      panel.appendChild(newBtn);
    }

    /* ── Wire list row action buttons ── */
    panel.querySelectorAll('[data-action]').forEach(function(el) {
      el.addEventListener('click', function() {
        var id     = el.dataset.id;
        var action = el.dataset.action;
        if (action === 'edit') {
          panel.dataset.isEditing = '1';
          panel.dataset.editingId = id;
          _stgRenderValidationLists(panel);
        } else if (action === 'export') {
          window.DWBValidationLists.exportList(id);
        } else if (action === 'delete') {
          panel.dataset.deletingId = id;
          _stgRenderValidationLists(panel);
        }
      });
    });

    /* ── Wire import file input ── */
    var importFile = panel.querySelector('#stg-import-file');
    if (importFile) {
      importFile.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        importFile.value = '';
        var reader = new FileReader();
        reader.onload = function(ev) {
          var parsed = null;
          try { parsed = JSON.parse(ev.target.result); } catch (err) { alert('Invalid JSON file.'); return; }
          if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.values)) {
            alert('File must have "name" (string) and "values" (array) fields.');
            return;
          }
          var name = parsed.name.trim();
          var allNames = window.DWBValidationLists.getAll().map(function(l) { return l.name; });
          if (allNames.indexOf(name) !== -1) {
            panel.dataset.importCollision = JSON.stringify({ name: name, values: parsed.values });
          } else {
            window.DWBValidationLists.importList(ev.target.result);
          }
          _stgRenderValidationLists(panel);
        };
        reader.readAsText(file);
      });
    }
  }

  function open(section) {
    _stgEnsureModal();
    var panel = document.getElementById('stg-panel');
    if (panel) {
      panel.dataset.isEditing = '0';
      panel.dataset.editingId = '';
      panel.dataset.deletingId = '';
      panel.dataset.importCollision = '';
    }
    if (section) {
      _activeSection = section;
      var overlay = document.getElementById('stg-overlay');
      if (overlay) {
        overlay.querySelectorAll('.stg-rail-btn').forEach(function(btn) {
          btn.classList.toggle('active', btn.dataset.section === section);
        });
      }
    }
    var ov = document.getElementById('stg-overlay');
    if (ov) {
      ov.classList.remove('hidden');
      _stgRenderSection();
    }
  }

  return { open: open };
})();

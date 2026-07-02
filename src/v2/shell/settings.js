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
            '<button class="stg-rail-btn" data-section="global-tokens">Global Tokens</button>' +
          '</div>' +
          '<div id="stg-panel" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;min-width:0"></div>' +
        '</div>' +
        '<div id="stg-footer" style="border-top:1px solid var(--border);padding:8px 16px;display:flex;align-items:center;flex-shrink:0">' +
          '<button class="btn-secondary" id="stg-export-all" style="font-size:12px">💾 Export All Settings</button>' +
          '<button class="btn-secondary" id="stg-import-all" style="font-size:12px;margin-left:auto">📥 Import All Settings</button>' +
          '<input type="file" id="stg-import-all-file" accept=".json" style="display:none">' +
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

    document.getElementById('stg-export-all').addEventListener('click', _stgExportAll);
    document.getElementById('stg-import-all').addEventListener('click', function() {
      document.getElementById('stg-import-all-file').click();
    });
    document.getElementById('stg-import-all-file').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      this.value = '';
      var reader = new FileReader();
      reader.onload = function(ev) {
        var parsed = null;
        try { parsed = JSON.parse(ev.target.result); } catch (err) {
          alert('Invalid JSON file — could not parse.');
          return;
        }
        if (!parsed || typeof parsed.dwbSettingsBackup !== 'string' || !String(parsed.dwbSettingsBackup).startsWith('1.')) {
          alert('This doesn’t appear to be a valid DWB settings backup file.\nExpected a file exported from Settings → Export All Settings.');
          return;
        }
        _stgShowImportConfirm(parsed);
      };
      reader.readAsText(file);
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
    else if (_activeSection === 'global-tokens') _stgRenderGlobalTokens(panel);
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

  function _stgRenderGlobalTokens(panel) {
    var tokens = window.DWBGlobalTokens ? window.DWBGlobalTokens.getAll() : [];
    var isEditing  = panel.dataset.gtIsEditing === '1';
    var editingId  = panel.dataset.gtEditingId || '';
    var deletingId = panel.dataset.gtDeletingId || '';

    panel.innerHTML = '';

    /* ── Header ── */
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0';
    header.innerHTML = '<div style="font-size:13px;font-weight:700;flex:1">Global Tokens</div>';
    panel.appendChild(header);

    /* ── Token rows ── */
    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'flex:1;overflow-y:auto';

    if (!tokens.length && !isEditing) {
      listWrap.innerHTML = '<div style="padding:24px 14px;text-align:center;font-size:12px;color:var(--text-faint)">No global tokens yet — add one to reuse values like company name or fiscal year across reports and text blocks.</div>';
    } else {
      var container = document.createElement('div');
      container.style.borderBottom = '1px solid var(--border)';
      tokens.forEach(function(token) {
        if (deletingId === token.id) {
          var delRow = document.createElement('div');
          delRow.className = 'stg-list-row';
          delRow.style.background = 'rgba(220,38,38,0.04)';
          delRow.innerHTML =
            '<span style="flex:1;font-size:11px;color:var(--danger)">Delete <strong>{{' + _stgEsc(token.key) + '}}</strong>? This cannot be undone.</span>' +
            '<button class="stg-icon-btn danger" id="stg-gt-del-yes" style="border-color:var(--danger);color:var(--danger)">Delete</button>' +
            '<button class="stg-icon-btn" id="stg-gt-del-no">Cancel</button>';
          container.appendChild(delRow);
          delRow.querySelector('#stg-gt-del-yes').addEventListener('click', function() {
            window.DWBGlobalTokens.remove(token.id);
            panel.dataset.gtDeletingId = '';
            _stgRenderGlobalTokens(panel);
          });
          delRow.querySelector('#stg-gt-del-no').addEventListener('click', function() {
            panel.dataset.gtDeletingId = '';
            _stgRenderGlobalTokens(panel);
          });
        } else {
          var row = document.createElement('div');
          row.className = 'stg-list-row';
          row.innerHTML =
            '<span class="stg-list-name" style="font-family:monospace;max-width:120px">' + _stgEsc(token.key) + '</span>' +
            '<span style="flex:1;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">' + _stgEsc(token.value) + '</span>' +
            '<button class="stg-icon-btn" data-gt-action="edit"   data-gt-id="' + _stgEsc(token.id) + '" title="Edit">&#x270F;</button>' +
            '<button class="stg-icon-btn danger" data-gt-action="delete" data-gt-id="' + _stgEsc(token.id) + '" title="Delete">&#x2715;</button>';
          container.appendChild(row);
        }
      });
      listWrap.appendChild(container);
    }
    panel.appendChild(listWrap);

    /* ── Inline editor ── */
    if (isEditing) {
      var editingToken = null;
      if (editingId) {
        for (var i = 0; i < tokens.length; i++) {
          if (tokens[i].id === editingId) { editingToken = tokens[i]; break; }
        }
      }
      var editor = document.createElement('div');
      editor.style.cssText = 'border-top:1px solid var(--border);padding:12px 14px;flex-shrink:0;background:var(--bg-raised)';
      editor.innerHTML =
        '<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">' + (editingId ? 'Edit Token' : 'New Token') + '</div>' +
        '<div class="form-row"><label>Key (letters, numbers, underscore)</label>' +
          '<input type="text" id="stg-gt-key" value="' + _stgEsc(editingToken ? editingToken.key : '') + '" placeholder="e.g. company_name" style="width:100%;font-family:monospace"></div>' +
        '<div id="stg-gt-key-err" style="font-size:10px;color:var(--danger);margin-top:-6px;margin-bottom:6px;display:none"></div>' +
        '<div class="form-row"><label>Value</label>' +
          '<input type="text" id="stg-gt-value" value="' + _stgEsc(editingToken ? editingToken.value : '') + '" placeholder="e.g. CNIC FFR Training" style="width:100%"></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button id="stg-gt-save" class="btn-primary" style="font-size:12px">Save</button>' +
          '<button id="stg-gt-cancel" class="btn-secondary" style="font-size:12px">Cancel</button>' +
        '</div>';
      panel.appendChild(editor);

      var keyInput = editor.querySelector('#stg-gt-key');
      var keyErr   = editor.querySelector('#stg-gt-key-err');

      function _stgGtValidateKey(val) {
        if (!val) return 'Key is required.';
        if (!/^\w+$/.test(val)) return 'Key must contain only letters, numbers, or underscores.';
        for (var j = 0; j < tokens.length; j++) {
          if (tokens[j].key === val && tokens[j].id !== editingId) return 'A token with this key already exists.';
        }
        return '';
      }

      keyInput.addEventListener('input', function() {
        var err = _stgGtValidateKey(this.value.trim());
        keyErr.textContent = err;
        keyErr.style.display = err ? 'block' : 'none';
      });

      editor.querySelector('#stg-gt-save').addEventListener('click', function() {
        var key = keyInput.value.trim();
        var val = editor.querySelector('#stg-gt-value').value;
        var err = _stgGtValidateKey(key);
        if (err) { keyErr.textContent = err; keyErr.style.display = 'block'; keyInput.focus(); return; }
        var tokenObj = { key: key, value: val };
        if (editingId) tokenObj.id = editingId;
        window.DWBGlobalTokens.save(tokenObj);
        panel.dataset.gtIsEditing = '0';
        panel.dataset.gtEditingId = '';
        _stgRenderGlobalTokens(panel);
      });
      editor.querySelector('#stg-gt-cancel').addEventListener('click', function() {
        panel.dataset.gtIsEditing = '0';
        panel.dataset.gtEditingId = '';
        _stgRenderGlobalTokens(panel);
      });
      setTimeout(function() {
        var el = editor.querySelector('#stg-gt-key');
        if (el) el.focus();
      }, 0);
    }

    /* ── + Add Token button ── */
    if (!isEditing) {
      var newBtn = document.createElement('button');
      newBtn.style.cssText = 'margin:10px 14px;padding:6px 12px;background:none;border:1px solid var(--border);border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;color:var(--text-main);align-self:flex-start';
      newBtn.textContent = '+ Add Token';
      newBtn.addEventListener('click', function() {
        panel.dataset.gtIsEditing = '1';
        panel.dataset.gtEditingId = '';
        _stgRenderGlobalTokens(panel);
      });
      panel.appendChild(newBtn);
    }

    /* ── Wire row action buttons ── */
    panel.querySelectorAll('[data-gt-action]').forEach(function(el) {
      el.addEventListener('click', function() {
        var id     = el.dataset.gtId;
        var action = el.dataset.gtAction;
        if (action === 'edit') {
          panel.dataset.gtIsEditing = '1';
          panel.dataset.gtEditingId = id;
          _stgRenderGlobalTokens(panel);
        } else if (action === 'delete') {
          panel.dataset.gtDeletingId = id;
          _stgRenderGlobalTokens(panel);
        }
      });
    });
  }

  function _stgExportAll() {
    var lists  = window.DWBValidationLists ? window.DWBValidationLists.getAll() : [];
    var tokens = window.DWBGlobalTokens    ? window.DWBGlobalTokens.getAll()    : [];
    var now = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : String(n); };
    var dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var backup = {
      dwbSettingsBackup: '1.0',
      exported: now.toISOString(),
      validationLists: lists,
      globalTokens: tokens
    };
    var data = JSON.stringify(backup, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'dwb-settings-backup-' + dateStr + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function _stgShowImportConfirm(backup) {
    var backupLists  = Array.isArray(backup.validationLists) ? backup.validationLists : [];
    var backupTokens = Array.isArray(backup.globalTokens)    ? backup.globalTokens    : [];
    var curLists  = window.DWBValidationLists ? window.DWBValidationLists.getAll() : [];
    var curTokens = window.DWBGlobalTokens    ? window.DWBGlobalTokens.getAll()    : [];

    var dlg = document.createElement('div');
    dlg.className = 'overlay';
    dlg.style.zIndex = '800';
    dlg.innerHTML =
      '<div class="modal" style="width:420px">' +
        '<div class="modal-header"><span>Import Settings Backup</span><button class="modal-close" id="stg-ic-x">✕</button></div>' +
        '<div style="padding:16px;font-size:13px">' +
          '<div style="margin-bottom:12px">' +
            '<div style="font-weight:600;margin-bottom:4px">This backup contains:</div>' +
            '<div style="font-size:12px;color:var(--text-muted);line-height:1.8">' +
              '&#x2022; ' + backupLists.length + ' validation list' + (backupLists.length !== 1 ? 's' : '') + '<br>' +
              '&#x2022; ' + backupTokens.length + ' global token' + (backupTokens.length !== 1 ? 's' : '') +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:16px">' +
            '<div style="font-weight:600;margin-bottom:4px">You currently have:</div>' +
            '<div style="font-size:12px;color:var(--text-muted);line-height:1.8">' +
              '&#x2022; ' + curLists.length + ' validation list' + (curLists.length !== 1 ? 's' : '') + '<br>' +
              '&#x2022; ' + curTokens.length + ' global token' + (curTokens.length !== 1 ? 's' : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:12px">' +
            '<button id="stg-ic-merge"   class="btn-primary"   style="flex:1">Merge</button>' +
            '<button id="stg-ic-replace" class="btn-secondary" style="flex:1;color:var(--danger);border-color:var(--danger)">Replace All</button>' +
            '<button id="stg-ic-cancel"  class="btn-secondary" style="flex:1">Cancel</button>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-faint);line-height:1.6">' +
            '<strong>Merge:</strong> adds new items; renames lists with duplicate names, skips tokens with duplicate keys.<br>' +
            '<strong>Replace All:</strong> clears your current validation lists and global tokens, then imports everything from the backup.' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);

    function _stgCloseDlg() { document.body.removeChild(dlg); }
    dlg.querySelector('#stg-ic-x').addEventListener('click', _stgCloseDlg);
    dlg.querySelector('#stg-ic-cancel').addEventListener('click', _stgCloseDlg);
    dlg.addEventListener('click', function(e) { if (e.target === dlg) _stgCloseDlg(); });

    dlg.querySelector('#stg-ic-merge').addEventListener('click', function() {
      _stgCloseDlg();
      _stgApplyMerge(backup);
    });
    dlg.querySelector('#stg-ic-replace').addEventListener('click', function() {
      _stgCloseDlg();
      _stgApplyReplace(backup);
    });
  }

  function _stgApplyMerge(backup) {
    var backupLists  = Array.isArray(backup.validationLists) ? backup.validationLists : [];
    var backupTokens = Array.isArray(backup.globalTokens)    ? backup.globalTokens    : [];
    var listsAdded = 0, listsCopied = 0, tokensAdded = 0, tokensSkipped = 0;

    if (window.DWBValidationLists) {
      backupLists.forEach(function(list) {
        if (!list.name || !Array.isArray(list.values)) return;
        var allNames = window.DWBValidationLists.getAll().map(function(l) { return l.name; });
        if (allNames.indexOf(list.name) === -1) {
          window.DWBValidationLists.save({ name: list.name, values: list.values });
          listsAdded++;
        } else {
          var base = list.name;
          var copyName = base + ' (copy)';
          var n = 2;
          while (allNames.indexOf(copyName) !== -1) { copyName = base + ' (copy ' + n + ')'; n++; }
          window.DWBValidationLists.save({ name: copyName, values: list.values });
          listsCopied++;
        }
      });
    }

    if (window.DWBGlobalTokens) {
      backupTokens.forEach(function(token) {
        if (!token.key) return;
        if (window.DWBGlobalTokens.get(token.key) === undefined) {
          window.DWBGlobalTokens.save({ key: token.key, value: String(token.value || '') });
          tokensAdded++;
        } else {
          tokensSkipped++;
        }
      });
    }

    var parts = [];
    if (listsAdded)    parts.push(listsAdded    + ' list'  + (listsAdded    !== 1 ? 's' : '') + ' added');
    if (listsCopied)   parts.push(listsCopied   + ' list'  + (listsCopied   !== 1 ? 's' : '') + ' renamed (copy)');
    if (tokensAdded)   parts.push(tokensAdded   + ' token' + (tokensAdded   !== 1 ? 's' : '') + ' added');
    if (tokensSkipped) parts.push(tokensSkipped + ' token' + (tokensSkipped !== 1 ? 's' : '') + ' skipped (already exist)');
    _stgShowToast(parts.length
      ? '✓ Merged: ' + parts.join(', ')
      : '✓ Nothing to import — all items already exist');
    _stgRenderSection();
  }

  function _stgApplyReplace(backup) {
    var backupLists  = Array.isArray(backup.validationLists) ? backup.validationLists : [];
    var backupTokens = Array.isArray(backup.globalTokens)    ? backup.globalTokens    : [];

    if (window.DWBValidationLists) {
      window.DWBValidationLists.getAll().forEach(function(l) { window.DWBValidationLists.remove(l.id); });
    }
    if (window.DWBGlobalTokens) {
      window.DWBGlobalTokens.getAll().forEach(function(t) { window.DWBGlobalTokens.remove(t.id); });
    }

    var listsAdded = 0, tokensAdded = 0;
    if (window.DWBValidationLists) {
      backupLists.forEach(function(list) {
        if (!list.name || !Array.isArray(list.values)) return;
        window.DWBValidationLists.save({ name: list.name, values: list.values });
        listsAdded++;
      });
    }
    if (window.DWBGlobalTokens) {
      backupTokens.forEach(function(token) {
        if (!token.key) return;
        window.DWBGlobalTokens.save({ key: token.key, value: String(token.value || '') });
        tokensAdded++;
      });
    }

    _stgShowToast('✓ Replaced: ' +
      listsAdded  + ' list'  + (listsAdded  !== 1 ? 's' : '') + ' and ' +
      tokensAdded + ' token' + (tokensAdded !== 1 ? 's' : '') + ' imported');
    _stgRenderSection();
  }

  function _stgShowToast(msg) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#15803d;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;z-index:900;box-shadow:0 2px 8px rgba(0,0,0,0.25);transition:opacity 0.35s';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { if (toast.parentNode) document.body.removeChild(toast); }, 380);
    }, 2600);
  }

  function open(section) {
    _stgEnsureModal();
    var panel = document.getElementById('stg-panel');
    if (panel) {
      panel.dataset.isEditing = '0';
      panel.dataset.editingId = '';
      panel.dataset.deletingId = '';
      panel.dataset.importCollision = '';
      panel.dataset.gtIsEditing = '0';
      panel.dataset.gtEditingId = '';
      panel.dataset.gtDeletingId = '';
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

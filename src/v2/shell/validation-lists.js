/* === DWBValidationLists: localStorage-backed validation list storage === */
window.DWBValidationLists = (function() {
  var _cache = null;
  var _KEY = 'dwb2_validation_lists';

  function _load() {
    if (_cache !== null) return _cache;
    try {
      var raw = localStorage.getItem(_KEY);
      _cache = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _cache = [];
    }
    return _cache;
  }

  function _write() {
    localStorage.setItem(_KEY, JSON.stringify(_cache));
  }

  function _uuid() {
    return 'vl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function getAll() {
    return _load().slice();
  }

  function get(id) {
    var lists = _load();
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].id === id) return lists[i];
    }
    return null;
  }

  function save(list) {
    _load();
    var now = new Date().toISOString();
    var id = list.id || _uuid();
    var idx = -1;
    for (var i = 0; i < _cache.length; i++) {
      if (_cache[i].id === id) { idx = i; break; }
    }
    if (idx === -1) {
      var newList = {
        id: id,
        name: String(list.name || '').trim(),
        values: Array.isArray(list.values) ? list.values.slice() : [],
        created: list.created || now,
        modified: now
      };
      _cache.push(newList);
      _write();
      return newList;
    }
    _cache[idx] = {
      id: id,
      name: String(list.name || '').trim(),
      values: Array.isArray(list.values) ? list.values.slice() : [],
      created: _cache[idx].created,
      modified: now
    };
    _write();
    return _cache[idx];
  }

  function remove(id) {
    _load();
    _cache = _cache.filter(function(l) { return l.id !== id; });
    _write();
  }

  function exportList(id) {
    var list = get(id);
    if (!list) return;
    var data = JSON.stringify({ name: list.name, values: list.values }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = list.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function importList(jsonString) {
    var parsed;
    try { parsed = JSON.parse(jsonString); } catch (e) { throw new Error('Invalid JSON'); }
    if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.values)) {
      throw new Error('Import file must have "name" (string) and "values" (array)');
    }
    var name = parsed.name.trim();
    if (!name) throw new Error('List name cannot be empty');
    var values = parsed.values.map(function(v) { return String(v); });
    var now = new Date().toISOString();
    var list = { id: _uuid(), name: name, values: values, created: now, modified: now };
    _load();
    _cache.push(list);
    _write();
    return list;
  }

  return { getAll: getAll, get: get, save: save, remove: remove, exportList: exportList, importList: importList };
})();

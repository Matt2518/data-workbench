/* === DWBGlobalTokens: localStorage-backed global token storage === */
window.DWBGlobalTokens = (function() {
  var _cache = null;
  var _KEY = 'dwb2_global_tokens';

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
    return 'gt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function getAll() {
    return _load().slice();
  }

  function get(key) {
    var tokens = _load();
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].key === key) return tokens[i].value;
    }
    return undefined;
  }

  function save(token) {
    _load();
    var now = new Date().toISOString();
    var id = token.id || null;
    var idx = -1;
    if (id) {
      for (var i = 0; i < _cache.length; i++) {
        if (_cache[i].id === id) { idx = i; break; }
      }
    }
    if (idx === -1) {
      var newToken = {
        id: _uuid(),
        key: String(token.key || '').trim(),
        value: String(token.value || ''),
        created: now,
        modified: now
      };
      _cache.push(newToken);
      _write();
      return newToken;
    }
    _cache[idx] = {
      id: _cache[idx].id,
      key: String(token.key || '').trim(),
      value: String(token.value || ''),
      created: _cache[idx].created,
      modified: now
    };
    _write();
    return _cache[idx];
  }

  function remove(id) {
    _load();
    _cache = _cache.filter(function(t) { return t.id !== id; });
    _write();
  }

  function resolve(text) {
    if (!text || typeof text !== 'string') return text;
    var all = _load();
    var map = {};
    all.forEach(function(t) { map[t.key] = t.value; });
    return text.replace(/\{\{(\w+)\}\}/g, function(match, key) {
      return map.hasOwnProperty(key) ? String(map[key]) : match;
    });
  }

  return { getAll: getAll, get: get, save: save, remove: remove, resolve: resolve };
})();

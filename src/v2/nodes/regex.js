/* === DWBNodes.REGEX_VALIDATE / REGEX_EXTRACT === */
window.DWBNodes = window.DWBNodes || {};

window.DWBNodes.REGEX_VALIDATE = {
  label: 'Regex Validate',
  icon: '✅',
  category: 'Validation',
  defaultConfig: { column: '', pattern: '', outputColumn: 'is_valid', invert: false },

  run: function(rows, config) {
    if (!config.column || !config.pattern) return rows;
    let re;
    try { re = new RegExp(config.pattern); } catch (e) { return rows; }
    const out = config.outputColumn || 'is_valid';
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      const v = String(row[config.column] !== undefined ? row[config.column] : '');
      const match = re.test(v);
      nr[out] = config.invert ? !match : match;
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (!config.pattern) return 'Pattern is required';
    try { new RegExp(config.pattern); } catch (e) { return 'Invalid regex: ' + e.message; }
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = currentRows && currentRows.length ? Object.keys(currentRows[0]) : [];
    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="rv-col" style="width:100%"><option value="">-- select --</option>
        ${cols.map(function(c) { return '<option value="' + _rxEsc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _rxEsc(c) + '</option>'; }).join('')}
        </select></div>
      <div class="form-row"><label>Pattern (regex)</label>
        <input type="text" id="rv-pat" value="${_rxEsc(config.pattern||'')}" placeholder="e.g. ^\\d{5}$" style="width:100%;font-family:monospace"></div>
      <div class="form-row"><label>Output column</label>
        <input type="text" id="rv-out" value="${_rxEsc(config.outputColumn||'is_valid')}" style="width:100%"></div>
      <div class="form-row-inline form-row"><label><input type="checkbox" id="rv-inv" ${config.invert ? 'checked' : ''}> Invert result</label></div>`;
    div.querySelector('#rv-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#rv-pat').addEventListener('input', function(e) { onChange('pattern', e.target.value); });
    div.querySelector('#rv-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.querySelector('#rv-inv').addEventListener('change', function(e) { onChange('invert', e.target.checked); });
    return div;
  }
};

window.DWBNodes.REGEX_EXTRACT = {
  label: 'Regex Extract',
  icon: '🔎',
  category: 'Validation',
  defaultConfig: { column: '', pattern: '', captureGroup: 0, outputColumn: 'extracted', noMatchValue: '' },

  run: function(rows, config) {
    if (!config.column || !config.pattern) return rows;
    let re;
    try { re = new RegExp(config.pattern); } catch (e) { return rows; }
    const out = config.outputColumn || 'extracted';
    const grp = parseInt(config.captureGroup || 0, 10);
    const noMatch = config.noMatchValue !== undefined ? config.noMatchValue : '';
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      const v = String(row[config.column] !== undefined ? row[config.column] : '');
      const m = v.match(re);
      nr[out] = m ? (m[grp] !== undefined ? m[grp] : noMatch) : noMatch;
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (!config.pattern) return 'Pattern is required';
    try { new RegExp(config.pattern); } catch (e) { return 'Invalid regex: ' + e.message; }
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = currentRows && currentRows.length ? Object.keys(currentRows[0]) : [];
    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="re-col" style="width:100%"><option value="">-- select --</option>
        ${cols.map(function(c) { return '<option value="' + _rxEsc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _rxEsc(c) + '</option>'; }).join('')}
        </select></div>
      <div class="form-row"><label>Pattern (regex)</label>
        <input type="text" id="re-pat" value="${_rxEsc(config.pattern||'')}" placeholder="e.g. (\\d+)" style="width:100%;font-family:monospace"></div>
      <div class="form-row"><label>Capture group (0 = whole match)</label>
        <input type="number" id="re-grp" value="${_rxEsc(String(config.captureGroup||0))}" min="0" style="width:100%"></div>
      <div class="form-row"><label>Output column</label>
        <input type="text" id="re-out" value="${_rxEsc(config.outputColumn||'extracted')}" style="width:100%"></div>
      <div class="form-row"><label>No-match value</label>
        <input type="text" id="re-nm" value="${_rxEsc(config.noMatchValue||'')}" style="width:100%"></div>`;
    div.querySelector('#re-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#re-pat').addEventListener('input', function(e) { onChange('pattern', e.target.value); });
    div.querySelector('#re-grp').addEventListener('input', function(e) { onChange('captureGroup', parseInt(e.target.value,10)||0); });
    div.querySelector('#re-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.querySelector('#re-nm').addEventListener('input', function(e) { onChange('noMatchValue', e.target.value); });
    return div;
  }
};

function _rxEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

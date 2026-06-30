/* === DWBNodes.FORMULA: computed column via expression === */
window.DWBNodes = window.DWBNodes || {};

window.DWBNodes.FORMULA = {
  label: 'Formula Column',
  icon: '𝑓',
  category: 'Text Cleaning',
  defaultConfig: { outputColumn: 'result', expression: '' },

  run: function(rows, config) {
    const expr = (config.expression || '').trim();
    const out  = (config.outputColumn || 'result').trim();
    if (!expr) return rows;

    // Build a safe evaluator: expose row fields as variables
    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      try {
        // Build variable declarations for each column
        const varDecls = Object.keys(row).map(function(k) {
          const v = row[k];
          const safe = k.replace(/[^a-zA-Z0-9_]/g, '_');
          const valStr = isNaN(Number(v)) ? JSON.stringify(String(v)) : String(Number(v));
          return 'var ' + safe + ' = ' + valStr + ';';
        }).join(' ');

        // Also expose row as _row
        const rowJson = JSON.stringify(row);

        /* jshint evil: true */
        nr[out] = (new Function(varDecls + ' var _row = ' + rowJson + '; return (' + expr + ');'))();
      } catch (e) {
        nr[out] = '#ERR:' + e.message;
      }
      return nr;
    });
  },

  validate: function(config) {
    if (!(config.outputColumn || '').trim()) return 'Output column name is required';
    if (!(config.expression || '').trim()) return 'Expression is required';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = currentRows && currentRows.length ? Object.keys(currentRows[0]) : [];

    div.innerHTML = `
      <div class="form-row">
        <label>Output Column Name</label>
        <input type="text" id="fm-out" value="${_fmEsc(config.outputColumn||'result')}" style="width:100%" placeholder="result">
      </div>
      <div class="form-row">
        <label>Expression</label>
        <textarea id="fm-expr" style="width:100%;height:80px;font-family:monospace;font-size:12px;resize:vertical" placeholder="e.g. col1 + ' ' + col2">${_fmEsc(config.expression||'')}</textarea>
      </div>
      ${cols.length ? '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Available columns: ' + cols.map(_fmEsc).join(', ') + '</div>' : ''}
      <div style="font-size:11px;color:var(--text-muted);line-height:1.5">
        Use column names as variables. Examples:<br>
        <code>price * quantity</code><br>
        <code>firstName + ' ' + lastName</code><br>
        <code>parseFloat(score) > 90 ? 'Pass' : 'Fail'</code>
      </div>`;

    div.querySelector('#fm-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.querySelector('#fm-expr').addEventListener('input', function(e) { onChange('expression', e.target.value); });
    return div;
  }
};

function _fmEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

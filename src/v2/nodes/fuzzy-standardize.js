/* === DWBNodes.FUZZY_STANDARDIZE: map variants to canonical values === */
window.DWBNodes = window.DWBNodes || {};

window.DWBNodes.FUZZY_STANDARDIZE = {
  label: 'Fuzzy Standardize',
  icon: '🔤',
  category: 'Validation',
  defaultConfig: { column: '', mappings: [], threshold: 80, outputColumn: '', addScoreColumn: false },

  run: function(rows, config) {
    if (!config.column) return rows;
    const mappings = config.mappings || [];
    if (mappings.length === 0) return rows;
    const outCol = (config.outputColumn || '').trim() || config.column;
    const threshold = config.threshold !== undefined ? config.threshold : 80;

    return rows.map(function(row) {
      const nr = Object.assign({}, row);
      const val = String(row[config.column] !== undefined ? row[config.column] : '').toLowerCase().trim();
      let bestScore = 0;
      let bestCanonical = row[config.column];

      mappings.forEach(function(mapping) {
        const canonical = mapping.canonical || '';
        const variants = (mapping.variants || []);
        // Check exact match first
        if (val === canonical.toLowerCase()) { bestScore = 100; bestCanonical = canonical; return; }
        variants.forEach(function(variant) {
          if (val === variant.toLowerCase().trim()) { bestScore = 100; bestCanonical = canonical; return; }
          const score = _fsLevenshteinSim(val, variant.toLowerCase().trim());
          if (score > bestScore) { bestScore = score; bestCanonical = canonical; }
        });
        // Also check canonical itself with fuzzy
        const cScore = _fsLevenshteinSim(val, canonical.toLowerCase());
        if (cScore > bestScore) { bestScore = cScore; bestCanonical = canonical; }
      });

      nr[outCol] = bestScore >= threshold ? bestCanonical : row[config.column];
      if (config.addScoreColumn) nr[outCol + '_score'] = bestScore;
      return nr;
    });
  },

  validate: function(config) {
    if (!config.column) return 'Select a column';
    if (!config.mappings || config.mappings.length === 0) return 'Add at least one mapping';
    return null;
  },

  configUI: function(config, onChange, currentRows) {
    const div = document.createElement('div');
    const cols = currentRows && currentRows.length ? Object.keys(currentRows[0]) : [];
    const mappings = config.mappings || [];

    function renderMappings() {
      const container = div.querySelector('#fs-mappings');
      if (!container) return;
      if (mappings.length === 0) {
        container.innerHTML = '<div style="color:var(--text-faint);font-size:11px;padding:6px 0">No mappings yet.</div>';
        return;
      }
      container.innerHTML = mappings.map(function(m, idx) {
        return `<div style="border:1px solid var(--border);border-radius:4px;padding:8px;margin-bottom:6px;font-size:11px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <strong style="flex:1">Canonical:</strong>
            <input type="text" class="fs-canonical" data-idx="${idx}" value="${_fsEsc(m.canonical||'')}" placeholder="Standard value" style="flex:2;padding:2px 6px;font-size:11px">
            <button class="fs-del-mapping" data-idx="${idx}" style="padding:1px 6px;font-size:11px;background:none;border:1px solid var(--border);border-radius:3px;color:var(--danger)">✕</button>
          </div>
          <div><label style="font-size:10px;color:var(--text-muted)">Variants (one per line):</label></div>
          <textarea class="fs-variants" data-idx="${idx}" style="width:100%;height:60px;font-size:11px;resize:vertical" placeholder="variant1&#10;variant2">${_fsEsc((m.variants||[]).join('\n'))}</textarea>
        </div>`;
      }).join('');

      container.querySelectorAll('.fs-canonical').forEach(function(inp) {
        inp.addEventListener('input', function() {
          mappings[parseInt(inp.dataset.idx,10)].canonical = inp.value;
          onChange('mappings', mappings.slice());
        });
      });
      container.querySelectorAll('.fs-variants').forEach(function(ta) {
        ta.addEventListener('input', function() {
          mappings[parseInt(ta.dataset.idx,10)].variants = ta.value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
          onChange('mappings', mappings.slice());
        });
      });
      container.querySelectorAll('.fs-del-mapping').forEach(function(btn) {
        btn.addEventListener('click', function() {
          mappings.splice(parseInt(btn.dataset.idx,10), 1);
          onChange('mappings', mappings.slice());
          renderMappings();
        });
      });
    }

    div.innerHTML = `
      <div class="form-row"><label>Column</label>
        <select id="fs-col" style="width:100%"><option value="">-- select --</option>
        ${cols.map(function(c) { return '<option value="' + _fsEsc(c) + '"' + (config.column === c ? ' selected' : '') + '>' + _fsEsc(c) + '</option>'; }).join('')}
        </select></div>
      <div class="form-row"><label>Output column (blank = overwrite)</label>
        <input type="text" id="fs-out" value="${_fsEsc(config.outputColumn||'')}" style="width:100%"></div>
      <div class="form-row"><label>Match threshold (0–100)</label>
        <input type="number" id="fs-thresh" value="${config.threshold !== undefined ? config.threshold : 80}" min="0" max="100" style="width:100%"></div>
      <div class="form-row-inline form-row"><label><input type="checkbox" id="fs-score" ${config.addScoreColumn ? 'checked' : ''}> Add score column</label></div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:8px 0 4px">Mappings</div>
      <div id="fs-mappings"></div>
      <button id="fs-add-mapping" style="padding:4px 10px;font-size:11px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;color:var(--text-main);cursor:pointer">＋ Add Mapping</button>`;

    div.querySelector('#fs-col').addEventListener('change', function(e) { onChange('column', e.target.value); });
    div.querySelector('#fs-out').addEventListener('input', function(e) { onChange('outputColumn', e.target.value); });
    div.querySelector('#fs-thresh').addEventListener('input', function(e) { onChange('threshold', parseInt(e.target.value,10)||80); });
    div.querySelector('#fs-score').addEventListener('change', function(e) { onChange('addScoreColumn', e.target.checked); });
    div.querySelector('#fs-add-mapping').addEventListener('click', function() {
      mappings.push({ canonical: '', variants: [] });
      onChange('mappings', mappings.slice());
      renderMappings();
    });

    renderMappings();
    return div;
  }
};

function _fsLevenshteinSim(a, b) {
  if (a === b) return 100;
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  const dist = dp[m][n];
  return Math.round((1 - dist / Math.max(m, n)) * 100);
}

function _fsEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

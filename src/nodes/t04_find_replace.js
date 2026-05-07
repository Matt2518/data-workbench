DWB.register('FIND_REPLACE', {
  title: 'Find & Replace',
  icon: '🔍',
  category: 'Transform',
  desc: 'Find and replace text values across one or more columns.',
  implemented: true,
  defaultConfig: {
    colIndices: 'all',
    rules: [{ find: '', replace: '' }],
    caseSensitive: false,
    wholeCell: false,
    useRegex: false
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg = node.config;
    if (cfg.colIndices === 'all') cfg.colIndices = prevData.headers.map((_, i) => i);

    function renderRules() {
      return cfg.rules.map((rule, ri) => `
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:4px;align-items:center;
                    padding:4px 0;border-bottom:1px solid var(--border)">
          <input type="text" data-ri="${ri}" data-field="find"
            value="${(rule.find||'').replace(/"/g,'&quot;')}"
            placeholder="Find…" style="font-size:12px">
          <input type="text" data-ri="${ri}" data-field="replace"
            value="${(rule.replace||'').replace(/"/g,'&quot;')}"
            placeholder="Replace with…" style="font-size:12px">
          <button data-remove="${ri}"
            style="padding:2px 6px;background:none;border:1px solid var(--border);border-radius:3px;
                   cursor:pointer;font-size:13px;color:var(--text-muted)">✕</button>
        </div>`
      ).join('');
    }

    const checks = prevData.headers.map((h, i) => {
      const checked = cfg.colIndices.includes(i);
      return `<label style="display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;cursor:pointer">
        <input type="checkbox" data-idx="${i}" ${checked ? 'checked' : ''}> ${h}
      </label>`;
    }).join('');

    const status = node.status === 'ok' && node._stats != null
      ? `<div style="font-size:12px;color:var(--success)">✓ ${node._stats} replacement(s) made</div>`
      : node.status === 'error'
        ? `<div style="font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Columns</div>
          <div id="fr-cols-${node.id}" style="max-height:100px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
            ${checks}
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted)">Rules</div>
            <button id="fr-add-${node.id}" style="font-size:11px;padding:2px 8px;background:var(--accent);color:#fff;border:none;border-radius:3px;cursor:pointer">+ Add rule</button>
          </div>
          <div id="fr-rules-${node.id}">${renderRules()}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="fr-cs-${node.id}" ${cfg.caseSensitive?'checked':''}> Case sensitive
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="fr-wc-${node.id}" ${cfg.wholeCell?'checked':''}> Whole cell only
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="fr-rx-${node.id}" ${cfg.useRegex?'checked':''}> Use regex
          </label>
        </div>
        <button id="fr-run-${node.id}"
          style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">
          🔍 Apply
        </button>
        ${status}
      </div>`;

    // Column checkboxes
    document.getElementById(`fr-cols-${node.id}`).addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.colIndices.includes(idx)) cfg.colIndices.push(idx); }
      else { cfg.colIndices = cfg.colIndices.filter(i => i !== idx); }
    });

    // Rules: oninput updates config only
    document.getElementById(`fr-rules-${node.id}`).addEventListener('input', e => {
      const ri = parseInt(e.target.dataset.ri, 10);
      if (isNaN(ri)) return;
      cfg.rules[ri][e.target.dataset.field] = e.target.value;
    });

    // Rules: remove button
    document.getElementById(`fr-rules-${node.id}`).addEventListener('click', e => {
      const ri = e.target.dataset.remove;
      if (ri === undefined) return;
      cfg.rules.splice(parseInt(ri, 10), 1);
      if (cfg.rules.length === 0) cfg.rules.push({ find: '', replace: '' });
      DWB.renderActiveNode(); DWB.runFrom(node.id);
    });

    // Add rule
    document.getElementById(`fr-add-${node.id}`).addEventListener('click', () => {
      cfg.rules.push({ find: '', replace: '' });
      DWB.renderActiveNode();
    });

    // Options
    document.getElementById(`fr-cs-${node.id}`).addEventListener('change', e => { cfg.caseSensitive = e.target.checked; });
    document.getElementById(`fr-wc-${node.id}`).addEventListener('change', e => { cfg.wholeCell = e.target.checked; });
    document.getElementById(`fr-rx-${node.id}`).addEventListener('change', e => { cfg.useRegex = e.target.checked; });

    // Apply
    document.getElementById(`fr-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { colIndices, rules, caseSensitive, wholeCell, useRegex } = node.config;
    const idxSet = new Set(Array.isArray(colIndices) ? colIndices : inputData.headers.map((_, i) => i));
    const activeRules = rules.filter(r => r.find !== '');
    let total = 0;

    const flags = 'g' + (caseSensitive ? '' : 'i');

    const out = DWB.passthroughCopy(inputData);
    out.rows = inputData.rows.map(r => r.map((cell, ci) => {
      if (!idxSet.has(ci)) return cell;
      let val = String(cell ?? '');

      for (const rule of activeRules) {
        const { find, replace } = rule;
        if (useRegex) {
          let rx;
          try { rx = new RegExp(find, flags); } catch { continue; }
          if (wholeCell) {
            const fullMatch = new RegExp('^(?:' + find + ')$', flags.replace('g',''));
            if (fullMatch.test(val)) { val = val.replace(rx, replace); total++; }
          } else {
            const before = val;
            val = val.replace(rx, replace);
            if (val !== before) total++;
          }
        } else {
          const cFind = caseSensitive ? find : find.toLowerCase();
          if (wholeCell) {
            const cVal = caseSensitive ? val : val.toLowerCase();
            if (cVal === cFind) { val = replace; total++; }
          } else {
            const cVal = caseSensitive ? val : val.toLowerCase();
            if (cVal.includes(cFind)) {
              const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              val = val.replace(new RegExp(escaped, flags), replace);
              total++;
            }
          }
        }
      }
      return val;
    }));

    node._stats = total;
    node.output = out;
    DWB.log(`Find & Replace: ${total} replacement(s) across ${idxSet.size} column(s)`);
  }
});

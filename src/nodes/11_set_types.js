const LIKERT_TEMPLATES = {
  numeric_5:    { label: '1–5 Scale',        scale: ['1','2','3','4','5'],                                                                     midpoint: 2, positiveEnd: 'high' },
  agree_5:      { label: 'Agreement (5)',     scale: ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'],                       midpoint: 2, positiveEnd: 'high' },
  satisfy_5:    { label: 'Satisfaction (5)',  scale: ['Very Dissatisfied','Dissatisfied','Neutral','Satisfied','Very Satisfied'],               midpoint: 2, positiveEnd: 'high' },
  always_never: { label: 'Frequency (5)',     scale: ['Never','Rarely','Sometimes','Often','Always'],                                          midpoint: 2, positiveEnd: 'high' },
  numeric_4:    { label: '1–4 Scale',         scale: ['1','2','3','4'],                                                                       midpoint: -1, positiveEnd: 'high' },
  custom:       { label: 'Custom',            scale: [],                                                                                      midpoint: -1, positiveEnd: 'high' }
};

const TYPE_COLORS = {
  number:      'var(--info)',
  date:        'var(--success)',
  categorical: '#7c3aed',
  likert:      'var(--accent-gold)',
  text:        'var(--text-faint)'
};

function _stAutoTemplate(data, ci) {
  const unique = new Set(data.rows.map(r => String(r[ci] ?? '')).filter(v => v !== ''));
  for (const [key, tmpl] of Object.entries(LIKERT_TEMPLATES)) {
    if (key === 'custom' || !tmpl.scale.length) continue;
    const tmplLower = new Set(tmpl.scale.map(s => s.toLowerCase()));
    if ([...unique].every(v => tmplLower.has(v.toLowerCase())) && unique.size <= tmpl.scale.length) return key;
  }
  return null;
}

DWB.register('SET_TYPES', {
  title: 'Set Column Types',
  icon: '🏷️',
  category: 'Column Operations',
  desc: 'Override inferred column types and configure Likert scale metadata.',
  implemented: true,
  defaultConfig: { overrides: {}, likertMeta: {} },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');
    if (!prevData) {
      body.innerHTML = `<div class="config-empty">No upstream data. Connect a source node first.</div>`;
      return;
    }

    const cfg       = node.config;
    const baseTypes = prevData.columnTypes || DWB.inferTypes(prevData);

    const rows = prevData.headers.map((h, ci) => {
      const inferred = baseTypes[ci] || 'text';
      const override = cfg.overrides[ci] || '';
      const active   = override || inferred;
      const meta     = cfg.likertMeta[ci] || {};

      // Sample values
      const allVals = prevData.rows.map(r => String(r[ci] ?? '')).filter(v => v !== '');
      const unique  = [...new Set(allVals)];
      const sample  = unique.slice(0, 5).map(v => v.length > 12 ? v.slice(0, 12) + '…' : v).join(', ');
      const sampleTitle = unique.join(', ');

      // Type dropdown — Auto shows inferred type in label
      const typeOpts = [
        `<option value=""${!override ? ' selected' : ''}>Auto (${inferred})</option>`,
        `<option disabled>────</option>`,
        `<option value="text"${override === 'text' ? ' selected' : ''}>Text</option>`,
        `<option value="number"${override === 'number' ? ' selected' : ''}>Number</option>`,
        `<option value="date"${override === 'date' ? ' selected' : ''}>Date</option>`,
        `<option value="categorical"${override === 'categorical' ? ' selected' : ''}>Categorical</option>`,
        `<option value="likert"${override === 'likert' ? ' selected' : ''}>Likert</option>`,
      ].join('');

      const dotColor = TYPE_COLORS[active] || 'var(--text-faint)';
      const hSafe    = h.replace(/"/g, '&quot;');
      const hDisplay = h.length > 20 ? h.slice(0, 20) + '…' : h;

      let likertSection = '';
      if (active === 'likert') {
        const autoKey = _stAutoTemplate(prevData, ci);
        const tmplKey = meta.template || autoKey || 'custom';
        const tmpl    = LIKERT_TEMPLATES[tmplKey] || LIKERT_TEMPLATES.custom;
        const scale   = meta.scale && meta.scale.length ? meta.scale : [...tmpl.scale];
        const displayLabels = meta.displayLabels || {};
        const midpoint = meta.midpoint !== undefined ? meta.midpoint : tmpl.midpoint;

        const tmplOpts = Object.entries(LIKERT_TEMPLATES).map(([k, t]) =>
          `<option value="${k}"${k === tmplKey ? ' selected' : ''}>${t.label}</option>`
        ).join('');

        const scaleItems = scale.map((v, si) => {
          const dispLabel = (displayLabels[v] || '').replace(/"/g, '&quot;');
          const canUp = si > 0, canDown = si < scale.length - 1;
          return `
            <div style="display:flex;gap:4px;align-items:center;margin-bottom:3px">
              <button class="st-ord-btn" data-ci="${ci}" data-si="${si}" data-dir="up"
                ${!canUp ? 'disabled' : ''}
                style="padding:1px 5px;font-size:10px;border:1px solid var(--border);border-radius:3px;
                       background:transparent;color:${canUp ? 'var(--text-muted)' : 'var(--text-faint)'};
                       cursor:${canUp ? 'pointer' : 'default'}">↑</button>
              <button class="st-ord-btn" data-ci="${ci}" data-si="${si}" data-dir="down"
                ${!canDown ? 'disabled' : ''}
                style="padding:1px 5px;font-size:10px;border:1px solid var(--border);border-radius:3px;
                       background:transparent;color:${canDown ? 'var(--text-muted)' : 'var(--text-faint)'};
                       cursor:${canDown ? 'pointer' : 'default'}">↓</button>
              <span style="font-size:11px;min-width:60px;color:var(--text-main)">${v}</span>
              <span style="font-size:10px;color:var(--text-faint);margin:0 2px">→</span>
              <input type="text" class="st-lbl-inp"
                data-ci="${ci}" data-si="${si}" data-val="${v.replace(/"/g,'&quot;')}"
                value="${dispLabel}" placeholder="Display label…"
                style="flex:1;font-size:11px;padding:2px 5px">
            </div>`;
        }).join('');

        const midOpts = [
          `<option value="-1"${midpoint === -1 ? ' selected' : ''}>None</option>`,
          ...scale.map((v, i) => `<option value="${i}"${i === midpoint ? ' selected' : ''}>${v}</option>`)
        ].join('');

        const dataUnique = new Set(prevData.rows.map(r => String(r[ci] ?? '')).filter(v => v !== ''));
        const scaleSet   = new Set(scale);
        const missing    = [...dataUnique].filter(v => !scaleSet.has(v));
        const warnHtml   = missing.length
          ? `<div style="margin-top:4px;font-size:10px;color:var(--warning)">⚠ Values not in scale: ${missing.slice(0,3).map(v => `"${v}"`).join(', ')}${missing.length > 3 ? ` +${missing.length - 3} more` : ''}</div>`
          : '';

        likertSection = `
          <div style="background:var(--bg-raised);border-radius:4px;padding:8px;margin:2px 0 6px 24px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);white-space:nowrap">Template:</label>
              <select id="st-tmpl-${node.id}-${ci}" style="flex:1;font-size:11px">${tmplOpts}</select>
            </div>
            <div style="font-size:10px;font-weight:700;color:var(--text-faint);text-transform:uppercase;
                        letter-spacing:0.06em;margin-bottom:4px">Scale Order → Display Label</div>
            <div>${scaleItems}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);white-space:nowrap">Midpoint:</label>
              <select id="st-mid-${node.id}-${ci}" style="flex:1;font-size:11px">${midOpts}</select>
            </div>
            ${warnHtml}
          </div>`;
      }

      return `
        <div style="display:grid;grid-template-columns:24px minmax(0,1fr) minmax(0,1fr) 150px;
                    gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-faint);text-align:right">${ci}</div>
          <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
               title="${hSafe}">${hDisplay}</div>
          <div style="font-size:10px;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
               title="${sampleTitle.replace(/"/g,'&quot;')}">${sample || '—'}</div>
          <div style="display:flex;align-items:center;gap:5px">
            <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                         background:${dotColor};display:inline-block"></span>
            <select id="st-type-${node.id}-${ci}" data-ci="${ci}"
              style="flex:1;font-size:11px">${typeOpts}</select>
          </div>
        </div>
        ${likertSection}`;
    }).join('');

    const status = (node.output && node.status === 'ok')
      ? `<div style="margin-top:6px;font-size:12px;color:var(--success)">✓ Types applied to ${prevData.headers.length} columns</div>`
      : node.status === 'error'
        ? `<div style="margin-top:6px;font-size:11px;color:var(--danger)">${node.errorMsg}</div>`
        : '';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column">
        <div style="display:grid;grid-template-columns:24px minmax(0,1fr) minmax(0,1fr) 150px;
                    gap:6px;font-size:10px;font-weight:700;color:var(--text-faint);text-transform:uppercase;
                    letter-spacing:0.06em;padding:0 0 4px;border-bottom:2px solid var(--border-strong)">
          <span>#</span><span>Column</span><span>Sample Values</span><span style="padding-left:13px">Type</span>
        </div>
        <div style="overflow-y:auto">${rows}</div>
        ${status}
        <button id="st-run-${node.id}"
          style="margin-top:8px;padding:6px 14px;background:var(--accent);color:#fff;
                 border:none;border-radius:4px;font-size:12px;cursor:pointer">
          🏷️ Apply Types
        </button>
      </div>`;

    // Type override dropdowns
    prevData.headers.forEach((_, ci) => {
      const sel = document.getElementById(`st-type-${node.id}-${ci}`);
      if (!sel) return;
      sel.addEventListener('change', e => {
        const val = e.target.value;
        if (val) cfg.overrides[ci] = val;
        else delete cfg.overrides[ci];
        if (val !== 'likert') delete cfg.likertMeta[ci];
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });

      const activeType = cfg.overrides[ci] || baseTypes[ci] || 'text';
      if (activeType !== 'likert') return;

      // Template picker
      const tmplSel = document.getElementById(`st-tmpl-${node.id}-${ci}`);
      if (tmplSel) {
        tmplSel.addEventListener('change', e => {
          const key  = e.target.value;
          const tmpl = LIKERT_TEMPLATES[key];
          cfg.likertMeta[ci] = {
            template: key,
            scale: tmpl.scale.length ? [...tmpl.scale] : (cfg.likertMeta[ci]?.scale || []),
            displayLabels: {},
            midpoint: tmpl.midpoint,
            positiveEnd: tmpl.positiveEnd
          };
          DWB.runFrom(node.id); DWB.renderActiveNode();
        });
      }

      // Midpoint — updates config without re-render
      const midSel = document.getElementById(`st-mid-${node.id}-${ci}`);
      if (midSel) {
        midSel.addEventListener('change', e => {
          if (!cfg.likertMeta[ci]) cfg.likertMeta[ci] = {};
          cfg.likertMeta[ci].midpoint = parseInt(e.target.value, 10);
        });
      }
    });

    // Scale reorder buttons — direct listeners on each newly created element
    body.querySelectorAll('.st-ord-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ci   = parseInt(btn.dataset.ci, 10);
        const si   = parseInt(btn.dataset.si, 10);
        const dir  = btn.dataset.dir;
        const meta = cfg.likertMeta[ci];
        if (!meta?.scale) return;
        const swap = dir === 'up' ? si - 1 : si + 1;
        if (swap < 0 || swap >= meta.scale.length) return;
        [meta.scale[si], meta.scale[swap]] = [meta.scale[swap], meta.scale[si]];
        DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    });

    // Display label inputs — update config without re-render
    body.querySelectorAll('.st-lbl-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        const ci  = parseInt(inp.dataset.ci, 10);
        const val = inp.dataset.val;
        if (!cfg.likertMeta[ci]) cfg.likertMeta[ci] = {};
        if (!cfg.likertMeta[ci].displayLabels) cfg.likertMeta[ci].displayLabels = {};
        const label = inp.value.trim();
        if (label) cfg.likertMeta[ci].displayLabels[val] = label;
        else delete cfg.likertMeta[ci].displayLabels[val];
      });
    });

    document.getElementById(`st-run-${node.id}`).addEventListener('click', () => {
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const baseTypes  = inputData.columnTypes || DWB.inferTypes(inputData);
    const overrides  = node.config.overrides  || {};
    const likertMeta = node.config.likertMeta || {};

    const columnTypes    = baseTypes.map((t, i) => overrides[i] || t);
    const columnTypeMeta = {};
    columnTypes.forEach((t, i) => {
      if (t === 'likert' && likertMeta[i]) columnTypeMeta[i] = likertMeta[i];
    });

    const out = DWB.passthroughCopy(inputData);
    out.columnTypes    = columnTypes;
    out.columnTypeMeta = columnTypeMeta;
    node.output = out;

    const n = { number: 0, date: 0, categorical: 0, likert: 0, text: 0 };
    columnTypes.forEach(t => { if (n[t] !== undefined) n[t]++; else n.text++; });
    DWB.log(`Set types: ${n.number} number, ${n.date} date, ${n.categorical} categorical, ${n.likert} likert, ${n.text} text`);
  }
});

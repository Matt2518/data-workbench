/* {{DEFAULT_VALIDATORS}} */

function dvLevenshtein(s1, s2) {
  s1 = String(s1 || '').toLowerCase().trim();
  s2 = String(s2 || '').toLowerCase().trim();
  if (s1 === s2) return 100;
  if (!s1.length || !s2.length) return 0;
  const m = s1.length, n = s2.length;
  const dp = Array.from({length: m + 1}, (_, i) =>
    Array.from({length: n + 1}, (_, j) => i ? (j ? 0 : i) : j));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return Math.round((1 - dp[m][n] / Math.max(m, n)) * 100);
}

function dvBestMatch(val, refValues) {
  let best = '', bestScore = -1;
  for (const ref of refValues) {
    const s = dvLevenshtein(val, ref);
    if (s > bestScore) { bestScore = s; best = ref; }
  }
  return best;
}

DWB.register('DATA_VALIDATION', {
  title: 'Data Validation',
  icon: '✅',
  category: 'Data Analysis',
  desc: 'Validates a column against a list of acceptable values, with fuzzy-matched resolution suggestions and persistent resolution memory.',
  implemented: true,

  defaultConfig: {
    targetColIndex: 0,
    referenceKey: null,
    referenceSource: null,
    referenceValues: [],
    uploadedLists: {},
    resolutions: {}
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = '<div class="config-empty">No upstream data. Connect a source node first.</div>';
      return;
    }

    const cfg = node.config;
    const id  = node.id;
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const stepLabel = (n, text) =>
      `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:5px">Step ${n} — ${text}</div>`;
    const fieldLabel = text =>
      `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:3px">${text}</div>`;

    // ── Step 1: Column to Validate ────────────────────────────────────────
    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i === cfg.targetColIndex ? ' selected' : ''}>${esc(h)}</option>`
    ).join('');

    const step1 = `
      <div>
        ${stepLabel(1, 'Column to Validate')}
        <select id="dv-col-${id}" style="width:100%">${colOpts}</select>
      </div>`;

    // ── Step 2: Reference List Source ─────────────────────────────────────
    const builtinKeys = Object.keys(DEFAULT_VALIDATORS);
    const builtinOpts = [
      `<option value="">-- Select a list --</option>`,
      ...builtinKeys.map(k =>
        `<option value="${esc(k)}"${cfg.referenceSource === 'builtin' && cfg.referenceKey === k ? ' selected' : ''}>${esc(k)}</option>`)
    ].join('');

    const uploadedKeys = Object.keys(cfg.uploadedLists || {});
    let uploadedBody;
    if (uploadedKeys.length) {
      const uploadedOpts = [
        `<option value="">-- Select a list --</option>`,
        ...uploadedKeys.map(k =>
          `<option value="${esc(k)}"${cfg.referenceSource === 'uploaded' && cfg.referenceKey === k ? ' selected' : ''}>${esc(k)}</option>`)
      ].join('');
      uploadedBody = `<select id="dv-uploaded-${id}" style="width:100%">${uploadedOpts}</select>`;
    } else {
      uploadedBody = `<div style="font-size:11px;color:var(--text-faint);padding:3px 0">No uploaded lists yet.</div>`;
    }

    const activeInfo = cfg.referenceKey
      ? `<div style="font-size:11px;color:var(--text-faint);margin-top:6px">Active list: <strong>${esc(cfg.referenceKey)}</strong> (${cfg.referenceValues.length} values)</div>`
      : '';

    const runBtn = `<button id="dv-run-${id}" class="btn-primary" style="margin-top:8px;width:100%"${cfg.referenceValues.length > 0 ? '' : ' disabled'}>Run Validation →</button>`;

    const step2 = `
      <div>
        ${stepLabel(2, 'Reference List Source')}
        <div style="display:flex;flex-direction:column;gap:8px;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-raised)">
          <div>
            ${fieldLabel('Built-in Lists')}
            <select id="dv-builtin-${id}" style="width:100%">${builtinOpts}</select>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:8px">
            ${fieldLabel('Uploaded Lists (This Workflow)')}
            ${uploadedBody}
          </div>
          <div style="border-top:1px solid var(--border);padding-top:8px">
            ${fieldLabel('Upload New List')}
            <label style="display:inline-block;padding:4px 12px;background:var(--accent);color:#fff;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit">
              Browse…
              <input type="file" id="dv-upload-${id}" accept=".txt,.csv" style="display:none">
            </label>
            <span style="font-size:11px;color:var(--text-faint);margin-left:8px">.txt or .csv, one value per line</span>
          </div>
        </div>
        ${activeInfo}
        ${runBtn}
      </div>`;

    // ── Step 3: Validation Results ─────────────────────────────────────────
    let step3;

    if (!cfg.referenceValues || !cfg.referenceValues.length) {
      step3 = `
        <div>
          ${stepLabel(3, 'Validation Results')}
          <div style="padding:8px 10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;font-size:12px;color:var(--text-muted)">
            Select a reference list to begin.
          </div>
        </div>`;
    } else {
      const colIdx = cfg.targetColIndex;
      const refSet = new Set(cfg.referenceValues.map(v => String(v)));
      const invalidCounts = {};
      for (const row of prevData.rows) {
        const val = String(row[colIdx] ?? '');
        if (!refSet.has(val)) {
          invalidCounts[val] = (invalidCounts[val] || 0) + 1;
        }
      }
      const invalidEntries = Object.entries(invalidCounts).sort(([, a], [, b]) => b - a);

      if (!invalidEntries.length) {
        step3 = `
          <div>
            ${stepLabel(3, 'Validation Results')}
            <div style="padding:8px 10px;background:rgba(34,197,94,0.08);border:1px solid var(--success);border-radius:4px;font-size:12px;color:var(--success)">
              All values are valid ✅
            </div>
          </div>`;
      } else {
        // Pre-compute best matches and auto-populate new resolutions
        const bestMatches = {};
        let newResolutionsAdded = 0;
        for (const [val] of invalidEntries) {
          const best = dvBestMatch(val, cfg.referenceValues);
          bestMatches[val] = best;
          if (!(val in cfg.resolutions)) {
            cfg.resolutions[val] = best;
            newResolutionsAdded++;
          }
        }

        const totalOccurrences = invalidEntries.reduce((s, [, c]) => s + c, 0);

        const tableRows = invalidEntries.map(([val, count]) => {
          const bestMatch   = bestMatches[val];
          const currentRes  = cfg.resolutions[val] ?? '';
          const refOpts = [
            `<option value="">-- Do Not Replace --</option>`,
            ...cfg.referenceValues.map(ref => {
              const label = ref === bestMatch ? `${esc(ref)} (Best Match)` : esc(ref);
              return `<option value="${esc(ref)}"${currentRes === ref ? ' selected' : ''}>${label}</option>`;
            })
          ].join('');
          return `
            <tr>
              <td style="padding:5px 8px;font-size:12px;word-break:break-all;border-bottom:1px solid var(--border)">${esc(val)}</td>
              <td style="padding:5px 8px;font-size:12px;text-align:center;color:var(--text-muted);border-bottom:1px solid var(--border)">${count}</td>
              <td style="padding:4px 6px;border-bottom:1px solid var(--border)">
                <select class="dv-resolution" data-val="${esc(val)}" style="width:100%;font-size:12px">${refOpts}</select>
              </td>
            </tr>`;
        }).join('');

        step3 = `
          <div>
            ${stepLabel(3, 'Validation Results')}
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">
              ${invalidEntries.length} invalid value${invalidEntries.length !== 1 ? 's' : ''} · ${totalOccurrences} occurrence${totalOccurrences !== 1 ? 's' : ''} total
            </div>
            <div id="dv-res-table-${id}" style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="background:var(--bg-raised)">
                    <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);border-bottom:1px solid var(--border)">Invalid Value</th>
                    <th style="padding:5px 8px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);border-bottom:1px solid var(--border)">Occurrences</th>
                    <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);border-bottom:1px solid var(--border)">Resolution</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
          </div>`;

        if (newResolutionsAdded > 0) {
          setTimeout(() => DWB.runFrom(node.id), 0);
        }
      }
    }

    // ── Compose ───────────────────────────────────────────────────────────
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${step1}
        ${step2}
        ${step3}
      </div>`;

    // ── Event Listeners ───────────────────────────────────────────────────

    document.getElementById(`dv-col-${id}`).addEventListener('change', e => {
      cfg.targetColIndex = parseInt(e.target.value, 10);
      cfg.resolutions = {};
      DWB.runFrom(node.id);
    });

    document.getElementById(`dv-builtin-${id}`).addEventListener('change', e => {
      const key = e.target.value;
      if (!key) return;
      cfg.referenceKey    = key;
      cfg.referenceSource = 'builtin';
      cfg.referenceValues = DEFAULT_VALIDATORS[key] || [];
      cfg.resolutions     = {};
    });

    const uploadedSel = document.getElementById(`dv-uploaded-${id}`);
    if (uploadedSel) {
      uploadedSel.addEventListener('change', e => {
        const key = e.target.value;
        if (!key) return;
        cfg.referenceKey    = key;
        cfg.referenceSource = 'uploaded';
        cfg.referenceValues = (cfg.uploadedLists || {})[key] || [];
        cfg.resolutions     = {};
      });
    }

    document.getElementById(`dv-run-${id}`).addEventListener('click', () => {
      DWB.runFrom(node.id);
    });

    document.getElementById(`dv-upload-${id}`).addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const name  = file.name.replace(/\.[^.]+$/, '');
        if (!cfg.uploadedLists) cfg.uploadedLists = {};
        cfg.uploadedLists[name] = lines;
        cfg.referenceKey        = name;
        cfg.referenceSource     = 'uploaded';
        cfg.referenceValues     = lines;
        cfg.resolutions         = {};
        DWB.runFrom(node.id);
      };
      reader.readAsText(file);
    });

    const resTable = document.getElementById(`dv-res-table-${id}`);
    if (resTable) {
      resTable.addEventListener('change', e => {
        const sel = e.target.closest('.dv-resolution');
        if (!sel) return;
        cfg.resolutions[sel.dataset.val] = sel.value;
        DWB.runFrom(node.id);
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const cfg = node.config;

    if (!cfg.referenceValues || !cfg.referenceValues.length || cfg.targetColIndex >= inputData.headers.length) {
      node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
      return;
    }

    const colIdx     = cfg.targetColIndex;
    const resolutions = cfg.resolutions || {};

    const newRows = inputData.rows.map(row => {
      const newRow = [...row];
      const val    = String(row[colIdx] ?? '');
      if (val in resolutions && resolutions[val] !== '') {
        newRow[colIdx] = resolutions[val];
      }
      return newRow;
    });

    node.output = { headers: [...inputData.headers], rows: newRows };
  }
});

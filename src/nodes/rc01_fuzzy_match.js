// ─── Similarity algorithms ──────────────────────────────────────────────────

function levenshtein(s1, s2) {
  s1 = String(s1 || '').toLowerCase().trim();
  s2 = String(s2 || '').toLowerCase().trim();
  if (s1 === s2) return 100;
  if (!s1.length || !s2.length) return 0;
  const m = s1.length, n = s2.length;
  const dp = Array.from({length: m+1}, (_, i) =>
    Array.from({length: n+1}, (_, j) => i ? (j ? 0 : i) : j));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s1[i-1] === s2[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return Math.round((1 - dp[m][n] / Math.max(m, n)) * 100);
}

function bigram(s1, s2) {
  s1 = String(s1 || '').toLowerCase().trim();
  s2 = String(s2 || '').toLowerCase().trim();
  if (s1 === s2) return 100;
  if (s1.length < 2 || s2.length < 2) return 0;
  let matches = 0;
  for (let i = 0; i < s1.length - 1; i++)
    if (s2.includes(s1.substring(i, i+2))) matches++;
  return Math.round((200 * matches) / (s1.length + s2.length - 2));
}

function scoreRow(rowA, rowB, pairs, algorithm) {
  const fn = algorithm === 'bigram' ? bigram : levenshtein;
  const totalWeight = pairs.reduce((a, p) => a + (parseFloat(p.weight) || 0), 0) || 1;
  const fieldScores = pairs.map(p => ({
    colA: p.colA, colB: p.colB,
    score: fn(rowA[p.colA], rowB[p.colB])
  }));
  const weighted = fieldScores.reduce((a, fs, i) =>
    a + fs.score * ((parseFloat(pairs[i].weight) || 0) / totalWeight), 0);
  return { score: Math.round(weighted), fieldScores };
}

// ─── Analysis engine ────────────────────────────────────────────────────────

async function _fmRunAnalysis(config, prevData, onProgress, onComplete, onCancel, abortController, options) {
  options = options || {};
  const tableBData = config.tableBData;
  if (!tableBData || !prevData || !config.matchPairs.length) return;

  const pairs = config.matchPairs;
  const algorithm = config.algorithm;

  // Benchmark
  const sampleA = Math.min(50, prevData.rows.length);
  const sampleB = Math.min(50, tableBData.rows.length);
  const t0 = performance.now();
  for (let i = 0; i < sampleA; i++)
    for (let j = 0; j < sampleB; j++)
      scoreRow(prevData.rows[i], tableBData.rows[j], pairs, algorithm);
  const elapsed = performance.now() - t0;

  const msPerComparison = elapsed / (sampleA * sampleB);
  const totalComparisons = prevData.rows.length * tableBData.rows.length;
  const estimatedMs = msPerComparison * totalComparisons;

  if (estimatedMs > 30000 && !options.confirmed) {
    onProgress({ phase: 'confirm', estimatedMs });
    return;
  }

  // Chunked processing
  const chunkSize = 50;
  const confirmedThresh = config.confirmedThreshold;
  const possibleThresh = config.possibleThreshold;
  const reviewState = Object.assign({}, config.reviewState || {});
  const msPerRow = msPerComparison * tableBData.rows.length;
  let rowsProcessed = 0;

  for (let chunkStart = 0; chunkStart < prevData.rows.length; chunkStart += chunkSize) {
    if (abortController.aborted) { onCancel(); return; }

    const chunkEnd = Math.min(chunkStart + chunkSize, prevData.rows.length);
    for (let ai = chunkStart; ai < chunkEnd; ai++) {
      const existing = reviewState[ai];
      if (existing && (existing.status === 'accepted' || existing.status === 'denied')) continue;

      const rowA = prevData.rows[ai];
      let bestScore = -1, bestBIndex = -1, bestFieldScores = null;
      for (let bi = 0; bi < tableBData.rows.length; bi++) {
        const { score, fieldScores } = scoreRow(rowA, tableBData.rows[bi], pairs, algorithm);
        if (score > bestScore) { bestScore = score; bestBIndex = bi; bestFieldScores = fieldScores; }
      }

      let status;
      if (bestScore >= confirmedThresh) status = 'confirmed';
      else if (bestScore >= possibleThresh) status = 'pending';
      else status = 'nomatch';

      reviewState[ai] = { rowBIndex: bestBIndex, score: bestScore, status, fieldScores: bestFieldScores };
    }

    rowsProcessed = chunkEnd;
    onProgress({
      phase: 'running',
      completed: rowsProcessed,
      total: prevData.rows.length,
      estimatedMsRemaining: (prevData.rows.length - rowsProcessed) * msPerRow
    });
    await new Promise(r => setTimeout(r, 0));
  }

  onComplete(reviewState);
}

// ─── Registration ────────────────────────────────────────────────────────────

DWB.register('FUZZY_MATCH', {
  title: 'Fuzzy Match',
  icon: '🤝',
  category: 'Reconciliation',
  desc: 'Match rows from the pipeline against a reference dataset using fuzzy string comparison. Review and approve matches manually.',
  implemented: true,

  defaultConfig: {
    tableBSource: 'stash',
    tableBStashName: '',
    tableBData: null,
    matchPairs: [],
    algorithm: 'levenshtein',
    confirmedThreshold: 80,
    possibleThreshold: 60,
    columnsToAppend: [],
    columnPrefix: '',
    noMatchBehavior: 'keep',
    analysisRun: false,
    reviewState: {}
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = '<div class="config-empty">No upstream data. Connect a source node first.</div>';
      return;
    }

    const cfg = node.config;
    if (!node._renderPhase) node._renderPhase = 'setup';
    if (node._reviewFilter === undefined) node._reviewFilter = 'pending';
    if (!node._reviewPage) node._reviewPage = 0;
    if (!node._advancedOpen) node._advancedOpen = false;

    const id = node.id;
    const A = prevData.headers;
    const B = cfg.tableBData ? cfg.tableBData.headers : [];

    // Auto-reload stash data if source is stash and data is missing but name is set
    if (cfg.tableBSource === 'stash' && !cfg.tableBData && cfg.tableBStashName) {
      const stash = DWB.getStash(cfg.tableBStashName);
      if (stash) cfg.tableBData = DWB.passthroughCopy(stash.data);
    }

    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const secLabel = text => `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:5px">${text}</div>`;

    // ── Section A: Reference Data Source ──────────────────────────────────

    function secA() {
      const isStash = cfg.tableBSource === 'stash';
      const stashNames = DWB.listStashes();

      const stashBody = stashNames.length
        ? `<select id="fm-stash-sel-${id}" style="width:100%">
            <option value="">-- Select a stash --</option>
            ${stashNames.map(n => `<option value="${esc(n)}"${n === cfg.tableBStashName ? ' selected' : ''}>${esc(n)}</option>`).join('')}
           </select>`
        : `<div style="font-size:11px;color:var(--text-muted);padding:6px 8px;background:var(--bg-raised);border-radius:4px">No stashes available. Save a dataset to stash first.</div>`;

      const uploadBody = `
        <div id="fm-upload-dz-${id}" style="padding:12px;border:2px dashed var(--border-strong);border-radius:5px;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Drop a CSV file here, or click Browse</div>
          <label style="display:inline-block;padding:3px 10px;background:var(--accent);color:#fff;border-radius:3px;font-size:11px;cursor:pointer">
            Browse…<input type="file" id="fm-upload-fi-${id}" accept=".csv" style="display:none">
          </label>
        </div>`;

      const loadedPill = cfg.tableBData
        ? `<div style="margin-top:5px;display:flex;align-items:center;gap:5px">
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--success);color:#fff;border-radius:10px;font-size:11px">✓ ${cfg.tableBData.rows.length.toLocaleString()} rows · ${cfg.tableBData.headers.length} cols loaded</span>
           </div>`
        : '';

      return `
        <div>
          ${secLabel('Reference Data Source')}
          <div style="display:flex;border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:7px">
            <button id="fm-src-stash-${id}"
              style="flex:1;padding:5px 8px;background:${isStash?'var(--accent)':'none'};color:${isStash?'#fff':'var(--text-muted)'};border:none;border-right:1px solid var(--border);cursor:pointer;font-size:12px;font-family:inherit">
              From Stash
            </button>
            <button id="fm-src-upload-${id}"
              style="flex:1;padding:5px 8px;background:${!isStash?'var(--accent)':'none'};color:${!isStash?'#fff':'var(--text-muted)'};border:none;cursor:pointer;font-size:12px;font-family:inherit">
              Upload CSV
            </button>
          </div>
          ${isStash ? stashBody : uploadBody}
          ${loadedPill}
        </div>`;
    }

    // ── Section B: Match Pairs ─────────────────────────────────────────────

    function secB() {
      if (!cfg.tableBData) return '';

      const aOpts = A.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');
      const bOpts = B.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');

      const pairRows = cfg.matchPairs.map((p, pi) => `
        <div style="display:grid;grid-template-columns:1fr auto 1fr auto auto;gap:4px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--border)">
          <select class="fm-pair-colA" data-pi="${pi}" style="font-size:12px">
            ${A.map((h,i) => `<option value="${i}"${i==p.colA?' selected':''}>${esc(h)}</option>`).join('')}
          </select>
          <span style="font-size:11px;color:var(--text-faint);padding:0 2px">→</span>
          <select class="fm-pair-colB" data-pi="${pi}" style="font-size:12px">
            ${B.map((h,i) => `<option value="${i}"${i==p.colB?' selected':''}>${esc(h)}</option>`).join('')}
          </select>
          <input type="number" class="fm-pair-weight" data-pi="${pi}" value="${p.weight}" min="0.1" step="0.1"
            style="width:50px;font-size:12px" title="Weight">
          <button class="fm-pair-rm" data-pi="${pi}"
            style="padding:1px 5px;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:11px;${cfg.matchPairs.length<=1?'opacity:0.3;pointer-events:none':''}">✕</button>
        </div>`).join('');

      return `
        <div>
          ${secLabel('Matching Rules')}
          <div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
            ${cfg.matchPairs.length ? pairRows : `<div style="padding:8px;font-size:11px;color:var(--text-faint);text-align:center">No match rules yet — add a pair below</div>`}
          </div>
          <button id="fm-add-pair-${id}"
            style="margin-top:5px;width:100%;padding:5px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">
            + Add Pair
          </button>
        </div>`;
    }

    // ── Section C: Columns to Append ──────────────────────────────────────

    function secC() {
      if (!cfg.tableBData) return '';

      const colChecks = B.map((h, i) => `
        <label style="display:flex;align-items:center;gap:7px;padding:3px 4px;font-size:12px;cursor:pointer">
          <input type="checkbox" class="fm-append-col" data-idx="${i}" ${cfg.columnsToAppend.includes(i)?'checked':''}>
          ${esc(h)}
        </label>`).join('');

      return `
        <div>
          ${secLabel('Import from Reference on Match')}
          <div style="display:flex;gap:6px;margin-bottom:5px">
            <button id="fm-append-all-${id}"
              style="padding:2px 8px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">Select All</button>
            <button id="fm-append-none-${id}"
              style="padding:2px 8px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">None</button>
          </div>
          <div id="fm-append-list-${id}"
            style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:4px 6px">
            ${colChecks}
          </div>
          <div style="margin-top:6px">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Column prefix (optional)</label>
            <input type="text" id="fm-prefix-${id}" value="${esc(cfg.columnPrefix)}"
              placeholder="e.g. ref_" style="width:100%">
          </div>
        </div>`;
    }

    // ── Section D: Output Options ─────────────────────────────────────────

    function secD() {
      const opts = [
        ['keep', 'Keep in output (empty appended columns)'],
        ['exclude', 'Exclude from output entirely']
      ];
      const radios = opts.map(([v, l]) =>
        `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="radio" name="fm-nomatch-${id}" value="${v}" ${cfg.noMatchBehavior===v?'checked':''}>
          ${l}
        </label>`).join('');
      return `
        <div>
          ${secLabel('Unmatched / Denied Rows')}
          <div style="display:flex;flex-direction:column;gap:4px">${radios}</div>
        </div>`;
    }

    // ── Section E: Advanced ───────────────────────────────────────────────

    function secE() {
      const ct = cfg.confirmedThreshold;
      const pt = cfg.possibleThreshold;
      const open = node._advancedOpen;

      let bucketCounts = '— — —';
      if (cfg.analysisRun && Object.keys(cfg.reviewState).length) {
        const st = Object.values(cfg.reviewState);
        const confirmed = st.filter(s => s.status==='confirmed').length;
        const pending   = st.filter(s => s.status==='pending').length;
        const nomatch   = st.filter(s => s.status==='nomatch').length;
        bucketCounts = `✓ ${confirmed} confirmed &nbsp; ? ${pending} review &nbsp; ✗ ${nomatch} no match`;
      }

      const algRadios = [
        ['levenshtein', 'Levenshtein (recommended)', 'Better for typos and name variations'],
        ['bigram', 'Bigram', 'Faster for large datasets']
      ].map(([v, l, d]) =>
        `<label style="display:flex;align-items:flex-start;gap:6px;font-size:12px;cursor:pointer;padding:4px 0">
          <input type="radio" name="fm-alg-${id}" value="${v}" ${cfg.algorithm===v?'checked':''} style="margin-top:2px">
          <div><div style="font-weight:600">${l}</div><div style="font-size:11px;color:var(--text-muted)">${d}</div></div>
        </label>`).join('');

      const advBody = `
        <div style="padding:8px 0 4px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px">Algorithm</div>
            ${algRadios}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Auto-confirm above</label>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" id="fm-thresh-c-${id}" value="${ct}" min="0" max="100"
                  style="width:52px;font-size:12px">
                <span style="font-size:11px;color:var(--text-muted)">%</span>
              </div>
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">Flag for review above</label>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" id="fm-thresh-p-${id}" value="${pt}" min="0" max="100"
                  style="width:52px;font-size:12px">
                <span style="font-size:11px;color:var(--text-muted)">%</span>
              </div>
            </div>
          </div>
          <div>
            <div id="fm-thresh-bar-wrap-${id}" style="position:relative;user-select:none;padding:6px 0">
              <div id="fm-thresh-bar-${id}"
                style="height:14px;border-radius:4px;background:linear-gradient(to right,var(--danger),var(--warning) 50%,var(--success));position:relative">
                <div id="fm-marker-p-${id}" data-which="possible"
                  style="position:absolute;top:-5px;left:${pt}%;transform:translateX(-50%);
                         width:14px;height:24px;background:white;border:2px solid var(--border-strong);
                         border-radius:4px;cursor:ew-resize;box-shadow:0 1px 3px rgba(0,0,0,0.25);z-index:2"></div>
                <div id="fm-marker-c-${id}" data-which="confirmed"
                  style="position:absolute;top:-5px;left:${ct}%;transform:translateX(-50%);
                         width:14px;height:24px;background:white;border:2px solid var(--navy-sailor);
                         border-radius:4px;cursor:ew-resize;box-shadow:0 1px 3px rgba(0,0,0,0.25);z-index:2"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-faint);margin-top:3px">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:2px">${bucketCounts}</div>
          </div>
        </div>`;

      return `
        <div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
          <button id="fm-adv-toggle-${id}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;
                   padding:8px 10px;background:var(--bg-raised);border:none;cursor:pointer;
                   font-size:12px;font-weight:600;color:var(--text-main);font-family:inherit">
            <span>Advanced Settings</span>
            <span style="font-size:10px;color:var(--text-faint);transform:rotate(${open?'0':'-90'}deg);transition:transform 0.2s">▼</span>
          </button>
          <div id="fm-adv-body-${id}" style="padding:0 10px;max-height:${open?'800px':'0'};overflow:hidden;transition:max-height 0.25s ease">
            ${open ? advBody : ''}
          </div>
        </div>`;
    }

    // ── Analyze area (phase-dependent) ────────────────────────────────────

    function analyzeArea() {
      const canAnalyze = !!cfg.tableBData && cfg.matchPairs.length > 0;

      if (node._renderPhase === 'confirming') {
        const ms = node._pendingEstimate || 0;
        const timeStr = ms >= 60000
          ? `~${Math.ceil(ms/60000)} minutes`
          : `~${Math.ceil(ms/1000)} seconds`;
        const rowsA = prevData.rows.length;
        const rowsB = cfg.tableBData ? cfg.tableBData.rows.length : 0;
        return `
          <div style="border:1px solid var(--warning);border-radius:6px;padding:12px;background:rgba(245,158,11,0.06)">
            <div style="font-size:13px;font-weight:600;color:var(--warning);margin-bottom:6px">⚠ Long-running analysis</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
              This analysis may take approximately <strong>${timeStr}</strong>.
            </div>
            <div style="font-size:11px;color:var(--text-faint);margin-bottom:10px">
              Dataset: ${rowsA.toLocaleString()} rows × ${rowsB.toLocaleString()} rows = ${(rowsA*rowsB).toLocaleString()} comparisons
            </div>
            <div style="display:flex;gap:8px">
              <button id="fm-run-anyway-${id}"
                style="flex:1;padding:6px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit">
                Run Anyway
              </button>
              <button id="fm-confirm-cancel-${id}"
                style="flex:1;padding:6px;background:none;border:1px solid var(--border);border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit">
                Cancel
              </button>
            </div>
          </div>`;
      }

      if (node._renderPhase === 'analyzing') {
        return `
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="height:6px;border-radius:3px;background:var(--bg-raised);overflow:hidden">
              <div id="fm-prog-bar-${id}" style="height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width 0.2s"></div>
            </div>
            <div id="fm-prog-count-${id}" style="font-size:11px;color:var(--text-muted)">Starting analysis…</div>
            <div id="fm-prog-eta-${id}" style="font-size:11px;color:var(--text-faint)"></div>
            <button id="fm-cancel-${id}"
              style="align-self:flex-start;padding:4px 10px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">
              ✕ Cancel
            </button>
          </div>`;
      }

      // Setup phase — show Analyze button
      let lastRunInfo = '';
      if (cfg.analysisRun && Object.keys(cfg.reviewState).length) {
        const st = Object.values(cfg.reviewState);
        const c = st.filter(s => s.status==='confirmed').length;
        const p = st.filter(s => s.status==='pending').length;
        const n = st.filter(s => s.status==='nomatch').length;
        lastRunInfo = `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Last run: ${c} confirmed, ${p} pending, ${n} no match</div>`;
      }

      return `
        <div>
          <button id="fm-analyze-btn-${id}"
            style="width:100%;padding:10px;background:${canAnalyze?'var(--accent)':'var(--border)'};
                   color:${canAnalyze?'#fff':'var(--text-faint)'};border:none;border-radius:5px;
                   font-size:13px;font-weight:600;cursor:${canAnalyze?'pointer':'default'};font-family:inherit"
            ${canAnalyze ? '' : 'disabled'}>
            ⚡ Analyze Matches
          </button>
          ${lastRunInfo}
        </div>`;
    }

    // ── Settings changed banner ───────────────────────────────────────────

    function settingsBanner() {
      if (!node._settingsChangedSinceAnalysis) return '';
      return `
        <div style="padding:7px 10px;background:rgba(245,158,11,0.1);border:1px solid var(--warning);border-radius:4px;font-size:11px;color:var(--warning)">
          ⚠ Settings changed — re-run analysis to update results
        </div>`;
    }

    // ── Review section ────────────────────────────────────────────────────

    function reviewSection() {
      if (node._renderPhase !== 'review' || !cfg.analysisRun) return '';

      const rs = cfg.reviewState;
      const allIndices = prevData.rows.length > 0 ? Array.from({length: prevData.rows.length}, (_, i) => i) : [];

      const counts = { confirmed: 0, pending: 0, nomatch: 0, accepted: 0, denied: 0 };
      for (const s of Object.values(rs)) counts[s.status] = (counts[s.status] || 0) + 1;

      const scoreColor = score =>
        score >= cfg.confirmedThreshold ? 'var(--success)' :
        score >= cfg.possibleThreshold  ? 'var(--warning)' : 'var(--danger)';

      const scoreDots = score => {
        const filled = Math.min(5, Math.round(score / 20));
        return '●'.repeat(filled) + '○'.repeat(5 - filled);
      };

      const pills = [
        ['pending',   '?',  counts.pending,   'var(--warning)'],
        ['confirmed', '✓',  counts.confirmed, 'var(--success)'],
        ['accepted',  '●',  counts.accepted,  'var(--accent)'],
        ['denied',    '○',  counts.denied,    'var(--text-muted)'],
        ['nomatch',   '✗',  counts.nomatch,   'var(--danger)']
      ].map(([status, sym, count, color]) => {
        const active = node._reviewFilter === status;
        return `
          <button class="fm-pill" data-filter="${status}"
            style="padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;
                   border:1px solid ${active ? color : 'var(--border)'};
                   background:${active ? color : 'none'};
                   color:${active ? '#fff' : 'var(--text-muted)'}">
            ${sym} ${count} ${status.charAt(0).toUpperCase()+status.slice(1)}
          </button>`;
      }).join('');

      const filter = node._reviewFilter;
      const filteredIndices = allIndices.filter(i => rs[i] && rs[i].status === filter);

      // Expanded pending card
      function expandedCard(ai) {
        const state = rs[ai];
        const rowA = prevData.rows[ai];
        const rowB = cfg.tableBData.rows[state.rowBIndex] || [];
        const score = state.score;
        const fieldPairs = (state.fieldScores || []).map((fs, fi) => {
          const pair = cfg.matchPairs[fi];
          if (!pair) return '';
          const fs_score = fs.score;
          const barColor = scoreColor(fs_score);
          return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px 10px">
              <div style="border:1px solid var(--border);border-radius:4px;padding:5px 7px;background:var(--bg-raised)">
                <div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">${esc(A[pair.colA] || '')}</div>
                <div style="font-size:12px;font-weight:700;word-break:break-all">${esc(rowA[pair.colA])}</div>
                <div style="margin-top:4px;height:4px;border-radius:2px;background:var(--border);overflow:hidden">
                  <div style="height:100%;width:${fs_score}%;background:${barColor};border-radius:2px"></div>
                </div>
                <div style="font-size:10px;color:var(--text-faint);margin-top:1px;text-align:right">${fs_score}%</div>
              </div>
              <div style="border:1px solid var(--border);border-radius:4px;padding:5px 7px;background:var(--bg-raised)">
                <div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">${esc(B[pair.colB] || '')}</div>
                <div style="font-size:12px;font-weight:700;word-break:break-all">${esc(rowB[pair.colB])}</div>
              </div>
            </div>`;
        }).join('');

        return `
          <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;background:var(--bg-surface)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg-raised);border-bottom:1px solid var(--border)">
              <span style="font-size:12px;font-weight:700;color:var(--text-muted)">ROW ${ai+1}</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${scoreColor(score)};color:#fff">${score}%</span>
                <span style="font-size:12px;letter-spacing:1px;color:${scoreColor(score)}">${scoreDots(score)}</span>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;padding:5px 10px 2px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-faint)">
              <span>Pipeline (Table A)</span><span>Reference (Table B)</span>
            </div>
            ${fieldPairs}
            <div style="display:flex;justify-content:flex-end;gap:6px;padding:6px 10px 8px">
              <button class="fm-review-action" data-action="accept" data-ai="${ai}"
                style="padding:4px 12px;background:var(--success);color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">
                ✓ Accept
              </button>
              <button class="fm-review-action" data-action="deny" data-ai="${ai}"
                style="padding:4px 12px;background:var(--danger);color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">
                ✗ Deny
              </button>
            </div>
          </div>`;
      }

      // Collapsed single-line card
      function collapsedCard(ai) {
        const state = rs[ai];
        const rowA = prevData.rows[ai];
        const rowB = cfg.tableBData.rows[state.rowBIndex] || [];
        const score = state.score;

        const firstPair = cfg.matchPairs[0];
        const aVal = firstPair ? esc(rowA[firstPair.colA]) : '';
        const bVal = firstPair ? esc(rowB[firstPair.colB]) : '';
        const snippet = firstPair ? ` — ${aVal} / ${bVal}` : '';

        const status = state.status;
        let statusBadge, actionBtn;

        if (status === 'confirmed') {
          statusBadge = `<span style="color:var(--success);font-weight:600">✓ Confirmed</span>`;
          actionBtn = `<button class="fm-review-action" data-action="demote" data-ai="${ai}"
            style="padding:1px 7px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">demote</button>`;
        } else if (status === 'accepted') {
          statusBadge = `<span style="color:var(--success)">✓ Accepted</span>`;
          actionBtn = `<button class="fm-review-action" data-action="undo" data-ai="${ai}"
            style="padding:1px 7px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">undo</button>`;
        } else if (status === 'denied') {
          statusBadge = `<span style="color:var(--danger)">✗ Denied</span>`;
          actionBtn = `<button class="fm-review-action" data-action="undo" data-ai="${ai}"
            style="padding:1px 7px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">undo</button>`;
        } else {
          statusBadge = `<span style="color:var(--text-faint)">✗ No Match</span>`;
          actionBtn = '';
        }

        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg-surface)">
            <span style="color:var(--text-muted)">ROW ${ai+1}${snippet}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--text-faint);font-size:11px">${score}%</span>
              ${statusBadge}
              ${actionBtn}
            </div>
          </div>`;
      }

      let cardsHtml = '';
      let loadMoreHtml = '';

      if (filter === 'pending') {
        const pageLimit = (node._reviewPage + 1) * 50;
        const visible = filteredIndices.slice(0, pageLimit);
        cardsHtml = visible.map(ai => expandedCard(ai)).join('');
        if (filteredIndices.length > pageLimit) {
          loadMoreHtml = `
            <button id="fm-load-more-${id}"
              style="width:100%;padding:6px;background:none;border:1px solid var(--border);border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit">
              Load more (${filteredIndices.length - pageLimit} remaining)
            </button>`;
        }
      } else {
        cardsHtml = filteredIndices.map(ai => collapsedCard(ai)).join('');
      }

      const emptyMsg = filteredIndices.length === 0
        ? `<div style="padding:16px;text-align:center;font-size:11px;color:var(--text-faint)">No rows with status "${filter}"</div>`
        : '';

      return `
        <div id="fm-review-section-${id}" style="border-top:2px solid var(--border);padding-top:10px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:8px">Review Matches</div>
          <div id="fm-pills-${id}" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
            ${pills}
          </div>
          <div id="fm-cards-${id}" style="display:flex;flex-direction:column;gap:6px">
            ${emptyMsg}
            ${cardsHtml}
          </div>
          ${loadMoreHtml}
        </div>`;
    }

    // ── Compose and render ────────────────────────────────────────────────

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${secA()}
        ${secB()}
        ${secC()}
        ${secD()}
        ${secE()}
        ${analyzeArea()}
        ${settingsBanner()}
        ${reviewSection()}
      </div>`;

    // ── Event listeners ───────────────────────────────────────────────────

    function markSettingsChanged() {
      if (cfg.analysisRun) node._settingsChangedSinceAnalysis = true;
    }

    // Source toggle
    const srcStash = document.getElementById(`fm-src-stash-${id}`);
    const srcUpload = document.getElementById(`fm-src-upload-${id}`);
    if (srcStash) srcStash.addEventListener('click', () => {
      if (cfg.tableBSource === 'stash') return;
      cfg.tableBSource = 'stash'; cfg.tableBData = null;
      cfg.analysisRun = false; cfg.reviewState = {}; cfg.matchPairs = []; cfg.columnsToAppend = [];
      node._renderPhase = 'setup'; node._settingsChangedSinceAnalysis = false;
      DWB.renderActiveNode();
    });
    if (srcUpload) srcUpload.addEventListener('click', () => {
      if (cfg.tableBSource === 'upload') return;
      cfg.tableBSource = 'upload'; cfg.tableBData = null;
      cfg.analysisRun = false; cfg.reviewState = {}; cfg.matchPairs = []; cfg.columnsToAppend = [];
      node._renderPhase = 'setup'; node._settingsChangedSinceAnalysis = false;
      DWB.renderActiveNode();
    });

    // Stash selection
    const stashSel = document.getElementById(`fm-stash-sel-${id}`);
    if (stashSel) stashSel.addEventListener('change', e => {
      cfg.tableBStashName = e.target.value; cfg.tableBData = null;
      cfg.analysisRun = false; cfg.reviewState = {}; cfg.matchPairs = []; cfg.columnsToAppend = [];
      node._renderPhase = 'setup'; node._settingsChangedSinceAnalysis = false;
      if (cfg.tableBStashName) {
        const stash = DWB.getStash(cfg.tableBStashName);
        if (stash) cfg.tableBData = DWB.passthroughCopy(stash.data);
      }
      DWB.runFrom(node.id); DWB.renderActiveNode();
    });

    // Upload file
    const uploadFi = document.getElementById(`fm-upload-fi-${id}`);
    const uploadDz = document.getElementById(`fm-upload-dz-${id}`);
    function handleUpload(file) {
      if (!file || !file.name.match(/\.csv$/i)) { DWB.log('Please select a .csv file', 'warn'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const parsed = DWB.parseCSV(ev.target.result);
        cfg.tableBData = parsed;
        cfg.analysisRun = false; cfg.reviewState = {}; cfg.matchPairs = []; cfg.columnsToAppend = [];
        node._renderPhase = 'setup'; node._settingsChangedSinceAnalysis = false;
        DWB.runFrom(node.id); DWB.renderActiveNode();
      };
      reader.readAsText(file);
    }
    if (uploadFi) uploadFi.addEventListener('change', e => handleUpload(e.target.files[0]));
    if (uploadDz) {
      uploadDz.addEventListener('dragover', e => { e.preventDefault(); uploadDz.style.borderColor='var(--accent)'; uploadDz.style.background='var(--accent-light)'; });
      uploadDz.addEventListener('dragleave', () => { uploadDz.style.borderColor='var(--border-strong)'; uploadDz.style.background=''; });
      uploadDz.addEventListener('drop', e => { e.preventDefault(); uploadDz.style.borderColor='var(--border-strong)'; uploadDz.style.background=''; handleUpload(e.dataTransfer.files[0]); });
    }

    // Match pairs
    const pairsWrap = body.querySelector(`[id^="fm-add-pair-"]`);
    const pairsContainer = body.querySelector('.fm-pair-colA')?.closest('[style*="border:1px solid var(--border);border-radius:4px;overflow:hidden"]');

    body.querySelectorAll('.fm-pair-colA').forEach(sel => {
      sel.addEventListener('change', e => {
        cfg.matchPairs[parseInt(e.target.dataset.pi, 10)].colA = parseInt(e.target.value, 10);
        markSettingsChanged(); DWB.runFrom(node.id);
      });
    });
    body.querySelectorAll('.fm-pair-colB').forEach(sel => {
      sel.addEventListener('change', e => {
        cfg.matchPairs[parseInt(e.target.dataset.pi, 10)].colB = parseInt(e.target.value, 10);
        markSettingsChanged(); DWB.runFrom(node.id);
      });
    });
    body.querySelectorAll('.fm-pair-weight').forEach(inp => {
      inp.addEventListener('input', e => {
        cfg.matchPairs[parseInt(e.target.dataset.pi, 10)].weight = parseFloat(e.target.value) || 1;
        markSettingsChanged();
      });
    });
    body.querySelectorAll('.fm-pair-rm').forEach(btn => {
      btn.addEventListener('click', e => {
        const pi = parseInt(e.target.dataset.pi, 10);
        if (cfg.matchPairs.length <= 1) return;
        cfg.matchPairs.splice(pi, 1);
        markSettingsChanged(); DWB.runFrom(node.id); DWB.renderActiveNode();
      });
    });
    const addPairBtn = document.getElementById(`fm-add-pair-${id}`);
    if (addPairBtn) addPairBtn.addEventListener('click', () => {
      cfg.matchPairs.push({ colA: 0, colB: 0, weight: 1 });
      markSettingsChanged(); DWB.renderActiveNode();
    });

    // Columns to append
    const appendList = document.getElementById(`fm-append-list-${id}`);
    if (appendList) appendList.addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) { if (!cfg.columnsToAppend.includes(idx)) cfg.columnsToAppend.push(idx); }
      else cfg.columnsToAppend = cfg.columnsToAppend.filter(i => i !== idx);
      DWB.runFrom(node.id);
    });
    const appendAll = document.getElementById(`fm-append-all-${id}`);
    if (appendAll) appendAll.addEventListener('click', () => {
      cfg.columnsToAppend = B.map((_, i) => i); DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    const appendNone = document.getElementById(`fm-append-none-${id}`);
    if (appendNone) appendNone.addEventListener('click', () => {
      cfg.columnsToAppend = []; DWB.runFrom(node.id); DWB.renderActiveNode();
    });
    const prefixInp = document.getElementById(`fm-prefix-${id}`);
    if (prefixInp) prefixInp.addEventListener('input', e => {
      cfg.columnPrefix = e.target.value; DWB.updateConfig(node.id, 'columnPrefix', e.target.value);
    });

    // Output options
    document.querySelectorAll(`input[name="fm-nomatch-${id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.noMatchBehavior = r.value; DWB.runFrom(node.id); });
    });

    // Advanced toggle
    const advToggle = document.getElementById(`fm-adv-toggle-${id}`);
    if (advToggle) advToggle.addEventListener('click', () => {
      node._advancedOpen = !node._advancedOpen; DWB.renderActiveNode();
    });

    // Algorithm
    document.querySelectorAll(`input[name="fm-alg-${id}"]`).forEach(r => {
      r.addEventListener('change', () => { cfg.algorithm = r.value; markSettingsChanged(); });
    });

    // Threshold inputs
    const threshC = document.getElementById(`fm-thresh-c-${id}`);
    const threshP = document.getElementById(`fm-thresh-p-${id}`);
    if (threshC) threshC.addEventListener('change', e => {
      let v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
      v = Math.max(v, cfg.possibleThreshold);
      cfg.confirmedThreshold = v; e.target.value = v;
      const mc = document.getElementById(`fm-marker-c-${id}`);
      if (mc) mc.style.left = v + '%';
      markSettingsChanged();
    });
    if (threshP) threshP.addEventListener('change', e => {
      let v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
      v = Math.min(v, cfg.confirmedThreshold);
      cfg.possibleThreshold = v; e.target.value = v;
      const mp = document.getElementById(`fm-marker-p-${id}`);
      if (mp) mp.style.left = v + '%';
      markSettingsChanged();
    });

    // Threshold drag
    function attachMarkerDrag(markerId, isConfirmed) {
      const marker = document.getElementById(`${markerId}-${id}`);
      const bar = document.getElementById(`fm-thresh-bar-${id}`);
      if (!marker || !bar) return;
      marker.addEventListener('mousedown', e => {
        e.preventDefault();
        const onMove = ev => {
          const rect = bar.getBoundingClientRect();
          let pct = Math.round((ev.clientX - rect.left) / rect.width * 100);
          pct = Math.max(0, Math.min(100, pct));
          if (isConfirmed) {
            pct = Math.max(pct, cfg.possibleThreshold);
            cfg.confirmedThreshold = pct;
            marker.style.left = pct + '%';
            if (threshC) threshC.value = pct;
          } else {
            pct = Math.min(pct, cfg.confirmedThreshold);
            cfg.possibleThreshold = pct;
            marker.style.left = pct + '%';
            if (threshP) threshP.value = pct;
          }
          markSettingsChanged();
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
    attachMarkerDrag('fm-marker-c', true);
    attachMarkerDrag('fm-marker-p', false);

    // Analyze button
    const analyzeBtn = document.getElementById(`fm-analyze-btn-${id}`);
    if (analyzeBtn && !analyzeBtn.disabled) {
      analyzeBtn.addEventListener('click', () => {
        node._renderPhase = 'analyzing';
        node._abortController = { aborted: false };
        DWB.renderActiveNode();

        setTimeout(() => {
          _fmRunAnalysis(
            cfg, prevData,
            progress => {
              if (progress.phase === 'confirm') {
                node._renderPhase = 'confirming';
                node._pendingEstimate = progress.estimatedMs;
                DWB.renderActiveNode();
              } else if (progress.phase === 'running') {
                const pct = Math.round(progress.completed / progress.total * 100);
                const barEl = document.getElementById(`fm-prog-bar-${id}`);
                if (barEl) barEl.style.width = pct + '%';
                const countEl = document.getElementById(`fm-prog-count-${id}`);
                if (countEl) countEl.textContent = `Comparing row ${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()}…`;
                const etaEl = document.getElementById(`fm-prog-eta-${id}`);
                if (etaEl) etaEl.textContent = progress.estimatedMsRemaining > 500
                  ? `Estimated time remaining: ~${Math.ceil(progress.estimatedMsRemaining / 1000)}s`
                  : 'Almost done…';
              }
            },
            reviewState => {
              cfg.reviewState = reviewState;
              cfg.analysisRun = true;
              node._renderPhase = 'review';
              node._settingsChangedSinceAnalysis = false;
              node._reviewFilter = 'pending';
              node._reviewPage = 0;
              DWB.runFrom(node.id);
              DWB.renderActiveNode();
              setTimeout(() => {
                const el = document.getElementById(`fm-review-section-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            },
            () => {
              const processed = Object.keys(cfg.reviewState).length;
              DWB.log(`Analysis cancelled. ${processed} of ${prevData.rows.length} rows processed.`);
              node._renderPhase = 'setup';
              DWB.renderActiveNode();
            },
            node._abortController,
            {}
          );
        }, 0);
      });
    }

    // Confirming phase buttons
    const runAnyway = document.getElementById(`fm-run-anyway-${id}`);
    if (runAnyway) runAnyway.addEventListener('click', () => {
      node._renderPhase = 'analyzing';
      node._abortController = { aborted: false };
      DWB.renderActiveNode();
      setTimeout(() => {
        _fmRunAnalysis(
          cfg, prevData,
          progress => {
            if (progress.phase === 'running') {
              const pct = Math.round(progress.completed / progress.total * 100);
              const barEl = document.getElementById(`fm-prog-bar-${id}`);
              if (barEl) barEl.style.width = pct + '%';
              const countEl = document.getElementById(`fm-prog-count-${id}`);
              if (countEl) countEl.textContent = `Comparing row ${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()}…`;
              const etaEl = document.getElementById(`fm-prog-eta-${id}`);
              if (etaEl) etaEl.textContent = progress.estimatedMsRemaining > 500
                ? `Estimated time remaining: ~${Math.ceil(progress.estimatedMsRemaining / 1000)}s`
                : 'Almost done…';
            }
          },
          reviewState => {
            cfg.reviewState = reviewState;
            cfg.analysisRun = true;
            node._renderPhase = 'review';
            node._settingsChangedSinceAnalysis = false;
            node._reviewFilter = 'pending';
            node._reviewPage = 0;
            DWB.runFrom(node.id);
            DWB.renderActiveNode();
            setTimeout(() => {
              const el = document.getElementById(`fm-review-section-${id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          },
          () => {
            DWB.log(`Analysis cancelled.`);
            node._renderPhase = 'setup';
            DWB.renderActiveNode();
          },
          node._abortController,
          { confirmed: true }
        );
      }, 0);
    });

    const confirmCancel = document.getElementById(`fm-confirm-cancel-${id}`);
    if (confirmCancel) confirmCancel.addEventListener('click', () => {
      node._renderPhase = 'setup'; DWB.renderActiveNode();
    });

    // Cancel during analysis
    const cancelBtn = document.getElementById(`fm-cancel-${id}`);
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      if (node._abortController) node._abortController.aborted = true;
    });

    // Review pills
    const pillsWrap = document.getElementById(`fm-pills-${id}`);
    if (pillsWrap) pillsWrap.addEventListener('click', e => {
      const pill = e.target.closest('.fm-pill');
      if (!pill) return;
      node._reviewFilter = pill.dataset.filter;
      node._reviewPage = 0;
      DWB.renderActiveNode();
    });

    // Review card actions (delegation)
    const cardsWrap = document.getElementById(`fm-cards-${id}`);
    if (cardsWrap) cardsWrap.addEventListener('click', e => {
      const btn = e.target.closest('.fm-review-action');
      if (!btn) return;
      const ai = parseInt(btn.dataset.ai, 10);
      const action = btn.dataset.action;
      if (action === 'accept')  cfg.reviewState[ai].status = 'accepted';
      if (action === 'deny')    cfg.reviewState[ai].status = 'denied';
      if (action === 'undo')    cfg.reviewState[ai].status = 'pending';
      if (action === 'demote')  cfg.reviewState[ai].status = 'pending';
      DWB.runFrom(node.id);
      DWB.renderActiveNode();
    });

    // Load more
    const loadMoreBtn = document.getElementById(`fm-load-more-${id}`);
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
      node._reviewPage++;
      DWB.renderActiveNode();
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const cfg = node.config;

    if (!cfg.analysisRun || !cfg.tableBData || cfg.columnsToAppend.length === 0) {
      const out = DWB.passthroughCopy(inputData);
      out.headers = [...inputData.headers, '_match_status'];
      out.rows = inputData.rows.map(r => [...r, '']);
      if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, 'text'];
      node.output = out;
      return;
    }

    const tableBHeaders = cfg.tableBData.headers;
    const tableBRows    = cfg.tableBData.rows;
    const prefix        = cfg.columnPrefix || '';

    const appendedHeaders = cfg.columnsToAppend.map(idx => prefix + (tableBHeaders[idx] || `col_${idx}`));
    const outHeaders = [...inputData.headers, ...appendedHeaders, '_match_status'];

    const outRows = [];
    for (let ai = 0; ai < inputData.rows.length; ai++) {
      const row   = inputData.rows[ai];
      const state = cfg.reviewState[ai];
      const empty = cfg.columnsToAppend.map(() => '');

      if (!state || state.status === 'nomatch') {
        if (cfg.noMatchBehavior === 'exclude') continue;
        outRows.push([...row, ...empty, 'No Match']);
      } else if (state.status === 'confirmed' || state.status === 'accepted') {
        const bRow  = tableBRows[state.rowBIndex] || [];
        const label = state.status === 'confirmed' ? 'Confirmed' : 'Accepted';
        outRows.push([...row, ...cfg.columnsToAppend.map(idx => bRow[idx] ?? ''), label]);
      } else if (state.status === 'denied') {
        if (cfg.noMatchBehavior === 'exclude') continue;
        outRows.push([...row, ...empty, 'Denied']);
      } else {
        outRows.push([...row, ...empty, 'Pending']);
      }
    }

    const newColTypes = [...appendedHeaders.map(() => 'text'), 'text'];
    const out = DWB.passthroughCopy(inputData);
    out.headers = outHeaders;
    out.rows = outRows;
    if (inputData.columnTypes) out.columnTypes = [...inputData.columnTypes, ...newColTypes];
    node.output = out;

    const st = Object.values(cfg.reviewState).reduce((a, s) => { a[s.status] = (a[s.status]||0)+1; return a; }, {});
    DWB.log(`Fuzzy Match: ${st.confirmed||0} confirmed, ${st.accepted||0} accepted, ${st.pending||0} pending, ${st.denied||0} denied, ${st.nomatch||0} no match → ${outRows.length} rows`);
  }
});

function levenshtein(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i ? (j ? 0 : i) : j));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function similarity(s1, s2) {
  s1 = String(s1 || '').toLowerCase();
  s2 = String(s2 || '').toLowerCase();
  const longer  = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length >= s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

function computeClusters(rows, targetColIndex, threshold) {
  const freqMap = {};
  for (const row of rows) {
    const val = String(row[targetColIndex] || '').trim();
    if (!val) continue;
    freqMap[val] = (freqMap[val] || 0) + 1;
  }

  const sorted = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]);
  const assigned = new Set();
  const clusters = [];

  for (const candidate of sorted) {
    if (assigned.has(candidate)) continue;
    assigned.add(candidate);
    const members = [{ value: candidate, count: freqMap[candidate] }];

    for (const other of sorted) {
      if (assigned.has(other)) continue;
      if (similarity(candidate, other) >= threshold) {
        members.push({ value: other, count: freqMap[other] });
        assigned.add(other);
      }
    }

    clusters.push({ parent: candidate, members });
  }

  clusters.sort((a, b) => freqMap[b.parent] - freqMap[a.parent]);
  return clusters;
}

DWB.register('FUZZY_CLEAN', {
  title: 'Fuzzy Clean',
  icon: '🪄',
  category: 'Data Analysis',
  desc: 'Automatically clusters similar values in a column and standardizes them to the most common spelling, with a manual review and override UI.',
  implemented: true,

  defaultConfig: {
    targetColIndex: 0,
    threshold: 0.85,
    outputMode: 'overwrite',
    newColName: 'Cleaned_Data',
    clusterOverrides: {}
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

    let clusters = computeClusters(prevData.rows, cfg.targetColIndex, cfg.threshold);

    function getCanonical(cluster) {
      for (const m of cluster.members) {
        const ov = cfg.clusterOverrides[m.value];
        if (ov !== undefined && ov !== m.value) return ov;
      }
      return cluster.parent;
    }

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i === cfg.targetColIndex ? ' selected' : ''}>${esc(h)}</option>`
    ).join('');

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column</label>
          <select id="fz-col-${id}" style="width:100%">${colOpts}</select>
          <div style="margin-top:8px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Similarity Threshold</label>
            <input type="number" id="fz-thresh-${id}" value="${cfg.threshold}" step="0.05" min="0.1" max="1.0"
              style="width:80px;font-size:12px">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Lower = more aggressive grouping. 0.85 recommended.</div>
          </div>
        </div>
        <div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="fz-overwrite-${id}"${cfg.outputMode === 'overwrite' ? ' checked' : ''}> Overwrite original column
          </label>
          <div id="fz-newcol-wrap-${id}" style="margin-top:6px;${cfg.outputMode === 'overwrite' ? 'display:none' : ''}">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
            <input type="text" id="fz-newcol-${id}" value="${esc(cfg.newColName)}" style="width:100%;box-sizing:border-box">
          </div>
        </div>
        <div id="fz-preview-${id}"></div>
      </div>`;

    function renderPreviewSection(highlight) {
      const previewEl = document.getElementById(`fz-preview-${id}`);
      if (!previewEl) return;

      const freqMap = {};
      for (const row of prevData.rows) {
        const v = String(row[cfg.targetColIndex] || '').trim();
        if (v) freqMap[v] = (freqMap[v] || 0) + 1;
      }
      const totalUnique  = Object.keys(freqMap).length;
      const singletons   = clusters.filter(c => c.members.length === 1).length;
      const multiClusters = clusters.filter(c => c.members.length > 1);

      // Build standardization map to compute K
      const stdMap = {};
      for (const cluster of clusters) {
        const canonical = getCanonical(cluster);
        for (const m of cluster.members) {
          if (m.value !== canonical) stdMap[m.value] = canonical;
        }
      }
      for (const [k, v] of Object.entries(cfg.clusterOverrides)) stdMap[k] = v;
      let willRemap = 0;
      for (const [k, v] of Object.entries(stdMap)) { if (k !== v) willRemap++; }

      function renderCardHtml(cluster) {
        const canonical = getCanonical(cluster);

        const nonParentActive = cluster.members.filter(m => {
          if (m.value === canonical) return false;
          const ov = cfg.clusterOverrides[m.value];
          return ov === undefined || ov !== m.value;
        });

        if (nonParentActive.length === 0) return '';

        const totalOccurrences = cluster.members.reduce((s, m) => s + m.count, 0);

        const selectOpts = cluster.members.map(m =>
          `<option value="${esc(m.value)}"${m.value === canonical ? ' selected' : ''}>${esc(m.value)} (${m.count})</option>`
        ).join('');

        const memberRows = nonParentActive.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-top:1px solid var(--border);font-size:12px">
            <span>← <span style="color:var(--text-main)">${esc(m.value)}</span> <span style="color:var(--text-faint)">(${m.count} occurrences)</span></span>
            <button class="fz-remove-btn" data-cluster-parent="${esc(cluster.parent)}" data-value="${esc(m.value)}"
              style="padding:1px 7px;background:none;border:1px solid var(--border);border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;margin-left:8px">Remove</button>
          </div>`).join('');

        return `
          <div class="fz-cluster-card" style="border:1px solid var(--border);border-radius:6px;overflow:hidden">
            <div style="padding:7px 10px;background:var(--bg-raised);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <strong style="font-size:13px">${esc(canonical)}</strong>
              <span style="font-size:11px;color:var(--text-muted)">${totalOccurrences} occurrences</span>
            </div>
            <div style="padding:6px 10px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);background:var(--bg-surface)">
              <label style="font-size:11px;color:var(--text-muted);white-space:nowrap">Canonical:</label>
              <select class="fz-parent-sel" data-cluster-parent="${esc(cluster.parent)}" style="font-size:12px;flex:1">${selectOpts}</select>
            </div>
            ${memberRows}
          </div>`;
      }

      const summaryLine = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${clusters.length} clusters · ${totalUnique} values · ${singletons} singletons</div>`;

      const cardHtmls = multiClusters.map(c => renderCardHtml(c)).filter(Boolean);

      const cardsContent = multiClusters.length === 0
        ? `<div style="font-size:12px;color:var(--text-muted);padding:12px 10px;border:1px solid var(--border);border-radius:4px;text-align:center">No similar value groups found. Try lowering the threshold.</div>`
        : cardHtmls.join('');

      const statsFooter = `<div style="font-size:11px;color:var(--text-faint);margin-top:8px">${prevData.rows.length.toLocaleString()} rows · ${totalUnique.toLocaleString()} unique values · ${willRemap.toLocaleString()} will be remapped</div>`;

      previewEl.innerHTML = `
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:6px">Cluster Preview</div>
          ${summaryLine}
          <div style="display:flex;flex-direction:column;gap:8px">${cardsContent}</div>
          ${statsFooter}
        </div>`;

      if (highlight) {
        previewEl.style.transition = 'background 0s';
        previewEl.style.background = 'rgba(59,130,246,0.08)';
        previewEl.style.borderRadius = '4px';
        previewEl.style.padding = '4px';
        setTimeout(() => {
          previewEl.style.transition = 'background 0.5s';
          previewEl.style.background = '';
          setTimeout(() => { previewEl.style.padding = ''; }, 500);
        }, 200);
      }

      previewEl.querySelectorAll('.fz-parent-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          const clusterParent = sel.dataset.clusterParent;
          const cluster = clusters.find(c => c.parent === clusterParent);
          if (!cluster) return;
          const newCanonical = sel.value;
          const oldCanonical = getCanonical(cluster);

          for (const m of cluster.members) {
            const isRemoved = cfg.clusterOverrides[m.value] === m.value && m.value !== oldCanonical;
            if (!isRemoved) cfg.clusterOverrides[m.value] = newCanonical;
          }
          cfg.clusterOverrides[newCanonical] = newCanonical;

          DWB.runFrom(node.id);
          renderPreviewSection(false);
        });
      });

      previewEl.querySelectorAll('.fz-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.dataset.value;
          cfg.clusterOverrides[value] = value;
          DWB.runFrom(node.id);
          renderPreviewSection(false);
        });
      });
    }

    renderPreviewSection(false);

    document.getElementById(`fz-col-${id}`).addEventListener('change', e => {
      cfg.targetColIndex = parseInt(e.target.value, 10);
      cfg.clusterOverrides = {};
      DWB.runFrom(node.id);
      DWB.renderActiveNode();
    });

    document.getElementById(`fz-thresh-${id}`).addEventListener('change', e => {
      const v = Math.max(0.1, Math.min(1.0, parseFloat(e.target.value) || 0.85));
      e.target.value = v;
      cfg.threshold = v;
      cfg.clusterOverrides = {};
      clusters = computeClusters(prevData.rows, cfg.targetColIndex, v);
      DWB.runFrom(node.id);
      renderPreviewSection(true);
    });

    document.getElementById(`fz-overwrite-${id}`).addEventListener('change', e => {
      cfg.outputMode = e.target.checked ? 'overwrite' : 'append';
      const wrap = document.getElementById(`fz-newcol-wrap-${id}`);
      if (wrap) wrap.style.display = cfg.outputMode === 'overwrite' ? 'none' : '';
      DWB.runFrom(node.id);
    });

    const newColInp = document.getElementById(`fz-newcol-${id}`);
    if (newColInp) {
      newColInp.addEventListener('input', e => {
        cfg.newColName = e.target.value;
        DWB.runFrom(node.id);
      });
    }
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const cfg = node.config;

    const clusters = computeClusters(inputData.rows, cfg.targetColIndex, cfg.threshold);

    // Build base standardization map from cluster computations
    const standardizationMap = {};
    for (const cluster of clusters) {
      let canonical = cluster.parent;
      for (const m of cluster.members) {
        const ov = cfg.clusterOverrides[m.value];
        if (ov !== undefined && ov !== m.value) { canonical = ov; break; }
      }
      for (const m of cluster.members) {
        if (m.value !== canonical) standardizationMap[m.value] = canonical;
      }
    }

    // Apply clusterOverrides on top
    for (const [child, canonical] of Object.entries(cfg.clusterOverrides)) {
      standardizationMap[child] = canonical;
    }

    const newHeaders = cfg.outputMode === 'overwrite'
      ? [...inputData.headers]
      : [...inputData.headers, cfg.newColName || 'Cleaned_Data'];

    const newRows = inputData.rows.map(row => {
      const newRow = [...row];
      const originalVal = String(row[cfg.targetColIndex] || '').trim();
      const cleanedVal  = standardizationMap[originalVal] ?? originalVal;
      if (cfg.outputMode === 'overwrite') {
        newRow[cfg.targetColIndex] = cleanedVal;
      } else {
        newRow.push(cleanedVal);
      }
      return newRow;
    });

    node.output = { headers: newHeaders, rows: newRows };

    let remapped = 0;
    for (const [k, v] of Object.entries(standardizationMap)) { if (k !== v) remapped++; }
    DWB.log(`Fuzzy Clean: ${clusters.length} clusters · ${remapped} value types remapped → ${newRows.length} rows`);
  }
});

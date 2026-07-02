/* === DWBPipeline: pipeline executor === */

window.DWBPipeline = (function() {
  function _parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rows = [];
    let headers = null;

    function parseLine(line) {
      const result = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQuote = false; }
          else { cur += ch; }
        } else {
          if (ch === '"') { inQuote = true; }
          else if (ch === ',') { result.push(cur); cur = ''; }
          else { cur += ch; }
        }
      }
      result.push(cur);
      return result;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const fields = parseLine(line);
      if (!headers) { headers = fields; continue; }
      if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;
      const row = {};
      headers.forEach(function(h, idx) { row[h] = fields[idx] !== undefined ? fields[idx] : ''; });
      rows.push(row);
    }
    return { headers: headers || [], rows };
  }

  function _peRunNodes(nodes, sourceData, stashes, snapshots, snapshotMeta, onLog) {
    let currentRows = [];
    const localStashes = Object.assign({}, stashes);
    const nodeResults = {};

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const type = node.type;

      try {
        if (type === 'INGEST') {
          if (node.sourceId) {
            const sd = sourceData.find(function(s) { return s.id === node.sourceId; });
            if (sd) {
              if (typeof sd.rows === 'string') {
                const parsed = _parseCSV(sd.rows);
                sd._parsedRows = parsed.rows;
                currentRows = parsed.rows;
              } else {
                currentRows = Array.isArray(sd.rows) ? sd.rows : (sd._parsedRows || []);
              }
              onLog('Ingested ' + sd.filename + ': ' + currentRows.length + ' rows', 'success');
            }
          } else if (node.config && node.config.csvText) {
            const parsed = _parseCSV(node.config.csvText);
            currentRows = parsed.rows;
            onLog('Ingested inline CSV: ' + currentRows.length + ' rows', 'success');
          } else {
            currentRows = [];
          }
        } else if (type === 'STASH_SAVE') {
          const sname = (node.config && node.config.name) || ('stash_' + i);
          localStashes[sname] = currentRows.slice();
          onLog('Stashed "' + sname + '": ' + currentRows.length + ' rows', 'info');
        } else if (type === 'STASH_RESTORE') {
          const sname = (node.config && node.config.name) || '';
          if (localStashes[sname]) {
            currentRows = localStashes[sname].slice();
            onLog('Restored "' + sname + '": ' + currentRows.length + ' rows', 'info');
          } else {
            onLog('Stash "' + sname + '" not found', 'warn');
          }
        } else if (type === 'PUSH_TO_VIZ') {
          const sname = node.promotedAs || ('snapshot_' + i);
          if (sname) {
            snapshots[sname] = currentRows.slice();
            for (let si = i - 1; si >= 0; si--) {
              if (nodes[si].type === 'SET_TYPES') {
                const stCols = (nodes[si].config || {}).columns || {};
                if (Object.keys(stCols).length) snapshotMeta[sname] = { columnTypes: stCols };
                break;
              }
            }
            onLog('Pushed to viz as "' + sname + '": ' + currentRows.length + ' rows', 'success');
          }
          // pass-through: currentRows unchanged
        } else {
          const nodeImpl = window.DWBNodes && window.DWBNodes[type];
          if (nodeImpl && typeof nodeImpl.run === 'function') {
            const err = nodeImpl.validate ? nodeImpl.validate(node.config || {}) : null;
            if (err) {
              onLog(node.label + ': ' + err, 'warn');
            } else {
              currentRows = nodeImpl.run(currentRows, node.config || {});
            }
          } else {
            onLog('Unknown node type: ' + type + ' — passing through', 'warn');
          }
        }
        nodeResults[node.id] = { ok: true, rowCount: currentRows.length };
      } catch (e) {
        onLog(node.label + ' error: ' + e.message, 'error');
        nodeResults[node.id] = { ok: false, error: e.message, rowCount: currentRows.length };
      }
    }

    // copy local stashes back
    Object.assign(stashes, localStashes);
    return { rows: currentRows, nodeResults };
  }

  function run() {
    const state = window.DWBState;
    if (!state.flow) return Promise.resolve();
    state.snapshots = {};
    state.stashes = {};
    state.snapshotMeta = {};

    return new Promise(function(resolve) {
      try {
        const result = _peRunNodes(
          state.flow.pipeline.nodes,
          state.flow.pipeline.sourceData,
          state.stashes,
          state.snapshots,
          state.snapshotMeta,
          function(msg, level) { window.DWBShell && window.DWBShell.log(msg, level); }
        );
        resolve(result);
      } catch (e) {
        window.DWBShell && window.DWBShell.log('Pipeline error: ' + e.message, 'error');
        resolve({ rows: [], nodeResults: {} });
      }
    });
  }

  function runToNode(nodeId) {
    const state = window.DWBState;
    if (!state.flow) return Promise.resolve({ rows: [] });

    const nodes = state.flow.pipeline.nodes;
    const idx = nodes.findIndex(function(n) { return n.id === nodeId; });
    const subset = idx >= 0 ? nodes.slice(0, idx + 1) : nodes;
    const tmpSnaps = {};
    const tmpStashes = {};

    return new Promise(function(resolve) {
      try {
        const result = _peRunNodes(
          subset,
          state.flow.pipeline.sourceData,
          tmpStashes,
          tmpSnaps,
          {},
          function() {}
        );
        resolve(result);
      } catch (e) {
        resolve({ rows: [] });
      }
    });
  }

  return { run: run, runToNode: runToNode, parseCSV: _parseCSV };
})();

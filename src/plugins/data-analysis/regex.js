(function () {
  'use strict';

  // ── Shared presets ───────────────────────────────────────────────────────

  const REGEX_PRESETS_EXTRACT = [
    { label: '-- Select a Preset --',         value: '' },
    { label: 'Email Addresses',               value: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}' },
    { label: 'URLs (http/https)',              value: 'https?://[^\\s/$.?#].[^\\s]*' },
    { label: 'US Phone Numbers',              value: '[\\+]?[(]?[0-9]{3}[)]?[-\\s\\.]?[0-9]{3}[-\\s\\.]?[0-9]{4,6}' },
    { label: 'Digits/Numbers Only',           value: '[0-9]+' },
    { label: 'Letters Only',                  value: '[a-zA-Z]+' },
    { label: 'Alphanumeric Words',            value: '[a-zA-Z0-9]+' },
    { label: 'Social Security Numbers (SSN)', value: '[0-9]{3}-[0-9]{2}-[0-9]{4}' },
    { label: 'IPv4 Addresses',                value: '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)' },
    { label: 'Prices / Currency ($)',         value: '\\$[0-9,]+(?:\\.[0-9]{2})?' },
  ];

  const REGEX_PRESETS_VALIDATE = [
    { label: '-- Select a Preset --',         value: '' },
    { label: 'Email Addresses',               value: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$' },
    { label: 'URLs (http/https)',              value: '^https?://[^\\s/$.?#].[^\\s]*$' },
    { label: 'US Phone Numbers',              value: '^[\\+]?[(]?[0-9]{3}[)]?[-\\s\\.]?[0-9]{3}[-\\s\\.]?[0-9]{4,6}$' },
    { label: 'Digits/Numbers Only',           value: '^[0-9]+$' },
    { label: 'Letters Only',                  value: '^[a-zA-Z]+$' },
    { label: 'Alphanumeric Words',            value: '^[a-zA-Z0-9]+$' },
    { label: 'Social Security Numbers (SSN)', value: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$' },
    { label: 'IPv4 Addresses',                value: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$' },
    { label: 'Prices / Currency ($)',         value: '^\\$[0-9,]+(?:\\.[0-9]{2})?$' },
  ];

  const REGEX_CHEAT_SHEET = `
    <details>
      <summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted);padding:4px 0;list-style:none">&#9658; Regex Cheat Sheet</summary>
      <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:11px;padding:8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;line-height:1.7">
        <div><code>\\d</code> = Any digit (0-9)</div>
        <div><code>+</code> = One or more</div>
        <div><code>\\w</code> = Any word character</div>
        <div><code>*</code> = Zero or more</div>
        <div><code>\\s</code> = Any whitespace</div>
        <div><code>{3}</code> = Exactly 3 times</div>
        <div><code>.</code> = Any character except newline</div>
        <div><code>^</code> = Starts with</div>
        <div><code>[A-Z]</code> = Any uppercase letter</div>
        <div><code>$</code> = Ends with</div>
        <div><code>[a-z]</code> = Any lowercase letter</div>
        <div><code>?</code> = Zero or one (optional)</div>
      </div>
    </details>`;

  // ── REGEX_EXTRACT ────────────────────────────────────────────────────────

  DWB.register('REGEX_EXTRACT', {
    title: 'Regex Extractor',
    icon: '🧲',
    category: 'Data Analysis',
    desc: 'Extract specific patterns from text into a new column.',
    implemented: true,

    defaultConfig: {
      targetColIndex: 0,
      pattern: '',
      matchMode: 'first',
      caseInsensitive: false,
      outColName: 'Extracted_Data'
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
      const sLabel = text =>
        `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:5px">${text}</div>`;

      const banner = `
        <div style="background:#e8f4fd;border:1px solid #90caf9;border-radius:4px;padding:8px 10px;font-size:12px;color:#1565c0;line-height:1.5">
          Extract text matching a pattern into a new column. Choose a preset or enter your own regex.
        </div>`;

      const colOpts = prevData.headers.map((h, i) =>
        `<option value="${i}"${i === cfg.targetColIndex ? ' selected' : ''}>${esc(h)}</option>`
      ).join('');

      const s1 = `
        <div>
          ${sLabel('Source Column')}
          <select id="rx-col-${id}" style="width:100%">${colOpts}</select>
        </div>`;

      const presetOpts = REGEX_PRESETS_EXTRACT.map(p =>
        `<option value="${esc(p.value)}">${esc(p.label)}</option>`
      ).join('');

      const s2 = `
        <div>
          ${sLabel('Pattern')}
          <div style="display:flex;flex-direction:column;gap:6px">
            <select id="rx-preset-${id}" style="width:100%">${presetOpts}</select>
            <input type="text" id="rx-pat-${id}" value="${esc(cfg.pattern)}"
              placeholder="e.g. \\d{4}-\\d{2}-\\d{2}"
              style="width:100%;box-sizing:border-box;font-family:monospace;font-size:12px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="rx-ci-${id}"${cfg.caseInsensitive ? ' checked' : ''}> Case-insensitive
            </label>
            ${REGEX_CHEAT_SHEET}
          </div>
        </div>`;

      const s3 = `
        <div>
          ${sLabel('Extraction Mode')}
          <select id="rx-mode-${id}" style="width:100%">
            <option value="first"${cfg.matchMode === 'first' ? ' selected' : ''}>First Match Only</option>
            <option value="all"${cfg.matchMode === 'all' ? ' selected' : ''}>All Matches — comma separated</option>
          </select>
        </div>`;

      const s4 = `
        <div>
          ${sLabel('Output Column Name')}
          <input type="text" id="rx-outcol-${id}" value="${esc(cfg.outColName)}"
            style="width:100%;box-sizing:border-box">
        </div>`;

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${banner}
          ${s1}
          ${s2}
          ${s3}
          ${s4}
        </div>`;

      document.getElementById(`rx-col-${id}`).addEventListener('change', e => {
        cfg.targetColIndex = parseInt(e.target.value, 10);
        DWB.runFrom(node.id);
      });

      document.getElementById(`rx-preset-${id}`).addEventListener('change', e => {
        const val = e.target.value;
        if (!val) return;
        cfg.pattern = val;
        document.getElementById(`rx-pat-${id}`).value = val;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rx-pat-${id}`).addEventListener('input', e => {
        cfg.pattern = e.target.value;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rx-ci-${id}`).addEventListener('change', e => {
        cfg.caseInsensitive = e.target.checked;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rx-mode-${id}`).addEventListener('change', e => {
        cfg.matchMode = e.target.value;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rx-outcol-${id}`).addEventListener('input', e => {
        cfg.outColName = e.target.value;
        DWB.runFrom(node.id);
      });
    },

    execute(node, inputData) {
      if (!inputData) throw new Error('No input data.');
      const cfg = node.config;

      if (!cfg.pattern || !cfg.pattern.trim()) {
        node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
        return;
      }

      const flags = cfg.matchMode === 'all'
        ? (cfg.caseInsensitive ? 'gi' : 'g')
        : (cfg.caseInsensitive ? 'i' : '');

      let regex;
      try {
        regex = new RegExp(cfg.pattern, flags);
      } catch (e) {
        throw new Error('Invalid Regular Expression.');
      }

      const outCol = cfg.outColName || 'Extracted_Data';
      const newHeaders = [...inputData.headers, outCol];

      const newRows = inputData.rows.map(row => {
        const newRow  = [...row];
        const cellVal = String(row[cfg.targetColIndex] || '');
        const matches = cellVal.match(regex);
        newRow.push(cfg.matchMode === 'all'
          ? (matches ? matches.join(', ') : '')
          : (matches ? matches[0] : ''));
        return newRow;
      });

      node.output = { headers: newHeaders, rows: newRows };
    }
  });

  // ── REGEX_VALIDATE ───────────────────────────────────────────────────────

  DWB.register('REGEX_VALIDATE', {
    title: 'Regex Validator',
    icon: '🛡️',
    category: 'Data Analysis',
    desc: 'Test a column against a pattern to tag or filter rows.',
    implemented: true,

    defaultConfig: {
      targetColIndex: 0,
      pattern: '',
      caseInsensitive: false,
      action: 'tag',
      outColName: 'Validation_Status',
      validText: 'Valid',
      invalidText: 'Invalid'
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
      const sLabel = text =>
        `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:5px">${text}</div>`;

      const banner = `
        <div style="background:#e8f4fd;border:1px solid #90caf9;border-radius:4px;padding:8px 10px;font-size:12px;color:#1565c0;line-height:1.5">
          Test each cell against a pattern. Tag rows with a status label, or keep/drop rows based on whether they match.
        </div>`;

      const colOpts = prevData.headers.map((h, i) =>
        `<option value="${i}"${i === cfg.targetColIndex ? ' selected' : ''}>${esc(h)}</option>`
      ).join('');

      const s1 = `
        <div>
          ${sLabel('Column to Validate')}
          <select id="rv-col-${id}" style="width:100%">${colOpts}</select>
        </div>`;

      const presetOpts = REGEX_PRESETS_VALIDATE.map(p =>
        `<option value="${esc(p.value)}">${esc(p.label)}</option>`
      ).join('');

      const s2 = `
        <div>
          ${sLabel('Pattern')}
          <div style="display:flex;flex-direction:column;gap:6px">
            <select id="rv-preset-${id}" style="width:100%">${presetOpts}</select>
            <div style="font-size:11px;color:var(--text-muted)">Validation presets use strict ^ and $ anchors to match the entire cell value.</div>
            <input type="text" id="rv-pat-${id}" value="${esc(cfg.pattern)}"
              placeholder="e.g. ^\\d{5}$"
              style="width:100%;box-sizing:border-box;font-family:monospace;font-size:12px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="rv-ci-${id}"${cfg.caseInsensitive ? ' checked' : ''}> Case-insensitive
            </label>
            ${REGEX_CHEAT_SHEET}
          </div>
        </div>`;

      const isTag = cfg.action === 'tag';
      const tagOptsHtml = `
        <div id="rv-tag-opts-${id}" style="${isTag ? '' : 'display:none'}">
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Status Column Name</label>
              <input type="text" id="rv-outcol-${id}" value="${esc(cfg.outColName)}"
                style="width:100%;box-sizing:border-box">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Valid Text</label>
                <input type="text" id="rv-valid-${id}" value="${esc(cfg.validText)}"
                  style="width:100%;box-sizing:border-box">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Invalid Text</label>
                <input type="text" id="rv-invalid-${id}" value="${esc(cfg.invalidText)}"
                  style="width:100%;box-sizing:border-box">
              </div>
            </div>
          </div>
        </div>`;

      const s3 = `
        <div>
          ${sLabel('Action')}
          <select id="rv-action-${id}" style="width:100%">
            <option value="tag"${cfg.action === 'tag'   ? ' selected' : ''}>Tag rows — add a validation status column</option>
            <option value="keep"${cfg.action === 'keep' ? ' selected' : ''}>Keep valid rows, drop invalid</option>
            <option value="drop"${cfg.action === 'drop' ? ' selected' : ''}>Drop valid rows, keep invalid</option>
          </select>
          ${tagOptsHtml}
        </div>`;

      let summaryHtml = '';
      if (cfg.pattern && cfg.pattern.trim()) {
        try {
          const rx = new RegExp(cfg.pattern, cfg.caseInsensitive ? 'i' : '');
          const colIdx = cfg.targetColIndex;
          let valid = 0;
          for (const row of prevData.rows) {
            if (rx.test(String(row[colIdx] || ''))) valid++;
          }
          const total   = prevData.rows.length;
          const invalid = total - valid;
          summaryHtml = `
            <div style="font-size:11px;color:var(--text-muted)">
              ${valid.toLocaleString()} valid &middot; ${invalid.toLocaleString()} invalid of ${total.toLocaleString()} total rows
            </div>`;
        } catch (e) {
          // invalid pattern — no summary
        }
      }

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${banner}
          ${s1}
          ${s2}
          ${s3}
          ${summaryHtml}
        </div>`;

      document.getElementById(`rv-col-${id}`).addEventListener('change', e => {
        cfg.targetColIndex = parseInt(e.target.value, 10);
        DWB.runFrom(node.id);
      });

      document.getElementById(`rv-preset-${id}`).addEventListener('change', e => {
        const val = e.target.value;
        if (!val) return;
        cfg.pattern = val;
        document.getElementById(`rv-pat-${id}`).value = val;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rv-pat-${id}`).addEventListener('input', e => {
        cfg.pattern = e.target.value;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rv-ci-${id}`).addEventListener('change', e => {
        cfg.caseInsensitive = e.target.checked;
        DWB.runFrom(node.id);
      });

      document.getElementById(`rv-action-${id}`).addEventListener('change', e => {
        cfg.action = e.target.value;
        const tagOpts = document.getElementById(`rv-tag-opts-${id}`);
        if (tagOpts) tagOpts.style.display = cfg.action === 'tag' ? '' : 'none';
        DWB.runFrom(node.id);
      });

      const outColEl = document.getElementById(`rv-outcol-${id}`);
      if (outColEl) outColEl.addEventListener('input', e => { cfg.outColName = e.target.value; DWB.runFrom(node.id); });

      const validEl = document.getElementById(`rv-valid-${id}`);
      if (validEl) validEl.addEventListener('input', e => { cfg.validText = e.target.value; DWB.runFrom(node.id); });

      const invalidEl = document.getElementById(`rv-invalid-${id}`);
      if (invalidEl) invalidEl.addEventListener('input', e => { cfg.invalidText = e.target.value; DWB.runFrom(node.id); });
    },

    execute(node, inputData) {
      if (!inputData) throw new Error('No input data.');
      const cfg = node.config;

      if (!cfg.pattern || !cfg.pattern.trim()) {
        node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
        return;
      }

      let regex;
      try {
        regex = new RegExp(cfg.pattern, cfg.caseInsensitive ? 'i' : '');
      } catch (e) {
        throw new Error('Invalid Regular Expression.');
      }

      const colIdx = cfg.targetColIndex;

      if (cfg.action === 'tag') {
        const outCol = cfg.outColName || 'Validation_Status';
        const newHeaders = [...inputData.headers, outCol];
        const newRows = inputData.rows.map(row => {
          const newRow = [...row];
          newRow.push(regex.test(String(row[colIdx] || ''))
            ? (cfg.validText   || 'Valid')
            : (cfg.invalidText || 'Invalid'));
          return newRow;
        });
        node.output = { headers: newHeaders, rows: newRows };
      } else if (cfg.action === 'keep') {
        node.output = {
          headers: [...inputData.headers],
          rows: inputData.rows
            .filter(row => regex.test(String(row[colIdx] || '')))
            .map(r => [...r])
        };
      } else {
        node.output = {
          headers: [...inputData.headers],
          rows: inputData.rows
            .filter(row => !regex.test(String(row[colIdx] || '')))
            .map(r => [...r])
        };
      }
    }
  });

})();

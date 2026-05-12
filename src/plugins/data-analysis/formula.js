DWB.register('FORMULA', {
  title: 'Formula Engine',
  icon: '🧮',
  category: 'Data Analysis',
  desc: 'Evaluate JavaScript expressions row-by-row to compute new values, referencing columns by name using [Column Name] syntax.',
  implemented: true,

  defaultConfig: {
    formula: '',
    outputMode: 'append',
    targetColIndex: 0,
    newColName: 'Calculated_Value'
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

    // Section 1: Info banner
    const s1 = `
      <div style="background:#e8f4fd;border:1px solid #90caf9;border-radius:4px;padding:8px 10px;font-size:12px;color:#1565c0;line-height:1.5">
        Use standard JavaScript syntax to compute new values.
        Reference column values using <strong>[Column Name]</strong> brackets.
      </div>`;

    // Section 2: Available Columns
    const chips = prevData.headers.map(h =>
      `<span style="display:inline-block;background:var(--bg-raised);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-family:monospace;font-size:11px;cursor:pointer;user-select:all;-webkit-user-select:all">[${esc(h)}]</span>`
    ).join(' ');

    const s2 = `
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:5px">Available Columns (click to select)</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${chips}</div>
      </div>`;

    // Section 3: Formula textarea
    const s3 = `
      <div>
        <label for="fm-formula-${id}" style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Expression / Formula</label>
        <textarea id="fm-formula-${id}" rows="4" style="width:100%;font-family:monospace;font-size:12px;resize:vertical;box-sizing:border-box" placeholder="e.g., Number([Qty]) * 15.99">${esc(cfg.formula)}</textarea>
      </div>`;

    // Section 4: Cheat Sheet (collapsible)
    const s4 = `
      <details>
        <summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted);padding:4px 0;list-style:none">&#9654; Formula Syntax &amp; Examples</summary>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:10px;font-size:11px;padding:8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px">
          <div>
            <div style="font-weight:700;margin-bottom:4px">&#9888;&#65039; Number vs Text (crucial rule)</div>
            <ul style="margin:0;padding-left:16px;line-height:1.8">
              <li>All CSV data is text by default</li>
              <li>Use Number() to do math: <code>Number([Price]) * 1.1</code></li>
              <li>Without it: "1" + "2" = "12" not 3</li>
            </ul>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px">&#128202; Math Operations</div>
            <ul style="margin:0;padding-left:16px;line-height:1.8">
              <li>Add/Subtract: <code>Number([Price]) + Number([Tax]) - 5</code></li>
              <li>Multiply/Divide: <code>Number([Salary]) * 1.05 / 12</code></li>
              <li>Round: <code>Math.round(Number([Total]) * 100) / 100</code></li>
              <li>Max/Min: <code>Math.max(Number([Q1]), Number([Q2]))</code></li>
              <li>Power: <code>Math.pow(Number([Base]), 2)</code></li>
            </ul>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px">&#128221; Text Manipulation</div>
            <ul style="margin:0;padding-left:16px;line-height:1.8">
              <li>Concatenate: <code>[First Name] + " " + [Last Name]</code></li>
              <li>Replace: <code>[Dept].replace("Engineering", "Eng")</code></li>
              <li>Upper/Lower: <code>[Status].toUpperCase()</code></li>
              <li>Substring: <code>[ID].substring(0, 3)</code></li>
              <li>Trim: <code>[Field].trim()</code></li>
              <li>Length: <code>[Comments].length</code></li>
              <li>Pad: <code>[Code].padStart(5, "0")</code></li>
            </ul>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px">&#128256; Logic</div>
            <ul style="margin:0;padding-left:16px;line-height:1.8">
              <li>Basic IF: <code>Number([Age]) &gt;= 18 ? "Adult" : "Minor"</code></li>
              <li>Check blank: <code>[Email] === "" ? "Missing" : "OK"</code></li>
              <li>Contains: <code>[Role].includes("Manager") ? "Lead" : "Staff"</code></li>
              <li>Nested: <code>Number([Score]) &gt;= 90 ? "A" : Number([Score]) &gt;= 80 ? "B" : "C"</code></li>
              <li>Date: <code>new Date([Date_Col]).getFullYear()</code></li>
            </ul>
          </div>
        </div>
      </details>`;

    // Section 5: Output Mode (placeholder — rendered by renderOutputSection)
    const s5 = `<div id="fm-output-${id}"></div>`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${s1}
        ${s2}
        ${s3}
        ${s4}
        ${s5}
      </div>`;

    // Renders only Section 5 to avoid disturbing the textarea
    const renderOutputSection = () => {
      const wrap = document.getElementById(`fm-output-${id}`);
      if (!wrap) return;

      const isAppend = cfg.outputMode !== 'overwrite';

      let modeDetail;
      if (isAppend) {
        modeDetail = `
          <div style="margin-top:6px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">New Column Name</label>
            <input type="text" id="fm-newcol-${id}" value="${esc(cfg.newColName)}" style="width:100%;box-sizing:border-box">
          </div>`;
      } else {
        const colOpts = prevData.headers.map((h, i) =>
          `<option value="${i}"${i === cfg.targetColIndex ? ' selected' : ''}>${esc(h)}</option>`
        ).join('');
        modeDetail = `
          <div style="margin-top:6px">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">Column to Overwrite</label>
            <select id="fm-target-${id}" style="width:100%">${colOpts}</select>
          </div>`;
      }

      wrap.innerHTML = `
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:5px">Output Mode</div>
          <div style="display:flex;gap:16px;margin-bottom:2px">
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
              <input type="radio" name="fm-mode-${id}" value="append"${isAppend ? ' checked' : ''}> Append as new column
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
              <input type="radio" name="fm-mode-${id}" value="overwrite"${!isAppend ? ' checked' : ''}> Overwrite existing column
            </label>
          </div>
          ${modeDetail}
        </div>`;

      wrap.querySelectorAll(`input[name="fm-mode-${id}"]`).forEach(r => {
        r.addEventListener('change', () => {
          cfg.outputMode = r.value;
          renderOutputSection();
          DWB.runFrom(node.id);
        });
      });

      if (isAppend) {
        document.getElementById(`fm-newcol-${id}`).addEventListener('input', e => {
          cfg.newColName = e.target.value;
          DWB.runFrom(node.id);
        });
      } else {
        document.getElementById(`fm-target-${id}`).addEventListener('change', e => {
          cfg.targetColIndex = parseInt(e.target.value, 10);
          DWB.runFrom(node.id);
        });
      }
    };

    renderOutputSection();

    document.getElementById(`fm-formula-${id}`).addEventListener('input', e => {
      cfg.formula = e.target.value;
      DWB.runFrom(node.id);
    });
  },

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');
    const { formula, outputMode, targetColIndex, newColName } = node.config;

    if (!formula || !formula.trim()) {
      node.output = { headers: [...inputData.headers], rows: inputData.rows.map(r => [...r]) };
      return;
    }

    // Build header map
    const headerMap = {};
    inputData.headers.forEach((h, i) => { headerMap[h] = i; });

    // Replace [Column Name] tokens with row[index]
    let processed = formula;
    let missingCol = null;
    processed = processed.replace(/\[([^\]]+)\]/g, (_, name) => {
      if (!(name in headerMap)) {
        if (!missingCol) missingCol = name;
        return 'undefined';
      }
      return `row[${headerMap[name]}]`;
    });
    if (missingCol) throw new Error(`Column [${missingCol}] not found. Check spelling.`);

    // Compile evaluator
    let evaluator;
    try {
      evaluator = new Function('row', `try { return (${processed}); } catch(e) { return "ERROR"; }`);
    } catch (e) {
      throw new Error('Invalid formula syntax.');
    }

    // Determine output headers
    const newHeaders = outputMode === 'append'
      ? [...inputData.headers, newColName || 'Calculated_Value']
      : [...inputData.headers];

    // Evaluate formula row by row
    const newRows = inputData.rows.map(row => {
      const newRow = [...row];
      let result = evaluator(row);
      if (result === null || result === undefined || (typeof result === 'number' && isNaN(result))) {
        result = '';
      }
      if (outputMode === 'append') {
        newRow.push(result);
      } else {
        newRow[targetColIndex] = result;
      }
      return newRow;
    });

    node.output = { headers: newHeaders, rows: newRows };
  }
});

'use strict';

// ─────────────────────── BUILT-IN LEXICON ────────────────────────────────────

const BUILTIN_LEXICON = {
  // Strong positive (+3)
  outstanding: 3, excellent: 3, exceptional: 3, fantastic: 3,
  perfect: 3, brilliant: 3, superb: 3, loved: 3,

  // Positive (+2)
  great: 2, awesome: 2, amazing: 2, wonderful: 2, best: 2,
  valuable: 2, happy: 2, engaging: 2, enjoyed: 2, love: 2,
  informative: 2, inspiring: 2, thorough: 2, comprehensive: 2,

  // Mildly positive (+1)
  good: 1, nice: 1, helpful: 1, useful: 1, effective: 1,
  clear: 1, solid: 1, improving: 1, like: 1, relevant: 1,
  applicable: 1, practical: 1, organized: 1, prepared: 1,
  knowledgeable: 1, professional: 1, interactive: 1,

  // Mildly negative (-1)
  bad: -1, unclear: -1, confusing: -1, hard: -1,
  difficult: -1, slow: -1, issue: -1, lacking: -1,
  boring: -1, outdated: -1, rushed: -1, repetitive: -1,
  vague: -1, disorganized: -1, monotonous: -1,

  // Negative (-2)
  poor: -2, terrible: -2, awful: -2, horrible: -2,
  worst: -2, failed: -2, useless: -2, waste: -2,
  broken: -2, disappointing: -2, frustrating: -2,
  inadequate: -2, unacceptable: -2, irrelevant: -2,
  unprepared: -2, ineffective: -2,

  // Strongly negative (-3)
  hate: -3, disgusting: -3, pathetic: -3, abysmal: -3,
  deplorable: -3
};

// ─────────────────────── SCORING ─────────────────────────────────────────────

function saScoreText(text, customLexicon) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  let score = 0;
  for (const word of words) {
    if (!word || word.length < 2) continue;
    if (Object.prototype.hasOwnProperty.call(customLexicon, word)) {
      score += Number(customLexicon[word]);
    } else if (Object.prototype.hasOwnProperty.call(BUILTIN_LEXICON, word)) {
      score += BUILTIN_LEXICON[word];
    }
  }
  return score;
}

// ─────────────────────── REGISTRATION ────────────────────────────────────────

DWB.register('SENTIMENT_ANALYSIS', {
  title: 'Sentiment Analysis',
  icon: '🎭',
  category: 'Data Analysis',
  desc: 'Scores free-text responses row-by-row using a keyword lexicon, appending a numeric sentiment score column. Higher scores are more positive, lower scores more negative.',
  implemented: true,

  defaultConfig: {
    sourceColIndex: 0,
    outColName: '',
    customLexicon: {}
  },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    if (!prevData) {
      body.innerHTML = '<div class="config-empty">No upstream data. Connect a source node first.</div>';
      return;
    }

    const cfg = node.config;
    const id  = node.id;

    if (!cfg.customLexicon || typeof cfg.customLexicon !== 'object') cfg.customLexicon = {};

    const esc = s => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const sectionLabel = t =>
      `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-faint);margin-bottom:5px">${t}</div>`;

    // ── Section 1: Source Column ──────────────────────────────────────────

    const colOpts = prevData.headers.map((h, i) =>
      `<option value="${i}"${i === cfg.sourceColIndex ? ' selected' : ''}>${esc(h)}</option>`
    ).join('');

    // ── Section 2: Output Column Name ─────────────────────────────────────

    const srcColName    = prevData.headers[cfg.sourceColIndex] || '';
    const outPlaceholder = srcColName ? srcColName + '_Sentiment' : 'Sentiment_Score';

    // ── Section 3: Custom Lexicon — add-word form ─────────────────────────

    const weightOpts = [
      [3, '+3 Strongly Positive'],
      [2, '+2 Positive'],
      [1, '+1 Mildly Positive'],
      [-1, '-1 Mildly Negative'],
      [-2, '-2 Negative'],
      [-3, '-3 Strongly Negative']
    ].map(([v, l]) =>
      `<option value="${v}"${v === 1 ? ' selected' : ''}>${l}</option>`
    ).join('');

    // ── Full HTML ─────────────────────────────────────────────────────────

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          ${sectionLabel('Source Column')}
          <select id="sa-src-${id}" style="width:100%">${colOpts}</select>
        </div>
        <div>
          ${sectionLabel('Output Column Name')}
          <input type="text" id="sa-outname-${id}" value="${esc(cfg.outColName)}"
            placeholder="${esc(outPlaceholder)}"
            style="width:100%;box-sizing:border-box">
        </div>
        <div>
          ${sectionLabel('Custom Lexicon')}
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">
            Custom words take priority over built-in entries. Useful for domain-specific terminology.
          </div>
          <div id="sa-table-${id}"></div>
          <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
            <input type="text" id="sa-word-${id}" placeholder="e.g. hands-on"
              style="flex:1;box-sizing:border-box">
            <select id="sa-weight-${id}" style="flex:1">${weightOpts}</select>
            <button id="sa-add-btn-${id}"
              style="padding:4px 10px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap">
              + Add
            </button>
          </div>
        </div>
        <div>
          ${sectionLabel('Live Preview')}
          <div id="sa-preview-${id}"
            style="font-size:11px;color:var(--text-muted);padding:6px 8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;line-height:1.5">
          </div>
        </div>
      </div>`;

    // ── Inner renderers ───────────────────────────────────────────────────

    const renderTable = () => {
      const wrap = document.getElementById(`sa-table-${id}`);
      if (!wrap) return;

      const entries = Object.entries(cfg.customLexicon);
      if (entries.length === 0) {
        wrap.innerHTML = `<div style="font-size:12px;color:var(--text-faint);padding:4px 0">No custom words added yet.</div>`;
        return;
      }

      const thStyle = 'text-align:left;padding:3px 6px;font-size:11px;font-weight:600;color:var(--text-muted);border-bottom:1px solid var(--border)';
      const tdStyle = 'padding:3px 6px;font-size:12px;border-bottom:1px solid var(--border)';

      const rows = entries.map(([word, weight]) => {
        const isOverride = Object.prototype.hasOwnProperty.call(BUILTIN_LEXICON, word);
        const source     = isOverride ? 'custom (override)' : 'custom';
        const sign       = Number(weight) > 0 ? '+' : '';
        const wColor     = Number(weight) > 0 ? '#166534' : Number(weight) < 0 ? '#991b1b' : 'inherit';
        return `<tr>
          <td style="${tdStyle}">${esc(word)}</td>
          <td style="${tdStyle};font-weight:600;color:${wColor}">${sign}${weight}</td>
          <td style="${tdStyle};color:var(--text-faint)">${source}</td>
          <td style="${tdStyle}">
            <button data-word="${esc(word)}"
              style="background:transparent;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:0 4px;line-height:1"
              title="Remove">×</button>
          </td>
        </tr>`;
      }).join('');

      wrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">Word</th>
            <th style="${thStyle}">Weight</th>
            <th style="${thStyle}">Source</th>
            <th style="${thStyle}"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      wrap.querySelectorAll('button[data-word]').forEach(btn => {
        btn.addEventListener('click', () => {
          delete cfg.customLexicon[btn.dataset.word];
          renderTable();
          renderPreview();
          DWB.runFrom(node.id);
        });
      });
    };

    const renderPreview = () => {
      const el = document.getElementById(`sa-preview-${id}`);
      if (el) el.textContent = saComputePreview(prevData, cfg);
    };

    // ── Event listeners ───────────────────────────────────────────────────

    document.getElementById(`sa-src-${id}`).addEventListener('change', e => {
      cfg.sourceColIndex = parseInt(e.target.value, 10);
      const outInput = document.getElementById(`sa-outname-${id}`);
      if (outInput) {
        const col = prevData.headers[cfg.sourceColIndex] || '';
        outInput.placeholder = col ? col + '_Sentiment' : 'Sentiment_Score';
      }
      renderPreview();
      DWB.runFrom(node.id);
    });

    document.getElementById(`sa-outname-${id}`).addEventListener('input', e => {
      cfg.outColName = e.target.value;
      DWB.runFrom(node.id);
    });

    const doAdd = () => {
      const wordInput  = document.getElementById(`sa-word-${id}`);
      const weightSel  = document.getElementById(`sa-weight-${id}`);
      if (!wordInput || !weightSel) return;
      const word = wordInput.value.toLowerCase().trim();
      if (!word) return;
      cfg.customLexicon[word] = parseInt(weightSel.value, 10);
      wordInput.value = '';
      renderTable();
      renderPreview();
      DWB.runFrom(node.id);
    };

    document.getElementById(`sa-add-btn-${id}`).addEventListener('click', doAdd);
    document.getElementById(`sa-word-${id}`).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    });

    // ── Initial paint ─────────────────────────────────────────────────────

    renderTable();
    renderPreview();
  },

  // ── Execute ───────────────────────────────────────────────────────────────

  execute(node, inputData) {
    if (!inputData) throw new Error('No input data.');

    const cfg        = node.config;
    const srcIdx     = cfg.sourceColIndex || 0;
    const custom     = cfg.customLexicon || {};
    const outColName = (cfg.outColName && cfg.outColName.trim())
      ? cfg.outColName.trim()
      : (inputData.headers[srcIdx] || 'Column') + '_Sentiment';

    const newHeaders = [...inputData.headers, outColName];

    const newRows = inputData.rows.map(row => {
      const text  = String(row[srcIdx] ?? '').trim();
      const score = text ? saScoreText(text, custom) : '';
      return [...row, score];
    });

    node.output = { headers: newHeaders, rows: newRows };
  }
});

// ─────────────────────── MODULE-PRIVATE HELPERS ───────────────────────────────

function saComputePreview(prevData, cfg) {
  const srcIdx = cfg.sourceColIndex || 0;
  const custom = cfg.customLexicon || {};
  let totalNorm = 0, count = 0, pos = 0, neg = 0, neutral = 0;

  for (const row of prevData.rows) {
    const text = String(row[srcIdx] ?? '').trim();
    if (!text) continue;
    const raw   = saScoreText(text, custom);
    const words = text.split(/\s+/).filter(Boolean).length;
    const norm  = words > 0 ? raw / words : 0;
    totalNorm += norm;
    count++;
    if (norm > 0.15)       pos++;
    else if (norm < -0.15) neg++;
    else                   neutral++;
  }

  if (count === 0) return 'No text responses to score.';

  const avg  = totalNorm / count;
  const sign = avg >= 0 ? '+' : '';
  return `${count} responses scored · Avg score: ${sign}${avg.toFixed(2)} · ${pos} positive / ${neutral} neutral / ${neg} negative using ±0.15 normalized threshold`;
}

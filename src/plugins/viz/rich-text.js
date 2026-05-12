'use strict';

// ─────────────────────── MARKDOWN CONVERTER ──────────────────────────────────

function _rtMarkdownToHtml(text) {
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  text = text.replace(/~~(.+?)~~/g,     '<s>$1</s>');
  text = text.replace(/^> (.+)$/gm,  '<blockquote>$1</blockquote>');
  text = text.replace(/^---$/gm,     '<hr>');
  // Unordered lists — collect consecutive lines
  text = text.replace(/((?:^[-*] .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => { const m = l.match(/^[-*] (.+)$/); return m ? `<li>${m[1]}</li>` : ''; })
      .join('');
    return `<ul>${items}</ul>`;
  });
  // Ordered lists — collect consecutive lines
  text = text.replace(/((?:^\d+\. .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => { const m = l.match(/^\d+\. (.+)$/); return m ? `<li>${m[1]}</li>` : ''; })
      .join('');
    return `<ol>${items}</ol>`;
  });
  // Wrap in paragraphs when no block elements are present
  if (!/<(h[1-3]|ul|ol|blockquote|hr)/i.test(text)) {
    text = '<p>' + text.replace(/\n\n+/g, '</p><p>') + '</p>';
  }
  return text;
}

// ─────────────────────── CONSTANTS ───────────────────────────────────────────

const RT_BACKGROUNDS = {
  none:    { bg: 'transparent',                                 shadow: 'none', border: 'none' },
  card:    { bg: 'var(--card-bg)',                              shadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border)' },
  accent:  { bg: 'var(--accent-subtle,rgba(59,130,246,0.08))', shadow: 'none', border: 'none' },
  info:    { bg: 'rgba(59,130,246,0.08)',                       shadow: 'none', border: 'none' },
  warning: { bg: 'rgba(245,158,11,0.08)',                       shadow: 'none', border: 'none' },
  success: { bg: 'rgba(34,197,94,0.08)',                        shadow: 'none', border: 'none' },
  custom:  { bg: null,                                          shadow: 'none', border: 'none' }
};

const RT_BORDER_STYLES = {
  none:    '',
  left:    '4px solid var(--accent)',
  full:    '1px solid var(--border)',
  rounded: '1px solid var(--border)'
};

const RT_PADDING = {
  small:  '8px 12px',
  medium: '16px 20px',
  large:  '28px 32px'
};

// Callout backgrounds always override borderStyle with a matching left bar.
const RT_CALLOUT_ACCENTS = {
  info:    '#3b82f6',
  warning: '#f59e0b',
  success: '#22c55e'
};

// ─────────────────────── GLOBAL HANDLERS ─────────────────────────────────────

DWB._rt_set = function(eid, key, val) {
  DWB.updateConfig_viz(eid, key, val);
  DWB.viz.renderElement(eid);
};

// bgStyle change also re-renders sidebar to show/hide the custom color picker.
DWB._rt_setBgStyle = function(eid, val) {
  DWB.updateConfig_viz(eid, 'bgStyle', val);
  DWB.viz.renderSidebar(eid);
  DWB.viz.renderElement(eid);
};

DWB._rt_onInput = function(eid) {
  const editor = document.getElementById('rt-editor-' + eid);
  if (!editor) return;
  const found = DWB.viz.findElement(eid);
  if (!found) return;
  found.element.config.content = editor.innerHTML;
  DWB.viz.renderElement(eid);
};

DWB._rt_onPaste = function(eid, e) {
  e.preventDefault();
  const raw  = e.clipboardData.getData('text/plain');
  const html = e.clipboardData.getData('text/html');

  const hasRichHtml = html && (
    html.includes('<b>') || html.includes('<strong>') ||
    html.includes('<h')  || html.includes('<ul')      || html.includes('<ol')
  );

  if (hasRichHtml) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('meta,style,link').forEach(el => el.remove());
    document.execCommand('insertHTML', false, doc.body ? doc.body.innerHTML : html);
  } else if (
    /^#{1,3} /m.test(raw) || /\*\*.+\*\*/.test(raw) ||
    /^[-*] /m.test(raw)   || /^> /m.test(raw)
  ) {
    document.execCommand('insertHTML', false, _rtMarkdownToHtml(raw));
  } else {
    document.execCommand('insertText', false, raw);
  }
};

DWB._rt_updateToolbar = function(eid) {
  ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
    const btn = document.getElementById('rt-btn-' + cmd + '-' + eid);
    if (!btn) return;
    const active = document.queryCommandState(cmd);
    btn.style.background = active ? 'var(--accent)' : '';
    btn.style.color      = active ? '#fff' : '';
  });
};

document.addEventListener('selectionchange', function() {
  const focused = document.activeElement;
  if (!focused || !focused.id || !focused.id.startsWith('rt-editor-')) return;
  DWB._rt_updateToolbar(focused.id.slice('rt-editor-'.length));
});

// ─────────────────────── ELEMENT REGISTRATION ────────────────────────────────

DWB.registerElement('RICH_TEXT', {
  title: 'Rich Text',
  icon: '📝',
  category: 'Presentation',
  desc: 'A static rich text block for narrative content, section headers, and callouts. Supports formatted text editing and Markdown paste conversion.',
  headerCompatible: false,

  // ── Config panel ─────────────────────────────────────────────────────────

  renderConfig(element, dataset) {
    const cfg = element.config;
    _rtEnsureDefaults(cfg);
    const eid = element.id;

    const btnS = 'padding:3px 7px;font-size:11px;border:1px solid var(--border);background:var(--bg-surface,#fff);border-radius:3px;cursor:pointer;color:var(--text-main);font-family:inherit;line-height:1.4';
    const sep  = '<span style="display:inline-block;width:1px;background:var(--border);height:18px;margin:0 3px;vertical-align:middle"></span>';

    // Format buttons track active state via queryCommandState.
    const fmtBtn = (cmd, label, title) =>
      `<button id="rt-btn-${cmd}-${eid}" title="${title}" style="${btnS}"
         onmousedown="event.preventDefault()"
         onclick="document.execCommand('${cmd}',false,null);DWB._rt_updateToolbar('${eid}')">${label}</button>`;

    // Generic command button — val='' becomes null (no-value commands).
    const cmdBtn = (label, title, cmd, val) =>
      `<button title="${title}" style="${btnS}"
         onmousedown="event.preventDefault()"
         onclick="document.execCommand('${cmd}',false,${val !== '' ? `'${val}'` : 'null'})">${label}</button>`;

    const toolbar = `
      <div style="display:flex;flex-wrap:wrap;gap:2px;padding:4px;background:var(--bg-raised,#f5f5f5);border:1px solid var(--border);border-bottom:none;border-radius:4px 4px 0 0;align-items:center">
        ${fmtBtn('bold',          '<b>B</b>',  'Bold')}
        ${fmtBtn('italic',        '<i>I</i>',  'Italic')}
        ${fmtBtn('underline',     '<u>U</u>',  'Underline')}
        ${fmtBtn('strikeThrough', '<s>S</s>',  'Strikethrough')}
        ${sep}
        ${cmdBtn('H1', 'Heading 1', 'formatBlock', 'h1')}
        ${cmdBtn('H2', 'Heading 2', 'formatBlock', 'h2')}
        ${cmdBtn('H3', 'Heading 3', 'formatBlock', 'h3')}
        ${sep}
        ${cmdBtn('1.', 'Ordered List',  'insertOrderedList',   '')}
        ${cmdBtn('•',  'Bulleted List', 'insertUnorderedList', '')}
        ${sep}
        <button title="Blockquote" style="${btnS}"
          onmousedown="event.preventDefault()"
          onclick="document.execCommand('formatBlock',false,'blockquote')">&ldquo;</button>
        <button title="Horizontal Rule" style="${btnS}"
          onmousedown="event.preventDefault()"
          onclick="document.execCommand('insertHTML',false,'&lt;hr&gt;')">&#x2014;</button>
        ${sep}
        ${cmdBtn('&#x21D0;', 'Align Left',   'justifyLeft',   '')}
        ${cmdBtn('&#x25A0;', 'Align Center', 'justifyCenter', '')}
        ${cmdBtn('&#x21D2;', 'Align Right',  'justifyRight',  '')}
        ${sep}
        ${cmdBtn('&#x2715;', 'Clear Format', 'removeFormat',  '')}
      </div>`;

    const bgOptions = [
      ['none',    'None (transparent)'],
      ['card',    'Card (default)'],
      ['accent',  'Accent'],
      ['info',    'Callout — Info'],
      ['warning', 'Callout — Warning'],
      ['success', 'Callout — Success'],
      ['custom',  'Custom color...']
    ].map(([v, l]) =>
      `<option value="${v}"${cfg.bgStyle === v ? ' selected' : ''}>${l}</option>`
    ).join('');

    const customColorPicker = cfg.bgStyle === 'custom' ? `
      <input type="color" class="sidebar-input" value="${cfg.customBgColor}"
        oninput="DWB._rt_set('${eid}','customBgColor',this.value)">` : '';

    const borderOptions = [
      ['none',    'None'],
      ['left',    'Left accent bar'],
      ['full',    'Full border'],
      ['rounded', 'Full border (rounded)']
    ].map(([v, l]) =>
      `<option value="${v}"${cfg.borderStyle === v ? ' selected' : ''}>${l}</option>`
    ).join('');

    const paddingOptions = [
      ['small',  'Small'],
      ['medium', 'Medium'],
      ['large',  'Large']
    ].map(([v, l]) =>
      `<option value="${v}"${cfg.padding === v ? ' selected' : ''}>${l}</option>`
    ).join('');

    return `
      <div class="dwb-config-group" style="padding:8px 12px">
        <label class="sidebar-label">Content</label>
        ${toolbar}
        <div id="rt-editor-${eid}" contenteditable="true"
          style="min-height:120px;padding:10px;border:1px solid var(--border);border-radius:0 0 4px 4px;font-family:var(--font-body,sans-serif);outline:none;background:var(--bg-surface,#fff);color:var(--text-main)"
          oninput="DWB._rt_onInput('${eid}')"
          onpaste="DWB._rt_onPaste('${eid}',event)"
          onfocus="DWB._rt_updateToolbar('${eid}')"
        >${cfg.content}</div>
      </div>
      <div class="dwb-config-group" style="padding:8px 12px;border-top:1px solid var(--border)">
        <label class="sidebar-label">Appearance</label>
        <label class="sidebar-label">Background</label>
        <select class="sidebar-input"
          onchange="DWB._rt_setBgStyle('${eid}',this.value)">
          ${bgOptions}
        </select>
        ${customColorPicker}
        <label class="sidebar-label" style="margin-top:8px">Border</label>
        <select class="sidebar-input"
          onchange="DWB._rt_set('${eid}','borderStyle',this.value)">
          ${borderOptions}
        </select>
        <label class="sidebar-label" style="margin-top:8px">Padding</label>
        <select class="sidebar-input"
          onchange="DWB._rt_set('${eid}','padding',this.value)">
          ${paddingOptions}
        </select>
      </div>`;
  },

  // ── Render ────────────────────────────────────────────────────────────────

  render(element, dataset, filters) {
    const container = document.getElementById('element-content-' + element.id);
    if (!container) return;

    const cfg = element.config;
    _rtEnsureDefaults(cfg);
    const eid = element.id;

    const bgDef = RT_BACKGROUNDS[cfg.bgStyle] || RT_BACKGROUNDS.card;
    const bg    = cfg.bgStyle === 'custom' ? cfg.customBgColor : bgDef.bg;

    // Callout backgrounds apply their own left accent bar, overriding borderStyle.
    let borderLeft = '';
    let border     = '';
    const borderRadius = cfg.borderStyle === 'rounded' ? '8px' : '4px';

    if (RT_CALLOUT_ACCENTS[cfg.bgStyle]) {
      borderLeft = `4px solid ${RT_CALLOUT_ACCENTS[cfg.bgStyle]}`;
    } else {
      const bs = RT_BORDER_STYLES[cfg.borderStyle] || '';
      if (cfg.borderStyle === 'left') borderLeft = bs;
      else                            border     = bs;
    }

    const containerStyle = [
      `background:${bg}`,
      `box-shadow:${bgDef.shadow}`,
      border     ? `border:${border}`          : 'border:none',
      borderLeft ? `border-left:${borderLeft}` : '',
      `border-radius:${borderRadius}`,
      `padding:${RT_PADDING[cfg.padding] || RT_PADDING.medium}`,
      'box-sizing:border-box',
      'height:100%',
      'min-height:60px'
    ].filter(Boolean).join(';');

    const sid = 'rt-scope-' + eid;
    const css = `
      #${sid} h1{font-size:1.8rem;font-weight:700;margin:0 0 0.5em}
      #${sid} h2{font-size:1.4rem;font-weight:600;margin:0 0 0.4em}
      #${sid} h3{font-size:1.1rem;font-weight:600;margin:0 0 0.3em}
      #${sid} p{line-height:1.6;margin:0 0 0.8em}
      #${sid} ul,#${sid} ol{padding-left:1.5em;margin:0 0 0.8em}
      #${sid} blockquote{border-left:3px solid var(--border);padding-left:1em;color:var(--text-muted);font-style:italic;margin:0 0 0.8em}
      #${sid} hr{border:none;border-top:1px solid var(--border);margin:1em 0}
    `;

    const isEmpty = !cfg.content || cfg.content.replace(/<[^>]*>/g, '').trim() === '';
    const contentHtml = isEmpty
      ? `<div style="color:var(--text-faint);text-align:center;font-style:italic;padding:24px 0;font-size:13px">Click to add content, or paste from Gemini / any AI...</div>`
      : cfg.content;

    container.innerHTML = `<style>${css}</style><div style="${containerStyle}"><div id="${sid}">${contentHtml}</div></div>`;
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onFilterChange(element, dataset, filters) {
    this.render(element, dataset, filters);
  },

  onThemeChange(element) {
    this.render(element, null, []);
  },

  getPromptContext(element, dataset) {
    const text = ((element.config || {}).content || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
    return `Rich Text block: ${text || '(empty)'}`;
  },

  getEchartsInstance() { return null; }
});

// ─────────────────────── MODULE-PRIVATE HELPERS ───────────────────────────────

function _rtEnsureDefaults(cfg) {
  if (cfg.content       === undefined) cfg.content       = '';
  if (cfg.bgStyle       === undefined) cfg.bgStyle       = 'card';
  if (cfg.customBgColor === undefined) cfg.customBgColor = '#ffffff';
  if (cfg.borderStyle   === undefined) cfg.borderStyle   = 'none';
  if (cfg.padding       === undefined) cfg.padding       = 'medium';
}

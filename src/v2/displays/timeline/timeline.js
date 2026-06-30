/* === DWBTimelines: timeline viz renderers === */

window.DWBTimelines = (function() {
  function render(viz, rows, container) {
    switch (viz.type) {
      case 'TIMELINE_HORIZONTAL': _tlRenderHorizontal(viz, rows, container); break;
      case 'TIMELINE_GANTT':      _tlRenderGantt(viz, rows, container);      break;
      case 'TIMELINE_VERTICAL':   _tlRenderVertical(viz, rows, container);   break;
      default: container.innerHTML = '<div style="padding:16px;color:var(--text-muted)">Unknown timeline type</div>';
    }
  }

  function _tlGetField(cfg, rows, key, fallbackIdx) {
    if (cfg[key]) return cfg[key];
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    return cols[fallbackIdx] || cols[0] || '';
  }

  function _tlRenderHorizontal(viz, rows, container) {
    const cfg = viz.config || {};
    const dateField  = _tlGetField(cfg, rows, 'dateField', 0);
    const labelField = _tlGetField(cfg, rows, 'labelField', 1);

    if (!rows.length) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px">No data to display.</div>';
      return;
    }

    // Sort by date
    const events = rows.slice().sort(function(a, b) {
      return new Date(a[dateField]) - new Date(b[dateField]);
    });

    // Simple equal-spacing horizontal layout
    const totalWidth = Math.max(800, events.length * 120);
    const html = `<div class="tl-h-wrap" style="min-width:${totalWidth}px">
      <div class="tl-h-track">
        ${events.map(function(row, idx) {
          const pct = events.length === 1 ? 50 : (idx / (events.length - 1)) * 100;
          const label = _tlEsc(String(row[labelField] || ''));
          const date  = _tlEsc(String(row[dateField] || ''));
          return `<div class="tl-h-event" style="left:${pct}%">
            <div class="tl-h-dot"></div>
            <div class="tl-h-label">${label}</div>
            <div class="tl-h-date">${date}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    container.innerHTML = html;
    _tlRenderConfigHint(viz, container, 'dateField, labelField');
  }

  function _tlRenderGantt(viz, rows, container) {
    const cfg = viz.config || {};
    const taskField  = _tlGetField(cfg, rows, 'taskField', 0);
    const startField = _tlGetField(cfg, rows, 'startField', 1);
    const endField   = _tlGetField(cfg, rows, 'endField', 2);

    if (!rows.length) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px">No data to display.</div>';
      return;
    }

    // Find min/max dates for scaling
    let minDate = Infinity, maxDate = -Infinity;
    rows.forEach(function(row) {
      const s = new Date(row[startField]).getTime();
      const e = new Date(row[endField]).getTime();
      if (!isNaN(s)) minDate = Math.min(minDate, s);
      if (!isNaN(e)) maxDate = Math.max(maxDate, e);
    });

    if (!isFinite(minDate)) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px">Could not parse date fields. Configure startField and endField in config.</div>';
      return;
    }

    const range = maxDate - minDate || 1;

    let html = '<div class="tl-gantt-wrap"><table class="tl-gantt-table">';
    html += '<thead><tr><th style="width:200px">Task</th><th>Start</th><th>End</th><th>Duration</th></tr></thead><tbody>';

    rows.forEach(function(row) {
      const task  = String(row[taskField] || '');
      const start = new Date(row[startField]);
      const end   = new Date(row[endField]);
      const sTs   = start.getTime();
      const eTs   = end.getTime();

      const left  = isNaN(sTs) ? 0 : ((sTs - minDate) / range) * 100;
      const width = isNaN(sTs) || isNaN(eTs) ? 20 : Math.max(2, ((eTs - sTs) / range) * 100);
      const days  = isNaN(sTs) || isNaN(eTs) ? '?' : Math.round((eTs - sTs) / 86400000) + 'd';

      html += `<tr class="tl-gantt-row">
        <td>${_tlEsc(task)}</td>
        <td>${isNaN(sTs) ? _tlEsc(String(row[startField]||'')) : start.toLocaleDateString()}</td>
        <td>${isNaN(eTs) ? _tlEsc(String(row[endField]||'')) : end.toLocaleDateString()}</td>
        <td class="tl-gantt-bar-cell">
          <div class="tl-gantt-bar-track">
            <div class="tl-gantt-bar" style="left:${left}%;width:${width}%">${_tlEsc(days)}</div>
          </div>
        </td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    _tlRenderConfigHint(viz, container, 'taskField, startField, endField');
  }

  function _tlRenderVertical(viz, rows, container) {
    const cfg = viz.config || {};
    const dateField  = _tlGetField(cfg, rows, 'dateField', 0);
    const titleField = _tlGetField(cfg, rows, 'titleField', 1);
    const descField  = _tlGetField(cfg, rows, 'descField', 2);

    if (!rows.length) {
      container.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px">No data to display.</div>';
      return;
    }

    const sorted = rows.slice().sort(function(a, b) {
      return new Date(a[dateField]) - new Date(b[dateField]);
    });

    let html = '<div class="tl-v-wrap">';
    sorted.forEach(function(row) {
      const date  = String(row[dateField] || '');
      const title = String(row[titleField] || '');
      const desc  = descField ? String(row[descField] || '') : '';
      html += `<div class="tl-v-event">
        <div class="tl-v-dot-col"><div class="tl-v-dot"></div></div>
        <div class="tl-v-content">
          <div class="tl-v-title">${_tlEsc(title)}</div>
          <div class="tl-v-date">${_tlEsc(date)}</div>
          ${desc ? '<div class="tl-v-desc">' + _tlEsc(desc) + '</div>' : ''}
        </div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    _tlRenderConfigHint(viz, container, 'dateField, titleField, descField');
  }

  function _tlRenderConfigHint(viz, container, fields) {
    const cfg = viz.config || {};
    const hasCfg = Object.values(cfg).some(function(v) { return v; });
    if (!hasCfg) {
      const hint = document.createElement('div');
      hint.style.cssText = 'padding:4px 8px;font-size:10px;color:var(--text-muted);background:var(--bg-raised);border-top:1px solid var(--border)';
      hint.textContent = 'Tip: Configure ' + fields + ' in the Viz tab config panel for accurate rendering.';
      container.appendChild(hint);
    }
  }

  function _tlEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render: render };
})();

/* === DWBSplash: splash screen and live tour === */

(function() {

var _spCurrentStep = 0;
var _spResizeHandler = null;

var _spTourSteps = [
  {
    target: '#topbar',
    title: 'Welcome to DWB 2.0',
    desc: 'Your data workbench — pipeline-based transformation and visualization, fully offline.'
  },
  {
    target: '[data-tab="pipeline"]',
    title: 'Pipeline tab',
    desc: 'Build your data transformation pipeline here. Each node processes your data in sequence.'
  },
  {
    target: '#pt-node-list',
    title: 'Node list',
    desc: 'Nodes live on the right. Add, configure, and chain them to shape your data.'
  },
  {
    target: '.pt-add-node-btn',
    title: 'Adding nodes',
    desc: 'Click here to add a node — choose from Transform, Structure, Logic, and more.'
  },
  {
    target: '#pt-inspector',
    title: 'Data inspector',
    desc: 'See your data at every step. The inspector shows the output of the selected node in real time.'
  },
  {
    target: '[data-tab="viz"]',
    title: 'Visualizations tab',
    desc: 'Create named visualization assets — charts, tables, stat cards — bound to your pipeline snapshots.'
  },
  {
    target: '[data-tab="displays"]',
    title: 'Displays tab',
    desc: 'Arrange visualizations into Dashboards, Reports, Presentations, or certificate Merges.'
  },
  {
    target: '[data-tab="wizard"]',
    title: 'Designer & User mode',
    desc: 'Build flows in Designer mode, then share them with non-technical users via the guided User mode wizard.'
  }
];

function _spShowSplash() {
  _spHideSplash();
  var el = document.createElement('div');
  el.id = 'sp-overlay';
  el.innerHTML = _spBuildSplashHTML();
  document.body.appendChild(el);

  el.querySelector('#sp-btn-tour').addEventListener('click', function() {
    _spHideSplash();
    _spStartTour();
  });
  el.querySelector('#sp-btn-start').addEventListener('click', function() {
    _spHideSplash();
    localStorage.setItem('dwb2_toured', '1');
    if (window.DWBShell) window.DWBShell.initNewFlow('Untitled Flow');
  });
}

function _spHideSplash() {
  var el = document.getElementById('sp-overlay');
  if (el) el.remove();
}

function _spBuildSplashHTML() {
  return `<div id="sp-card">
    <div class="sp-anchor">⚓</div>
    <div class="sp-title-row">
      <span class="sp-title-dwb">DWB</span>
      <span class="sp-title-ver">2.0</span>
    </div>
    <div class="sp-tagline">Pipeline-based data transformation and visualization</div>
    <div class="sp-rule"></div>
    <div class="sp-pills">
      <span class="sp-pill">⚙️ Pipeline</span>
      <span class="sp-pill">🎨 Visualizations</span>
      <span class="sp-pill">🖥️ Displays</span>
    </div>
    <div class="sp-actions">
      <button class="btn-primary sp-btn-lg" id="sp-btn-tour">Take a Tour →</button>
      <button class="btn-secondary sp-btn-lg" id="sp-btn-start">Start Fresh</button>
    </div>
  </div>`;
}

function _spStartTour() {
  _spEndTour();
  _spCurrentStep = 0;
  _spAdvanceToStep(0);
}

function _spEndTour() {
  var overlay = document.getElementById('sp-tour-overlay');
  if (overlay) overlay.remove();
  var ring = document.getElementById('sp-tour-ring');
  if (ring) ring.remove();
  var tooltip = document.getElementById('sp-tour-tooltip');
  if (tooltip) tooltip.remove();
  if (_spResizeHandler) {
    window.removeEventListener('resize', _spResizeHandler);
    _spResizeHandler = null;
  }
  localStorage.setItem('dwb2_toured', '1');
  if (window.DWBShell && window.DWBState && !window.DWBState.flow) {
    window.DWBShell.initNewFlow('Untitled Flow');
  }
}

function _spHasNextStep(fromIdx) {
  for (var i = fromIdx + 1; i < _spTourSteps.length; i++) {
    if (document.querySelector(_spTourSteps[i].target)) return true;
  }
  return false;
}

function _spAdvanceToStep(idx) {
  while (idx < _spTourSteps.length && !document.querySelector(_spTourSteps[idx].target)) {
    idx++;
  }
  if (idx >= _spTourSteps.length) {
    _spEndTour();
    return;
  }
  _spCurrentStep = idx;
  _spRenderStep(idx);
}

function _spRenderStep(idx) {
  var step = _spTourSteps[idx];
  var target = document.querySelector(step.target);

  var overlay = document.getElementById('sp-tour-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sp-tour-overlay';
    document.body.appendChild(overlay);
  }

  var ring = document.getElementById('sp-tour-ring');
  if (!ring) {
    ring = document.createElement('div');
    ring.id = 'sp-tour-ring';
    document.body.appendChild(ring);
  }
  _spPositionRing(ring, target);

  var tooltip = document.getElementById('sp-tour-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'sp-tour-tooltip';
    document.body.appendChild(tooltip);
  }

  var isFirst = (idx === 0);
  var isLast  = !_spHasNextStep(idx);

  tooltip.innerHTML = _spBuildTooltipHTML(idx, step, isFirst, isLast);
  _spPositionTooltip(tooltip, target);

  var btnBack = tooltip.querySelector('#sp-tour-back');
  var btnNext = tooltip.querySelector('#sp-tour-next');
  var btnSkip = tooltip.querySelector('#sp-tour-skip');

  if (btnBack) {
    btnBack.addEventListener('click', function() {
      var prev = _spCurrentStep - 1;
      while (prev >= 0 && !document.querySelector(_spTourSteps[prev].target)) {
        prev--;
      }
      if (prev >= 0) {
        _spCurrentStep = prev;
        _spRenderStep(prev);
      }
    });
  }

  btnNext.addEventListener('click', function() {
    if (isLast) {
      _spEndTour();
    } else {
      _spAdvanceToStep(_spCurrentStep + 1);
    }
  });

  btnSkip.addEventListener('click', function() {
    _spEndTour();
  });

  if (_spResizeHandler) window.removeEventListener('resize', _spResizeHandler);
  _spResizeHandler = function() {
    var t = document.querySelector(_spTourSteps[_spCurrentStep].target);
    if (t) {
      _spPositionRing(ring, t);
      _spPositionTooltip(tooltip, t);
    }
  };
  window.addEventListener('resize', _spResizeHandler);
}

function _spPositionRing(ring, target) {
  var rect = target.getBoundingClientRect();
  var pad = 4;
  ring.style.top    = (rect.top    - pad) + 'px';
  ring.style.left   = (rect.left   - pad) + 'px';
  ring.style.width  = (rect.width  + pad * 2) + 'px';
  ring.style.height = (rect.height + pad * 2) + 'px';
}

function _spPositionTooltip(tooltip, target) {
  var rect = target.getBoundingClientRect();
  var vw   = window.innerWidth;
  var vh   = window.innerHeight;
  var TW   = 280;
  var TH   = tooltip.offsetHeight || 160;
  var GAP  = 12;

  var top, left;

  if (rect.bottom + GAP + TH <= vh - 8) {
    top = rect.bottom + GAP;
  } else {
    top = rect.top - GAP - TH;
    if (top < 8) top = Math.max(8, rect.bottom + GAP);
  }

  left = rect.left;
  if (left + TW > vw - 8) left = vw - TW - 8;
  if (left < 8) left = 8;

  tooltip.style.top  = top  + 'px';
  tooltip.style.left = left + 'px';
}

function _spBuildTooltipHTML(idx, step, isFirst, isLast) {
  return `<div class="sp-tip-step">Step ${idx + 1} of ${_spTourSteps.length}</div>
    <div class="sp-tip-title">${step.title}</div>
    <div class="sp-tip-desc">${step.desc}</div>
    <div class="sp-tip-nav">
      ${!isFirst ? '<button class="btn-secondary sp-tip-btn" id="sp-tour-back">← Back</button>' : '<span></span>'}
      <span class="flex-spacer"></span>
      <button class="sp-tip-skip" id="sp-tour-skip">Skip tour</button>
      <button class="btn-primary sp-tip-btn" id="sp-tour-next">${isLast ? 'Finish' : 'Next →'}</button>
    </div>`;
}

window.DWBSplash = {
  showSplash: _spShowSplash,
  hideSplash: _spHideSplash,
  startTour:  _spStartTour,
  endTour:    _spEndTour
};

})();

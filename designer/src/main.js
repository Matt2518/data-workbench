document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initProperties();
  initFields();
  initAssets();
  initIO();

  // Element add buttons
  document.getElementById('btn-add-bound-text').addEventListener('click', () => {
    if (!state.fields.length) {
      alert('Add at least one field in the Fields tab first.');
      return;
    }
    addBoundText(state.fields[0].id);
  });
  document.getElementById('btn-add-static-text').addEventListener('click', () => addStaticText());
  document.getElementById('btn-add-image').addEventListener('click', () => {
    const ids = Object.keys(state.assets);
    if (!ids.length) {
      alert('Upload an image in the Asset Library first.');
      return;
    }
    addImageAsset(ids[0]);
  });
  document.getElementById('btn-add-rect').addEventListener('click', () => addRect());

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('visible'));
      btn.classList.add('active');
      document.getElementById(target + '-tab').classList.add('visible');
    });
  });
  // default tab
  document.querySelector('.tab-btn').click();

  // Grid toggle
  document.getElementById('btn-grid').addEventListener('click', () => {
    applyChange(s => { s.gridOn = !s.gridOn; });
    document.getElementById('btn-grid').classList.toggle('active', state.gridOn);
    renderOverlay();
  });

  // Template name changes meta directly
  document.getElementById('template-name').addEventListener('change', e => {
    applyChange(s => { s.meta.name = e.target.value; });
  });

  // Refit canvas on window resize
  window.addEventListener('resize', () => { updateZoom(); renderOverlay(); });

  // Initial fit after layout settles
  requestAnimationFrame(() => { updateZoom(); renderOverlay(); });
});

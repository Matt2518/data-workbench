// Asset Library — base64 storage and thumbnail management
function initAssets() {
  document.getElementById('btn-upload-asset').addEventListener('click', () => {
    const inp = document.createElement('input'); inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/gif,image/svg+xml,image/webp';
    inp.addEventListener('change', () => {
      if (!inp.files || !inp.files.length) return;
      const file = inp.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        const base64 = dataUrl.slice(comma + 1);
        const assetId = genId('asset');
        applyChange(s => {
          s.assets[assetId] = { name: file.name, type: file.type, data: base64 };
        });
        renderAssets();
      };
      reader.readAsDataURL(file);
    });
    inp.click();
  });

  renderAssets();
}

function renderAssets() {
  const grid = document.getElementById('asset-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.assets);
  if (!entries.length) {
    grid.innerHTML = '<div class="asset-empty">No assets. Upload an image to begin.</div>';
    return;
  }
  for (const [id, asset] of entries) {
    const card = document.createElement('div'); card.className = 'asset-card';

    const thumb = document.createElement('img'); thumb.className = 'asset-thumb';
    thumb.src = `data:${asset.type};base64,${asset.data}`;
    thumb.alt = asset.name;
    card.appendChild(thumb);

    const nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.className = 'asset-name'; nameInp.value = asset.name;
    nameInp.addEventListener('change', () => {
      applyChange(s => { if (s.assets[id]) s.assets[id].name = nameInp.value; });
    });
    card.appendChild(nameInp);

    const btnRow = document.createElement('div'); btnRow.className = 'asset-btn-row';

    const useBtn = document.createElement('button'); useBtn.className = 'btn-sm'; useBtn.textContent = 'Add to canvas';
    useBtn.addEventListener('click', () => { addImageAsset(id); });
    btnRow.appendChild(useBtn);

    const delBtn = document.createElement('button'); delBtn.className = 'btn-sm btn-danger'; delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      applyChange(s => { delete s.assets[id]; });
      renderAssets();
      renderCanvas();
      renderProperties();
    });
    btnRow.appendChild(delBtn);

    card.appendChild(btnRow);
    grid.appendChild(card);
  }
}

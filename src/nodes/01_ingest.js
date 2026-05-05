DWB.register('INGEST', {
  title: 'Ingest CSV',
  icon: '📁',
  category: 'Input & Output',
  desc: 'Load a CSV file into the pipeline.',
  implemented: true,
  defaultConfig: { fileData: null, fileName: '' },

  renderConfig(node, prevData) {
    const body = document.getElementById('config-body');

    const statusHtml = node.config.fileName
      ? `<div style="margin-top:10px;font-size:12px;color:var(--success)">✓ Loaded: ${node.config.fileName}</div>`
      : '';

    const errorHtml = node.status === 'error'
      ? `<div style="margin-top:8px;font-size:11px;color:var(--danger)">${node.errorMsg || 'Error'}</div>`
      : '';

    body.innerHTML = `
      <div id="ingest-dz-${node.id}"
        style="border:2px dashed var(--border-strong);border-radius:6px;
               padding:20px 12px;text-align:center;cursor:pointer;
               transition:border-color 0.15s,background 0.15s">
        <div style="font-size:28px;margin-bottom:6px">📁</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
          Drop a CSV file here, or click Browse
        </div>
        <label style="display:inline-block;padding:5px 16px;background:var(--accent);
                      color:#fff;border-radius:4px;font-size:12px;cursor:pointer;
                      border:none;font-family:inherit">
          Browse…
          <input type="file" accept=".csv" style="display:none" id="ingest-fi-${node.id}">
        </label>
      </div>
      ${statusHtml}${errorHtml}`;

    function handleFile(file) {
      if (!file || !file.name.match(/\.csv$/i)) {
        DWB.log('Please select a .csv file', 'warn');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        node.config.fileData = ev.target.result;
        node.config.fileName = file.name;
        node.customName = file.name;
        DWB.renderTrack();
        DWB.runFrom(node.id);
        DWB.renderActiveNode();
      };
      reader.readAsText(file);
    }

    const fi = document.getElementById(`ingest-fi-${node.id}`);
    fi.addEventListener('change', e => handleFile(e.target.files[0]));

    const dz = document.getElementById(`ingest-dz-${node.id}`);
    dz.addEventListener('dragover', e => {
      e.preventDefault();
      dz.style.borderColor = 'var(--accent)';
      dz.style.background  = 'var(--accent-light)';
    });
    dz.addEventListener('dragleave', () => {
      dz.style.borderColor = 'var(--border-strong)';
      dz.style.background  = '';
    });
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.style.borderColor = 'var(--border-strong)';
      dz.style.background  = '';
      handleFile(e.dataTransfer.files[0]);
    });
  },

  execute(node, inputData) {
    if (!node.config.fileData) throw new Error('No file uploaded.');
    const parsed = DWB.parseCSV(node.config.fileData);
    if (parsed.headers.length === 0) throw new Error('CSV appears to be empty.');
    node.output = parsed;
    DWB.log(`Ingested ${node.config.fileName}: ${parsed.rows.length} rows, ${parsed.headers.length} columns`);
  }
});

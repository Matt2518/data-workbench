/* === DWBSchema: data model, factories, serialization === */
window.DWBSchema = (function() {
  function genId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function createFlow(name) {
    const now = new Date().toISOString();
    const flow = {
      dwbflow: '2.0',
      meta: {
        name: name || 'Untitled Flow',
        created: now,
        modified: now,
        dataMode: 'embedded'
      },
      pipeline: {
        nodes: [],
        sourceData: []
      },
      visualizations: [],
      displays: []
    };
    flow.displays.push(createDisplay('DASHBOARD', 'Dashboard'));
    return flow;
  }

  function createNode(type, label) {
    return {
      id: genId(),
      type: type || 'INGEST',
      label: label || (type || 'Node'),
      config: {},
      promotedAs: null,
      sourceId: null,
      userStep: null
    };
  }

  function createSourceData(filename) {
    return {
      id: genId(),
      filename: filename || '',
      injectedAtNodeId: null,
      rows: []
    };
  }

  function createViz(type, label) {
    return {
      id: genId(),
      type: type || 'DATA_TABLE',
      label: label || (type || 'Visualization'),
      snapshotName: '',
      config: {},
      filterableFields: [],
      linkToDisplayFilters: true
    };
  }

  function createDisplay(type, label) {
    const base = {
      id: genId(),
      type: type || 'DASHBOARD',
      label: label || (type || 'Display'),
      config: {},
      placements: []
    };
    if (type === 'DASHBOARD') {
      base.config.layout = '2col';
      base.config.layoutSplit = '50-50';
      base.filterContext = { activeFilters: {} };
    } else if (type === 'MERGE') {
      base.config.templateSource = 'embedded';
      base.config.template = null;
      base.config.snapshotName = '';
      base.config.bindings = {};
    }
    return base;
  }

  function createPlacement(vizId, type) {
    const base = { id: genId(), vizId: vizId || null, overrides: {} };
    if (type === 'DASHBOARD') {
      base.column = 1;
    } else if (type === 'REPORT') {
      base.pageBreakBefore = false;
      base.sizeMode = 'auto';
      base.explicitHeight = null;
      base.caption = '';
    } else if (type === 'PRESENTATION') {
      base.slideTitle = '';
      base.notes = '';
    } else if (type === 'MERGE') {
      base.snapshotName = '';
      base.bindings = {};
    }
    return base;
  }

  function serialize(flow) {
    const copy = JSON.parse(JSON.stringify(flow));
    copy.meta.modified = new Date().toISOString();
    return JSON.stringify(copy, null, 2);
  }

  function deserialize(text) {
    const obj = JSON.parse(text);
    if (!obj.dwbflow) throw new Error('Not a .dwbflow file');
    // Patch missing fields for forward compat
    obj.pipeline = obj.pipeline || { nodes: [], sourceData: [] };
    obj.visualizations = obj.visualizations || [];
    obj.displays = obj.displays || [];
    if (obj.displays.length === 0) obj.displays.push(createDisplay('DASHBOARD', 'Dashboard'));
    return obj;
  }

  return { genId, createFlow, createNode, createSourceData, createViz, createDisplay, createPlacement, serialize, deserialize };
})();

// Passthrough node — passes input data to output unchanged
DWB.register('passthrough', {
  label: 'Passthrough',
  description: 'Passes data through without modification.',
  inputs: ['data'],
  outputs: ['data'],
  process(inputs) {
    return { data: inputs.data };
  }
});

'use strict';
// Plugin manifest for the data-analysis category.
// Add new plugin filenames here to include them in the build.
module.exports = {
  category: 'Data Analysis',
  plugins: [
    './left-join.js',
    './data-validation.js',
    './diff.js',
    './pivot.js',
    './formula.js',
    './fuzzy-clean.js',
    './regex.js',
    './sentiment-analysis.js'
  ]
};

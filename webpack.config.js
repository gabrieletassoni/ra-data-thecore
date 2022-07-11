const path = require('path');

module.exports = {
    entry: './src/thecore.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production'
};
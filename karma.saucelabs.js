const webpackConfig = require('./webpack.config')(undefined, {mode: 'development'});
const browsers = require('./browsers.json');
const pkg = require('./package.json');

const title = `${pkg.name} ${pkg.version} unit tests`;

module.exports = function(config) {
    config.set({
        frameworks: ['mocha'],
        files: [
            { pattern: 'test/**/*.spec.js' }
        ],

        preprocessors: {
            'test/**/*.spec.js': ['webpack', 'sourcemap']
        },

        webpack: webpackConfig[0],

        reporters: ['mocha', 'saucelabs', 'bamboo'],

        sauceLabs: {
            testName: title,
            startConnect: true,
            verbose: true,
            verboseDebugging: true
        },

        browsers: Object.keys(browsers),
        customLaunchers: browsers,
        browserDisconnectTimeout: 10000, // default 2000
        browserDisconnectTolerance: 1, // default 0
        browserNoActivityTimeout:  4 * 60 * 1000, // default 10000
        captureTimeout: 4 * 60 * 1000, // default 60000
        concurrency: 2,
        singleRun: true,
    });
};
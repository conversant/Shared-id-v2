const webpackConfig = require('./webpack.config')(undefined, {mode: 'development'});
const browsers = require('./browsers.epsilon.json');
const pkg = require('./package.json');

const title = `${pkg.name} ${pkg.version} unit tests`;

const tunnelName = require('./scripts/tunnelName');

console.log(`Using Sauce Connect tunnel: ${tunnelName}`);

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
            startConnect: false,
            tunnelIdentifier: tunnelName,
            verbose: true,
            verboseDebugging: true
        },

        browsers: Object.keys(browsers),
        customLaunchers: browsers,
        browserDisconnectTimeout: 10000,
        browserDisconnectTolerance: 1,
        browserNoActivityTimeout:  4 * 60 * 1000,
        captureTimeout: 4 * 60 * 1000,
        concurrency: 2,
        singleRun: true,
    });
};

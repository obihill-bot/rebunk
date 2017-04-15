// Karma configuration
// Generated on Wed Dec 28 2016 01:47:42 GMT+0100 (WAT)

module.exports = function(config) {

    if (!process.env.SAUCE_USERNAME || !process.env.SAUCE_ACCESS_KEY) {
        console.log('Make sure the SAUCE_USERNAME and SAUCE_ACCESS_KEY environment variables are set.');
        process.exit(1);
    }

    // Browsers to run on Sauce Labs
    // Check out https://saucelabs.com/platforms for all browser/OS combos
    var customLaunchers = {
        sl_desktop_chrome: {
            base: 'SauceLabs',
            browserName: 'chrome',
            platform: 'Windows 10',
            version: '53'
        },
        sl_desktop_firefox: {
            base: 'SauceLabs',
            browserName: 'firefox',
            platform: 'Windows 10',
            version: '47'
        },
        sl_desktop_edge: {
            base: 'SauceLabs',
            browserName: 'microsoftedge',
            platform: 'Windows 10',
            version: '14'
        },
        sl_desktop_ie_11: {
            base: 'SauceLabs',
            browserName: 'internet explorer',
            platform: 'Windows 8.1',
            version: '11'
        },
        sl_desktop_ie_10: {
            base: 'SauceLabs',
            browserName: 'internet explorer',
            platform: 'Windows 8',
            version: '10'
        },
        sl_desktop_ie_9: {
            base: 'SauceLabs',
            browserName: 'internet explorer',
            platform: 'Windows 7',
            version: '9'
        },
        sl_desktop_ie_8: {
            base: 'SauceLabs',
            browserName: 'internet explorer',
            platform: 'Windows 7',
            version: '8'
        }
    }

    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine', 'fixture'],


        // list of files / patterns to load in the browser
        files: [
            //'*Spec.js', '*.spec.js',
            {pattern: 'spec/run/**/*.spec.js'},
            {pattern: 'spec/lib/helper/karma/**/*.js'},
            {pattern: 'spec/src/**/*.js'},
            {pattern: 'spec/fixture/**/*.html'},
            {pattern: 'spec/fixture/**/*.css'}
        ],


        // list of files to exclude
        exclude: [
        ],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            '**/*.html': ['html2js'],
            '**/*.json': ['json_fixtures'],
            'spec/src/**/!(*alpha).js': ['coverage']
        },

        //plugins
        plugins: [
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-phantomjs-launcher',
            'karma-html2js-preprocessor',
            'karma-jasmine',
            'karma-fixture',
            'karma-html2js-preprocessor',
            'karma-json-fixtures-preprocessor',
            'karma-coverage',
            'karma-sauce-launcher'
        ],

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['dots', 'saucelabs'],

        coverageReporter: {
            reporters: [
                {type : 'html', dir : 'result/coverage/report-html', subdir: '.'},
                {type : 'lcov', dir : 'result/coverage/lcov', subdir: '.'},
                {type : 'text', dir : 'result/coverage/report-txt', subdir: '.', file: 'text.txt'},
                {type: 'text-summary', dir : 'result/coverage/report-txt', subdir: '.', file: 'text-summary.txt' }
            ]
        },

        sauceLabs: {
            testName: 'Karma and Sauce Labs demo',
            recordScreenshots: false,
            connectOptions: {
                port: 5757,
                logfile: 'sauce_connect.log'
            },
            public: 'public'
        },

        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,


        customLaunchers: customLaunchers,
        browsers: Object.keys(customLaunchers),
        captureTimeout: 300000,
        browserNoActivityTimeout: 300000,


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: 1
    });
};

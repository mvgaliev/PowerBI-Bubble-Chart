'use strict';

const recursivePathToTests = 'test/**/*.ts',
    srcRecursivePath = '.tmp/drop/visual.js',
    srcCssRecursivePath = '.tmp/drop/visual.css',
    srcOriginalRecursivePath = 'src/**/*.ts',
    coverageFolder = 'coverage';

const browsers = ['Firefox'];

if (process.env.TRAVIS) {
    browsers.push('ChromeTravisCI');
} else {
    browsers.push('Chrome', 'Edge');
}

module.exports = (config) => {
    config.set({
        browsers,
        customLaunchers: {
            ChromeTravisCI: {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        },
        colors: true,
        frameworks: ['jasmine'],
        reporters: [
            'progress',
            'coverage',
            'karma-remap-istanbul'
        ],
        singleRun: true,
        files: [
            srcCssRecursivePath,
            srcRecursivePath,
            'node_modules/jquery/dist/jquery.min.js',
            'node_modules/jasmine-jquery/lib/jasmine-jquery.js',
            'node_modules/powerbi-visuals-utils-testutils/lib/index.js',
            {
                pattern: './capabilities.json',
                watched: false,
                served: true,
                included: false
            },
            recursivePathToTests,
            {
                pattern: srcOriginalRecursivePath,
                included: false,
                served: true
            }
        ],
        preprocessors: {
            [recursivePathToTests]: ['typescript'],
            [srcRecursivePath]: ['sourcemap', 'coverage']
        },
        typescriptPreprocessor: {
            options: {
                sourceMap: false,
                target: 'ES5',
                removeComments: false,
                concatenateOutput: false
            }
        },
        coverageReporter: {
            dir: coverageFolder,
            reporters: [{
                    type: 'html'
                },
                {
                    type: 'lcov'
                }
            ]
        },
        remapIstanbulReporter: {
            reports: {
                lcovonly: coverageFolder + '/lcov.info',
                html: coverageFolder,
                'text-summary': null
            }
        }
    });
};
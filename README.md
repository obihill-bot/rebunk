# Rebunk

A simple in-browser front-end testing framework

<p>
<a href="https://circleci.com/gh/obihill/rebunk"><img src="https://img.shields.io/circleci/project/github/obihill/rebunk/master.svg" alt="Build Status"></a>
<a href="https://codecov.io/gh/obihill/rebunk"><img src="https://img.shields.io/codecov/c/github/obihill/rebunk/master.svg"></a>
<a href="https://github.com/obihill/rebunk/releases"><img src="https://img.shields.io/github/release/obihill/rebunk.svg"></a>
<a href="https://github.com/obihill/rebunk/blob/master/license.md"><img src="https://img.shields.io/github/license/obihill/rebunk.svg"></a>
</p>

## Intro

Rebunk is a simple front-end testing framework for the browser. 

When writing front-end code, you probably use `console.log` at specific breakpoints in your code to describe what is happening .

With rebunk, you simply replace the `console.log` with `rebunk.test`, and rebunk will test the condition and display the results in a sequential and prettified format.

## Install

Install Rebunk by simply adding it to the `<head>` of the Web page you want to test:

```html
<script src="path/to/rebunk.js"></script>
```

You can also use Bower:

```
bower install rebunk
```

## Usage

To use rebunk, first add your JavaScript source file after rebunk in the `<head>` of the Web page that you want to test:

```html
<script src="path/to/rebunk.js"></script>
<script src="path/to/source.js"></script>
```

Then, in your source file [or files] simply add your test conditions:

```javascript
/** source.js **/
var test_fn = function(arg_str){
    return arg_str;
};
var result_str = test_fn('thisisrebunk');

rebunk.test('Test the return value of my function with an expected value', 'thisisnotrebunk', result_str);
```

After this, open the Web page, and then open the browser console to see the test results.

## Resources

- [API Reference](https://github.com/obihill/rebunk/tree/master/wiki/api.md)
- [Examples](https://github.com/obihill/rebunk/tree/master/wiki/examples.md)

## Tests

The tests for rebunk are written using the [Jasmine](https://jasmine.github.io/) test framework via the [Karma](http://karma-runner.github.io/) test runner. 

To run the unit tests, do the following:

```
npm test
```

You can also navigate into the `test` directory and run directly with Karma [using the Chrome browser]:

```
karma start karma.conf.js --browsers Chrome
```

## Issues

If you have any bug reports or feature requests, please file them using the Issues tab. 

## License

[MIT](https://github.com/obihill/rebunk/tree/master/license.md)

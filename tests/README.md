# L4 DAR Prototype - Test Suite

This directory contains the test suite for the L4 DAR Prototype application.

## Overview

The test suite includes:
- **Unit Tests**: Test individual modules and functions
- **Integration Tests**: Test the application as a whole
- **Performance Tests**: Monitor frame rates and performance

## Test Structure

```
tests/
├── test-runner.html      # Main test page (open in browser)
├── test-runner.js        # Test framework and runner
├── settings-tests.js     # Settings module tests
├── physics-tests.js      # Physics module tests
├── input-tests.js        # Input module tests
└── integration-tests.js  # Full application integration tests
```

## Running Tests

### Method 1: Browser (Recommended)
1. Start the local server: `python -m http.server 8000`
2. Open `http://localhost:8000/tests/test-runner.html` in your browser
3. Tests will run automatically and display results

### Method 2: Console
1. Open browser developer tools (F12)
2. Navigate to the test page
3. Check the console for detailed test output

## Test Categories

### Settings Tests
- ✅ Settings validation (numeric, boolean, enum)
- ✅ Prototype pollution protection
- ✅ Save/load functionality
- ✅ Settings updates and clearing

### Physics Tests
- ✅ Constants validation (DAR roll speed, history sizes)
- ✅ Three.js vector and quaternion operations
- ✅ Basic physics calculations
- ✅ Error boundary testing

### Input Tests
- ✅ Device detection
- ✅ Input validation and bounds checking
- ✅ Module cleanup functions
- ✅ Three.js integration

### Integration Tests
- ✅ Application startup
- ✅ Module imports
- ✅ DOM element creation
- ✅ Accessibility attributes
- ✅ Performance API availability

## Test Framework

The test framework provides:
- **Assert.equal()** - Strict equality testing
- **Assert.deepEqual()** - Deep object comparison
- **Assert.throws()** - Exception testing
- **Assert.isTrue/isFalse()** - Boolean testing
- **Assert.isFinite()** - Number validation

## Adding New Tests

To add a new test:

```javascript
testRunner.add('Test Name', () => {
  // Test code here
  Assert.equal(actualValue, expectedValue, 'Optional message');
});
```

## Continuous Integration

Tests are designed to run in any modern browser with ES6 module support. The test suite can be integrated into CI/CD pipelines for automated testing.

## Performance Monitoring

The test suite includes performance monitoring that:
- Tracks frame render times
- Warns about slow frames (>16.67ms)
- Validates Three.js and browser API availability

## Coverage

Current test coverage includes:
- Settings validation and persistence
- Physics constants and calculations
- Input handling and validation
- Application startup and integration
- Accessibility features
- Memory management (cleanup functions)

## Future Enhancements

- Add visual regression tests
- Implement automated performance benchmarks
- Add end-to-end user interaction tests
- Integrate with testing frameworks like Jest or Mocha
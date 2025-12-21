/**
 * test-runner.js
 * Simple test framework for L4 DAR prototype
 * Runs unit tests and reports results
 */

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
    this.outputElement = null;
    this.summaryElement = null;
  }

  /**
   * Initialize DOM elements for output
   */
  initDOM() {
    this.outputElement = document.getElementById('test-output');
    this.summaryElement = document.getElementById('summary');
  }

  /**
   * Add a test to the suite
   * @param {string} name - Test name
   * @param {Function} testFn - Test function
   */
  add(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Run all tests
   */
  async run() {
    this.initDOM();

    const header = '🧪 Running L4 DAR Prototype Tests...\n\n';
    this.log(header);

    for (const test of this.tests) {
      try {
        await test.testFn();
        this.results.passed++;
        this.log(`✅ ${test.name}\n`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ name: test.name, error });
        this.log(`❌ ${test.name}: ${error.message}\n`);
      }
    }

    this.printSummary();
  }

  /**
   * Log message to both console and DOM
   */
  log(message) {
    console.log(message.replace('\n', ''));
    if (this.outputElement) {
      this.outputElement.textContent += message;
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    const total = this.results.passed + this.results.failed;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    let summary = `\n📊 Test Results: ${this.results.passed}/${total} passed (${passRate}%)\n`;

    if (this.results.errors.length > 0) {
      summary += '\n❌ Failed Tests:\n';
      this.results.errors.forEach(({ name, error }) => {
        summary += `  ${name}: ${error.message}\n`;
      });
    }

    if (this.results.passed === total) {
      summary += '\n🎉 All tests passed!';
    }

    this.log(summary);

    // Update summary element
    if (this.summaryElement) {
      this.summaryElement.style.display = 'block';
      this.summaryElement.innerHTML = summary.replace(/\n/g, '<br>');
      this.summaryElement.className = this.results.passed === total ? 'summary success' : 'summary error';
    }
  }
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

class Assert {
  static equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
  }

  static deepEqual(actual, expected, message = '') {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message} Expected ${expectedStr}, got ${actualStr}`);
    }
  }

  static throws(fn, message = '') {
    try {
      fn();
      throw new Error(`${message} Expected function to throw`);
    } catch (error) {
      if (error.message.includes('Expected function to throw')) {
        throw error;
      }
      // Function threw as expected
    }
  }

  static isTrue(value, message = '') {
    if (!value) {
      throw new Error(`${message} Expected true, got ${value}`);
    }
  }

  static isFalse(value, message = '') {
    if (value) {
      throw new Error(`${message} Expected false, got ${value}`);
    }
  }

  static isFinite(value, message = '') {
    if (!isFinite(value)) {
      throw new Error(`${message} Expected finite number, got ${value}`);
    }
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

const testRunner = new TestRunner();

// Export for use in test files
window.TestRunner = TestRunner;
window.Assert = Assert;
window.testRunner = testRunner;

// Auto-run tests when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Load test files
  const testFiles = [
    'settings-tests.js',
    'physics-tests.js',
    'input-tests.js',
    'integration-tests.js',
    'physics-validation-tests.js',
    'performance-tests.js'
  ];

  let loadedCount = 0;

  testFiles.forEach(file => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = file;
    script.onload = () => {
      loadedCount++;
      if (loadedCount === testFiles.length) {
        // All test files loaded, run tests
        setTimeout(() => testRunner.run(), 100);
      }
    };
    script.onerror = () => {
      console.error(`Failed to load test file: ${file}`);
      loadedCount++;
      if (loadedCount === testFiles.length) {
        setTimeout(() => testRunner.run(), 100);
      }
    };
    document.head.appendChild(script);
  });
});
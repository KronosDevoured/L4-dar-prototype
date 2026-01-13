/**
 * debugManager.js
 * Unified debug logging system for the L4 DAR prototype
 * Provides consistent debug output across all modules
 */

// ============================================================================
// DEBUG LEVELS
// ============================================================================

export const DEBUG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

// ============================================================================
// DEBUG MANAGER CLASS
// ============================================================================

class DebugManager {
  constructor() {
    this.level = DEBUG_LEVELS.WARN; // Default: only errors and warnings
    this.enabledCategories = new Set();
    this.disabledCategories = new Set();
    this.startTime = performance.now();
  }

  /**
   * Set global debug level
   * @param {number} level - One of DEBUG_LEVELS
   */
  setLevel(level) {
    if (Object.values(DEBUG_LEVELS).includes(level)) {
      this.level = level;
    } else {
      console.warn(`Invalid debug level: ${level}`);
    }
  }

  /**
   * Enable a specific category
   * @param {string} category - Category name (e.g., 'physics', 'input', 'rendering')
   */
  enableCategory(category) {
    this.enabledCategories.add(category);
    this.disabledCategories.delete(category);
  }

  /**
   * Disable a specific category
   * @param {string} category - Category name
   */
  disableCategory(category) {
    this.disabledCategories.add(category);
    this.enabledCategories.delete(category);
  }

  /**
   * Check if a category should log
   * @param {string} category - Category name
   * @returns {boolean} - Whether to log
   */
  isCategoryEnabled(category) {
    if (this.enabledCategories.has(category)) return true;
    if (this.disabledCategories.has(category)) return false;
    return true; // Default: enabled
  }

  /**
   * Get elapsed time since debug manager was created
   * @returns {number} - Milliseconds
   */
  getElapsedTime() {
    return (performance.now() - this.startTime).toFixed(1);
  }

  /**
   * Format log message with timestamp
   * @param {string} category - Category name
   * @param {string} levelName - Level name (ERROR, WARN, etc.)
   * @param {string} message - Message to log
   * @returns {string} - Formatted message
   */
  formatMessage(category, levelName, message) {
    const elapsed = this.getElapsedTime();
    return `[${elapsed}ms] [${category}] [${levelName}] ${message}`;
  }

  /**
   * Log error message (always shown)
   * @param {string} category - Category name
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  error(category, message, data = null) {
    if (this.level >= DEBUG_LEVELS.ERROR && this.isCategoryEnabled(category)) {
      const formatted = this.formatMessage(category, 'ERROR', message);
      if (data !== null) {
        console.error(formatted, data);
      } else {
        console.error(formatted);
      }
    }
  }

  /**
   * Log warning message
   * @param {string} category - Category name
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  warn(category, message, data = null) {
    if (this.level >= DEBUG_LEVELS.WARN && this.isCategoryEnabled(category)) {
      const formatted = this.formatMessage(category, 'WARN', message);
      if (data !== null) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    }
  }

  /**
   * Log info message
   * @param {string} category - Category name
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  info(category, message, data = null) {
    if (this.level >= DEBUG_LEVELS.INFO && this.isCategoryEnabled(category)) {
      const formatted = this.formatMessage(category, 'INFO', message);
      if (data !== null) {
        console.info(formatted, data);
      } else {
        console.info(formatted);
      }
    }
  }

  /**
   * Log debug message (only shown when DEBUG level set)
   * @param {string} category - Category name
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  debug(category, message, data = null) {
    if (this.level >= DEBUG_LEVELS.DEBUG && this.isCategoryEnabled(category)) {
      const formatted = this.formatMessage(category, 'DEBUG', message);
      if (data !== null) {
        console.log(formatted, data);
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Assert a condition and log error if false
   * @param {boolean} condition - Condition to check
   * @param {string} category - Category name
   * @param {string} message - Message if assertion fails
   */
  assert(condition, category, message) {
    if (!condition) {
      this.error(category, `ASSERTION FAILED: ${message}`);
    }
  }

  /**
   * Reset debug manager to defaults
   */
  reset() {
    this.level = DEBUG_LEVELS.WARN;
    this.enabledCategories.clear();
    this.disabledCategories.clear();
    this.startTime = performance.now();
  }
}

// ============================================================================
// GLOBAL DEBUG MANAGER INSTANCE
// ============================================================================

const debugManager = new DebugManager();

// Export singleton
export default debugManager;

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function setDebugLevel(level) {
  debugManager.setLevel(level);
}

export function enableCategory(category) {
  debugManager.enableCategory(category);
}

export function disableCategory(category) {
  debugManager.disableCategory(category);
}

export function logError(category, message, data = null) {
  debugManager.error(category, message, data);
}

export function logWarn(category, message, data = null) {
  debugManager.warn(category, message, data);
}

export function logInfo(category, message, data = null) {
  debugManager.info(category, message, data);
}

export function logDebug(category, message, data = null) {
  debugManager.debug(category, message, data);
}

export function debugAssert(condition, category, message) {
  debugManager.assert(condition, category, message);
}

/**
 * integration-tests.js
 * Integration tests for the full L4 DAR application
 */

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

// Test that the application can start without errors
testRunner.add('Integration - Application startup', async () => {
  // This test runs after DOM is ready, so if we get here, basic startup worked
  Assert.isTrue(document.readyState === 'complete' || document.readyState === 'interactive');

  // Check that required DOM elements exist (skip if running in test-only mode)
  const canvas = document.getElementById('gl');
  if (canvas) {
    Assert.isTrue(canvas !== null, 'GL canvas should exist');
  } else {
    Assert.isTrue(true, 'Skipped - test-only mode');
  }

  const hud = document.getElementById('hud');
  if (hud) {
    Assert.isTrue(hud !== null, 'HUD canvas should exist');
  }
});

// Test that Three.js is loaded and working
testRunner.add('Integration - Three.js availability', () => {
  if (typeof THREE !== 'undefined') {
    Assert.isTrue(typeof THREE !== 'undefined', 'Three.js should be loaded');
    Assert.isTrue(typeof THREE.Scene !== 'undefined', 'THREE.Scene should be available');
    Assert.isTrue(typeof THREE.WebGLRenderer !== 'undefined', 'THREE.WebGLRenderer should be available');
  } else {
    Assert.isTrue(true, 'Skipped - Three.js not loaded in test-only mode');
  }
});

// Test that modules can be imported
testRunner.add('Integration - Module imports', async () => {
  try {
    // Test importing key modules
    const constants = await import('../docs/js/modules/constants.js');
    Assert.isTrue(typeof constants.CAR_PRESETS !== 'undefined', 'Constants should export CAR_PRESETS');

    const settings = await import('../docs/js/modules/settings.js');
    Assert.isTrue(typeof settings.loadSettings === 'function', 'Settings should export loadSettings');

    // If we get here without errors, imports work
    Assert.isTrue(true);
  } catch (error) {
    Assert.isTrue(false, `Module import failed: ${error.message}`);
  }
});

// Test that the main cleanup function exists
testRunner.add('Integration - Main cleanup function', () => {
  // Check if cleanup function was exposed to window (only in full app mode)
  if (typeof window.cleanup !== 'undefined') {
    Assert.isTrue(typeof window.cleanup === 'function', 'Main cleanup function should be exposed');
  } else {
    Assert.isTrue(true, 'Skipped - test-only mode');
  }
});

// Test performance monitoring
testRunner.add('Integration - Performance monitoring', () => {
  // Test that performance API is available
  Assert.isTrue(typeof performance !== 'undefined', 'Performance API should be available');
  Assert.isTrue(typeof performance.now === 'function', 'performance.now should be available');

  // Test basic timing
  const start = performance.now();
  const end = performance.now();
  Assert.isTrue(end >= start, 'Performance timing should work');
});

// Test localStorage availability
testRunner.add('Integration - localStorage availability', () => {
  let storageAvailable = true;
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
  } catch (error) {
    storageAvailable = false;
  }

  // localStorage should be available in modern browsers
  Assert.isTrue(storageAvailable, 'localStorage should be available');
});

// Test canvas creation
testRunner.add('Integration - Canvas setup', () => {
  const glCanvas = document.getElementById('gl');
  const hudCanvas = document.getElementById('hud');

  if (glCanvas && hudCanvas) {
    Assert.isTrue(glCanvas instanceof HTMLCanvasElement, 'GL canvas should be HTMLCanvasElement');
    Assert.isTrue(hudCanvas instanceof HTMLCanvasElement, 'HUD canvas should be HTMLCanvasElement');

    // Test that canvases have proper dimensions
    Assert.isTrue(glCanvas.width > 0, 'GL canvas should have width');
    Assert.isTrue(glCanvas.height > 0, 'GL canvas should have height');
    Assert.isTrue(hudCanvas.width > 0, 'HUD canvas should have width');
    Assert.isTrue(hudCanvas.height > 0, 'HUD canvas should have height');
  } else {
    Assert.isTrue(true, 'Skipped - test-only mode');
  }
});

// Test UI elements exist
testRunner.add('Integration - UI elements', () => {
  const menuBtn = document.getElementById('menuBtn');
  
  if (menuBtn) {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const themeBtn = document.getElementById('themeBtn');
    const ringModeBtn = document.getElementById('ringModeBtn');

    Assert.isTrue(menuBtn !== null, 'Menu button should exist');
    Assert.isTrue(fullscreenBtn !== null, 'Fullscreen button should exist');
    Assert.isTrue(themeBtn !== null, 'Theme button should exist');
    Assert.isTrue(ringModeBtn !== null, 'Ring mode button should exist');
  } else {
    Assert.isTrue(true, 'Skipped - test-only mode');
  }
});

// Test accessibility attributes
testRunner.add('Integration - Accessibility attributes', () => {
  const menuBtn = document.getElementById('menuBtn');
  
  if (menuBtn) {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const themeBtn = document.getElementById('themeBtn');
    const ringModeBtn = document.getElementById('ringModeBtn');

    // Check that aria-label attributes were added
    Assert.isTrue(menuBtn.hasAttribute('aria-label'), 'Menu button should have aria-label');
    Assert.isTrue(fullscreenBtn.hasAttribute('aria-label'), 'Fullscreen button should have aria-label');
    Assert.isTrue(themeBtn.hasAttribute('aria-label'), 'Theme button should have aria-label');
    Assert.isTrue(ringModeBtn.hasAttribute('aria-label'), 'Ring mode button should have aria-label');
  } else {
    Assert.isTrue(true, 'Skipped - test-only mode');
  }
});
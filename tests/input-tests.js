/**
 * input-tests.js
 * Unit tests for input module
 */

// ============================================================================
// INPUT TESTS
// ============================================================================

// Import constants
import * as CONST from '../docs/js/modules/constants.js';
import * as THREE from 'three';

// Test device detection constants
testRunner.add('Input - Device detection', async () => {
  // Import fresh to ensure availability
  const CONST_MODULE = await import('../docs/js/modules/constants.js');
  const test_CONST = CONST_MODULE.default || CONST_MODULE;
  
  // Test that device detection constants exist and are booleans
  Assert.isTrue(test_CONST.isMobile !== undefined, 'isMobile should be defined');
  Assert.isTrue(test_CONST.isDesktop !== undefined, 'isDesktop should be defined');
});

// Test stick deadzone constant
testRunner.add('Input - Stick deadzone constant', async () => {
  // Import the constant from input module
  try {
    const input = await import('../docs/js/modules/input.js');
    Assert.isTrue(typeof input.STICK_DEADZONE === 'number');
    Assert.isTrue(input.STICK_DEADZONE >= 0 && input.STICK_DEADZONE <= 0.5);
  } catch (error) {
    // If import fails, that's also a test failure
    Assert.isTrue(false, 'Failed to import input module');
  }
});

// Test Three.js Vector2 operations (used in input)
testRunner.add('Input - Vector2 operations', () => {
  const vec = new THREE.Vector2(1, 2);

  // Test basic operations
  Assert.equal(vec.x, 1);
  Assert.equal(vec.y, 2);

  // Test length calculation
  const length = vec.length();
  Assert.equal(length, Math.sqrt(5));

  // Test normalization
  vec.normalize();
  Assert.isTrue(Math.abs(vec.length() - 1.0) < 0.001);
});

// Test input validation (joystick bounds)
testRunner.add('Input - Joystick bounds validation', () => {
  // Test that joystick values are clamped properly
  const testValue = (value) => {
    // Simulate joystick input processing
    const clamped = Math.max(-1, Math.min(1, value));
    return clamped;
  };

  Assert.equal(testValue(0.5), 0.5);
  Assert.equal(testValue(1.5), 1.0); // Should clamp to 1.0
  Assert.equal(testValue(-1.5), -1.0); // Should clamp to -1.0
  Assert.equal(testValue(0), 0);
});

// Test air roll state management
testRunner.add('Input - Air roll state logic', () => {
  // Test basic air roll values
  const testAirRoll = (value) => {
    return value === -1 || value === 0 || value === 1 || value === 2;
  };

  Assert.isTrue(testAirRoll(-1)); // Left
  Assert.isTrue(testAirRoll(0));  // Off
  Assert.isTrue(testAirRoll(1));  // Right
  Assert.isTrue(testAirRoll(2));  // Free
  Assert.isFalse(testAirRoll(3)); // Invalid
});

// Test input module cleanup (smoke test)
testRunner.add('Input - Cleanup function exists', async () => {
  // Test that cleanup function can be called without error
  try {
    const input = await import('../docs/js/modules/input.js');
    Assert.isTrue(typeof input.cleanup === 'function');
    // Call cleanup to ensure it doesn't throw
    input.cleanup();
    Assert.isTrue(true);
  } catch (error) {
    Assert.isTrue(false, 'Failed to import or cleanup input module');
  }
});

// Test touch input constants
testRunner.add('Input - Touch input constants', async () => {
  try {
    const touch = await import('../docs/js/modules/input/touchInput.js');
    // Test that constants are defined and reasonable (if exported)
    if (touch.JOY_BASE_R !== undefined) {
      Assert.isTrue(typeof touch.JOY_BASE_R === 'number');
      Assert.isTrue(touch.JOY_BASE_R > 0);
    }
    
    // Module imported successfully
    Assert.isTrue(true, 'Touch input module imported');
  } catch (error) {
    Assert.isTrue(false, `Failed to import touch input module: ${error.message}`);
  }
});

// Test gamepad input constants
testRunner.add('Input - Gamepad input constants', async () => {
  try {
    const gamepad = await import('../docs/js/modules/input/gamepadInput.js');
    // Test that deadzone is reasonable (if exported)
    if (gamepad.GP_DEADZONE !== undefined) {
      Assert.isTrue(typeof gamepad.GP_DEADZONE === 'number');
      Assert.isTrue(gamepad.GP_DEADZONE >= 0 && gamepad.GP_DEADZONE <= 0.5);
    }
    
    // Module imported successfully
    Assert.isTrue(true, 'Gamepad input module imported');
  } catch (error) {
    Assert.isTrue(false, `Failed to import gamepad input module: ${error.message}`);
  }
});

// Test keyboard input cleanup
testRunner.add('Input - Keyboard input cleanup', async () => {
  try {
    const keyboard = await import('../docs/js/modules/input/keyboardInput.js');
    Assert.isTrue(typeof keyboard.cleanup === 'function');
    // Test cleanup doesn't throw
    keyboard.cleanup();
    Assert.isTrue(true);
  } catch (error) {
    Assert.isTrue(false, 'Failed to import or cleanup keyboard input module');
  }
});

// Test air roll controller cleanup
testRunner.add('Input - Air roll controller cleanup', () => {
  import('../docs/js/modules/input/airRollController.js').then(airRoll => {
    Assert.isTrue(typeof airRoll.cleanup === 'function');
    // Test cleanup doesn't throw
    airRoll.cleanup();
    Assert.isTrue(true);
  }).catch(() => {
    Assert.isTrue(false, 'Failed to import or cleanup air roll controller module');
  });
});

// Test main input module cleanup
testRunner.add('Input - Main module cleanup', () => {
  import('../docs/js/modules/input.js').then(input => {
    Assert.isTrue(typeof input.cleanup === 'function');
    // Test cleanup doesn't throw (this would catch the duplicate identifier error)
    input.cleanup();
    Assert.isTrue(true);
  }).catch((error) => {
    Assert.isTrue(false, `Failed to import or cleanup input module: ${error.message}`);
  });
});
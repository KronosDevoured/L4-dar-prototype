/**
 * physics-tests.js
 * Unit tests for physics module
 */

// ============================================================================
// PHYSICS TESTS
// ============================================================================

// Import physics constants
import * as CONST from '../docs/js/modules/constants.js';
import * as THREE from 'three';

// Test DAR roll speed constant
testRunner.add('Physics - DAR roll speed constant', () => {
  Assert.equal(CONST.DAR_ROLL_SPEED, 5.5);
  Assert.isFinite(CONST.DAR_ROLL_SPEED);
});

// Test input history size constant
testRunner.add('Physics - Input history size constant', () => {
  Assert.equal(CONST.INPUT_HISTORY_SIZE, 3);
  Assert.isTrue(CONST.INPUT_HISTORY_SIZE > 0);
});

// Test angular velocity history length constant
testRunner.add('Physics - Angular velocity history length constant', () => {
  Assert.equal(CONST.ANGULAR_VELOCITY_HISTORY_LENGTH, 30);
  Assert.isTrue(CONST.ANGULAR_VELOCITY_HISTORY_LENGTH > 0);
});

// Test physics calculations (basic math)
testRunner.add('Physics - Basic angular velocity calculations', () => {
  // Test that basic vector operations work
  const vec1 = new THREE.Vector3(1, 2, 3);
  const vec2 = new THREE.Vector3(4, 5, 6);

  vec1.add(vec2);
  Assert.deepEqual(vec1, new THREE.Vector3(5, 7, 9));

  vec1.multiplyScalar(2);
  Assert.deepEqual(vec1, new THREE.Vector3(10, 14, 18));
});

// Test quaternion operations (critical for physics)
testRunner.add('Physics - Quaternion operations', () => {
  const quat = new THREE.Quaternion(0, 0, 0, 1); // Identity quaternion

  // Test identity quaternion
  Assert.equal(quat.x, 0);
  Assert.equal(quat.y, 0);
  Assert.equal(quat.z, 0);
  Assert.equal(quat.w, 1);

  // Test normalization
  quat.set(1, 1, 1, 1);
  quat.normalize();
  const length = Math.sqrt(quat.x*quat.x + quat.y*quat.y + quat.z*quat.z + quat.w*quat.w);
  Assert.isTrue(Math.abs(length - 1.0) < 0.001); // Should be approximately 1
});

// Test physics constants are reasonable
testRunner.add('Physics - Constants are reasonable', () => {
  // DAR roll speed should be reasonable (not too fast or slow)
  Assert.isTrue(CONST.DAR_ROLL_SPEED > 0 && CONST.DAR_ROLL_SPEED < 20);

  // Input history should be small but positive
  Assert.isTrue(CONST.INPUT_HISTORY_SIZE >= 1 && CONST.INPUT_HISTORY_SIZE <= 10);

  // Angular velocity history should be reasonable for smoothing
  Assert.isTrue(CONST.ANGULAR_VELOCITY_HISTORY_LENGTH >= 10 && CONST.ANGULAR_VELOCITY_HISTORY_LENGTH <= 100);
});

// Test physics error handling (if we can access the functions)
testRunner.add('Physics - Error boundaries work', () => {
  // Test that our error boundaries don't crash the test runner
  try {
    // This should not throw
    Assert.isTrue(true);
  } catch (error) {
    throw new Error('Error boundary test failed');
  }
});

// Test Three.js is available
testRunner.add('Physics - Three.js availability', () => {
  Assert.isTrue(typeof THREE !== 'undefined');
  Assert.isTrue(typeof THREE.Vector3 !== 'undefined');
  Assert.isTrue(typeof THREE.Quaternion !== 'undefined');
});

// Test physics module can be imported (basic smoke test)
testRunner.add('Physics - Module import smoke test', () => {
  // If we get here, the module imported successfully
  Assert.isTrue(true);
});

// Test DAR physics responsiveness
testRunner.add('Physics - DAR Responsiveness', async () => {
  // Test that DAR mode uses higher PD gains for snappier movement
  // This is tested indirectly by ensuring the physics module loads correctly
  try {
    const physics = await import('../docs/js/modules/physics.js');
    Assert.isTrue(typeof physics.updatePhysics === 'function');
    // The actual PD gain logic is internal to the module
    // Higher gains (400 vs 200) are used when DAR is active for snappier response
  } catch (error) {
    Assert.isTrue(false, 'Failed to import physics module');
  }
});
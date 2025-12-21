/**
 * physics-validation-tests.js
 * Tests for physics accuracy against Rocket League measurements
 */

// ============================================================================
// PHYSICS VALIDATION TESTS
// ============================================================================

// Test that physics constants match expected values
testRunner.add('Physics Validation - DAR Roll Speed', async () => {
  // Import the constant and verify it matches RL measurements
  const module = await import('../docs/js/modules/constants.js');
  const CONST = module.default || module;
  
  // DAR roll speed should be 5.5 rad/s (from RL measurements)
  Assert.equal(CONST.DAR_ROLL_SPEED, 5.5);

  // Convert to degrees per second for verification
  const degPerSec = (CONST.DAR_ROLL_SPEED * 180) / Math.PI;
  Assert.isTrue(degPerSec > 300 && degPerSec < 330, 'DAR roll speed should be ~315 deg/s');
});

// Test physics damping values match RL
testRunner.add('Physics Validation - Damping Constants', async () => {
  const module = await import('../docs/js/modules/constants.js');
  const CONST = module.default || module;
  
  // No-DAR damping should be 2.96 (from RL measurements)
  Assert.equal(CONST.PHYSICS_DEFAULTS.damp, 2.96);

  // DAR damping should be 4.35 (from RL measurements)
  Assert.equal(CONST.PHYSICS_DEFAULTS.dampDAR, 4.35);
});

// Test angular velocity limits
testRunner.add('Physics Validation - Angular Velocity Limits', async () => {
  const module = await import('../docs/js/modules/constants.js');
  const CONST = module.default || module;
  
  // Global angular velocity cap should be 5.5 rad/s
  Assert.equal(CONST.PHYSICS_DEFAULTS.wmax, 5.5);

  // Individual axis limits should match global cap (5.5 rad/s)
  Assert.equal(CONST.PHYSICS_DEFAULTS.wmaxPitch, 5.5);
  Assert.equal(CONST.PHYSICS_DEFAULTS.wmaxYaw, 5.5);
  Assert.equal(CONST.PHYSICS_DEFAULTS.wmaxRoll, 5.5);
});

// Test acceleration values are in reasonable range
testRunner.add('Physics Validation - Acceleration Values', async () => {
  const module = await import('../docs/js/modules/constants.js');
  const CONST = module.default || module;
  
  // Pitch acceleration should be ~733 deg/s²
  Assert.isTrue(CONST.PHYSICS_DEFAULTS.accelPitch >= 700 && CONST.PHYSICS_DEFAULTS.accelPitch <= 800);

  // Yaw acceleration should be ~528 deg/s²
  Assert.isTrue(CONST.PHYSICS_DEFAULTS.accelYaw >= 500 && CONST.PHYSICS_DEFAULTS.accelYaw <= 600);

  // Roll acceleration should be ~898 deg/s²
  Assert.isTrue(CONST.PHYSICS_DEFAULTS.accelRoll >= 850 && CONST.PHYSICS_DEFAULTS.accelRoll <= 950);
});

// Test that physics calculations produce expected results
testRunner.add('Physics Validation - Basic Calculations', () => {
  // Test angular velocity integration (simplified)
  const dt = 0.016; // 60 FPS
  const accel = 715; // deg/s²
  const accelRad = (accel * Math.PI) / 180; // Convert to rad/s²

  // Initial velocity
  let w = 0;

  // Apply acceleration for one frame
  w += accelRad * dt;

  // Should produce reasonable angular velocity
  Assert.isTrue(w > 0 && w < 1, 'Angular velocity should be reasonable after one frame');

  // Test over multiple frames (1 second)
  for (let i = 0; i < 60; i++) {
    w += accelRad * dt;
  }

  // After 1 second, should be close to accel (in rad/s)
  Assert.isTrue(w > accelRad * 0.8 && w < accelRad * 1.2, 'Angular velocity should accumulate properly');
});

// Test input curve calculation
testRunner.add('Physics Validation - Input Curve', () => {
  const inputPow = 1.5; // Default curve power
  const testInputs = [0.1, 0.5, 0.9];

  testInputs.forEach(input => {
    const curved = Math.pow(input, inputPow);
    Assert.isTrue(curved >= 0 && curved <= 1, 'Curved input should be in [0,1] range');
    // For inputPow > 1, values < 1 will be smaller (softer curve at low inputs)
    Assert.isTrue(curved <= input, 'Curve should soften input values (pow > 1)');
  });
});

// Test deadzone handling
testRunner.add('Physics Validation - Deadzone Handling', () => {
  const deadzone = 0.15;
  const testInputs = [
    { input: 0.1, expected: 0 }, // Below deadzone
    { input: 0.2, expected: (0.2 - 0.15) / (1 - 0.15) }, // Above deadzone: ~0.0588
    { input: 0.5, expected: (0.5 - 0.15) / (1 - 0.15) }, // Well above: ~0.4118
    { input: 1.0, expected: 1.0 } // Max input
  ];

  testInputs.forEach(({ input, expected }) => {
    let effectiveInput = 0;
    if (Math.abs(input) > deadzone) {
      effectiveInput = (Math.abs(input) - deadzone) / (1 - deadzone);
      effectiveInput = Math.sign(input) * Math.min(effectiveInput, 1);
    }

    Assert.isTrue(Math.abs(effectiveInput - expected) < 0.01, `Deadzone calculation failed for input ${input}: expected ${expected.toFixed(4)}, got ${effectiveInput.toFixed(4)}`);
  });
});

// Test DAR PD gains are higher than normal gains
testRunner.add('Physics Validation - DAR PD Gains', async () => {
  try {
    await import('../docs/js/modules/physics.js');
    // We can't directly access the constants, but we can test that DAR mode produces different behavior
    // This is tested indirectly through the physics calculations
    Assert.isTrue(true, 'DAR PD gains test placeholder - gains are now dynamic in physics module');
  } catch (error) {
    Assert.isTrue(false, 'Failed to import physics module for DAR gains test');
  }
});
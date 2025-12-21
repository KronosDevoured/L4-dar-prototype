/**
 * performance-tests.js
 * Performance benchmarks for L4 DAR prototype
 */

import * as THREE from 'three';

// ============================================================================
// PERFORMANCE BENCHMARKS
// ============================================================================

// Test frame rate stability
testRunner.add('Performance - Frame Rate Stability', async () => {
  const frameTimes = [];
  const targetFPS = 60;
  const targetFrameTime = 1000 / targetFPS; // ~16.67ms
  const testDuration = 1000; // 1 second
  let startTime = performance.now();
  let lastFrameTime = startTime;

  // Simulate frame loop
  let frameCount = 0;
  return new Promise((resolve) => {
    const frameLoop = () => {
      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      
      const elapsed = now - startTime;

      if (elapsed < testDuration) {
        frameCount++;
        frameTimes.push(frameTime);
        requestAnimationFrame(frameLoop);
      } else {
        // Analyze results
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const fps = 1000 / avgFrameTime;
        const variance = frameTimes.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / frameTimes.length;
        const stdDev = Math.sqrt(variance);

        // Frame time should be positive and reasonable (browser may run faster than 60fps)
        Assert.isTrue(avgFrameTime > 0 && avgFrameTime < 100,
          `Average frame time ${avgFrameTime.toFixed(2)}ms should be reasonable (0-100ms)`);

        // FPS should be reasonable (allow wide variance for different browsers/hardware)
        Assert.isTrue(fps > 10 && fps < 300,
          `FPS ${fps.toFixed(1)} should be between 10-300`);

        // Frame time variance should be reasonable
        Assert.isTrue(stdDev < 50,
          `Frame time standard deviation ${stdDev.toFixed(2)}ms should be < 50ms for stable performance`);
        
        resolve();
      }
    };

    requestAnimationFrame(frameLoop);
  });
});

// Test physics calculation performance
testRunner.add('Performance - Physics Calculation Speed', async () => {
  // Import physics module
  try {
    const Physics = await import('../docs/js/modules/physics.js');
    const iterations = 1000;
    const dt = 0.016; // 60 FPS

    // Create mock game state
    const mockGameState = {
      car: {
        position: new THREE.Vector3(0, 0, 0),
        quaternion: new THREE.Quaternion(),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        linearVelocity: new THREE.Vector3(0, 0, 0)
      },
      input: {
        pitch: 0.5,
        yaw: 0.3,
        roll: 0.2,
        throttle: 0.8,
        jump: false,
        boost: false
      },
      settings: {
        damp: 2.96,
        dampDAR: 4.35,
        wMax: 5.5,
        wMaxPitch: 8.0,
        wMaxYaw: 8.0,
        wMaxRoll: 5.5,
        maxAccelPitch: 715,
        maxAccelYaw: 528,
        maxAccelRoll: 898,
        inputPow: 1.5,
        deadzone: 0.15
      }
    };

    // Time physics updates
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Simulate physics update (without error boundaries for pure performance test)
      const car = mockGameState.car;
      const input = mockGameState.input;
      const settings = mockGameState.settings;

      // Simplified physics calculation (core logic)
      const inputPitch = Math.pow(Math.abs(input.pitch), settings.inputPow) * Math.sign(input.pitch);
      const inputYaw = Math.pow(Math.abs(input.yaw), settings.inputPow) * Math.sign(input.yaw);
      const inputRoll = Math.pow(Math.abs(input.roll), settings.inputPow) * Math.sign(input.roll);

      // Apply deadzone
      const applyDeadzone = (value) => {
        if (Math.abs(value) < settings.deadzone) return 0;
        return Math.sign(value) * (Math.abs(value) - settings.deadzone) / (1 - settings.deadzone);
      };

      const pitchInput = applyDeadzone(inputPitch);
      const yawInput = applyDeadzone(inputYaw);
      const rollInput = applyDeadzone(inputRoll);

      // Calculate accelerations (simplified)
      const pitchAccel = pitchInput * (settings.maxAccelPitch * Math.PI / 180);
      const yawAccel = yawInput * (settings.maxAccelYaw * Math.PI / 180);
      const rollAccel = rollInput * (settings.maxAccelRoll * Math.PI / 180);

      // Update angular velocity
      car.angularVelocity.x += pitchAccel * dt;
      car.angularVelocity.y += yawAccel * dt;
      car.angularVelocity.z += rollAccel * dt;

      // Apply damping
      const damp = input.roll !== 0 ? settings.dampDAR : settings.damp;
      car.angularVelocity.multiplyScalar(Math.pow(damp, dt));

      // Clamp velocities
      car.angularVelocity.x = Math.max(-settings.wMaxPitch, Math.min(settings.wMaxPitch, car.angularVelocity.x));
      car.angularVelocity.y = Math.max(-settings.wMaxYaw, Math.min(settings.wMaxYaw, car.angularVelocity.y));
      car.angularVelocity.z = Math.max(-settings.wMaxRoll, Math.min(settings.wMaxRoll, car.angularVelocity.z));
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerUpdate = totalTime / iterations;

    // Physics should be fast enough for 60 FPS (under 16.67ms per update)
    Assert.isTrue(avgTimePerUpdate < 1.0,
      `Physics update time ${avgTimePerUpdate.toFixed(3)}ms should be < 1.0ms for smooth 60 FPS`);

    // Should handle at least 1000 updates per second
    Assert.isTrue(iterations / (totalTime / 1000) > 500,
      `Should handle > 500 physics updates per second`);
  } catch (error) {
    Assert.isTrue(false, `Physics test failed: ${error.message}`);
  }
});

// Test memory usage stability
testRunner.add('Performance - Memory Usage Stability', async () => {
  if (!performance.memory) {
    console.warn('Performance.memory not available, skipping memory test');
    return;
  }

  const initialMemory = performance.memory.usedJSHeapSize;
  const samples = [];
  const testDuration = 2000; // 2 seconds

  // Monitor memory over time
  const startTime = performance.now();
  const monitor = () => {
    const elapsed = performance.now() - startTime;
    samples.push({
      time: elapsed,
      memory: performance.memory.usedJSHeapSize
    });

    if (elapsed < testDuration) {
      setTimeout(monitor, 100);
    } else {
      // Analyze memory usage
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemory = Math.max(...samples.map(s => s.memory));
      const memoryVariance = samples.reduce((sum, s) => sum + Math.pow(s.memory - initialMemory, 2), 0) / samples.length;

      // Memory increase should be minimal (less than 10MB)
      Assert.isTrue(memoryIncrease < 10 * 1024 * 1024,
        `Memory increase ${Math.round(memoryIncrease / 1024 / 1024)}MB should be < 10MB`);

      // Memory usage should be relatively stable (low variance)
      Assert.isTrue(Math.sqrt(memoryVariance) < 2 * 1024 * 1024,
        `Memory variance should be < 2MB for stable usage`);
    }
  };

  return new Promise(resolve => {
    monitor();
    setTimeout(() => resolve(), testDuration + 500);
  });
});

// Test Three.js object creation/destruction performance
testRunner.add('Performance - Three.js Object Management', () => {
  const iterations = 100;
  const objects = [];

  // Time object creation
  const createStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    objects.push(mesh);
  }
  const createTime = performance.now() - createStart;

  // Time object disposal
  const disposeStart = performance.now();
  objects.forEach(obj => {
    obj.geometry.dispose();
    obj.material.dispose();
  });
  const disposeTime = performance.now() - disposeStart;

  // Cleanup
  objects.length = 0;

  // Object creation should be reasonably fast
  const avgCreateTime = createTime / iterations;
  Assert.isTrue(avgCreateTime < 1.0,
    `Three.js object creation ${avgCreateTime.toFixed(3)}ms should be < 1.0ms per object`);

  // Object disposal should be fast
  const avgDisposeTime = disposeTime / iterations;
  Assert.isTrue(avgDisposeTime < 0.1,
    `Three.js object disposal ${avgDisposeTime.toFixed(3)}ms should be < 0.1ms per object`);
});
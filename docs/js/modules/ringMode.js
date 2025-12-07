/**
 * ringMode.js
 * Ring Mode game logic for L4 DAR prototype
 * Handles ring spawning, physics, collision detection, and camera control
 */

import * as THREE from 'three';
import * as CONST from './constants.js';
import * as Car from './car.js';
import * as Audio from './audio.js';
import { settings, saveSettings } from './settings.js';

// ============================================================================
// PRIVATE STATE VARIABLES
// ============================================================================

// Ring Mode state
let ringModeActive = false;
let ringModeScore = 0;
let ringModeHighScore = settings.ringModeHighScore ?? 0;
let ringModeLives = 5;
let ringModeRingCount = 0;
let ringCameraSpeed = settings.ringCameraSpeed ?? 0.1;

// Ring Mode physics
let ringModeVelocity = new THREE.Vector2(0, 0); // XY velocity only
let ringModePosition = new THREE.Vector2(0, 0); // Car position in 2D plane
let ringModeStarted = false; // Track if player has started (boosted at least once)
let ringModePaused = false; // Track pause state
let ignoreBoostUntilRelease = false; // Ignore boost input after respawn until released

// Boost flame effects
let boostFlames = [];

// Camera smooth path tracking
let cameraTargetX = 0; // Smooth interpolated camera target position
let cameraTargetY = 0;

// Ring geometry and spawning
let rings = []; // Active rings in the scene
let currentColorIndex = 0;

// Preloaded ring resources (cached geometry and materials)
let ringGeometryCache = null;
let ringMaterialCache = new Map(); // Cache materials by color
let ringResourcesPreloaded = false;

// Ring spawning state
let ringSpawnTimer = 0;
let ringSpawnIndex = 0; // Track spawn order for camera focusing

let currentDifficulty = settings.ringDifficulty ?? 'normal';

// Pattern generation variables
let currentPattern = 'random';
let patternProgress = 0; // Progress through current pattern (0-1)
let patternLength = 15; // Number of rings in this pattern
let patternRingCount = 0; // Rings spawned in current pattern
const PATTERN_TYPES = ['sine_horizontal', 'sine_vertical', 'spiral', 'helix', 'figure8', 'vertical_line', 'horizontal_line', 'wave_combo', 'random'];

// Pattern parameters (randomized when pattern changes)
let patternAmplitude = 400; // Wave/spiral amplitude
let patternFrequency = 0.5; // Oscillation frequency
let patternPhase = 0; // Starting phase offset

// Scene and camera references (set during initialization)
let scene = null;
let camera = null;
let renderer = null;

// External physics state (passed in from main code)
let externalW = null; // Angular velocity vector
let externalOrbitOn = null; // Orbit mode flag (object with value property)

// ============================================================================
// EXPORTED GETTERS
// ============================================================================

export function getRingModeActive() { return ringModeActive; }
export function getRingModeScore() { return ringModeScore; }
export function getRingModeHighScore() { return ringModeHighScore; }
export function getRingModeLives() { return ringModeLives; }
export function getRingModeRingCount() { return ringModeRingCount; }
export function getRingCameraSpeed() { return ringCameraSpeed; }
export function getRingModeVelocity() { return new THREE.Vector2(ringModeVelocity.x, ringModeVelocity.y); }
export function getRingModePosition() { return new THREE.Vector2(ringModePosition.x, ringModePosition.y); }
export function getRingModeStarted() { return ringModeStarted; }
export function getRingModePaused() { return ringModePaused; }
export function getCurrentDifficulty() { return currentDifficulty; }
export function getRings() { return rings; }
export function getCameraTarget() { return { x: cameraTargetX, y: cameraTargetY }; }
export function getBoostFlames() { return boostFlames; }

// ============================================================================
// EXPORTED SETTERS
// ============================================================================

export function setRingModeActive(active) { ringModeActive = active; }
export function setRingModePaused(paused) { ringModePaused = paused; }
export function toggleRingModePaused() {
  ringModePaused = !ringModePaused;
  return ringModePaused;
}
export function setRingCameraSpeed(speed) { ringCameraSpeed = speed; }
export function setCurrentDifficulty(diff) {
  currentDifficulty = diff;
  saveSettings({ ringDifficulty: diff });
}
export function setRingModeLives(lives) { ringModeLives = lives; }
export function setRingModePosition(x, y) { ringModePosition.set(x, y); }
export function setRingModeVelocity(x, y) { ringModeVelocity.set(x, y); }

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Ring Mode with scene and camera references
 * @param {THREE.Scene} sceneRef - Three.js scene
 * @param {THREE.Camera} cameraRef - Three.js camera
 * @param {THREE.WebGLRenderer} rendererRef - Three.js renderer
 * @param {THREE.Vector3} wRef - Angular velocity vector reference
 * @param {Object} orbitOnRef - Orbit mode flag reference (object with value property)
 */
export function initRingMode(sceneRef, cameraRef, rendererRef, wRef, orbitOnRef) {
  scene = sceneRef;
  camera = cameraRef;
  renderer = rendererRef;
  externalW = wRef;
  externalOrbitOn = orbitOnRef;

  // Load settings
  ringModeHighScore = settings.ringModeHighScore ?? 0;
  currentDifficulty = settings.ringDifficulty ?? 'normal';
  ringCameraSpeed = settings.ringCameraSpeed ?? 0.1;

  // Preload resources
  preloadRingResources();

  console.log('[Ring Mode] Initialized');
}

// ============================================================================
// RESOURCE PRELOADING
// ============================================================================

/**
 * Preload ring resources to prevent lag on first spawn
 */
function preloadRingResources() {
  if (ringResourcesPreloaded) return;

  console.log('[Ring Mode] Preloading resources...');

  // Cache shared geometry (all rings use same torus geometry)
  ringGeometryCache = new THREE.TorusGeometry(CONST.INITIAL_RING_SIZE / 2, CONST.RING_TUBE_RADIUS, 16, 32);

  // Cache materials for each color
  CONST.RING_COLORS.forEach(color => {
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.2
    });
    ringMaterialCache.set(color, material);
  });

  // Create a dummy ring offscreen and render it to compile shaders
  const dummyRing = new THREE.Mesh(
    ringGeometryCache,
    ringMaterialCache.get(CONST.RING_COLORS[0])
  );
  dummyRing.position.set(0, 0, -5000); // Far offscreen

  // Add point light to compile light shaders too
  const dummyLight = new THREE.PointLight(CONST.RING_COLORS[0], 2, 150);
  dummyRing.add(dummyLight);

  scene.add(dummyRing);

  // Render one frame to compile shaders
  renderer.render(scene, camera);

  // Clean up dummy ring
  scene.remove(dummyRing);
  dummyLight.dispose();

  // Preload boost flame geometry/material (compile shaders)
  if (!Car.car) {
    console.warn('[Ring Mode] Car not loaded yet, skipping boost flame preload');
  } else {
    createBoostFlames();
    // Briefly activate to compile shaders
    updateBoostFlames(true, null);
    renderer.render(scene, camera);
    updateBoostFlames(false, null);
  }

  ringResourcesPreloaded = true;
  console.log('[Ring Mode] Resources preloaded successfully!');
}

// ============================================================================
// RING MODE CONTROL
// ============================================================================

/**
 * Reset Ring Mode (for retry button)
 */
export function resetRingMode() {
  ringModeScore = 0;
  ringModeLives = CONST.DIFFICULTY_SETTINGS[currentDifficulty].initialLives;
  ringModeRingCount = 0;
  ringModeVelocity.set(0, 0);
  ringModePosition.set(0, 0);
  ringSpawnTimer = 0;
  ringSpawnIndex = 0;
  currentColorIndex = 0;
  ringModeStarted = false;
  ringModePaused = false;
  ignoreBoostUntilRelease = true; // Ignore boost until player releases it
  patternRingCount = 0;
  cameraTargetX = 0;
  cameraTargetY = 0;
  clearAllRings();
  clearBoostFlames();

  if (Car.car) {
    Car.car.quaternion.identity();
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
    Car.car.position.set(0, 0, 0);
  }

  // Reset external physics state
  if (externalW) {
    externalW.set(0, 0, 0);
  }
  if (externalOrbitOn) {
    externalOrbitOn.value = false;
  }

  spawnRing();

  // Restart music
  Audio.startBackgroundMusic();
}

/**
 * Start Ring Mode
 */
export function startRingMode() {
  ringModeActive = true;

  // Initialize Ring Mode
  ringModeScore = 0;
  ringModeLives = CONST.DIFFICULTY_SETTINGS[currentDifficulty].initialLives;
  ringModeRingCount = 0;
  ringModeVelocity.set(0, 0);
  ringModePosition.set(0, 0);
  ringSpawnTimer = 0;
  ringSpawnIndex = 0;
  currentColorIndex = 0;
  ringModeStarted = false;
  ringModePaused = false;
  ignoreBoostUntilRelease = true; // Ignore boost until player releases it
  patternRingCount = 0;
  cameraTargetX = 0;
  cameraTargetY = 0;
  clearAllRings();

  // Resources already preloaded at startup, just spawn first ring
  spawnRing();

  if (Car.car) {
    Car.car.quaternion.identity();
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
    Car.car.position.set(0, 0, 0);
  }

  // Reset external physics state
  if (externalW) {
    externalW.set(0, 0, 0);
  }
  if (externalOrbitOn) {
    externalOrbitOn.value = false;
  }

  // Start background music
  Audio.startBackgroundMusic();
}

/**
 * Stop Ring Mode
 */
export function stopRingMode() {
  ringModeActive = false;

  // Clean up
  ringModeVelocity.set(0, 0);
  ringModePosition.set(0, 0);
  clearAllRings();
  clearBoostFlames();

  // Stop background music
  Audio.stopBackgroundMusic();
}

/**
 * Toggle Ring Mode on/off
 */
export function toggleRingMode() {
  if (ringModeActive) {
    stopRingMode();
  } else {
    startRingMode();
  }
  return ringModeActive;
}

// ============================================================================
// RING CREATION AND MANAGEMENT
// ============================================================================

/**
 * Create a ring with neon 80s aesthetic (uses cached resources)
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} z - Z position
 * @param {number} size - Ring size
 * @param {number} speed - Movement speed
 * @param {number} spawnIndex - Spawn order index
 * @returns {Object} Ring object
 */
function createRing(x, y, z, size, speed, spawnIndex) {
  const color = CONST.RING_COLORS[currentColorIndex];
  currentColorIndex = (currentColorIndex + 1) % CONST.RING_COLORS.length;

  // ALWAYS use cached geometry for performance (prevents lag on spawn)
  // Scale the mesh instead of creating new geometry for different sizes
  const geometry = ringGeometryCache;
  const cachedMaterial = ringMaterialCache.get(color);
  const material = cachedMaterial || new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.8,
    metalness: 0.3,
    roughness: 0.2
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.set(x, y, z);

  // Scale ring to match requested size (cached geometry is for CONST.INITIAL_RING_SIZE)
  const scale = size / CONST.INITIAL_RING_SIZE;
  ring.scale.set(scale, scale, scale);

  // Add point light for glow effect
  const light = new THREE.PointLight(color, 2, 150);
  light.position.set(0, 0, 0);
  ring.add(light);

  scene.add(ring);

  return {
    mesh: ring,
    size: size,
    speed: speed,
    passed: false,
    missed: false,
    spawnIndex: spawnIndex // Track when this ring was spawned
  };
}

/**
 * Remove all rings from scene
 */
function clearAllRings() {
  rings.forEach(r => {
    scene.remove(r.mesh);
    // Don't dispose geometry/materials - they're cached and reused!
    // Only dispose if not using cache (fallback case)
    if (r.mesh.geometry !== ringGeometryCache) {
      r.mesh.geometry.dispose();
    }
    if (!ringMaterialCache.has(r.mesh.material.color.getHex())) {
      r.mesh.material.dispose();
    }
  });
  rings = [];
}

// ============================================================================
// PATTERN GENERATION
// ============================================================================

/**
 * Select a new ring pattern based on difficulty and progression
 */
function selectNewPattern() {
  const difficultySettings = CONST.DIFFICULTY_SETTINGS[currentDifficulty];

  // Progressive difficulty based on rings completed (affected by difficulty setting)
  const difficultyLevel = Math.floor(ringModeRingCount / 5 * difficultySettings.progressionRate);

  // Use difficulty-specific allowed patterns or progressive unlock
  let availablePatterns = difficultySettings.allowedPatterns || PATTERN_TYPES;

  // If no specific pattern restriction, use progressive unlock (Normal/Hard modes)
  if (!difficultySettings.allowedPatterns) {
    if (difficultyLevel < 2) {
      // First 10 rings: easier straight/simple patterns
      availablePatterns = ['horizontal_line', 'vertical_line', 'sine_horizontal', 'sine_vertical'];
    } else if (difficultyLevel < 4) {
      // Rings 10-20: introduce more complex patterns
      availablePatterns = ['sine_horizontal', 'sine_vertical', 'wave_combo', 'helix', 'spiral'];
    }
    // After 20 rings: all patterns available

    // Exclude 'random' pattern if difficulty setting requires it (Normal mode)
    if (difficultySettings.excludeRandomPattern) {
      availablePatterns = availablePatterns.filter(p => p !== 'random');
    }
  }

  currentPattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
  patternRingCount = 0;
  patternLength = 8 + Math.floor(Math.random() * 12); // 8-20 rings per pattern

  // Progressive amplitude and frequency increase (affected by difficulty)
  const baseAmplitude = (200 + (difficultyLevel * 100)) * difficultySettings.patternAmplitudeMultiplier;
  const amplitudeVariance = (200 + (difficultyLevel * 50)) * difficultySettings.patternAmplitudeMultiplier;
  patternAmplitude = Math.min(baseAmplitude + Math.random() * amplitudeVariance, CONST.RING_GRID_BOUNDS * 0.9);

  const baseFrequency = 0.3 + (difficultyLevel * 0.1); // Faster oscillations as difficulty increases
  patternFrequency = Math.min(baseFrequency + Math.random() * 0.5, 2.0);

  patternPhase = Math.random() * Math.PI * 2;
  console.log(`New pattern: ${currentPattern}, length: ${patternLength}, difficulty: ${difficultyLevel}, amplitude: ${Math.round(patternAmplitude)}`);
}

/**
 * Get position for ring based on current pattern
 * @param {number} progress - Progress through pattern (0-1)
 * @returns {Object} { x, y } position
 */
function getPatternPosition(progress) {
  const t = progress; // 0 to 1 through the pattern
  let x = 0, y = 0;

  switch(currentPattern) {
    case 'sine_horizontal':
      // Horizontal sine wave
      x = Math.sin(t * Math.PI * 2 * patternFrequency + patternPhase) * patternAmplitude;
      y = (Math.random() - 0.5) * 200; // Small random Y variance
      break;

    case 'sine_vertical':
      // Vertical sine wave
      x = (Math.random() - 0.5) * 200;
      y = Math.sin(t * Math.PI * 2 * patternFrequency + patternPhase) * patternAmplitude;
      break;

    case 'spiral':
      // Expanding or contracting spiral
      const spiralRadius = patternAmplitude * (0.3 + t * 0.7);
      const spiralAngle = t * Math.PI * 4 + patternPhase;
      x = Math.cos(spiralAngle) * spiralRadius;
      y = Math.sin(spiralAngle) * spiralRadius;
      break;

    case 'helix':
      // Helix (circular with vertical oscillation)
      const helixAngle = t * Math.PI * 3 + patternPhase;
      x = Math.cos(helixAngle) * patternAmplitude;
      y = Math.sin(t * Math.PI * 2 * patternFrequency) * (patternAmplitude * 0.5);
      break;

    case 'figure8':
      // Figure-8 pattern
      const fig8t = t * Math.PI * 2 + patternPhase;
      x = Math.sin(fig8t) * patternAmplitude;
      y = Math.sin(fig8t * 2) * patternAmplitude * 0.7;
      break;

    case 'vertical_line':
      // Straight vertical line
      x = (Math.random() - 0.5) * 100;
      y = -patternAmplitude + (t * patternAmplitude * 2);
      break;

    case 'horizontal_line':
      // Straight horizontal line
      x = -patternAmplitude + (t * patternAmplitude * 2);
      y = (Math.random() - 0.5) * 100;
      break;

    case 'wave_combo':
      // Combined horizontal and vertical waves
      x = Math.sin(t * Math.PI * 2 * patternFrequency + patternPhase) * patternAmplitude;
      y = Math.cos(t * Math.PI * 2 * patternFrequency * 1.3) * (patternAmplitude * 0.6);
      break;

    case 'random':
    default:
      // Pure random
      x = (Math.random() - 0.5) * CONST.RING_GRID_BOUNDS * 0.8;
      y = (Math.random() - 0.5) * CONST.RING_GRID_BOUNDS * 0.8;
      break;
  }

  // Distance cap: Limit maximum distance from current player position
  // Max distance = grid radius (center to edge = 1500 units)
  const MAX_RING_DISTANCE = CONST.RING_GRID_BOUNDS; // 1500 units (half the total grid width)
  const dx = x - ringModePosition.x;
  const dy = y - ringModePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > MAX_RING_DISTANCE) {
    // Clamp to max distance while preserving direction
    const scale = MAX_RING_DISTANCE / distance;
    x = ringModePosition.x + dx * scale;
    y = ringModePosition.y + dy * scale;
  }

  return { x, y };
}

/**
 * Spawn a new ring
 */
function spawnRing() {
  // Check if there's already a ring too close to spawn position
  // Prevent clustering by enforcing minimum Z-distance between rings
  // At base speed (200 u/s) and 3s interval, rings should be ~600 units apart
  const MIN_RING_Z_SPACING = 650; // Minimum units between rings on Z-axis
  const hasCloseRing = rings.some(r => Math.abs(r.mesh.position.z - CONST.RING_SPAWN_DISTANCE) < MIN_RING_Z_SPACING);

  if (hasCloseRing) {
    // Skip spawning this ring, try again next interval
    return;
  }

  // Check if we need a new pattern
  if (patternRingCount === 0 || patternRingCount >= patternLength) {
    selectNewPattern();
  }

  // Get position from current pattern
  patternProgress = patternRingCount / patternLength;
  const pos = getPatternPosition(patternProgress);
  const spawnX = pos.x;
  const spawnY = pos.y;
  const spawnZ = CONST.RING_SPAWN_DISTANCE;

  patternRingCount++;

  const difficultySettings = CONST.DIFFICULTY_SETTINGS[currentDifficulty];

  // Calculate progression based on ring count (every 10 rings, affected by difficulty)
  const progressionLevel = Math.floor(ringModeRingCount / 10 * difficultySettings.progressionRate);

  // Size: -5% every 10 rings (max 50% reduction), then apply difficulty multiplier
  const sizeReduction = progressionLevel * 0.05;
  const ringSize = CONST.INITIAL_RING_SIZE * (1 - Math.min(sizeReduction, 0.5)) * difficultySettings.sizeMultiplier;

  // Speed: +5% every 10 rings (max 50% increase), then apply difficulty multiplier
  const speedIncrease = progressionLevel * 0.05;
  let ringSpeed = CONST.RING_BASE_SPEED * (1 + Math.min(speedIncrease, 0.5)) * difficultySettings.speedMultiplier;

  // Distance-based speed modifier: slow down rings that spawn far away
  const distanceToRing = Math.sqrt(
    (spawnX - ringModePosition.x) ** 2 +
    (spawnY - ringModePosition.y) ** 2
  );
  const MAX_RING_DISTANCE = CONST.RING_GRID_BOUNDS; // 1500 units
  const distanceRatio = distanceToRing / MAX_RING_DISTANCE; // 0.0 to 1.0

  // If ring is far away (>50% of max distance), slow it down
  // At max distance (1500 units), speed is reduced by 50%
  if (distanceRatio > 0.5) {
    const slowdownFactor = 1 - ((distanceRatio - 0.5) * 1.0); // 1.0 at 50%, 0.5 at 100%
    ringSpeed *= slowdownFactor;
  }

  const ring = createRing(spawnX, spawnY, spawnZ, ringSize, ringSpeed, ringSpawnIndex++);

  // Mark rings spawned at far distances (>85% of max) as bonus rings
  // Passing these grants an extra life
  const BONUS_RING_THRESHOLD = 0.85; // 85% of max distance
  ring.isBonusRing = distanceRatio >= BONUS_RING_THRESHOLD;

  // Visual indicator: bonus rings glow brighter
  if (ring.isBonusRing) {
    ring.mesh.material.emissiveIntensity = 1.5; // Brighter glow
    console.log('Bonus ring spawned at distance:', distanceToRing.toFixed(0), '/', MAX_RING_DISTANCE);
  }

  rings.push(ring);
}

// ============================================================================
// BOOST FLAME EFFECTS
// ============================================================================

/**
 * Create boost flame effects
 */
function createBoostFlames() {
  if (!Car.car) return;

  // Create two flame cones for the tailpipes
  const flameGeometry = new THREE.ConeGeometry(16, 60, 8); // 2x bigger (radius: 8->16, height: 30->60)
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.9
  });

  for (let i = 0; i < 2; i++) {
    const flame = new THREE.Mesh(flameGeometry, flameMaterial.clone());
    flame.visible = false;

    // Position in car's local space (at rear of car)
    const offset = (i === 0) ? -12 : 12; // Left and right offset
    flame.position.set(offset, 0, -100); // Local position: left/right, center height, rear

    // Rotate flame cone to point backward/downward (rear of car)
    // X rotation: tip points toward rear
    flame.rotation.set(Math.PI * 0.5, 0, 0); // 90° X rotation

    // Add point light for glow
    const light = new THREE.PointLight(0xff6600, 3, 80);
    flame.add(light);

    Car.car.add(flame); // Add as child of car so it moves with the car
    boostFlames.push(flame);
  }
}

/**
 * Update boost flame effects
 * @param {boolean} active - Whether boost is active
 * @param {THREE.Vector3} forwardDir - Forward direction (unused, flames are children of car)
 */
function updateBoostFlames(active, forwardDir) {
  if (boostFlames.length === 0) {
    createBoostFlames();
  }

  if (!Car.car) return;

  boostFlames.forEach((flame, i) => {
    flame.visible = active;

    if (active) {
      // Flames are children of car, so they move automatically with it
      // Just animate the scale and opacity

      // Animate flame size
      const pulse = 0.7 + Math.random() * 0.6;
      flame.scale.set(pulse, pulse * 1.5, pulse);

      // Vary opacity
      flame.material.opacity = 0.7 + Math.random() * 0.3;
    }
  });
}

/**
 * Clear boost flames
 */
function clearBoostFlames() {
  boostFlames.forEach(flame => {
    if (flame.parent) flame.parent.remove(flame);
    flame.geometry.dispose();
    flame.material.dispose();
  });
  boostFlames = [];
}

// ============================================================================
// RING MODE PHYSICS UPDATE
// ============================================================================

/**
 * Update Ring Mode physics
 * Called from main integrate() function
 * @param {number} dt - Delta time
 * @param {Object} inputState - Input state { boostActive }
 * @param {THREE.Quaternion} carQuaternion - Car's quaternion for forward direction
 */
export function updateRingModePhysics(dt, inputState, carQuaternion) {
  if (!ringModeActive || ringModePaused || ringModeLives <= 0) {
    return;
  }

  // Get car's forward direction from quaternion
  const forward = new THREE.Vector3(0, 0, 1); // Car's local forward (flipped from -1 to 1)
  forward.applyQuaternion(carQuaternion);

  // Project onto XY plane for 2D movement
  const boostDirX = forward.x;
  const boostDirY = forward.y;

  // Check if boost was released (to re-enable boost after respawn)
  if (!inputState.boostActive && ignoreBoostUntilRelease) {
    ignoreBoostUntilRelease = false;
    console.log('Boost released - ready to start');
  }

  // Determine if boost is actually active (considering ignore flag)
  const effectiveBoostActive = inputState.boostActive && !ignoreBoostUntilRelease;

  // Track if game has started (first boost press)
  if (effectiveBoostActive && !ringModeStarted) {
    ringModeStarted = true;
  }

  // Boost rumble sound control
  if (effectiveBoostActive) {
    Audio.startBoostRumble();
  } else {
    Audio.stopBoostRumble();
  }

  // Apply forces
  let accelX = 0;
  let accelY = ringModeStarted ? CONST.RING_GRAVITY : 0; // Only apply gravity after first boost

  if (effectiveBoostActive) {
    // Boost in the direction car's nose is facing
    accelX += boostDirX * CONST.RING_BOOST_ACCEL;
    accelY += boostDirY * CONST.RING_BOOST_ACCEL;
  }

  // Update boost flame visibility and position
  updateBoostFlames(inputState.boostActive, forward);

  // Integrate velocity
  ringModeVelocity.x += accelX * dt;
  ringModeVelocity.y += accelY * dt;

  // Clamp to max speed
  const speed = ringModeVelocity.length();
  if (speed > CONST.RING_MAX_SPEED) {
    ringModeVelocity.multiplyScalar(CONST.RING_MAX_SPEED / speed);
  }

  // Integrate position
  ringModePosition.x += ringModeVelocity.x * dt;
  ringModePosition.y += ringModeVelocity.y * dt;

  // Clamp to bounds
  ringModePosition.x = THREE.MathUtils.clamp(ringModePosition.x, -CONST.RING_GRID_BOUNDS, CONST.RING_GRID_BOUNDS);
  ringModePosition.y = THREE.MathUtils.clamp(ringModePosition.y, -CONST.RING_GRID_BOUNDS, CONST.RING_GRID_BOUNDS);

  // Check out of bounds (player went too far)
  if (Math.abs(ringModePosition.x) >= CONST.RING_GRID_BOUNDS ||
      Math.abs(ringModePosition.y) >= CONST.RING_GRID_BOUNDS) {
    // Out of bounds - respawn at next ring position
    ringModeVelocity.set(0, 0);

    // Find next unpassed ring to respawn at
    const nextRing = rings.find(r => !r.passed && !r.missed);
    if (nextRing) {
      // Respawn at the ring's X/Y position
      ringModePosition.set(nextRing.mesh.position.x, nextRing.mesh.position.y);
    } else {
      // No rings available, respawn at center
      ringModePosition.set(0, 0);
    }

    ringModeStarted = false; // Wait for boost before falling
    ignoreBoostUntilRelease = true; // Ignore boost until player releases it
    ringModeLives--; // Lose a life
    console.log('Out of bounds! Lives:', ringModeLives);
  }
}

// ============================================================================
// RING MODE RENDERING UPDATE
// ============================================================================

/**
 * Update Ring Mode rendering (camera, rings, collision detection)
 * Called from main integrate() function after physics
 * @param {number} dt - Delta time
 */
export function updateRingModeRendering(dt) {
  if (!ringModeActive) {
    return;
  }

  // Override car position to stay on grid
  if (Car.car) {
    Car.car.position.x = ringModePosition.x;
    Car.car.position.y = ringModePosition.y;
    Car.car.position.z = 0; // Locked to 2D plane
  }

  // Find the closest ring and the next ring ahead of the car (negative Z)
  // Prioritize by spawn order (oldest unpassed ring first), then by Z-distance
  let targetRing = null;
  let nextRing = null;

  // Filter to only active rings (behind camera, not passed/missed)
  const activeRings = rings.filter(r => r.mesh.position.z < 0 && !r.passed && !r.missed);

  if (activeRings.length > 0) {
    // Sort by spawn index (oldest first), then by Z-distance (closest first)
    activeRings.sort((a, b) => {
      // First priority: spawn order (lower index = spawned earlier)
      if (a.spawnIndex !== b.spawnIndex) {
        return a.spawnIndex - b.spawnIndex;
      }
      // Second priority: Z-distance (higher Z = closer to camera)
      return b.mesh.position.z - a.mesh.position.z;
    });

    // Oldest unpassed ring is the target
    targetRing = activeRings[0];

    // Next oldest unpassed ring (if exists)
    if (activeRings.length > 1) {
      nextRing = activeRings[1];
    }
  }

  // Check if car is inside the target ring
  let carInsideTargetRing = false;
  if (targetRing) {
    const dx = ringModePosition.x - targetRing.mesh.position.x;
    const dy = ringModePosition.y - targetRing.mesh.position.y;
    const distanceToRing = Math.sqrt(dx * dx + dy * dy);
    const ringOuterRadius = targetRing.size / 2 + CONST.RING_TUBE_RADIUS;
    carInsideTargetRing = distanceToRing < ringOuterRadius;
  }

  // Smooth camera path following system - interpolate between multiple rings
  let cameraOffsetX = 0;
  let cameraOffsetY = CONST.CAM_BASE.y;

  if (targetRing && !carInsideTargetRing) {
    // Car is outside target ring - focus camera on rings
    // Calculate weighted average position of next 2-3 upcoming rings
    // This creates a smooth curve through ring centers
    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;

    // Get up to 3 upcoming rings for smooth path
    const upcomingRings = activeRings.slice(0, Math.min(3, activeRings.length));

    for (let i = 0; i < upcomingRings.length; i++) {
      const ring = upcomingRings[i];
      const ringDepth = Math.abs(ring.mesh.position.z);

      // Weight based on depth - closer rings have more influence
      // But far rings still contribute to keep them in frame
      let weight = 1.0;
      if (i === 0) {
        weight = 3.0; // Current target ring has strongest influence
      } else if (i === 1) {
        weight = 1.5; // Next ring has moderate influence
      } else {
        weight = 0.5; // Future rings have minimal influence
      }

      // Reduce weight for very far rings to prevent camera from overshooting
      const depthFactor = Math.min(ringDepth / 1000, 1.0);
      weight *= (1.0 - depthFactor * 0.5);

      weightedX += ring.mesh.position.x * weight;
      weightedY += ring.mesh.position.y * weight;
      totalWeight += weight;
    }

    // Calculate average target position (smooth path through rings)
    if (totalWeight > 0) {
      const pathTargetX = weightedX / totalWeight;
      const pathTargetY = weightedY / totalWeight;

      // Smoothly interpolate camera target toward path
      const smoothing = 0.05; // Very smooth interpolation
      cameraTargetX += (pathTargetX - cameraTargetX) * smoothing;
      cameraTargetY += (pathTargetY - cameraTargetY) * smoothing;

      // Calculate direction from car to smooth path target
      const deltaX = cameraTargetX - ringModePosition.x;
      const deltaY = cameraTargetY - ringModePosition.y;
      const distXY = Math.hypot(deltaX, deltaY);

      if (distXY > 0.1) {
        // Normalize direction
        const dirX = deltaX / distXY;
        const dirY = deltaY / distXY;

        // Minimal camera orbit - keep it simple and smooth
        const orbitRadius = 150; // Fixed moderate orbit

        // Camera aims to keep path visible
        cameraOffsetX = -dirX * orbitRadius;
        cameraOffsetY = CONST.CAM_BASE.y - dirY * 100;
      }
    }
  }

  // Smoothly move camera to target offset position
  const targetCamX = ringModePosition.x + cameraOffsetX;
  const targetCamY = ringModePosition.y + cameraOffsetY;
  const targetCamZ = CONST.CAM_BASE.z;

  // Lerp camera position for smooth movement
  camera.position.x += (targetCamX - camera.position.x) * ringCameraSpeed;
  camera.position.y += (targetCamY - camera.position.y) * ringCameraSpeed;
  camera.position.z = targetCamZ;

  // Look at point between car and next ring to keep distant rings visible
  let lookAtX = ringModePosition.x;
  let lookAtY = ringModePosition.y;
  let lookAtZ = 0;

  if (carInsideTargetRing) {
    // Car is inside target ring - focus camera on car
    lookAtX = ringModePosition.x;
    lookAtY = ringModePosition.y;
    lookAtZ = 0;
  } else if (targetRing) {
    // Car is outside target ring - blend between car and ring
    // Calculate full 3D distance from car to ring
    const dx = targetRing.mesh.position.x - ringModePosition.x;
    const dy = targetRing.mesh.position.y - ringModePosition.y;
    const dz = targetRing.mesh.position.z - 0; // Car is at Z=0
    const ringDistance3D = Math.sqrt(dx*dx + dy*dy + dz*dz);

    // Much gentler blend - max 20% toward ring to keep car on screen
    // Only blend if ring is very far (>2000 units)
    const blendFactor = ringDistance3D > 2000 ? Math.min((ringDistance3D - 2000) / 4000, 0.2) : 0;

    lookAtX = ringModePosition.x * (1 - blendFactor) + targetRing.mesh.position.x * blendFactor;
    lookAtY = ringModePosition.y * (1 - blendFactor) + targetRing.mesh.position.y * blendFactor;
    lookAtZ = 0 * (1 - blendFactor) + targetRing.mesh.position.z * blendFactor * 0.2; // Minimal Z shift
  }

  camera.lookAt(lookAtX, lookAtY, lookAtZ);

  // Move rings toward camera (only if not paused, game has started, and not game over)
  if (!ringModePaused && ringModeStarted && ringModeLives > 0) {
    for(let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      const prevZ = ring.mesh.position.z;
      ring.mesh.position.z += ring.speed * dt; // Use individual ring speed for progression
      const newZ = ring.mesh.position.z;

      // Update visual effects based on distance for depth perception
      const distanceZ = Math.abs(ring.mesh.position.z);

      // Opacity fade: full opacity when close, fade out when far
      // Starts fading at 3000 units, fully visible at 1000 units
      const opacityFactor = THREE.MathUtils.clamp(1 - (distanceZ - 1000) / 2000, 0.3, 1);
      ring.mesh.material.opacity = opacityFactor;
      ring.mesh.material.transparent = true;

      // Emissive intensity: brighter when close, dimmer when far
      // This creates a fog-like effect
      const emissiveFactor = THREE.MathUtils.clamp(1 - distanceZ / 4000, 0.3, 0.8);
      ring.mesh.material.emissiveIntensity = emissiveFactor;

      // Point light intensity also fades with distance
      if (ring.mesh.children[0] && ring.mesh.children[0].isLight) {
        const lightIntensity = THREE.MathUtils.clamp(2 - distanceZ / 2000, 0.5, 2);
        ring.mesh.children[0].intensity = lightIntensity;
      }

      // Check if car passed through the ring's plane (Z=0, where car is locked)
      if (prevZ < 0 && newZ >= 0 && !ring.passed && !ring.missed) {
        // Ring crossed the car's Z plane - check for collision
        const carX = ringModePosition.x;
        const carY = ringModePosition.y;
        const ringX = ring.mesh.position.x;
        const ringY = ring.mesh.position.y;

        // Distance from car center to ring center in XY plane
        const dx = carX - ringX;
        const dy = carY - ringY;
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);

        // Ring outer and inner radii
        const ringOuterRadius = ring.size / 2 + CONST.RING_TUBE_RADIUS;
        const ringInnerRadius = ring.size / 2 - CONST.RING_TUBE_RADIUS;

        if (distanceToCenter <= ringInnerRadius) {
          // Clean pass - car went through the center
          ring.passed = true;
          ringModeScore++;
          ringModeRingCount++;

          // Bonus life for passing distant rings
          if (ring.isBonusRing) {
            ringModeLives++;
            console.log('BONUS! Passed distant ring! +1 Life. Total lives:', ringModeLives);
          } else {
            console.log('Passed through ring! Score:', ringModeScore);
          }

          // Update high score
          if (ringModeScore > ringModeHighScore) {
            ringModeHighScore = ringModeScore;
            saveSettings({ ringModeHighScore: ringModeHighScore });
          }

          // Audio feedback - play success sound
          Audio.playRingPassSound();
        } else if (distanceToCenter < ringOuterRadius) {
          // Hit the edge of the ring
          ring.missed = true;
          console.log('Hit ring edge! Heart damage');
          // Audio feedback - play miss sound
          Audio.playRingMissSound();
          // TODO: Apply heart damage
        } else {
          // Completely missed the ring
          ring.missed = true;
          ringModeLives--;
          console.log('Missed ring! Lives:', ringModeLives);
          // Audio feedback - play miss sound
          Audio.playRingMissSound();
          // TODO: Check if game over
        }
      }

      // Remove rings immediately after they pass through grid (Z=0)
      // No need to keep them traveling behind the player
      if(ring.mesh.position.z > 50) { // Small buffer past Z=0
        // Check if we missed an unpassed ring
        if (!ring.passed && !ring.missed) {
          ringModeLives--;
          console.log('Ring passed without going through! Lives:', ringModeLives);
          // Audio feedback - play miss sound
          Audio.playRingMissSound();
        }
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        rings.splice(i, 1);
      }
    }

    // Spawn new rings periodically (affected by difficulty)
    ringSpawnTimer += dt;
    const spawnInterval = CONST.RING_BASE_SPAWN_INTERVAL * CONST.DIFFICULTY_SETTINGS[currentDifficulty].spawnIntervalMultiplier;
    if(ringSpawnTimer >= spawnInterval) {
      spawnRing();
      ringSpawnTimer = 0;
    }
  }
}

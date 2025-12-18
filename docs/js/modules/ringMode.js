/**
 * ringMode.js
 * Ring Mode game logic for L4 DAR prototype
 * Handles ring spawning, physics, collision detection, and camera control
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as CONST from './constants.js';
import * as Car from './car.js';
import * as Audio from './audio.js';
import { getSetting, saveSettings } from './settings.js';

// ============================================================================
// MODULE DEPENDENCIES (injected via init())
// ============================================================================

// Reference to central game state (injected via init() to avoid circular dependency)
let gameState = null;

// Reference to Input module (injected via init() to avoid circular dependency)
let Input = null;

// ============================================================================
// PRIVATE STATE VARIABLES
// ============================================================================

// Ring Mode state
let ringModeActive = false;
let ringModeScore = 0;
let ringModeHighScore = 0; // Current difficulty high score (loaded based on difficulty)
let ringModeLives = 5;
let ringModeRingCount = 0;
let ringCameraSpeed = getSetting('ringCameraSpeed') ?? 0.1;

// Ring Mode physics
let ringModeVelocity = new THREE.Vector2(0, 0); // XY velocity only
let ringModePosition = new THREE.Vector2(0, 0); // Car position in 2D plane
let ringModeStarted = false; // Track if player has started (boosted at least once)
let ringModePaused = false; // Track pause state
let ignoreBoostUntilRelease = false; // Ignore boost input after respawn until released

// Boost flame effects
let boostFlames = [];

// Boundary visualization
let boundaryGrid = null; // Visual indicator showing the kill barrier
let landingIndicator = null; // 3D dashed circle showing where target ring will land on grid

// Landing indicator cache (to avoid rebuilding every frame)
let cachedTargetRingId = null; // Track which ring we built the indicator for
let cachedPlayerInsideState = null; // Track if player was inside/outside

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

let currentDifficulty = getSetting('ringDifficulty') ?? 'normal';

// Pattern generation variables
let currentPattern = 'random';
let patternProgress = 0; // Progress through current pattern (0-1)
let patternLength = 15; // Number of rings in this pattern
let patternRingCount = 0; // Rings spawned in current pattern
const PATTERN_TYPES = ['sine_horizontal', 'sine_vertical', 'spiral', 'helix', 'figure8', 'vertical_line', 'horizontal_line', 'wave_combo', 'random', 'square', 'triangle', 'star', 'pentagon'];

// Pattern parameters (randomized when pattern changes)
let patternAmplitude = 400; // Wave/spiral amplitude
let patternFrequency = 0.5; // Oscillation frequency
let patternPhase = 0; // Starting phase offset

// Hard mode section management
let currentSection = null; // Current section type (gauntlet, geometric, flowing, chaos)
let sectionRingCount = 0; // Rings spawned in current section
let sectionDuration = 0; // Total rings in current section
let sectionSpawnInterval = 1.0; // Spawn interval multiplier for this section
let sectionSpeed = 1.0; // Speed multiplier for this section
let sectionAmplitude = 1.0; // Amplitude multiplier for this section

// Scene and camera references (set during initialization)
let scene = null;
let camera = null;
let renderer = null;

// External physics state (passed in from main code)
let externalW = null; // Angular velocity vector
let externalOrbitOn = null; // Orbit mode flag (object with value property)

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the RingMode module with game state dependency
 * This breaks the circular dependency by injecting dependencies at runtime
 * @param {GameState} state - Central game state instance
 * @param {object} inputModule - Input module for boost button control
 */
export function init(state, inputModule) {
  gameState = state;
  Input = inputModule;
}

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
// HIGH SCORE HELPERS
// ============================================================================

/**
 * Get the settings key for the current difficulty's high score
 * @param {string} difficulty - Difficulty level ('easy', 'normal', 'hard', 'expert')
 * @returns {string} Settings key for that difficulty's high score
 */
function getHighScoreKey(difficulty) {
  switch (difficulty) {
    case 'easy': return 'ringModeHighScoreEasy';
    case 'hard': return 'ringModeHighScoreHard';
    case 'expert': return 'ringModeHighScoreExpert';
    case 'normal':
    default: return 'ringModeHighScoreNormal';
  }
}

/**
 * Load high score for current difficulty
 */
function loadHighScoreForDifficulty() {
  const key = getHighScoreKey(currentDifficulty);
  ringModeHighScore = getSetting(key) ?? 0;
}

/**
 * Save high score for current difficulty
 */
function saveHighScoreForDifficulty() {
  const key = getHighScoreKey(currentDifficulty);
  const settings = {};
  settings[key] = ringModeHighScore;
  saveSettings(settings);
}

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
  // Load the high score for the new difficulty
  loadHighScoreForDifficulty();
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
  currentDifficulty = getSetting('ringDifficulty') ?? 'normal';
  ringCameraSpeed = getSetting('ringCameraSpeed') ?? 0.1;

  // Load difficulty-specific high score
  loadHighScoreForDifficulty();

  // Preload resources
  preloadRingResources();

}

// ============================================================================
// RESOURCE PRELOADING
// ============================================================================

/**
 * Preload ring resources to prevent lag on first spawn
 */
function preloadRingResources() {
  if (ringResourcesPreloaded) {
    return;
  }

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
  if (Car.car) {
    // Create boost flames if they don't exist
    if (boostFlames.length === 0) {
      createBoostFlames();
    }

    // Briefly activate to compile shaders
    updateBoostFlames(true, null);
    renderer.render(scene, camera);
    updateBoostFlames(false, null);
  }

  ringResourcesPreloaded = true;
}

/**
 * Create boundary box visualization showing the kill barrier
 */
function createBoundaryGrid() {
  if (boundaryGrid) {
    // Clean up existing boundary
    scene.remove(boundaryGrid);
    boundaryGrid.geometry.dispose();
    boundaryGrid.material.dispose();
  }

  const size = CONST.RING_GRID_BOUNDS; // 1500 units

  // Create a simple box outline in XY plane (car moves in XY at z=0)
  // Box dimensions: width (X), height (Y), depth (Z toward camera)
  const geometry = new THREE.BoxGeometry(size * 2, size * 2, 10);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({
    color: 0xff0000, // Red
    opacity: 0.4,
    transparent: true
  });

  const boundaryBox = new THREE.LineSegments(edges, material);
  boundaryBox.position.z = 0; // Same Z as car (2D movement plane)

  geometry.dispose(); // Clean up the temporary geometry

  boundaryGrid = boundaryBox;
  scene.add(boundaryGrid);
}

/**
 * Create or update the 3D dashed circle landing indicator on the grid
 * This shows where the target ring will be positioned on the grid plane
 * Dashes are thick arcs that are hollow when player is outside, filled when inside
 * OPTIMIZATION: Only rebuilds geometry when ring changes or player crosses threshold
 */
function updateLandingIndicator() {
  // Find the target ring (oldest unpassed ring)
  const targetRing = rings.find(r => !r.passed && !r.missed);

  if (!targetRing) {
    // No target ring - hide indicator
    if (landingIndicator) {
      scene.remove(landingIndicator);

      // Clean up based on type (Mesh or Group)
      if (landingIndicator.geometry) {
        // It's a Mesh (filled state)
        landingIndicator.geometry.dispose();
        landingIndicator.material.dispose();
      } else if (landingIndicator.children) {
        // It's a Group (hollow state)
        landingIndicator.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }

      landingIndicator = null;
      cachedTargetRingId = null;
      cachedPlayerInsideState = null;
    }
    return;
  }

  // Get ring's grid position (XY on the grid plane)
  const ringX = targetRing.mesh.position.x;
  const ringY = targetRing.mesh.position.y;
  const ringRadius = targetRing.size / 2;
  const ringColor = targetRing.mesh.material.color;

  // Check if player is inside the circle
  const distanceToRing = Math.sqrt(
    (ringModePosition.x - ringX) ** 2 +
    (ringModePosition.y - ringY) ** 2
  );
  const isPlayerInside = distanceToRing <= ringRadius;

  // PERFORMANCE OPTIMIZATION: Only rebuild if ring changed or player crossed threshold
  const ringId = targetRing.spawnIndex; // Use spawn index as unique ID
  if (cachedTargetRingId === ringId && cachedPlayerInsideState === isPlayerInside && landingIndicator) {
    // Ring and state unchanged - just update position (ring might be moving toward player)
    landingIndicator.position.set(ringX, ringY, 0);
    return;
  }

  // Cache miss - need to rebuild geometry
  cachedTargetRingId = ringId;
  cachedPlayerInsideState = isPlayerInside;

  // Dash configuration
  const dashCount = 24; // Number of dashes around circle
  const dashThickness = 12; // Thickness of each dash
  const dashOuterRadius = ringRadius;
  const dashInnerRadius = ringRadius - dashThickness;
  const dashAngle = 12; // degrees per dash
  const gapAngle = 3; // degrees between dashes

  // Create geometry for all dashes
  const dashGeometries = [];

  for (let i = 0; i < dashCount; i++) {
    const startAngle = i * (dashAngle + gapAngle) * (Math.PI / 180);
    const endAngle = (i * (dashAngle + gapAngle) + dashAngle) * (Math.PI / 180);

    if (isPlayerInside) {
      // FILLED: Draw solid dash segment
      const shape = new THREE.Shape();

      // Start at outer arc
      shape.moveTo(Math.cos(startAngle) * dashOuterRadius, Math.sin(startAngle) * dashOuterRadius);
      // Draw outer arc
      shape.absarc(0, 0, dashOuterRadius, startAngle, endAngle, false);
      // Line to inner radius
      shape.lineTo(Math.cos(endAngle) * dashInnerRadius, Math.sin(endAngle) * dashInnerRadius);
      // Draw inner arc backwards
      shape.absarc(0, 0, dashInnerRadius, endAngle, startAngle, true);
      // Close path
      shape.closePath();

      const geometry = new THREE.ShapeGeometry(shape);
      dashGeometries.push(geometry);
    } else {
      // HOLLOW: Draw only outer and inner arc outlines
      const outerPoints = [];
      const innerPoints = [];
      const segments = 16; // Segments per dash arc

      // Outer arc
      for (let j = 0; j <= segments; j++) {
        const angle = startAngle + (endAngle - startAngle) * (j / segments);
        outerPoints.push(new THREE.Vector3(
          Math.cos(angle) * dashOuterRadius,
          Math.sin(angle) * dashOuterRadius,
          0
        ));
      }

      // Inner arc
      for (let j = 0; j <= segments; j++) {
        const angle = startAngle + (endAngle - startAngle) * (j / segments);
        innerPoints.push(new THREE.Vector3(
          Math.cos(angle) * dashInnerRadius,
          Math.sin(angle) * dashInnerRadius,
          0
        ));
      }

      const outerGeometry = new THREE.BufferGeometry().setFromPoints(outerPoints);
      const innerGeometry = new THREE.BufferGeometry().setFromPoints(innerPoints);
      dashGeometries.push(outerGeometry, innerGeometry);
    }
  }

  // Remove old indicator
  if (landingIndicator) {
    scene.remove(landingIndicator);

    // Clean up based on type (Mesh or Group)
    if (landingIndicator.geometry) {
      // It's a Mesh (filled state)
      landingIndicator.geometry.dispose();
      landingIndicator.material.dispose();
    } else if (landingIndicator.children) {
      // It's a Group (hollow state)
      landingIndicator.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    landingIndicator = null;
  }

  if (isPlayerInside) {
    // Merge all filled dash geometries into one mesh
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(dashGeometries);
    dashGeometries.forEach(g => g.dispose());

    const material = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    landingIndicator = new THREE.Mesh(mergedGeometry, material);
  } else {
    // Create line segments for hollow dashes
    const material = new THREE.LineBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });

    landingIndicator = new THREE.Group();
    dashGeometries.forEach(geom => {
      const line = new THREE.Line(geom, material);
      landingIndicator.add(line);
    });
  }

  landingIndicator.position.set(ringX, ringY, 0); // Position on grid at z=0
  scene.add(landingIndicator);
}

// ============================================================================
// RING MODE CONTROL
// ============================================================================

/**
 * Reset Ring Mode (for retry button)
 */
/**
 * Reset only physics state (for rhythm mode)
 * Does NOT reset game state or start ring mode
 */
export function resetRingModePhysicsOnly() {
  ringModeVelocity.set(0, 0);
  ringModePosition.set(0, 0);
  ringModeStarted = false;
  ignoreBoostUntilRelease = true;
}

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

  // Reset section variables for hard mode
  currentSection = null;
  sectionRingCount = 0;
  sectionDuration = 0;
  sectionSpawnInterval = 1.0;
  sectionSpeed = 1.0;
  sectionAmplitude = 1.0;

  clearAllRings();
  clearBoostFlames();

  if (Car.car) {
    Car.car.quaternion.identity();
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
    Car.car.position.set(0, 0, 0);
  }

  // Reset external physics state
  gameState.resetAngularVelocity();

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
  gameState.setRingModeActive(true);

  // Show boost button and ensure positions are correct
  if (Input) {
    Input.setRingModeActive(true);
    Input.handleResize(); // Ensure button positions are updated for current window size
  }

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

  // Reset section variables for hard mode
  currentSection = null;
  sectionRingCount = 0;
  sectionDuration = 0;
  sectionSpawnInterval = 1.0;
  sectionSpeed = 1.0;
  sectionAmplitude = 1.0;

  clearAllRings();

  // Create boundary grid visualization
  createBoundaryGrid();

  // Resources already preloaded at startup, just spawn first ring
  spawnRing();

  if (Car.car) {
    Car.car.quaternion.identity();
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
    Car.car.position.set(0, 0, 0);
  }

  // Reset external physics state
  gameState.resetAngularVelocity();

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
  gameState.setRingModeActive(false);

  // Hide boost button
  if (Input) {
    Input.setRingModeActive(false);
  }

  // Clean up
  ringModeVelocity.set(0, 0);
  ringModePosition.set(0, 0);
  clearAllRings();
  clearBoostFlames();

  // Remove boundary grid
  if (boundaryGrid) {
    scene.remove(boundaryGrid);
    boundaryGrid.geometry.dispose();
    boundaryGrid.material.dispose();
    boundaryGrid = null;
  }

  // Remove landing indicator
  if (landingIndicator) {
    scene.remove(landingIndicator);

    // Clean up based on type (Mesh or Group)
    if (landingIndicator.geometry) {
      // It's a Mesh (filled state)
      landingIndicator.geometry.dispose();
      landingIndicator.material.dispose();
    } else if (landingIndicator.children) {
      // It's a Group (hollow state)
      landingIndicator.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    landingIndicator = null;
  }

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
    // Check if material is cached by comparing against cached materials
    let isCached = false;
    for (const cachedMaterial of ringMaterialCache.values()) {
      if (cachedMaterial === r.mesh.material) {
        isCached = true;
        break;
      }
    }
    if (!isCached) {
      r.mesh.material.dispose();
    }
  });
  rings = [];
}

// ============================================================================
// PATTERN GENERATION
// ============================================================================

/**
 * Select a new section for hard mode
 */
function selectNewSection() {
  const sectionTypes = Object.keys(CONST.HARD_MODE_SECTIONS);
  const sectionType = sectionTypes[Math.floor(Math.random() * sectionTypes.length)];
  const section = CONST.HARD_MODE_SECTIONS[sectionType];

  currentSection = sectionType;
  sectionRingCount = 0;
  sectionDuration = section.duration;
  sectionSpawnInterval = section.spawnIntervalMultiplier;
  sectionSpeed = section.speedMultiplier;
  sectionAmplitude = section.amplitudeMultiplier;

  return section;
}

/**
 * Select a new ring pattern based on difficulty and progression
 */
function selectNewPattern() {
  const difficultySettings = CONST.DIFFICULTY_SETTINGS[currentDifficulty];

  // Progressive difficulty based on rings completed (affected by difficulty setting)
  const difficultyLevel = Math.floor(ringModeRingCount / 5 * difficultySettings.progressionRate);

  // HARD MODE: Use section-based pattern selection
  if (currentDifficulty === 'hard') {
    // Check if we need a new section
    if (sectionRingCount === 0 || sectionRingCount >= sectionDuration) {
      const section = selectNewSection();
      // Pick pattern from section's allowed patterns
      currentPattern = section.patterns[Math.floor(Math.random() * section.patterns.length)];
      patternRingCount = 0;
      patternLength = section.duration;
    } else {
      // Continue current section - optionally change pattern mid-section
      const section = CONST.HARD_MODE_SECTIONS[currentSection];
      if (patternRingCount >= patternLength) {
        currentPattern = section.patterns[Math.floor(Math.random() * section.patterns.length)];
        patternRingCount = 0;
        patternLength = Math.max(3, Math.floor(section.duration / 2)); // Vary pattern within section
      }
    }

    // Section-specific amplitude and frequency
    const baseAmplitude = (250 + (difficultyLevel * 80)) * sectionAmplitude;
    const amplitudeVariance = (150 + (difficultyLevel * 40)) * sectionAmplitude;
    patternAmplitude = Math.min(baseAmplitude + Math.random() * amplitudeVariance, CONST.RING_GRID_BOUNDS * 0.9);

    const baseFrequency = 0.4 + (difficultyLevel * 0.08);
    patternFrequency = Math.min(baseFrequency + Math.random() * 0.4, 1.8);

    patternPhase = Math.random() * Math.PI * 2;
    return;
  }

  // NORMAL/EASY MODE: Original progressive unlock logic
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
  // Expert mode starts with wider spreads immediately (baseAmplitude boosted by +400)
  const expertBoost = currentDifficulty === 'expert' ? 400 : 0;
  const baseAmplitude = (200 + expertBoost + (difficultyLevel * 100)) * difficultySettings.patternAmplitudeMultiplier;
  const amplitudeVariance = (200 + (difficultyLevel * 50)) * difficultySettings.patternAmplitudeMultiplier;
  patternAmplitude = Math.min(baseAmplitude + Math.random() * amplitudeVariance, CONST.RING_GRID_BOUNDS * 0.9);

  const baseFrequency = 0.3 + (difficultyLevel * 0.1); // Faster oscillations as difficulty increases
  patternFrequency = Math.min(baseFrequency + Math.random() * 0.5, 2.0);

  patternPhase = Math.random() * Math.PI * 2;
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

    case 'square':
      // Square path
      const squareSide = Math.min(Math.floor(t * 4), 3); // 4 sides, clamp to 0-3
      const sideProgress = (t * 4) % 1; // Progress along current side
      const squareSize = patternAmplitude * 0.8;
      if (squareSide === 0) {
        // Bottom side (left to right)
        x = -squareSize + sideProgress * squareSize * 2;
        y = -squareSize;
      } else if (squareSide === 1) {
        // Right side (bottom to top)
        x = squareSize;
        y = -squareSize + sideProgress * squareSize * 2;
      } else if (squareSide === 2) {
        // Top side (right to left)
        x = squareSize - sideProgress * squareSize * 2;
        y = squareSize;
      } else {
        // Left side (top to bottom)
        x = -squareSize;
        y = squareSize - sideProgress * squareSize * 2;
      }
      break;

    case 'triangle':
      // Triangle path
      const triSide = Math.min(Math.floor(t * 3), 2); // 3 sides, clamp to 0-2
      const triProgress = (t * 3) % 1;
      const triSize = patternAmplitude * 0.8;
      if (triSide === 0) {
        // Bottom side (left to right)
        x = -triSize + triProgress * triSize * 2;
        y = -triSize * 0.577; // Height of equilateral triangle
      } else if (triSide === 1) {
        // Right side (bottom-right to top)
        x = triSize - triProgress * triSize;
        y = -triSize * 0.577 + triProgress * triSize * 1.732;
      } else {
        // Left side (top to bottom-left)
        x = 0 - triProgress * triSize;
        y = triSize * 1.155 - triProgress * triSize * 1.732;
      }
      break;

    case 'star':
      // 5-pointed star
      const starPoints = 10; // 5 outer + 5 inner points
      const starIndex = Math.floor(t * starPoints) % starPoints;
      const isOuter = starIndex % 2 === 0;
      const starRadius = isOuter ? patternAmplitude : patternAmplitude * 0.4;
      const pointAngle = (starIndex / starPoints) * Math.PI * 2 + patternPhase;
      x = Math.cos(pointAngle) * starRadius;
      y = Math.sin(pointAngle) * starRadius;
      break;

    case 'pentagon':
      // Pentagon path
      const pentSide = Math.min(Math.floor(t * 5), 4); // 5 sides, clamp to 0-4
      const pentProgress = (t * 5) % 1;
      const pentRadius = patternAmplitude * 0.8;
      const angle1 = (pentSide / 5) * Math.PI * 2 - Math.PI / 2 + patternPhase;
      const angle2 = ((pentSide + 1) / 5) * Math.PI * 2 - Math.PI / 2 + patternPhase;
      const x1 = Math.cos(angle1) * pentRadius;
      const y1 = Math.sin(angle1) * pentRadius;
      const x2 = Math.cos(angle2) * pentRadius;
      const y2 = Math.sin(angle2) * pentRadius;
      x = x1 + (x2 - x1) * pentProgress;
      y = y1 + (y2 - y1) * pentProgress;
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
 * Calculate minimum time needed to reach a ring position
 * Based on physics: reaction time + orientation time + travel time + stabilization time
 * Properly accounts for gravity, current momentum, and direction changes
 *
 * @param {number} targetX - Ring X position
 * @param {number} targetY - Ring Y position
 * @param {number} currentX - Current car X position
 * @param {number} currentY - Current car Y position
 * @param {number} currentVelX - Current car X velocity
 * @param {number} currentVelY - Current car Y velocity
 * @param {number} ringCount - Current ring count for progressive skill scaling
 * @returns {number} Minimum time in seconds to reach the ring
 */
function calculateMinimumTimeToReach(targetX, targetY, currentX, currentY, currentVelX, currentVelY, ringCount = 0, difficulty = 'normal') {
  // Time components (based on user requirements)
  const REACTION_TIME = 0.2; // Time for player to see and react to new ring
  const ORIENTATION_TIME = 0.5; // Time to orient car toward ring
  const STABILIZATION_TIME = 1.0; // Time to stabilize and wait for ring to pass

  // Calculate distance components
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // If very close (< 100 units), use simplified timing
  if (distance < 100) {
    return REACTION_TIME + ORIENTATION_TIME + 0.5 + STABILIZATION_TIME;
  }

  // Physics constants
  const MAX_SPEED = CONST.RING_MAX_SPEED; // 1400 units/s
  const BOOST_ACCEL = CONST.RING_BOOST_ACCEL; // 1200 units/s²
  const GRAVITY = Math.abs(CONST.RING_GRAVITY); // 600 units/s² (downward)

  // PROGRESSIVE SKILL SCALING: Transition from human play to skilled play
  // Normal/Hard modes:
  //   Rings 0-100: 50% boost efficiency (human play - lots of corrections)
  //   Rings 100-200: Gradually increase from 50% to 75% (mastery progression)
  //   Rings 200+: 75% boost efficiency (skilled/perfect play expected)
  // Expert mode:
  //   Rings 0+: Start at 92% (near-perfect play required from the start)
  //   Rings 0-200: Gradually increase from 92% to 100% (approaching theoretical perfection)
  //   Rings 200+: 100% boost efficiency (perfect play - theoretical limit)
  const SKILL_START_RING = 100; // Start increasing skill requirement (normal/hard)
  const SKILL_END_RING = 200;   // Reach max skill requirement
  let skillFactor = 0.5; // Default: 50% boost efficiency (human play)

  if (difficulty === 'expert') {
    // Expert mode: 92% -> 100% over 200 rings
    if (ringCount >= SKILL_END_RING) {
      skillFactor = 1.0; // Perfect play - theoretical limit
    } else {
      // Linear interpolation from 0.92 to 1.0 over 200 rings
      const progress = Math.min(ringCount / SKILL_END_RING, 1.0);
      skillFactor = 0.92 + (progress * 0.08); // 0.92 -> 1.0
    }
  } else {
    // Normal/Hard modes: 50% -> 75% scaling
    if (ringCount >= SKILL_END_RING) {
      skillFactor = 0.75; // Skilled play
    } else if (ringCount > SKILL_START_RING) {
      // Linear interpolation from 0.5 to 0.75
      const progress = (ringCount - SKILL_START_RING) / (SKILL_END_RING - SKILL_START_RING);
      skillFactor = 0.5 + (progress * 0.25); // 0.5 -> 0.75
    }
  }

  // Calculate travel time separately for X and Y axes, then use the max
  // This accounts for gravity affecting Y differently than X

  // === HORIZONTAL (X) MOVEMENT ===
  const absX = Math.abs(dx);
  let timeX = 0;

  if (absX > 10) {
    // Apply progressive skill scaling
    // Early rings: 50% boost efficiency (human play)
    // Late rings: 75% boost efficiency (skilled play)
    const accelX = Math.max(100, BOOST_ACCEL * skillFactor); // Prevent divide-by-zero

    // Current velocity in X direction (considering if we're going toward or away from target)
    const velTowardX = dx > 0 ? currentVelX : -currentVelX;

    if (velTowardX < 0) {
      // Moving away from target - need to stop first, then accelerate toward it
      const timeToStop = Math.abs(velTowardX) / accelX;
      const distanceWhileStopping = 0.5 * accelX * timeToStop * timeToStop;
      const remainingX = absX + distanceWhileStopping; // Extra distance because we moved away

      // Time to cover remaining distance from stopped position
      const timeAfterStop = Math.sqrt(2 * remainingX / accelX);
      timeX = timeToStop + timeAfterStop;
    } else {
      // Moving toward target or stationary
      // Simple kinematic: d = v₀*t + 0.5*a*t²
      // Solve for t using quadratic formula
      const a = 0.5 * accelX;
      const b = velTowardX;
      const c = -absX;
      const discriminant = b * b - 4 * a * c;
      timeX = (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a);
    }
  }

  // === VERTICAL (Y) MOVEMENT WITH GRAVITY ===
  const absY = Math.abs(dy);
  let timeY = 0;

  if (absY > 10) {
    // Going UP: boost acceleration minus gravity (fighting gravity)
    // Going DOWN: boost acceleration plus gravity (gravity helps)
    const isGoingUp = dy > 0;
    const effectiveAccelY = isGoingUp
      ? (BOOST_ACCEL - GRAVITY) * skillFactor  // Progressive skill scaling
      : (BOOST_ACCEL + GRAVITY) * skillFactor; // Progressive skill scaling

    // Current velocity in Y direction (considering direction to target)
    const velTowardY = dy > 0 ? currentVelY : -currentVelY;

    if (velTowardY < 0) {
      // Moving away from target - need to stop first
      const decelY = isGoingUp ? (BOOST_ACCEL + GRAVITY) : (BOOST_ACCEL - GRAVITY);
      const timeToStop = Math.abs(velTowardY) / Math.max(100, decelY);
      const distanceWhileStopping = 0.5 * decelY * timeToStop * timeToStop;
      const remainingY = absY + distanceWhileStopping;

      // Time to cover remaining distance from stopped position
      const timeAfterStop = Math.sqrt(2 * remainingY / Math.max(100, effectiveAccelY));
      timeY = timeToStop + timeAfterStop;
    } else {
      // Moving toward target or stationary
      const a = 0.5 * Math.max(100, effectiveAccelY);
      const b = velTowardY;
      const c = -absY;
      const discriminant = b * b - 4 * a * c;
      timeY = (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a);
    }

    // Extra time penalty for going upward against gravity
    if (isGoingUp) {
      timeY *= 1.25; // 25% more time when fighting gravity
    }
  }

  // Use the MAXIMUM of X and Y times (can't reach target until both axes align)
  // Progressive buffer scaling: More forgiving early, tighter late
  // Rings 0-100: 1.5× buffer (50% extra time for human corrections)
  // Rings 100-200: Gradually reduce to 1.2× buffer
  // Rings 200+: 1.2× buffer (20% extra time for skilled play)
  let bufferMultiplier = 1.5; // Default: human play buffer
  if (ringCount >= SKILL_END_RING) {
    bufferMultiplier = 1.2; // Skilled play buffer
  } else if (ringCount > SKILL_START_RING) {
    const progress = (ringCount - SKILL_START_RING) / (SKILL_END_RING - SKILL_START_RING);
    bufferMultiplier = 1.5 - (progress * 0.3); // 1.5 -> 1.2
  }
  const travelTime = Math.max(timeX, timeY) * bufferMultiplier;

  // Total time = reaction + orientation + travel + stabilization
  const totalTime = REACTION_TIME + ORIENTATION_TIME + travelTime + STABILIZATION_TIME;

  return totalTime;
}

/**
 * Spawn a new ring
 *
 * CRITICAL SAFEGUARDS TO PROTECT PLAYER FROM UNFAIR SITUATIONS:
 *
 * 1. Z-Spacing Check: Prevents rings from spawning too close together in space
 * 2. Arrival Time Collision: Prevents multiple rings from arriving at nearly the same time
 * 3. Momentum/Directional Conflict: Prevents opposite-direction rings when player is committed
 *
 * Safeguard 2 (Arrival Time) protects against:
 * - Player waiting for a slow-moving far ring
 * - Fast-moving close ring spawning and arriving milliseconds later
 * - Impossible situation requiring player to be in two places at once
 *
 * Safeguard 3 (Momentum Conflict) protects against:
 * - Player rushing toward Ring A (building momentum)
 * - Ring B spawning in OPPOSITE direction
 * - Player must fight momentum for Ring A AND prepare for opposite Ring B
 * - Compound difficulty spike from directional reversal + tight timing
 *
 * By enforcing minimum arrival separation (1.5s) and momentum-aware directional checks,
 * we ensure fair, sequential challenges rather than simultaneous impossible scenarios.
 */
function spawnRing() {
  // SAFEGUARD 1: Z-Spacing Check
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
  // Easy difficulty: lock rings to X-axis only (no vertical movement)
  const spawnY = currentDifficulty === 'easy' ? 0 : pos.y;
  const spawnZ = CONST.RING_SPAWN_DISTANCE;

  patternRingCount++;

  const difficultySettings = CONST.DIFFICULTY_SETTINGS[currentDifficulty];

  // Calculate progression based on ring count (every 10 rings, affected by difficulty)
  // CAP at level 5 (50 rings) to prevent extreme difficulty at high ring counts
  const progressionLevel = Math.min(Math.floor(ringModeRingCount / 10 * difficultySettings.progressionRate), 5);

  // Size: -5% every 10 rings (max 50% reduction at level 10), then apply difficulty multiplier
  const sizeReduction = progressionLevel * 0.05;
  const ringSize = CONST.INITIAL_RING_SIZE * (1 - Math.min(sizeReduction, 0.5)) * difficultySettings.sizeMultiplier;

  // Calculate 2D distance to ring
  const distanceToRing = Math.sqrt(
    (spawnX - ringModePosition.x) ** 2 +
    (spawnY - ringModePosition.y) ** 2
  );
  const MAX_RING_DISTANCE = CONST.RING_GRID_BOUNDS; // 1500 units
  const distanceRatio = distanceToRing / MAX_RING_DISTANCE; // 0.0 to 1.0

  // Check if this will be a bonus ring (very far away)
  // Expert mode requires 96% distance (very rare)
  // Hard/Easy/Normal modes require 85% distance
  const BONUS_RING_THRESHOLD = currentDifficulty === 'expert' ? 0.96 : 0.85;
  const isBonusRing = distanceRatio >= BONUS_RING_THRESHOLD;

  // PHYSICS-BASED TIMING CALCULATION
  // Calculate minimum time needed to reach this ring based on actual car physics
  // Pass current ring count for progressive skill scaling and difficulty for expert mode
  const minTimeToReach = calculateMinimumTimeToReach(
    spawnX, spawnY,
    ringModePosition.x, ringModePosition.y,
    ringModeVelocity.x, ringModeVelocity.y,
    ringModeRingCount,
    currentDifficulty
  );

  // Ring needs to travel from spawn point (z = -1100) to pass-through point (z = 0)
  const ringTravelDistance = Math.abs(CONST.RING_SPAWN_DISTANCE); // 1100 units

  // Calculate base ring speed from physics timing
  // Ring speed = distance / time
  let ringSpeed = ringTravelDistance / minTimeToReach;

  // Apply difficulty base multiplier, but scale it down for far rings
  // Far rings already have physics-calculated difficulty, don't make them impossible
  let difficultyMultiplier = 1.0;

  if (currentDifficulty === 'easy') {
    difficultyMultiplier = 0.85; // 15% more time (easier)
  } else if (currentDifficulty === 'hard') {
    // For close rings (< 40% distance), apply full hard multiplier
    // For far rings (> 40% distance), scale down the multiplier based on distance
    if (distanceRatio < 0.4) {
      difficultyMultiplier = 1.10; // 10% less time for close rings
    } else {
      // Gradually reduce multiplier for far rings
      // At 40% distance: 1.10×
      // At 70% distance: 1.0× (no multiplier)
      // At 85%+ distance: 0.95× (actually SLOWER for bonus rings)
      const farRingFactor = (distanceRatio - 0.4) / 0.5; // 0.0 at 40%, 1.0 at 90%
      difficultyMultiplier = 1.10 - (farRingFactor * 0.15); // Scales from 1.10 to 0.95
    }
  }

  ringSpeed *= difficultyMultiplier;

  // Very light progression (only in hard mode, only for close rings)
  // Far rings don't need progression - they're already hard enough!
  if (currentDifficulty === 'hard' && distanceRatio < 0.5) {
    const progressionBonus = Math.min(progressionLevel * 0.015, 0.075); // Reduced from 2% to 1.5%
    ringSpeed *= (1 + progressionBonus);
  }

  // Hard mode section multipliers (only for close-medium rings)
  if (currentDifficulty === 'hard' && currentSection && distanceRatio < 0.6) {
    // Scale section multipliers down since physics already handles base difficulty
    const scaledSectionSpeed = 1.0 + (sectionSpeed - 1.0) * 0.4; // Reduced from 50% to 40%
    ringSpeed *= scaledSectionSpeed;
  }

  // Bonus rings: NO speed increase - they're already the hardest to reach
  // Being far away is the difficulty, not the speed

  // EXPERT MODE: Speed boost for rings spawning near the edge of the current target ring
  // This creates fast-reaction scenarios while the player is still maneuvering through the current ring
  if (currentDifficulty === 'expert') {
    // Find the current target ring (closest unpassed ring by arrival time)
    const upcomingRings = rings.filter(r => !r.passed && !r.missed && r.mesh.position.z < 0);
    if (upcomingRings.length > 0) {
      upcomingRings.sort((a, b) => {
        const aTime = Math.abs(a.mesh.position.z) / a.speed;
        const bTime = Math.abs(b.mesh.position.z) / b.speed;
        return aTime - bTime;
      });

      const targetRing = upcomingRings[0];

      // Calculate 2D distance from new ring spawn position to target ring center
      const dx = spawnX - targetRing.mesh.position.x;
      const dy = spawnY - targetRing.mesh.position.y;
      const distanceToTargetRing = Math.sqrt(dx * dx + dy * dy);

      // Target ring's outer edge (including tube thickness)
      const targetRingRadius = targetRing.size / 2 + CONST.RING_TUBE_RADIUS;

      // Check if new ring spawns within one ring's diameter from the edge of target ring
      // "One ring's distance" = the current ring size being spawned
      const edgeProximityThreshold = targetRingRadius + ringSize;

      if (distanceToTargetRing <= edgeProximityThreshold) {
        // New ring is spawning very close to the current target ring's edge
        // Apply up to 2x speed boost (making it arrive faster, creating pressure)
        const expertSpeedBoost = 2.0;
        ringSpeed *= expertSpeedBoost;
      }
    }
  }

  // Clamp ring speed to reasonable bounds (prevent extreme cases)
  ringSpeed = Math.max(80, Math.min(350, ringSpeed));

  // SAFEGUARD 2 & 3: Combined Arrival Time and Momentum Conflict Detection
  // OPTIMIZATION: Check both safeguards in single pass through active rings

  // Calculate when THIS ring will arrive at the player (Z = 0)
  const thisRingArrivalTime = Math.abs(spawnZ) / ringSpeed;

  // Constants for conflict detection
  const MIN_ARRIVAL_TIME_SEPARATION = currentDifficulty === 'hard' ? 2.5 : 2.0;
  const MOMENTUM_COMMITMENT_TIME = 3.0;
  const OPPOSITE_DIRECTION_THRESHOLD = -0.5;

  // Find active rings (not passed/missed, still approaching)
  // OPTIMIZATION: Filter once instead of multiple times
  const activeRings = [];
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (!ring.passed && !ring.missed && ring.mesh.position.z < 0) {
      const distanceToArrival = Math.abs(ring.mesh.position.z);
      const arrivalTime = distanceToArrival / ring.speed;
      activeRings.push({ ring, arrivalTime });
    }
  }

  // Early exit if no active rings
  if (activeRings.length === 0) {
    // No conflicts possible, proceed to spawn
  } else {
    // SAFEGUARD 2: Arrival Time Collision Check
    for (let i = 0; i < activeRings.length; i++) {
      const arrivalTimeDifference = Math.abs(thisRingArrivalTime - activeRings[i].arrivalTime);
      if (arrivalTimeDifference < MIN_ARRIVAL_TIME_SEPARATION) {
        // CONFLICT: Rings would arrive too close together
        return;
      }
    }

    // SAFEGUARD 3: Momentum Conflict Check
    // Find the soonest arriving ring (already calculated arrival times)
    let nextRing = activeRings[0];
    for (let i = 1; i < activeRings.length; i++) {
      if (activeRings[i].arrivalTime < nextRing.arrivalTime) {
        nextRing = activeRings[i];
      }
    }

    // Only check momentum conflict if player is committed to next ring
    if (nextRing.arrivalTime < MOMENTUM_COMMITMENT_TIME) {
      const nextRingPos = nextRing.ring.mesh.position;

      // Calculate direction vectors
      const dx1 = nextRingPos.x - ringModePosition.x;
      const dy1 = nextRingPos.y - ringModePosition.y;
      const dx2 = spawnX - ringModePosition.x;
      const dy2 = spawnY - ringModePosition.y;

      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (dist1 > 10 && dist2 > 10) {
        // Normalize and compute dot product
        const dotProduct = (dx1 / dist1) * (dx2 / dist2) + (dy1 / dist1) * (dy2 / dist2);

        // Check for opposite directions
        if (dotProduct < OPPOSITE_DIRECTION_THRESHOLD) {
          const arrivalGap = Math.abs(thisRingArrivalTime - nextRing.arrivalTime);
          if (arrivalGap < 2.5) {
            // CONFLICT: Opposite direction with tight timing
            return;
          }
        }
      }
    }
  }

  // All safeguards passed - safe to create ring

  const ring = createRing(spawnX, spawnY, spawnZ, ringSize, ringSpeed, ringSpawnIndex++);

  // Mark rings spawned at far distances as bonus rings
  ring.isBonusRing = isBonusRing;

  // Determine if this bonus ring actually grants a life (chance-based by difficulty)
  // Easy: 100% chance (all bonus rings grant life)
  // Normal: 75% chance (3 in 4 bonus rings grant life)
  // Hard: 50% chance (1 in 2 bonus rings grant life)
  // Expert: 33% chance (1 in 3 bonus rings grant life)
  const bonusLifeChance = currentDifficulty === 'easy' ? 1.0 :
                          currentDifficulty === 'normal' ? 0.75 :
                          currentDifficulty === 'hard' ? 0.5 :
                          currentDifficulty === 'expert' ? 0.33 : 1.0;
  ring.grantsLife = isBonusRing && (Math.random() < bonusLifeChance);

  // Store initial 2D distance for distant ring indicator
  ring.initialDistance2D = distanceToRing;

  // Visual indicator: bonus rings glow brighter
  if (ring.isBonusRing) {
    ring.mesh.material.emissiveIntensity = 1.5; // Brighter glow
  }

  // Track section progress for hard mode
  if (currentDifficulty === 'hard') {
    sectionRingCount++;
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
  // Allow rhythm mode to use ring mode physics
  const isRhythmMode = gameState && gameState.getRhythmModeActive();

  if (!isRhythmMode && (!ringModeActive || ringModePaused || ringModeLives <= 0)) {
    // Stop boost sound when game is over or paused
    Audio.stopBoostRumble();
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
  // Easy difficulty: no vertical movement (no gravity)
  let accelY = (ringModeStarted && currentDifficulty !== 'easy') ? CONST.RING_GRAVITY : 0;

  if (effectiveBoostActive) {
    // Boost in the direction car's nose is facing
    accelX += boostDirX * CONST.RING_BOOST_ACCEL;
    // Easy difficulty: no vertical boost component
    if (currentDifficulty !== 'easy') {
      accelY += boostDirY * CONST.RING_BOOST_ACCEL;
    }
  }

  // Update boost flame visibility and position
  updateBoostFlames(inputState.boostActive, forward);

  // Integrate velocity
  ringModeVelocity.x += accelX * dt;
  ringModeVelocity.y += accelY * dt;

  // Easy difficulty: lock Y velocity to 0 (horizontal movement only)
  if (currentDifficulty === 'easy') {
    ringModeVelocity.y = 0;
  }

  // Clamp to max speed
  const speed = ringModeVelocity.length();
  if (speed > CONST.RING_MAX_SPEED) {
    ringModeVelocity.multiplyScalar(CONST.RING_MAX_SPEED / speed);
  }

  // Integrate position
  ringModePosition.x += ringModeVelocity.x * dt;
  ringModePosition.y += ringModeVelocity.y * dt;

  // Easy difficulty: lock Y position to 0 (horizontal movement only)
  if (currentDifficulty === 'easy') {
    ringModePosition.y = 0;
  }

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
  // Check if rhythm mode is active
  const isRhythmMode = gameState && gameState.getRhythmModeActive();

  if (!ringModeActive && !isRhythmMode) {
    return;
  }

  // Override car position to stay on grid
  if (Car.car) {
    Car.car.position.x = ringModePosition.x;
    Car.car.position.y = ringModePosition.y;

    // Both ring mode AND rhythm mode lock Z to 0 (2D plane)
    // Rings come toward the car, not the other way around
    Car.car.position.z = 0;
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

    // Safety check: ensure we have rings before accessing
    if (activeRings.length > 0) {
      // Oldest unpassed ring is the target
      targetRing = activeRings[0];

      // Next oldest unpassed ring (if exists)
      if (activeRings.length > 1) {
        nextRing = activeRings[1];
      }
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

  // NaN safety check - if position becomes NaN, reset to safe defaults
  if (!isFinite(targetCamX) || !isFinite(targetCamY) || !isFinite(targetCamZ)) {
    console.warn('Camera target position is NaN - resetting to origin');
    camera.position.set(0, CONST.CAM_BASE.y, CONST.CAM_BASE.z);
    ringModePosition.set(0, 0);
    ringModeVelocity.set(0, 0);
  } else {
    // Lerp camera position for smooth movement
    camera.position.x += (targetCamX - camera.position.x) * ringCameraSpeed;
    camera.position.y += (targetCamY - camera.position.y) * ringCameraSpeed;
    camera.position.z = targetCamZ;

    // Additional safety: check if camera position became NaN after lerp
    if (!isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
      console.warn('Camera position became NaN after lerp - resetting');
      camera.position.set(0, CONST.CAM_BASE.y, CONST.CAM_BASE.z);
    }
  }

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

          // Bonus life for passing rings that grant lives
          if (ring.grantsLife) {
            ringModeLives++;
          }

          // Update high score (difficulty-specific)
          if (ringModeScore > ringModeHighScore) {
            ringModeHighScore = ringModeScore;
            saveHighScoreForDifficulty();
          }

          // Audio feedback - play success sound
          Audio.playRingPassSound();
        } else if (distanceToCenter < ringOuterRadius) {
          // Hit the edge of the ring
          ring.missed = true;
          // Audio feedback - play miss sound
          Audio.playRingMissSound();
          // TODO: Apply heart damage
        } else {
          // Completely missed the ring
          ring.missed = true;
          ringModeLives--;
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
          // Audio feedback - play miss sound
          Audio.playRingMissSound();
        }
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        rings.splice(i, 1);
      }
    }

    // Spawn new rings periodically (affected by difficulty and section)
    // BUT: Do NOT spawn rings if rhythm mode is active (it handles its own ring spawning)
    if (!isRhythmMode) {
      ringSpawnTimer += dt;

      // Calculate spawn interval with difficulty and section multipliers
      let spawnInterval = CONST.RING_BASE_SPAWN_INTERVAL * CONST.DIFFICULTY_SETTINGS[currentDifficulty].spawnIntervalMultiplier;

      // Apply section spawn interval multiplier for hard mode
      if (currentDifficulty === 'hard' && currentSection) {
        spawnInterval *= sectionSpawnInterval;
      }

      if(ringSpawnTimer >= spawnInterval) {
        spawnRing();
        ringSpawnTimer = 0;
      }
    }
  }

  // Update the 3D dashed circle landing indicator on the grid
  updateLandingIndicator();
}

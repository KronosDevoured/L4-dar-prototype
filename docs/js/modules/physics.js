/**
 * physics.js
 * Car physics calculations for the L4 DAR prototype
 * Handles angular velocity, PD control, damping, and quaternion integration
 */

import * as THREE from 'three';
import * as CONST from './constants.js';
import * as Car from './car.js';
import * as Input from './input.js';

// ============================================================================
// MODULE-SCOPED PHYSICS STATE
// ============================================================================

// Reference to central game state (injected via init())
let gameState = null;

// Reference to RingMode module (injected via init() to avoid circular dependency)
let RingMode = null;

// Angular velocity vector (rad/s)
let w = new THREE.Vector3(0, 0, 0);

// Input history for smoothing
let inputHistory = { x: [], y: [] };
const INPUT_HISTORY_SIZE = 3;

// Previous angular acceleration (for derivative term)
let prevAlpha = new THREE.Vector3(0, 0, 0);

// Axis lock states
let pitchLocked = false;
let yawLocked = false;
let rollLocked = false;

// Tornado circle - measured axis data at min and max stick input (right direction)
let AXIS_MIN_DATA = null; // { centerLocal: Vector3, axisLocal: Vector3, radius: number }
let AXIS_MAX_DATA = null; // { centerLocal: Vector3, axisLocal: Vector3, radius: number }

// Load axis data from localStorage
function loadAxisDataFromStorage() {
  try {
    const minData = localStorage.getItem('tornadoAxisMinData');
    const maxData = localStorage.getItem('tornadoAxisMaxData');

    if (minData) {
      const parsed = JSON.parse(minData);
      AXIS_MIN_DATA = {
        centerLocal: new THREE.Vector3(parsed.centerLocal.x, parsed.centerLocal.y, parsed.centerLocal.z),
        axisLocal: new THREE.Vector3(parsed.axisLocal.x, parsed.axisLocal.y, parsed.axisLocal.z),
        radius: parsed.radius
      };
      console.log('✓ Loaded MIN axis data from localStorage');
    }

    if (maxData) {
      const parsed = JSON.parse(maxData);
      AXIS_MAX_DATA = {
        centerLocal: new THREE.Vector3(parsed.centerLocal.x, parsed.centerLocal.y, parsed.centerLocal.z),
        axisLocal: new THREE.Vector3(parsed.axisLocal.x, parsed.axisLocal.y, parsed.axisLocal.z),
        radius: parsed.radius
      };
      console.log('✓ Loaded MAX axis data from localStorage');
    }
  } catch (e) {
    console.error('Failed to load axis data from localStorage:', e);
  }
}

// Save axis data to localStorage
function saveAxisDataToStorage() {
  try {
    if (AXIS_MIN_DATA) {
      localStorage.setItem('tornadoAxisMinData', JSON.stringify({
        centerLocal: { x: AXIS_MIN_DATA.centerLocal.x, y: AXIS_MIN_DATA.centerLocal.y, z: AXIS_MIN_DATA.centerLocal.z },
        axisLocal: { x: AXIS_MIN_DATA.axisLocal.x, y: AXIS_MIN_DATA.axisLocal.y, z: AXIS_MIN_DATA.axisLocal.z },
        radius: AXIS_MIN_DATA.radius
      }));
    }

    if (AXIS_MAX_DATA) {
      localStorage.setItem('tornadoAxisMaxData', JSON.stringify({
        centerLocal: { x: AXIS_MAX_DATA.centerLocal.x, y: AXIS_MAX_DATA.centerLocal.y, z: AXIS_MAX_DATA.centerLocal.z },
        axisLocal: { x: AXIS_MAX_DATA.axisLocal.x, y: AXIS_MAX_DATA.axisLocal.y, z: AXIS_MAX_DATA.axisLocal.z },
        radius: AXIS_MAX_DATA.radius
      }));
    }
  } catch (e) {
    console.error('Failed to save axis data to localStorage:', e);
  }
}

// Load on module init
loadAxisDataFromStorage();

// Tornado circle tracking - measure nose position at 0° and 180° roll to find axis
let tornadoMeasurement = {
  measuring: false,
  targetStickMag: 0,      // 0.10 for min, 1.0 for max
  startNose: null,        // Nose position at 0° roll
  oppositeNose: null,     // Nose position at 180° roll
  nosePositions: [],      // Array of nose positions from 179° to 181°
  rotationAngle: 0,
  prevRotation: new THREE.Quaternion()
};

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

// Legacy roll PD gains (not actively used, kept for compatibility)
const KP_ROLL = 3.2, KD_ROLL = 0.25;

// PD control gains for pitch/yaw/roll
// Increased from 18.0 to 36.0 for much more responsive air control in Ring Mode (DAR)
const KpPitch = 36.0, KdPitch = 4.0;
const KpYaw   = 36.0, KdYaw   = 4.0;
const KpRoll  = 12.0, KdRoll  = 3.0;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Physics module with game state and Ring Mode dependency
 * This breaks the circular dependency by injecting dependencies at runtime
 * @param {GameState} state - Central game state instance
 * @param {Object} ringModeModule - RingMode module reference
 */
export function init(state, ringModeModule) {
  gameState = state;
  RingMode = ringModeModule;

  // Sync initial angular velocity with game state
  w = gameState.getAngularVelocityRef();

}

// ============================================================================
// EXPORTED GETTERS
// ============================================================================

/**
 * Get the current angular velocity vector
 * @returns {THREE.Vector3} Angular velocity (rad/s)
 */
export function getAngularVelocity() {
  return w.clone();
}

/**
 * Get the input history buffer (for debugging)
 * @returns {Object} Input history { x: [], y: [] }
 */
export function getInputHistory() {
  return {
    x: [...inputHistory.x],
    y: [...inputHistory.y]
  };
}

// ============================================================================
// EXPORTED SETTERS
// ============================================================================

/**
 * Set the angular velocity to a specific value
 * @param {number} x - Pitch velocity (rad/s)
 * @param {number} y - Yaw velocity (rad/s)
 * @param {number} z - Roll velocity (rad/s)
 */
export function setAngularVelocity(x, y, z) {
  w.set(x, y, z);
}

/**
 * Reset angular velocity to zero
 */
export function resetAngularVelocity() {
  w.set(0, 0, 0);
}

/**
 * Reset input history (for smoothing)
 */
export function resetInputHistory() {
  inputHistory = { x: [], y: [] };
}

/**
 * Reset all physics state
 */
export function resetPhysics() {
  w.set(0, 0, 0);
  inputHistory = { x: [], y: [] };
  prevAlpha.set(0, 0, 0);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const MIN_STICK_MAG = 0.10;  // what you used for your "min" measurement
const MAX_STICK_MAG = 1.00;  // full stick

function getInterpolatedAxisData(stickMag) {
  if (!AXIS_MIN_DATA || !AXIS_MAX_DATA) return null;

  // Normalize stickMag into 0..1 range
  const tRaw = (stickMag - MIN_STICK_MAG) / (MAX_STICK_MAG - MIN_STICK_MAG);
  const t = THREE.MathUtils.clamp(isNaN(tRaw) ? 0 : tRaw, 0, 1);

  const centerLocal = new THREE.Vector3().lerpVectors(
    AXIS_MIN_DATA.centerLocal,
    AXIS_MAX_DATA.centerLocal,
    t
  );

  const axisLocal = new THREE.Vector3().lerpVectors(
    AXIS_MIN_DATA.axisLocal,
    AXIS_MAX_DATA.axisLocal,
    t
  ).normalize();

  const radius = THREE.MathUtils.lerp(
    AXIS_MIN_DATA.radius,
    AXIS_MAX_DATA.radius,
    t
  );

  return { centerLocal, axisLocal, radius, t };
}

/**
 * Smooth joystick input using a rolling average
 * @param {number} jx - Raw joystick X input
 * @param {number} jy - Raw joystick Y input
 * @returns {Object} Smoothed input { x, y }
 */
function smoothInput(jx, jy) {
  inputHistory.x.push(jx);
  inputHistory.y.push(jy);
  if (inputHistory.x.length > INPUT_HISTORY_SIZE) {
    inputHistory.x.shift();
    inputHistory.y.shift();
  }

  const avgX = inputHistory.x.reduce((a, b) => a + b, 0) / inputHistory.x.length;
  const avgY = inputHistory.y.reduce((a, b) => a + b, 0) / inputHistory.y.length;
  return { x: avgX, y: avgY };
}

/**
 * Soft clamp angular velocity to prevent sudden stops
 * @param {THREE.Vector3} w - Angular velocity vector
 * @param {number} max - Maximum allowed magnitude
 */
function softClampAngularVelocity(w, max) {
  const mag = w.length();
  if (mag <= max) return;

  const excess = mag - max;
  const reduction = Math.min(1.0, excess / max);
  const scale = 1.0 - (reduction * 0.3);
  w.multiplyScalar(scale);
}

// ============================================================================
// VISUALIZATION UPDATE
// ============================================================================

/**
 * Update front-face arrow and tornado circle visualizations
 * @param {number} ux - Unit stick X (-1 to 1, right = +ux)
 * @param {number} uy - Unit stick Y (-1 to 1, up = +uy)
 * @param {number} eff - Effective input magnitude (0 to 1)
 * @param {Object} settings - Visualization settings
 */
function updateVisualizations(ux, uy, eff, settings) {
  // ONE TIME DEBUG
  if (!updateVisualizations._logged) {
    console.log('[updateVisualizations] Function is being called');
    updateVisualizations._logged = true;
  }

  const {
    showArrow,
    showCircle,
    arrowScale,
    circleScale,
    circleTiltAngle,
    circleTiltModifier
  } = settings;

  // --- Front-face arrow visualization ---
  if (Car.faceArrow && Car.faceTip) {
    const show = showArrow && eff > 0.02;
    Car.faceArrow.visible = show;
    Car.faceTip.visible   = show;

    if (show) {
      const lenMax = Math.min(Car.BOX.hx, Car.BOX.hy) * 0.95;
      const len    = Math.max(10, lenMax * eff * (arrowScale || 1));
      const zFace  = Car.BOX.hz + 0.6;

      const x2 = ux * len;
      const y2 = -uy * len;

      const pos = Car.faceArrow.geometry.attributes.position.array;
      pos[0] = 0;  pos[1] = 0;  pos[2] = zFace;
      pos[3] = x2; pos[4] = y2; pos[5] = zFace;
      Car.faceArrow.geometry.attributes.position.needsUpdate = true;

      const col = (Math.abs(x2) > Math.abs(y2))
        ? (x2 >= 0 ? CONST.COL_LEFT : CONST.COL_RIGHT)
        : (uy >= 0 ? CONST.COL_DOWN : CONST.COL_UP);
      Car.faceArrow.material.color.setHex(col);
      Car.faceTip.material.color.setHex(col);

      Car.faceTip.position.set(x2, y2, zFace);
      const ang = Math.atan2(x2, -y2) + Math.PI;
      Car.faceTip.rotation.set(0, 0, ang);
      const s = 0.95 * (arrowScale || 1);
      Car.faceTip.scale.set(s, s, 1);
    }
  }

}

// ============================================================================
// MAIN PHYSICS UPDATE
// ============================================================================

/**
 * Update physics simulation for one timestep
 * @param {number} dt - Time delta (seconds)
 * @param {Object} settings - Physics settings object
 * @param {boolean} chromeShown - True if menu is open (pauses physics)
 *
 * Settings object contains:
 * - showArrow, showCircle: Visualization toggles
 * - arrowScale, circleScale, circleTiltAngle, circleTiltModifier: Visualization parameters
 * - inputPow: Input curve exponent (1.0 = linear)
 * - damp, dampDAR: Damping coefficients for normal/DAR mode
 * - brakeOnRelease: Extra damping when stick is released (non-DAR only)
 * - maxAccelPitch, maxAccelYaw, maxAccelRoll: Max angular accelerations (deg/s²)
 * - wMax, wMaxPitch, wMaxYaw, wMaxRoll: Max angular velocities (rad/s)
 */
export function updatePhysics(dt, settings, chromeShown) {
  // Skip physics when menu is open OR when Ring Mode is paused
  // EXCEPT during automated measurement mode
  const allowMeasurement = window.measurementState && window.measurementState.active;
  if (!allowMeasurement && (chromeShown || gameState.isRingModePaused())) {
    return;
  }

  // Destructure settings for easier access
  const {
    showArrow,
    showCircle,
    arrowScale,
    circleScale,
    circleTiltAngle,
    circleTiltModifier,
    inputPow,
    damp,
    dampDAR,
    brakeOnRelease,
    maxAccelPitch,
    maxAccelYaw,
    maxAccelRoll,
    wMax,
    wMaxPitch,
    wMaxYaw,
    wMaxRoll
  } = settings;

  // --- 1. Get smoothed joystick position from Input module ---
  const joyVec = Input.getJoyVec();
  const jx = joyVec.x / Input.getJoyBaseR();
  const jy = -joyVec.y / Input.getJoyBaseR(); // up is positive
  let mag = Math.hypot(jx, jy);

  let eff = 0;
  let ux = 0, uy = 0;

  if (mag > Input.STICK_DEADZONE) {
    const m2 = (mag - Input.STICK_DEADZONE) / (1 - Input.STICK_DEADZONE);
    const shaped = Math.pow(Math.max(0, m2), inputPow || 1.0); // 0..1
    eff = shaped;

    ux = -jx; // right = +ux (raw stick value, no normalization)
    uy = jy;  // up = +uy (raw stick value, no normalization)
  }

  // === RING MODE: Calculate movement forces (normal rotation physics will run below) ===
  if (gameState.getRingModeActive()) {
    // Always call updateRingModePhysics so it can handle game-over logic (like stopping boost sound)
    RingMode.updateRingModePhysics(dt, {
      boostActive: Input.getRingModeBoostActive()
    }, Car.car.quaternion);
  }

  // --- 2. Update visualizations (front-face arrow and tornado circle) ---
  updateVisualizations(ux, uy, eff, {
    showArrow,
    showCircle,
    arrowScale,
    circleScale,
    circleTiltAngle,
    circleTiltModifier
  });

  // --- 3. Slider conversions (deg/s² → rad/s²) ---
  let maxAccelPitchRad = (maxAccelPitch * Math.PI) / 180;
  let maxAccelYawRad   = (maxAccelYaw   * Math.PI) / 180;
  let maxAccelRollRad  = (maxAccelRoll  * Math.PI) / 180;

  // --- 3.5. DAR acceleration multipliers (from RL measurements) ---
  if (Input.getDarOn()) {
    maxAccelPitchRad *= 0.997;  // DAR: 714→712 deg/s²
    maxAccelYawRad *= 1.00;      // DAR: 521→522 deg/s² (no change)
    maxAccelRollRad *= 0.98;     // DAR: 2153→2110 deg/s²
  }

  // --- 4. Desired angular velocities (rate control) ---
  let maxPitchSpeed = wMaxPitch;  // rad/s, slider already in "ω"
  let maxYawSpeed   = wMaxYaw;    // rad/s
  let targetRollSpeed = 0;        // rad/s

  // Check if using Air Roll (Free) mode
  const isAirRollFree = (Input.getAirRoll() === 2);

  // Check if using directional air roll (Left/Right)
  const isDirectionalAirRoll = (Input.getAirRoll() === -1 || Input.getAirRoll() === 1);

  // Directional air roll tornado spin (measured from Rocket League)
  // This activates when:
  // 1. Air Roll Left/Right buttons are pressed (Square/Circle on gamepad, Q/E on keyboard)
  // 2. DAR button is active with a selected direction in the menu
  if ((isDirectionalAirRoll || Input.getDarOn()) && !isAirRollFree) {
    // RL tornado spin: 0.74 seconds per rotation
    const RL_TORNADO_PERIOD = 0.74;  // seconds
    targetRollSpeed = Input.getAirRoll() * (2 * Math.PI) / RL_TORNADO_PERIOD;  // Input.getAirRoll() = ±1 for Left/Right
  }

  // stick → desired spin rates
  let wx_des, wy_des, wz_des;

  if (isAirRollFree) {
    // Air Roll (Free): horizontal stick controls roll, vertical controls pitch
    wx_des = maxPitchSpeed * eff * uy; // pitch (up/down)
    wy_des = 0;                         // no yaw
    wz_des = wMaxRoll * eff * (-ux);   // roll (left stick = roll left, right stick = roll right)
  } else {
    // Normal or Air Roll Left/Right: standard controls
    wx_des = maxPitchSpeed * eff * uy; // pitch
    wy_des = maxYawSpeed   * eff * ux; // yaw
    wz_des = targetRollSpeed;          // roll from DAR
  }

  // --- Update tornado circle visualizer ---
  const stickMag = Math.sqrt(ux * ux + uy * uy);

  // MEASUREMENT MODE: Track nose position through 179°-181° roll rotation
  if (tornadoMeasurement.measuring && stickMag > 0.01) {
    const carQuat = Car.car.quaternion.clone();
    const carPos = Car.car.position.clone();
    const noseLocal = new THREE.Vector3(0, 0, Car.BOX.hz);
    const noseWorld = noseLocal.clone().applyQuaternion(carQuat).add(carPos);

    // Track roll rotation angle
    const rotationDelta = carQuat.clone().multiply(tornadoMeasurement.prevRotation.clone().invert());
    rotationDelta.normalize();
    const angle = 2 * Math.acos(Math.min(1, Math.abs(rotationDelta.w)));
    tornadoMeasurement.rotationAngle += angle;
    tornadoMeasurement.prevRotation.copy(carQuat);

    const rotationDegrees = tornadoMeasurement.rotationAngle * 180 / Math.PI;
    console.log(`Roll angle: ${rotationDegrees.toFixed(1)}°`);

    // Collect nose positions between 179° and 181°
    if (rotationDegrees >= 179 && rotationDegrees <= 181) {
      tornadoMeasurement.nosePositions.push(noseWorld.clone());
    }

    // When we pass 181°, calculate the axis
    if (rotationDegrees > 181 && tornadoMeasurement.nosePositions.length > 0) {
      // Average all nose positions between 179° and 181° to get the opposite point
      const oppositeNose = new THREE.Vector3();
      for (const pos of tornadoMeasurement.nosePositions) {
        oppositeNose.add(pos);
      }
      oppositeNose.divideScalar(tornadoMeasurement.nosePositions.length);

      const startNose = tornadoMeasurement.startNose;

      // Circle center is midpoint (in world space)
      const centerWorld = startNose.clone().add(oppositeNose).multiplyScalar(0.5);

      // Axis direction is from start to opposite (diameter)
      const axisWorld = oppositeNose.clone().sub(startNose).normalize();

      // Radius is half the distance
      const radius = startNose.distanceTo(oppositeNose) * 0.5;

      // Convert to car-local space
      const centerLocal = centerWorld.clone().sub(carPos).applyQuaternion(carQuat.clone().invert());
      const axisLocal = axisWorld.clone().applyQuaternion(carQuat.clone().invert());

      // Store based on stick magnitude
      const data = { centerLocal, axisLocal, radius };
      if (Math.abs(tornadoMeasurement.targetStickMag - 0.10) < 0.05) {
        AXIS_MIN_DATA = data;
        console.log('✓ MIN axis measured:', data);
        saveAxisDataToStorage();
      } else if (Math.abs(tornadoMeasurement.targetStickMag - 1.0) < 0.1) {
        AXIS_MAX_DATA = data;
        console.log('✓ MAX axis measured:', data);
        saveAxisDataToStorage();
      }

      // Stop measuring
      tornadoMeasurement.measuring = false;

      // Reset automated measurement state
      if (window.measurementState) {
        window.measurementState.active = false;
        window.measurementState.input.x = 0;
        window.measurementState.input.y = 0;
      }
    }
  }

  // Reset measurement when stick released (but NOT during automated measurement)
  if (tornadoMeasurement.measuring && stickMag < 0.01 && !(window.measurementState && window.measurementState.active)) {
    tornadoMeasurement.measuring = false;
    console.log('Measurement cancelled - stick released');
  }

  // Yellow tornado line - controlled by analog stick in car-local space
  if (stickMag > 0.01) {
    // Show the yellow line
    Car.yellowTornadoLine.visible = true;

    const carPos = Car.car.position.clone();
    const carQuat = Car.car.quaternion.clone();

    // Nose endpoint position in car-local space
    // Maximum offset: 40 units from roll axis in any direction
    const MAX_OFFSET = 40;
    const LINE_HALF_LENGTH = 150;

    // Stick mapping (inverted for nose-relative control):
    // Stick DOWN (uy < 0) → endpoint moves nose UP (local X positive)
    // Stick UP (uy > 0) → endpoint moves nose DOWN (local X negative)
    // Stick LEFT (ux < 0) → endpoint moves nose LEFT (local Y positive)
    // Stick RIGHT (ux > 0) → endpoint moves nose RIGHT (local Y negative)
    const offsetX = -uy * MAX_OFFSET;
    const offsetY = -ux * MAX_OFFSET;

    // Nose endpoint: starts at (0, 0, 150) and offsets by stick input
    // Stick directly controls X and Y offset, Z stays at line half-length
    const x = offsetX;
    const y = offsetY;
    const z = LINE_HALF_LENGTH;

    // Nose endpoint in car-local space
    const localNoseEndpoint = new THREE.Vector3(x, y, z);

    // Transform to world space
    const worldNoseEndpoint = localNoseEndpoint.clone().applyQuaternion(carQuat);

    // Line endpoints: nose endpoint and opposite side (just negate the vector)
    const lineEnd = carPos.clone().add(worldNoseEndpoint);
    const lineStart = carPos.clone().sub(worldNoseEndpoint);

    // Update line geometry
    const positions = Car.yellowTornadoLine.geometry.attributes.position;
    positions.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
    positions.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
    positions.needsUpdate = true;
  } else {
    // Hide the yellow line when stick is not touched
    Car.yellowTornadoLine.visible = false;
  }

  // --- 5. PD control → angular acceleration per axis ---
  const ax_des = KpPitch * (wx_des - w.x) - KdPitch * w.x;
  const ay_des = KpYaw   * (wy_des - w.y) - KdYaw   * w.y;
  const az_des = KpRoll  * (wz_des - w.z) - KdRoll  * w.z;

  const ax = THREE.MathUtils.clamp(ax_des, -maxAccelPitchRad, maxAccelPitchRad);
  const ay = THREE.MathUtils.clamp(ay_des, -maxAccelYawRad,   maxAccelYawRad);
  const az = THREE.MathUtils.clamp(az_des, -maxAccelRollRad,  maxAccelRollRad);

  // --- 6. Integrate angular velocity ---
  w.x += ax * dt;
  w.y += ay * dt;
  w.z += az * dt;

  // Apply axis locks - set velocity to 0 for locked axes
  if (pitchLocked) w.x = 0;
  if (yawLocked) w.y = 0;
  if (rollLocked) w.z = 0;

  // --- 7. Damping + release brake ---
  // CRITICAL: Damping only applies when inputs are released!
  const noStick = eff < 0.08;
  if (noStick) {
    // Check if DAR is active from ANY source (gamepad or touch)
    const isDARActive = isDirectionalAirRoll || Input.getDarOn();
    const baseDamp = isDARActive ? dampDAR : damp;
    const dampEff = (baseDamp || 0) + ((!isDARActive) ? (brakeOnRelease || 0) : 0);
    const scale = Math.exp(-dampEff * dt);
    w.multiplyScalar(scale);
  }

  // --- 8. Per-axis caps + global cap ---
  if (Math.abs(w.x) > wMaxPitch) w.x = Math.sign(w.x) * wMaxPitch;
  if (Math.abs(w.y) > wMaxYaw)   w.y = Math.sign(w.y) * wMaxYaw;

  const wMag = w.length();
  if (wMag > wMax) {
    w.multiplyScalar(wMax / wMag);
  }

  // --- 9. Quaternion integration ---
  const wx = w.x, wy = w.y, wz = w.z, halfdt = 0.5 * dt;
  const q = Car.car.quaternion;
  const rw = -q.x * wx - q.y * wy - q.z * wz;
  const rx =  q.w * wx + q.y * wz - q.z * wy;
  const ry =  q.w * wy + q.z * wx - q.x * wz;
  const rz =  q.w * wz + q.x * wy - q.y * wx;
  q.w += rw * halfdt;
  q.x += rx * halfdt;
  q.y += ry * halfdt;
  q.z += rz * halfdt;
  q.normalize();

  // Roll axis locking disabled - car can rotate freely
  // (Previously locked to align with green line)

  // === RING MODE: Override car position and update rings ===
  RingMode.updateRingModeRendering(dt);
}

// ============================================================================
// TORNADO CIRCLE AXIS MEASUREMENT FUNCTIONS
// ============================================================================

/**
 * Start measuring axis at minimum stick input (~25%)
 * Hold DAR + stick at ~25%, call this, then rotate 180°
 */
export function measureMinAxis() {
  tornadoMeasurement.measuring = true;
  tornadoMeasurement.targetStickMag = 0.10;
  const carQuat = Car.car.quaternion.clone();
  const carPos = Car.car.position.clone();
  const noseLocal = new THREE.Vector3(0, 0, Car.BOX.hz);
  const noseWorld = noseLocal.clone().applyQuaternion(carQuat).add(carPos);
  tornadoMeasurement.startNose = noseWorld.clone();
  tornadoMeasurement.nosePositions = [];
  tornadoMeasurement.rotationAngle = 0;
  tornadoMeasurement.prevRotation.copy(carQuat);
  console.log('Measuring MIN axis - rotate 180° now...');
}

/**
 * Start measuring axis at maximum stick input (100%)
 * Hold DAR + stick at 100%, call this, then rotate 180°
 */
export function measureMaxAxis() {
  tornadoMeasurement.measuring = true;
  tornadoMeasurement.targetStickMag = 1.0;
  const carQuat = Car.car.quaternion.clone();
  const carPos = Car.car.position.clone();
  const noseLocal = new THREE.Vector3(0, 0, Car.BOX.hz);
  const noseWorld = noseLocal.clone().applyQuaternion(carQuat).add(carPos);
  tornadoMeasurement.startNose = noseWorld.clone();
  tornadoMeasurement.nosePositions = [];
  tornadoMeasurement.rotationAngle = 0;
  tornadoMeasurement.prevRotation.copy(carQuat);
  console.log('Measuring MAX axis - rotate 180° now...');
}

/**
 * Print the measured axis data for hardcoding
 */
export function printAxisData() {
  if (AXIS_MIN_DATA && AXIS_MAX_DATA) {
    console.log('Copy these into physics.js:');
    console.log(`let AXIS_MIN_DATA = {
  centerLocal: new THREE.Vector3(${AXIS_MIN_DATA.centerLocal.x}, ${AXIS_MIN_DATA.centerLocal.y}, ${AXIS_MIN_DATA.centerLocal.z}),
  axisLocal: new THREE.Vector3(${AXIS_MIN_DATA.axisLocal.x}, ${AXIS_MIN_DATA.axisLocal.y}, ${AXIS_MIN_DATA.axisLocal.z}),
  radius: ${AXIS_MIN_DATA.radius}
};`);
    console.log(`let AXIS_MAX_DATA = {
  centerLocal: new THREE.Vector3(${AXIS_MAX_DATA.centerLocal.x}, ${AXIS_MAX_DATA.centerLocal.y}, ${AXIS_MAX_DATA.centerLocal.z}),
  axisLocal: new THREE.Vector3(${AXIS_MAX_DATA.axisLocal.x}, ${AXIS_MAX_DATA.axisLocal.y}, ${AXIS_MAX_DATA.axisLocal.z}),
  radius: ${AXIS_MAX_DATA.radius}
};`);
  } else {
    console.log('No axis data measured yet. Call measureMinAxis() and measureMaxAxis()');
  }
}

// ============================================================================
// AXIS LOCK FUNCTIONS
// ============================================================================

export function togglePitchLock() {
  pitchLocked = !pitchLocked;
  console.log(`Pitch ${pitchLocked ? 'LOCKED' : 'UNLOCKED'}`);
  return pitchLocked;
}

export function toggleYawLock() {
  yawLocked = !yawLocked;
  console.log(`Yaw ${yawLocked ? 'LOCKED' : 'UNLOCKED'}`);
  return yawLocked;
}

export function toggleRollLock() {
  rollLocked = !rollLocked;
  console.log(`Roll ${rollLocked ? 'LOCKED' : 'UNLOCKED'}`);
  return rollLocked;
}

// ============================================================================

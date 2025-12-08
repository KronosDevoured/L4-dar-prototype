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

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

// Stick deadzone (local constant)
const STICK_DEADZONE = 0.02;

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

  // --- Tornado circle visualizer (shows DAR cone path) ---
  if (Car.tornadoCircle) {
    // Circle only shows for Air Roll Left/Right (not Free), when DAR is active
    const isDAR = (Input.getAirRoll() === -1 || Input.getAirRoll() === 1);
    const shouldShowCircle = showCircle && isDAR && Input.getDarOn() && eff > 0.02;
    Car.tornadoCircle.visible = shouldShowCircle;

    if (shouldShowCircle) {
      const zFace = Car.BOX.hz + 0.6;

      // Calculate circle radius based on stick input
      const baseRadius = Math.min(Car.BOX.hx, Car.BOX.hy) * 0.95;
      const arrowLength = baseRadius * eff * (arrowScale || 1);

      // Circle scale controlled by circleScale slider
      const circleRadius = arrowLength * (circleScale || 0.3);

      // The circle should be offset perpendicular to the arrow direction
      // Air Roll Left (Input.getAirRoll() = -1): offset +90 degrees (counter-clockwise)
      // Air Roll Right (Input.getAirRoll() = +1): offset -90 degrees (clockwise)
      const arrowAngle = Math.atan2(ux, uy); // angle of the arrow in XY plane
      const perpAngle = arrowAngle + (Input.getAirRoll() * Math.PI / 2); // offset 90 degrees based on roll direction

      // Position circle center perpendicular to arrow, distance = circle radius
      const centerX = Math.sin(perpAngle) * circleRadius;
      const centerY = -Math.cos(perpAngle) * circleRadius;

      Car.tornadoCircle.scale.set(circleRadius, circleRadius, 1);
      Car.tornadoCircle.position.set(centerX, centerY, zFace);

      // Update circle color based on stick direction (same as arrow)
      const col = (Math.abs(ux) > Math.abs(uy))
        ? (ux >= 0 ? CONST.COL_LEFT : CONST.COL_RIGHT)
        : (uy >= 0 ? CONST.COL_DOWN : CONST.COL_UP);
      Car.tornadoCircle.material.color.setHex(col);

      // Apply tilt rotation toward the car
      // Calculate modifier strength: 0 at stable points (every 45°), 1.0 at unstable points (between 45° marks)
      // Stable points: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
      // Using sin(4x) to create 8 peaks per rotation (frequency = 4)
      const arrowAngleDeg = (arrowAngle * 180 / Math.PI + 360) % 360;
      const modifierStrength = Math.abs(Math.sin(4 * arrowAngle)); // 0 at stable, 1 at unstable

      // Apply base tilt + modifier
      const totalTilt = circleTiltAngle + (circleTiltModifier * modifierStrength);
      const tiltRad = (totalTilt * Math.PI) / 180;

      // Reset rotation first
      Car.tornadoCircle.rotation.set(0, 0, 0);

      // Rotate around the axis perpendicular to the arrow (makes circle tilt toward car)
      // Negative tiltRad to tilt toward car instead of away
      Car.tornadoCircle.rotateOnAxis(
        new THREE.Vector3(-Math.cos(perpAngle), -Math.sin(perpAngle), 0).normalize(),
        -tiltRad
      );
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
  if (chromeShown || gameState.isRingModePaused()) {
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

    ux = -jx / (mag || 1); // right = +ux
    uy = jy  / (mag || 1); // up = +uy
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

  // DAR tornado spin (measured from Rocket League)
  if (Input.getDarOn() && !isAirRollFree) {
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

  // --- 7. Damping + release brake ---
  // CRITICAL: Damping only applies when inputs are released!
  const noStick = eff < 0.08;
  if (noStick) {
    const baseDamp = Input.getDarOn() ? dampDAR : damp;
    const dampEff = (baseDamp || 0) + ((!Input.getDarOn()) ? (brakeOnRelease || 0) : 0);
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

  // --- 9. Quaternion integration (unchanged) ---
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

  // === RING MODE: Override car position and update rings ===
  RingMode.updateRingModeRendering(dt);
}

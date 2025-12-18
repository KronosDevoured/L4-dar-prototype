/**
 * touchInput.js
 * Touch input handling for joystick, DAR button, and boost button
 * Manages multi-touch gestures and control repositioning
 */

import * as THREE from 'three';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Joystick
let JOY_BASE_R = 100;
let JOY_KNOB_R = Math.round(JOY_BASE_R * 0.32);
let JOY_CENTER = new THREE.Vector2(130, window.innerHeight - 130);

// DAR Button
let DAR_R = 44;
let DAR_CENTER = new THREE.Vector2(window.innerWidth - 80, window.innerHeight - 130);

// Boost Button
let BOOST_R = 50;
let BOOST_CENTER = new THREE.Vector2(window.innerWidth - 80, window.innerHeight - 250);

// ============================================================================
// STATE
// ============================================================================

// Joystick state
let joyActive = false;
let joyVec = new THREE.Vector2(0, 0);
let smJoy = new THREE.Vector2(0, 0);
let relocating = false;
let holdTimer = null;
let joyPressStartPos = new THREE.Vector2(0, 0);

// DAR state
let darOn = false;
let darRelocating = false;
let darHoldTimer = null;
let darPressT = 0;

// Boost state
let boostRelocating = false;
let boostHoldTimer = null;
let boostPressT = 0;
let showBoostButton = false;
let boostButtonEverShown = false; // Track if button was ever shown (for repositioning)
let boostTwoFingerMode = false; // Track if two fingers are on boost button for relocation
let boostSecondFingerId = null; // Track the second finger's pointer ID

// Multi-touch pointer tracking
let joyPointerId = null;

// Hint elements
const joyHint = document.getElementById('joyHint');
const darHint = document.getElementById('darHint');
let darPointerId = null;
let boostPointerId = null;
let activePointers = new Map();

// ============================================================================
// CONSTANTS
// ============================================================================

const STICK_TAU_MS = 8;
const RELOCATE_HOLD_MS = 250;
export const STICK_MIN = 0.02;
export const STICK_DEADZONE = 0.09;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function inJoyLoose(x, y) {
  const dx = x - JOY_CENTER.x;
  const dy = y - JOY_CENTER.y;
  const loose = JOY_BASE_R + 28;
  const inC = (dx * dx + dy * dy) <= loose * loose;
  const inB = (Math.abs(dx) <= JOY_BASE_R) && (Math.abs(dy) <= JOY_BASE_R + 40);
  return inC || inB;
}

function vecFromJoyPx(x, y) {
  let dx = x - JOY_CENTER.x;
  let dy = y - JOY_CENTER.y;
  const m = Math.hypot(dx, dy);
  if (m > JOY_BASE_R) {
    const k = JOY_BASE_R / (m || 1);
    dx *= k;
    dy *= k;
  }
  return new THREE.Vector2(dx, dy);
}

export function clampJoyCenter() {
  JOY_CENTER.x = Math.max(JOY_BASE_R + 20, Math.min(innerWidth - (JOY_BASE_R + 20), JOY_CENTER.x));
  JOY_CENTER.y = Math.max(JOY_BASE_R + 20, Math.min(innerHeight - (JOY_BASE_R + 20), JOY_CENTER.y));
}

function inDAR(x, y) {
  const dx = x - DAR_CENTER.x;
  const dy = y - DAR_CENTER.y;
  return (dx * dx + dy * dy) <= (DAR_R * DAR_R);
}

function clampDARCenter() {
  const m = DAR_R + 20;
  DAR_CENTER.x = Math.max(m, Math.min(innerWidth - m, DAR_CENTER.x));
  DAR_CENTER.y = Math.max(m, Math.min(innerHeight - m, DAR_CENTER.y));
}

function inBoost(x, y) {
  const dx = x - BOOST_CENTER.x;
  const dy = y - BOOST_CENTER.y;
  return (dx * dx + dy * dy) <= (BOOST_R * BOOST_R);
}

function clampBoostCenter() {
  const m = BOOST_R + 20;
  BOOST_CENTER.x = Math.max(m, Math.min(innerWidth - m, BOOST_CENTER.x));
  BOOST_CENTER.y = Math.max(m, Math.min(innerHeight - m, BOOST_CENTER.y));
}

function inRetryButton(x, y) {
  // Retry button dimensions from rendering.js
  const retryButtonWidth = 200;
  const retryButtonHeight = 50;
  const retryButtonX = window.innerWidth / 2 - retryButtonWidth / 2;
  const retryButtonY = window.innerHeight / 2 + 30;

  return x >= retryButtonX && x <= retryButtonX + retryButtonWidth &&
         y >= retryButtonY && y <= retryButtonY + retryButtonHeight;
}

function positionHints() {
  if (joyHint && darHint) {
    joyHint.style.left = (JOY_CENTER.x + JOY_BASE_R + 18) + 'px';
    joyHint.style.top = (JOY_CENTER.y - JOY_BASE_R - 18) + 'px';
    darHint.style.left = (DAR_CENTER.x + DAR_R + 18) + 'px';
    darHint.style.top = (DAR_CENTER.y - DAR_R - 18) + 'px';
  }
}

// ============================================================================
// TOUCH EVENT HANDLERS
// ============================================================================

export function onPointerDown(e, callbacks) {
  const x = e.clientX;
  const y = e.clientY;
  const id = e.pointerId;

  activePointers.set(id, { x, y });

  // Check joystick
  if (joyPointerId === null && inJoyLoose(x, y)) {
    joyPointerId = id;
    joyActive = true;
    joyVec.copy(vecFromJoyPx(x, y));
    joyPressStartPos.set(x, y);

    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      // Only enable relocate if still active and timer wasn't cancelled by movement
      if (joyActive && !relocating) {
        relocating = true;
        callbacks?.showJoyHint?.();
      }
    }, RELOCATE_HOLD_MS);
  }
  // Check DAR button
  else if (darPointerId === null && inDAR(x, y)) {
    darPointerId = id;
    darPressT = performance.now();
    darOn = true;
    callbacks?.onDARPress?.(true);

    clearTimeout(darHoldTimer);
    darHoldTimer = setTimeout(() => {
      if (darOn && !darRelocating) {
        darRelocating = true;
        callbacks?.showDARHint?.();
      }
    }, RELOCATE_HOLD_MS);
  }
  // Check Boost button
  else if (boostPointerId === null && showBoostButton && inBoost(x, y)) {
    boostPointerId = id;
    boostPressT = performance.now();

    // Only activate boost if Ring Mode is active
    const ringModeActive = callbacks?.getRingModeActive?.() || false;

    if (ringModeActive) {
      // In Ring Mode: boost immediately
      callbacks?.onBoostPress?.(true);
    }
    // Note: No hold-to-relocate in free flight - use two-finger gesture instead
  }
  // Check for second finger anywhere in open space (two-finger boost relocation)
  else if (activePointers.size === 2 && boostSecondFingerId === null && showBoostButton) {
    // Second finger detected - check if both fingers are in open space (not on controls)
    let firstPointer = null;
    let firstId = null;

    // Find the first pointer (the one that's not the current id)
    for (const [pointerId, pointer] of activePointers.entries()) {
      if (pointerId !== id) {
        firstPointer = pointer;
        firstId = pointerId;
        break;
      }
    }

    if (firstPointer) {
      // Check that neither finger is on a control button
      const firstInControl = inJoyLoose(firstPointer.x, firstPointer.y) || inDAR(firstPointer.x, firstPointer.y) || inBoost(firstPointer.x, firstPointer.y);
      const secondInControl = inJoyLoose(x, y) || inDAR(x, y) || inBoost(x, y);

      if (!firstInControl && !secondInControl) {
        // Two fingers in open space - enable boost button relocation
        boostSecondFingerId = id;
        boostTwoFingerMode = true;
        boostRelocating = true;

        // Move boost button to second finger position
        BOOST_CENTER.set(x, y);
        clampBoostCenter();

        callbacks?.showBoostHint?.();

        // Deactivate boost if it was active
        const ringModeActive = callbacks?.getRingModeActive?.() || false;
        if (ringModeActive && boostPointerId !== null) {
          callbacks?.onBoostPress?.(false);
        }
      }
    }
  }
  // Check Retry button (when game over)
  else if (inRetryButton(x, y)) {
    callbacks?.onRetryPress?.();
  }
}

export function onPointerMove(e, callbacks) {
  const x = e.clientX;
  const y = e.clientY;
  const id = e.pointerId;

  if (!activePointers.has(id)) return;
  activePointers.set(id, { x, y });

  // Joystick movement
  if (id === joyPointerId) {
    // Cancel relocate timer if pointer has moved significantly
    const moved = joyPressStartPos.distanceTo(new THREE.Vector2(x, y));
    if (moved > 10 && holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    if (relocating) {
      JOY_CENTER.set(x, y);
      clampJoyCenter();
      callbacks?.positionHints?.();
    } else {
      joyVec.copy(vecFromJoyPx(x, y));
    }
  }
  // DAR repositioning
  else if (id === darPointerId && darRelocating) {
    DAR_CENTER.set(x, y);
    clampDARCenter();
    callbacks?.positionHints?.();
  }
  // Boost repositioning (drag with second finger in two-finger mode)
  else if (id === boostSecondFingerId && boostRelocating) {
    BOOST_CENTER.set(x, y);
    clampBoostCenter();
    callbacks?.positionHints?.();
  }
}

export function endPtr(id, callbacks) {
  activePointers.delete(id);

  // Joystick release
  if (id === joyPointerId) {
    joyPointerId = null;
    joyActive = false;
    joyVec.set(0, 0);
    smJoy.set(0, 0);
    relocating = false;
    clearTimeout(holdTimer);
  }
  // DAR release
  else if (id === darPointerId) {
    darPointerId = null;
    const heldTime = performance.now() - darPressT;
    if (heldTime < RELOCATE_HOLD_MS || !darRelocating) {
      callbacks?.onDARRelease?.();
    }
    darOn = false;
    darRelocating = false;
    clearTimeout(darHoldTimer);
  }
  // Boost release
  else if (id === boostPointerId) {
    boostPointerId = null;
    // Only trigger boost release if it was a normal boost press (not relocation)
    if (!boostTwoFingerMode && !boostRelocating) {
      callbacks?.onBoostPress?.(false);
    }
    // If in two-finger mode, exit it when boost finger releases
    if (boostTwoFingerMode) {
      boostSecondFingerId = null;
      boostTwoFingerMode = false;
      boostRelocating = false;
      callbacks?.hideBoostHint?.();
    }
  }
  // Second finger release during two-finger boost relocation
  else if (id === boostSecondFingerId) {
    boostSecondFingerId = null;
    boostTwoFingerMode = false;
    boostRelocating = false;
    callbacks?.hideBoostHint?.();
  }
}

// ============================================================================
// UPDATE LOOP
// ============================================================================

export function updateTouch(dt) {
  // Smooth joystick interpolation ONLY for on-screen touch joystick
  // Keyboard/gamepad get direct response (no smoothing lag)
  if (joyActive) {
    // Touch joystick: smooth to reduce finger jitter
    const a = Math.exp(-dt * 1000 / STICK_TAU_MS);
    smJoy.x = a * smJoy.x + (1 - a) * joyVec.x;
    smJoy.y = a * smJoy.y + (1 - a) * joyVec.y;
  } else {
    // Keyboard/gamepad: direct, instant response
    smJoy.x = joyVec.x;
    smJoy.y = joyVec.y;
  }
}

// ============================================================================
// CONFIGURATION SETTERS
// ============================================================================

export function setJoyBaseR(r) {
  JOY_BASE_R = r;
  JOY_KNOB_R = Math.round(JOY_BASE_R * 0.32);
}

export function setJoyKnobR(r) {
  JOY_KNOB_R = r;
}

export function setShowBoostButton(show) {
  if (show) {
    boostButtonEverShown = true; // Remember that boost button was shown
  }
  // Keep button visible if it was ever shown (allows repositioning in free flight)
  showBoostButton = boostButtonEverShown;
}

export function setJoyVec(x, y) {
  joyVec.set(x, y);
}

// ============================================================================
// RESIZE HANDLER
// ============================================================================

export function handleTouchResize() {
  clampJoyCenter();
  clampDARCenter();
  clampBoostCenter();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let hudElement = null;
let savedCallbacks = {};

export function initTouch(hud, callbacks = {}) {
  hudElement = hud;
  savedCallbacks = callbacks;

  // Set up touch event listeners
  hud.addEventListener('pointerdown', (e) => onPointerDown(e, callbacks), { passive: false });
  hud.addEventListener('pointermove', (e) => onPointerMove(e, callbacks), { passive: false });
  hud.addEventListener('pointerup', (e) => endPtr(e.pointerId, callbacks), { passive: false });
  hud.addEventListener('pointercancel', (e) => endPtr(e.pointerId, callbacks), { passive: false });

  // Ensure all button positions are correct for current window size
  handleTouchResize();

  // Position hints
  positionHints();
}

// ============================================================================
// GETTERS
// ============================================================================

export function getJoyVec() {
  // Return raw smoothed joystick vector in pixels
  // Physics module will handle deadzone and normalization
  return smJoy.clone();
}

export function getJoyActive() {
  return joyActive;
}

export function getJoyCenter() {
  return JOY_CENTER.clone();
}

export function getJoyBaseR() {
  return JOY_BASE_R;
}

export function getJoyKnobR() {
  return JOY_KNOB_R;
}

export function getDarOn() {
  return darOn;
}

export function getDarCenter() {
  return DAR_CENTER.clone();
}

export function getDarR() {
  return DAR_R;
}

export function getBoostCenter() {
  return BOOST_CENTER.clone();
}

export function getBoostR() {
  return BOOST_R;
}

export function getShowBoostButton() {
  return showBoostButton;
}

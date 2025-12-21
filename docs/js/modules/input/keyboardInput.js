/**
 * keyboardInput.js
 * Keyboard input handling for movement and air roll controls
 */

// ============================================================================
// STATE
// ============================================================================

const keyState = new Map(); // Track which keys are currently held down
const keyPrevState = new Map(); // Track previous frame state for edge detection

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onKeyDown(e) {
  keyState.set(e.code, true);
}

function onKeyUp(e) {
  keyState.set(e.code, false);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initKeyboard() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

export function cleanupKeyboard() {
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
}

// ============================================================================
// UPDATE LOOP
// ============================================================================

export function updateKeyboard(chromeShown, ringModePaused, callbacks) {
  // Menu toggle (Escape key)
  if (keyJustPressed('Escape')) {
    if (chromeShown) {
      callbacks?.closeMenu?.();
    } else {
      callbacks?.openMenu?.();
    }
  }

  // Pause (P key) - only in Ring Mode
  if (keyJustPressed('KeyP') && callbacks?.ringModeActive) {
    callbacks?.execBinding?.('pause');
  }

  // Don't process game controls if menu is open or paused
  if (chromeShown || ringModePaused) {
    updatePrevState();
    return;
  }

  // WASD Movement
  const input = {
    pitch: 0,
    yaw: 0
  };

  if (keyHeld('KeyW')) input.pitch += 1;
  if (keyHeld('KeyS')) input.pitch -= 1;
  if (keyHeld('KeyA')) input.yaw += 1;
  if (keyHeld('KeyD')) input.yaw -= 1;

  // Air roll controls (Q = left, E = right, Shift = free)
  // In toggle mode: toggle on keypress
  if (callbacks?.airRollIsToggle) {
    if (keyJustPressed('KeyQ')) callbacks?.execBinding?.('rollLeft');
    if (keyJustPressed('KeyE')) callbacks?.execBinding?.('rollRight');
    if (keyJustPressed('ShiftLeft') || keyJustPressed('ShiftRight')) callbacks?.execBinding?.('rollFree');
  } else {
    // In hold mode: activate while held
    // Note: Deactivation is complex (needs to check if gamepad/DAR also pressing)
    // For now, report which keys are held and let orchestrator handle it
    const airRollKeys = {
      rollLeft: keyHeld('KeyQ'),
      rollRight: keyHeld('KeyE'),
      rollFree: keyHeld('ShiftLeft') || keyHeld('ShiftRight')
    };
    callbacks?.onKeyboardAirRoll?.(airRollKeys);
  }

  // Boost (Space)
  const boostPressed = keyHeld('Space');
  callbacks?.onBoostChange?.(boostPressed);

  // Notify callback with keyboard input
  callbacks?.onKeyboardInput?.(input);

  // Update previous state for next frame
  updatePrevState();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function keyJustPressed(code) {
  return keyState.get(code) && !keyPrevState.get(code);
}

function keyHeld(code) {
  return keyState.get(code) || false;
}

function updatePrevState() {
  keyPrevState.clear();
  keyState.forEach((value, key) => {
    keyPrevState.set(key, value);
  });
}

// ============================================================================
// CLEANUP AND MEMORY MANAGEMENT
// ============================================================================

/**
 * Cleanup keyboard input resources
 * Call this when shutting down the application to prevent memory leaks
 */
export function cleanup() {
  // Remove event listeners
  cleanupKeyboard();

  // Clear key state maps
  keyState.clear();
  keyPrevState.clear();
}

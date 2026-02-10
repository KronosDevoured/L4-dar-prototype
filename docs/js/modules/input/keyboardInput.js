/**
 * keyboardInput.js
 * Keyboard input handling for movement and air roll controls
 */

import { getSetting, saveSettings } from '../settings.js';

// ============================================================================
// DEFAULT BINDINGS & STATE
// ============================================================================

const defaultKbBindings = {
  pitchForward: 'KeyW',
  pitchBackward: 'KeyS',
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  rollLeft: 'KeyQ',
  rollRight: 'KeyE',
  rollFree: 'ShiftLeft',
  boost: 'Space',
  pause: 'KeyP',
  openMenu: 'Escape'
};

let kbBindings = null;

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

export function initKeyboard(savedBindings) {
  // Use saved bindings if available, otherwise use defaults
  if (savedBindings) {
    kbBindings = { ...savedBindings };
  } else {
    kbBindings = { ...defaultKbBindings };
  }

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
  // Menu toggle (configurable binding)
  if (keyJustPressed(kbBindings.openMenu)) {
    if (chromeShown) {
      callbacks?.closeMenu?.();
    } else {
      callbacks?.openMenu?.();
    }
  }

  // Pause - only in Ring Mode (configurable binding)
  if (keyJustPressed(kbBindings.pause) && callbacks?.ringModeActive) {
    callbacks?.execBinding?.('pause');
  }

  // Don't process game controls if menu is open or paused
  if (chromeShown || ringModePaused) {
    updatePrevState();
    return;
  }

  // Movement - uses configurable bindings
  const input = {
    pitch: 0,
    yaw: 0
  };

  if (keyHeld(kbBindings.pitchForward)) input.pitch += 1;
  if (keyHeld(kbBindings.pitchBackward)) input.pitch -= 1;
  if (keyHeld(kbBindings.turnLeft)) input.yaw += 1;
  if (keyHeld(kbBindings.turnRight)) input.yaw -= 1;

  // Air roll controls - uses configurable bindings
  // In toggle mode: toggle on keypress
  if (callbacks?.airRollIsToggle) {
    if (keyJustPressed(kbBindings.rollLeft)) callbacks?.execBinding?.('rollLeft');
    if (keyJustPressed(kbBindings.rollRight)) callbacks?.execBinding?.('rollRight');
    if (keyJustPressed(kbBindings.rollFree)) callbacks?.execBinding?.('rollFree');
  } else {
    // In hold mode: activate while held
    // Note: Deactivation is complex (needs to check if gamepad/DAR also pressing)
    // For now, report which keys are held and let orchestrator handle it
    const airRollKeys = {
      rollLeft: keyHeld(kbBindings.rollLeft),
      rollRight: keyHeld(kbBindings.rollRight),
      rollFree: keyHeld(kbBindings.rollFree)
    };
    callbacks?.onKeyboardAirRoll?.(airRollKeys);
  }

  // Boost (configurable binding)
  const boostPressed = keyHeld(kbBindings.boost);
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
// KEYBOARD BINDINGS MANAGEMENT
// ============================================================================

export function getKbBindings() {
  return { ...kbBindings };
}

export function setKbBindings(newBindings) {
  kbBindings = { ...newBindings };
  saveSettings({ kbBindings });
}

export function setKbBinding(action, keyCode) {
  if (kbBindings) {
    kbBindings[action] = keyCode;
    saveSettings({ kbBindings });
  }
}

export function getDefaultKbBindings() {
  return { ...defaultKbBindings };
}

export function resetKbBindings() {
  kbBindings = { ...defaultKbBindings };
  saveSettings({ kbBindings });
}

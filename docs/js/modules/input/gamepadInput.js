/**
 * gamepadInput.js
 * Gamepad input handling with button remapping and presets
 */

import { saveSettings } from '../settings.js';

// ============================================================================
// STATE
// ============================================================================

let gpEnabled = true;
let gpBindings = null;
let gpIndex = -1;
let gpRemapping = false;
let gpRemapReady = false;
let gpPrevActionPressed = {};

const GP_DEADZONE = 0.15;

// ============================================================================
// DEFAULT BINDINGS & PRESETS
// ============================================================================

const defaultGpBindings = {
  toggleDAR: { kind: 'button', index: 1 },
  rollLeft: { kind: 'button', index: 4 },
  rollRight: { kind: 'button', index: 5 },
  rollFree: { kind: 'button', index: 7 },
  boost: { kind: 'button', index: 0 },
  pause: { kind: 'button', index: 9 },
  restart: { kind: 'button', index: 10 },
  orbitCW: { kind: 'button', index: 2 },
  orbitCCW: { kind: 'button', index: 3 },
  toggleTheme: { kind: 'button', index: 8 },
  openMenu: { kind: 'button', index: 6 }
};

const GP_PRESETS = {
  ps5: {
    toggleDAR: { kind: 'button', index: 0 },
    rollLeft: { kind: 'button', index: 2 },
    rollRight: { kind: 'button', index: 1 },
    rollFree: { kind: 'button', index: 4 },
    boost: { kind: 'button', index: 5 },
    pause: { kind: 'button', index: 12 },
    restart: { kind: 'button', index: 13 },
    orbitCW: { kind: 'button', index: 15 },
    orbitCCW: { kind: 'button', index: 14 },
    toggleTheme: { kind: 'button', index: 8 },
    openMenu: { kind: 'button', index: 9 }
  },
  xinput: defaultGpBindings
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initGamepad(savedBindings) {
  gpBindings = savedBindings || { ...defaultGpBindings };

  window.addEventListener('gamepadconnected', onGamepadConnected);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
}

export function cleanupGamepad() {
  window.removeEventListener('gamepadconnected', onGamepadConnected);
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onGamepadConnected(e) {
  if (gpIndex < 0) {
    gpIndex = e.gamepad.index;
  }
  updateStatus(`Connected: ${e.gamepad.id}`);
}

function onGamepadDisconnected(e) {
  if (e.gamepad.index === gpIndex) {
    gpIndex = -1;
  }
  updateStatus(gpEnabled ? 'Enabled (waiting for gamepad)' : 'No gamepad');
}

function updateStatus(text) {
  const gpStatusTag = document.getElementById('gpStatus');
  if (gpStatusTag) {
    gpStatusTag.textContent = text;
  }
}

// ============================================================================
// GAMEPAD READING
// ============================================================================

function readPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = (gpIndex >= 0 && pads[gpIndex]) ? pads[gpIndex] : null;
  return { pad, pads };
}

function isPressedForBinding(binding, pad) {
  if (!binding || !pad) return false;
  if (binding.kind === 'button') {
    return pad.buttons[binding.index]?.pressed || false;
  } else if (binding.kind === 'axis') {
    const val = pad.axes[binding.index] || 0;
    return binding.direction === '+' ? val > 0.5 : val < -0.5;
  }
  return false;
}

// ============================================================================
// UPDATE LOOP
// ============================================================================

export function updateGamepad(chromeShown, callbacks) {
  if (!gpEnabled) return;

  const { pad } = readPads();
  if (!pad) {
    updateStatus('Enabled (waiting for gamepad)');
    return;
  }
  updateStatus(`Connected: ${pad.id}`);

  // If remapping, handle that separately
  if (gpRemapping) {
    handleRemap(pad);
    return;
  }

  // Menu navigation handled by caller if needed
  if (chromeShown) {
    return; // Let main input handle menu navigation
  }

  // Process gamepad joystick for movement
  const lx = pad.axes[0] || 0;
  const ly = pad.axes[1] || 0;
  const rx = pad.axes[2] || 0;
  const ry = pad.axes[3] || 0;

  // Left stick for movement
  if (Math.abs(lx) > GP_DEADZONE || Math.abs(ly) > GP_DEADZONE) {
    callbacks?.onGamepadStick?.({ x: lx, y: ly });
  }

  // Process button bindings
  Object.keys(gpBindings).forEach(action => {
    const binding = gpBindings[action];
    const pressed = isPressedForBinding(binding, pad);
    const prevPressed = gpPrevActionPressed[action] || false;

    // Edge detection - only trigger on press (not hold)
    if (pressed && !prevPressed) {
      callbacks?.execBinding?.(action);
    }

    gpPrevActionPressed[action] = pressed;
  });

  // Check if any air roll button is pressed
  const rollLeftPressed = isPressedForBinding(gpBindings.rollLeft, pad);
  const rollRightPressed = isPressedForBinding(gpBindings.rollRight, pad);
  const rollFreePressed = isPressedForBinding(gpBindings.rollFree, pad);

  callbacks?.onGamepadAirRoll?.({
    rollLeft: rollLeftPressed,
    rollRight: rollRightPressed,
    rollFree: rollFreePressed
  });

  // Boost button
  const boostPressed = isPressedForBinding(gpBindings.boost, pad);
  callbacks?.onBoostChange?.(boostPressed);
}

// ============================================================================
// PRESET MANAGEMENT
// ============================================================================

export function setBindingPreset(name) {
  if (GP_PRESETS[name]) {
    gpBindings = { ...GP_PRESETS[name] };
    saveSettings({ gpBindings });
    updateBindLabel();
  }
}

// ============================================================================
// REMAPPING
// ============================================================================

function handleRemap(pad) {
  const gpRemapBtn = document.getElementById('gpRemap');
  const gpActionSel = document.getElementById('gpAction');

  if (!gpRemapBtn || !gpActionSel) return;

  const action = gpActionSel.value;
  if (!action) return;

  // Check if all buttons/axes are released (ready state)
  const allButtonsReleased = pad.buttons.every(b => !b.pressed);
  const allAxesNeutral = pad.axes.every(a => Math.abs(a) < 0.3);

  if (!gpRemapReady && allButtonsReleased && allAxesNeutral) {
    gpRemapReady = true;
    gpRemapBtn.textContent = 'Press a button...';
    return;
  }

  if (!gpRemapReady) {
    gpRemapBtn.textContent = 'Release all buttons...';
    return;
  }

  // Check for button press
  for (let i = 0; i < pad.buttons.length; i++) {
    if (pad.buttons[i].pressed) {
      gpBindings[action] = { kind: 'button', index: i };
      saveSettings({ gpBindings });
      gpRemapping = false;
      gpRemapReady = false;
      gpRemapBtn.textContent = 'Remap';
      gpRemapBtn.classList.remove('active');
      updateBindLabel();
      return;
    }
  }

  // Check for axis movement
  for (let i = 0; i < pad.axes.length; i++) {
    const val = pad.axes[i];
    if (Math.abs(val) > 0.7) {
      gpBindings[action] = { kind: 'axis', index: i, direction: val > 0 ? '+' : '-' };
      saveSettings({ gpBindings });
      gpRemapping = false;
      gpRemapReady = false;
      gpRemapBtn.textContent = 'Remap';
      gpRemapBtn.classList.remove('active');
      updateBindLabel();
      return;
    }
  }
}

function updateBindLabel() {
  const gpBindLabel = document.getElementById('gpBindLabel');
  const gpActionSel = document.getElementById('gpAction');

  if (!gpBindLabel || !gpActionSel) return;

  const action = gpActionSel.value;
  if (!action || !gpBindings[action]) {
    gpBindLabel.textContent = '';
    return;
  }

  const binding = gpBindings[action];
  let label = '';
  if (binding.kind === 'button') {
    label = `Button ${binding.index}`;
  } else if (binding.kind === 'axis') {
    label = `Axis ${binding.index} ${binding.direction}`;
  }
  gpBindLabel.textContent = label;
}

// ============================================================================
// UI SETUP
// ============================================================================

export function setupGamepadUI() {
  const gpEnableBtn = document.getElementById('gpEnable');
  const gpPresetSel = document.getElementById('gpPreset');
  const gpActionSel = document.getElementById('gpAction');
  const gpRemapBtn = document.getElementById('gpRemap');

  if (gpEnableBtn) {
    gpEnableBtn.classList.toggle('active', gpEnabled);
    gpEnableBtn.textContent = gpEnabled ? 'Enabled' : 'Disabled';
    gpEnableBtn.addEventListener('click', () => {
      gpEnabled = !gpEnabled;
      gpEnableBtn.classList.toggle('active', gpEnabled);
      gpEnableBtn.textContent = gpEnabled ? 'Enabled' : 'Disabled';
      saveSettings({ gpEnabled });
      updateStatus(gpEnabled ? 'Enabled (waiting for gamepad)' : 'Disabled');
    });
  }

  if (gpPresetSel) {
    gpPresetSel.addEventListener('change', () => {
      setBindingPreset(gpPresetSel.value);
    });
  }

  if (gpActionSel) {
    gpActionSel.addEventListener('change', updateBindLabel);
  }

  if (gpRemapBtn) {
    gpRemapBtn.addEventListener('click', () => {
      gpRemapping = !gpRemapping;
      gpRemapReady = false;
      gpRemapBtn.classList.toggle('active', gpRemapping);
      gpRemapBtn.textContent = gpRemapping ? 'Waiting...' : 'Remap';
      if (!gpRemapping) {
        updateBindLabel();
      }
    });
  }

  updateBindLabel();
}

// ============================================================================
// GETTERS
// ============================================================================

export function getGpEnabled() {
  return gpEnabled;
}

export function getGpBindings() {
  return { ...gpBindings };
}

export function isGamepadPressingAirRoll() {
  if (!gpEnabled) return false;
  const { pad } = readPads();
  if (!pad) return false;

  return isPressedForBinding(gpBindings.rollLeft, pad) ||
         isPressedForBinding(gpBindings.rollRight, pad) ||
         isPressedForBinding(gpBindings.rollFree, pad);
}

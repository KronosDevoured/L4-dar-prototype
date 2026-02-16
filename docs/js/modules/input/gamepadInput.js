/**
 * gamepadInput.js
 * Gamepad input handling with button remapping and presets
 */

import { saveSettings, getSetting } from '../settings.js';

// ============================================================================
// STATE
// ============================================================================

let gpEnabled = true;
let gpBindings = null;
let gpIndex = -1;
let gpRemapping = false;
let gpRemapReady = false;
let gpPrevActionPressed = {};

// Get deadzone from settings - per stick
function getLeftStickDeadzone() {
  return getSetting('gpLeftStickDeadzone') ?? 0.15;
}

function getRightStickDeadzone() {
  return getSetting('gpRightStickDeadzone') ?? 0.15;
}

// Get sensitivity from settings - per stick
function getLeftStickSensitivity() {
  return getSetting('gpLeftStickSensitivity') ?? 1.0;
}

function getRightStickSensitivity() {
  return getSetting('gpRightStickSensitivity') ?? 1.0;
}

// ============================================================================
// DEFAULT BINDINGS & PRESETS
// ============================================================================

const defaultGpBindings = {
  toggleDAR: { kind: 'button', index: 1 },
  rollLeft: { kind: 'button', index: 5 },
  rollRight: { kind: 'button', index: 4 },
  rollFree: { kind: 'button', index: 7 },
  boost: { kind: 'button', index: 0 },
  pause: { kind: 'button', index: 9 },
  restart: { kind: 'button', index: 10 },
  retry: { kind: 'button', index: 11 },
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
    retry: { kind: 'button', index: 14 },
    orbitCW: { kind: 'button', index: 15 },
    orbitCCW: { kind: 'button', index: 14 },
    toggleTheme: { kind: 'button', index: 8 },
    openMenu: { kind: 'button', index: 9 }
  },
  xinput: defaultGpBindings
};

function ensureBindings() {
  if (!gpBindings) {
    gpBindings = { ...defaultGpBindings };
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initGamepad(savedBindings, savedEnabled, savedPreset) {
  // Use saved bindings if available, otherwise use preset, otherwise use defaults
  if (savedBindings) {
    gpBindings = { ...savedBindings };
  } else if (savedPreset && GP_PRESETS[savedPreset]) {
    gpBindings = { ...GP_PRESETS[savedPreset] };
  } else {
    gpBindings = { ...defaultGpBindings };
  }

  if (savedEnabled !== undefined) {
    gpEnabled = savedEnabled;
  }

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

    // Reset remapping state if gamepad disconnects during remap
    if (gpRemapping) {
      gpRemapping = false;
      gpRemapReady = false;
      console.warn('Gamepad disconnected during remapping - reset to normal mode');
    }
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

function getAnalogValueForBinding(binding, pad) {
  if (!binding || !pad) return 0;
  
  if (binding.kind === 'button') {
    // For buttons (including triggers), return the analog value (0.0 to 1.0)
    return pad.buttons[binding.index]?.value || 0;
  } else if (binding.kind === 'axis') {
    // Determine which stick based on axis index and use appropriate deadzone
    // Axes: 0,1 = left stick, 2,3 = right stick
    const deadzone = (binding.index <= 1) ? getLeftStickDeadzone() : getRightStickDeadzone();
    
    // For axes, return scaled value based on direction
    const val = pad.axes[binding.index] || 0;
    
    // Apply deadzone first
    if (Math.abs(val) < deadzone) return 0;
    
    // Return scaled value (0.0 to 1.0) based on direction
    if (binding.direction === '+' && val > 0) {
      // Positive direction: scale from deadzone to 1.0
      return (val - deadzone) / (1.0 - deadzone);
    } else if (binding.direction === '-' && val < 0) {
      // Negative direction: scale from deadzone to 1.0
      return (Math.abs(val) - deadzone) / (1.0 - deadzone);
    }
    return 0;
  }
  return 0;
}

// ============================================================================
// UPDATE LOOP
// ============================================================================

export function updateGamepad(chromeShown, callbacks) {
  if (!gpEnabled) {
    return;
  }

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

  // Get deadzones and sensitivities per stick
  const leftDeadzone = getLeftStickDeadzone();
  const rightDeadzone = getRightStickDeadzone();
  const leftSensitivity = getLeftStickSensitivity();
  const rightSensitivity = getRightStickSensitivity();

  // Left stick for movement - apply deadzone and sensitivity before sending
  const leftStickMag = Math.sqrt(lx * lx + ly * ly);
  let stickX = 0, stickY = 0;
  if (leftStickMag > leftDeadzone) {
    // Pass through raw magnitude above deadzone, apply sensitivity
    const withSensitivity = Math.min(1, leftStickMag * leftSensitivity);
    const scale = withSensitivity / leftStickMag;
    stickX = lx * scale;
    stickY = ly * scale;
  }
  callbacks?.onGamepadStick?.({ x: stickX, y: stickY });

  // List of valid actions that are in the Controls menu
  const validActions = ['pitchForward', 'pitchBackward', 'turnLeft', 'turnRight', 
                        'rollLeft', 'rollRight', 'rollFree', 'toggleDAR',
                        'boost', 'pause', 'openMenu',
                        'restart', 'retry', 'orbitCW', 'orbitCCW', 'toggleTheme'];

  // Process only valid button bindings (ignore legacy bindings like toggleTheme, restart, etc.)
  validActions.forEach(action => {
    const binding = gpBindings[action];
    if (!binding) return; // Skip if no binding for this action
    
    const pressed = isPressedForBinding(binding, pad);
    const prevPressed = gpPrevActionPressed[action] || false;

    // Edge detection - trigger on press
    if (pressed && !prevPressed) {
      callbacks?.execBinding?.(action);
    }

    gpPrevActionPressed[action] = pressed;
  });

  // ToggleDAR button - send current state for hold mode tracking
  // IMPORTANT: This must run BEFORE air roll handler so toggleDARActive is updated first
  const toggleDARPressed = isPressedForBinding(gpBindings.toggleDAR, pad);
  callbacks?.onToggleDARState?.(toggleDARPressed);

  // === DUAL STICK MODE: Check right stick FIRST and give it absolute priority ===
  const isDualStickMode = getSetting('dualStickMode');
  const rightStickAssignment = getSetting('rightStickAssignment');
  
  // Check if right stick is active (using right stick deadzone)
  const rightStickMag = Math.sqrt(rx * rx + ry * ry);
  const rightStickActive = isDualStickMode && rightStickAssignment !== 'none' && rightStickMag > rightDeadzone;

  // Send right stick position with deadzone and sensitivity applied, or zeros if below deadzone
  if (rightStickActive) {
    // Pass through raw magnitude above deadzone, apply sensitivity
    const withSensitivity = Math.min(1, rightStickMag * rightSensitivity);
    const scale = withSensitivity / rightStickMag;
    callbacks?.onRightStick?.({ x: rx * scale, y: ry * scale });
  } else {
    callbacks?.onRightStick?.({ x: 0, y: 0 });
  }

  // Determine air roll state
  let rollLeft = false;
  let rollRight = false;
  let rollFree = false;
  let rollLeftIntensity = 0;
  let rollRightIntensity = 0;
  let rollFreeIntensity = 0;

  if (rightStickActive) {
    // RIGHT STICK HAS ABSOLUTE PRIORITY - use only its assignment
    // Right stick always has full intensity (1.0) when active
    if (rightStickAssignment === 'rollFree') {
      rollFree = true;
      rollFreeIntensity = 1.0;
    } else if (rightStickAssignment === 'rollLeft') {
      rollLeft = true;
      rollLeftIntensity = 1.0;
    } else if (rightStickAssignment === 'rollRight') {
      rollRight = true;
      rollRightIntensity = 1.0;
    }
  } else {
    // Right stick not active - check button/axis presses and get analog values
    // For axis bindings, getAnalogValueForBinding returns 0 if not pressed in the bound direction
    rollLeftIntensity = getAnalogValueForBinding(gpBindings.rollLeft, pad);
    rollRightIntensity = getAnalogValueForBinding(gpBindings.rollRight, pad);
    rollFreeIntensity = getAnalogValueForBinding(gpBindings.rollFree, pad);
    
    // Determine pressed state based on intensity (handles both buttons and axes)
    rollLeft = rollLeftIntensity > 0;
    rollRight = rollRightIntensity > 0;
    rollFree = rollFreeIntensity > 0;
  }

  callbacks?.onGamepadAirRoll?.({
    rollLeft: rollLeft,
    rollRight: rollRight,
    rollFree: rollFree,
    rollLeftIntensity: rollLeftIntensity,
    rollRightIntensity: rollRightIntensity,
    rollFreeIntensity: rollFreeIntensity,
    rightStickActive: rightStickActive
  });

  // Boost button
  const boostPressed = isPressedForBinding(gpBindings.boost, pad);
  callbacks?.onBoostChange?.(boostPressed);
}

/**
 * Update gamepad menu navigation
 * Called from input.js when chromeShown && menuFocusableElements.length > 0
 */
export function updateGamepadMenuNavigation(callbacks) {
  if (!gpEnabled) {
    return;
  }

  const { pad } = readPads();
  if (!pad) {
    return;
  }

  // If remapping, don't handle menu navigation
  if (gpRemapping) {
    return;
  }

  const currentTime = Date.now();

  // D-pad and left stick navigation
  const dpadUp = pad.buttons[12]?.pressed || false;
  const dpadDown = pad.buttons[13]?.pressed || false;
  const dpadLeft = pad.buttons[14]?.pressed || false;
  const dpadRight = pad.buttons[15]?.pressed || false;

  const lx = pad.axes[0] || 0;
  const ly = pad.axes[1] || 0;
  const stickUp = ly < -0.5;
  const stickDown = ly > 0.5;
  const stickLeft = lx < -0.5;
  const stickRight = lx > 0.5;

  // Track previous stick state for edge detection
  const prevStickUp = !!gpPrevActionPressed['stick_up'];
  const prevStickDown = !!gpPrevActionPressed['stick_down'];
  const prevStickLeft = !!gpPrevActionPressed['stick_left'];
  const prevStickRight = !!gpPrevActionPressed['stick_right'];

  // Track d-pad previous state
  const prevDpadUp = !!gpPrevActionPressed['dpad_up'];
  const prevDpadDown = !!gpPrevActionPressed['dpad_down'];
  const prevDpadLeft = !!gpPrevActionPressed['dpad_left'];
  const prevDpadRight = !!gpPrevActionPressed['dpad_right'];

  // Handle directional navigation with edge detection
  if ((dpadUp && !prevDpadUp) || (stickUp && !prevStickUp)) {
    callbacks?.onMenuNavigate?.('up', currentTime);
  } else if ((dpadDown && !prevDpadDown) || (stickDown && !prevStickDown)) {
    callbacks?.onMenuNavigate?.('down', currentTime);
  } else if ((dpadLeft && !prevDpadLeft) || (stickLeft && !prevStickLeft)) {
    callbacks?.onMenuNavigate?.('left', currentTime);
  } else if ((dpadRight && !prevDpadRight) || (stickRight && !prevStickRight)) {
    callbacks?.onMenuNavigate?.('right', currentTime);
  }

  // Update previous states
  gpPrevActionPressed['stick_up'] = stickUp;
  gpPrevActionPressed['stick_down'] = stickDown;
  gpPrevActionPressed['stick_left'] = stickLeft;
  gpPrevActionPressed['stick_right'] = stickRight;
  gpPrevActionPressed['dpad_up'] = dpadUp;
  gpPrevActionPressed['dpad_down'] = dpadDown;
  gpPrevActionPressed['dpad_left'] = dpadLeft;
  gpPrevActionPressed['dpad_right'] = dpadRight;

  // X button (Cross) to activate/select (button 0)
  const xPressed = pad.buttons[0]?.pressed || false;
  const xWasPressed = !!gpPrevActionPressed['menu_x'];
  if (xPressed && !xWasPressed) {
    callbacks?.onMenuActivate?.();
  }
  gpPrevActionPressed['menu_x'] = xPressed;

  // Circle button to close menu (button 1)
  const circlePressed = pad.buttons[1]?.pressed || false;
  const circleWasPressed = !!gpPrevActionPressed['menu_circle'];
  if (circlePressed && !circleWasPressed) {
    callbacks?.onMenuClose?.();
  }
  gpPrevActionPressed['menu_circle'] = circlePressed;

  // Check for openMenu binding to allow closing menu with it
  if (gpBindings.openMenu) {
    const openMenuPressed = isPressedForBinding(gpBindings.openMenu, pad);
    const openMenuWasPressed = !!gpPrevActionPressed['openMenu'];
    if (openMenuPressed && !openMenuWasPressed) {
      callbacks?.onMenuClose?.();
    }
    gpPrevActionPressed['openMenu'] = openMenuPressed;
  }
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
    // Preset is now read-only - users customize bindings via Controls menu instead
    gpPresetSel.disabled = true;
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
  ensureBindings();
  return { ...gpBindings };
}

export function getGamepadDeadzone() {
  // Return average of left and right stick deadzones
  return (getLeftStickDeadzone() + getRightStickDeadzone()) / 2;
}

export function setGpBinding(action, binding) {
  ensureBindings();
  if (gpBindings) {
    gpBindings[action] = binding;
    saveSettings({ gpBindings });
  }
}

export function resetBindingsToDefaults() {
  gpBindings = { ...defaultGpBindings };
  saveSettings({ gpBindings });
}

export function isGamepadPressingAirRoll() {
  if (!gpEnabled) return false;
  const { pad } = readPads();
  if (!pad) return false;

  return isPressedForBinding(gpBindings.rollLeft, pad) ||
         isPressedForBinding(gpBindings.rollRight, pad) ||
         isPressedForBinding(gpBindings.rollFree, pad);
}

// ============================================================================
// CLEANUP AND MEMORY MANAGEMENT
// ============================================================================

/**
 * Cleanup gamepad input resources
 * Call this when shutting down the application to prevent memory leaks
 */
export function cleanup() {
  // Reset all state
  gpEnabled = true;
  gpBindings = null;
  gpIndex = -1;
  gpRemapping = false;
  gpRemapReady = false;
  gpPrevActionPressed = {};
}

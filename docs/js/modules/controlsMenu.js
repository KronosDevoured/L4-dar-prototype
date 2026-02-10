/**
 * controlsMenu.js
 * Manages the controls rebinding UI and logic
 * Displays keyboard and gamepad bindings side-by-side
 */

import * as KeyboardInput from './input/keyboardInput.js';
import * as GamepadInput from './input/gamepadInput.js';
import * as ButtonMapper from './input/buttonMapper.js';
import { saveSettings, getSetting } from './settings.js';

// ============================================================================
// STATE
// ============================================================================

let remappingAction = null;
let remappingDevice = null; // 'keyboard' or 'gamepad'
let currentGamepadId = null;

// ============================================================================
// ACTION METADATA
// ============================================================================

const ACTION_CATEGORIES_KB = {
  movement: {
    label: 'Movement',
    actions: ['pitchForward', 'pitchBackward', 'turnLeft', 'turnRight']
  },
  airControl: {
    label: 'Air Control',
    actions: ['rollLeft', 'rollRight', 'rollFree']
  },
  actions: {
    label: 'Actions',
    actions: ['boost', 'pause', 'openMenu']
  }
};

const ACTION_CATEGORIES_GP = {
  movement: {
    label: 'Movement',
    actions: ['pitchForward', 'pitchBackward', 'turnLeft', 'turnRight']
  },
  airControl: {
    label: 'Air Control',
    actions: ['rollLeft', 'rollRight', 'rollFree', 'toggleDAR']
  },
  actions: {
    label: 'Actions',
    actions: ['boost', 'pause', 'openMenu']
  },
  ringMode: {
    label: 'Ring Mode',
    actions: ['restart', 'retry']
  },
  camera: {
    label: 'Camera',
    actions: ['orbitCW', 'orbitCCW']
  },
  ui: {
    label: 'UI',
    actions: ['toggleTheme']
  }
};

const RIGHT_STICK_OPTIONS = {
  none: 'Disabled',
  rollFree: 'Air Roll (Free)',
  rollLeft: 'Air Roll Left',
  rollRight: 'Air Roll Right'
};

const ACTION_LABELS = {
  pitchForward: 'Pitch Forward',
  pitchBackward: 'Pitch Backward',
  turnLeft: 'Turn Left',
  turnRight: 'Turn Right',
  rollLeft: 'Roll Left',
  rollRight: 'Roll Right',
  rollFree: 'Roll Free',
  toggleDAR: 'Toggle DAR',
  boost: 'Boost',
  pause: 'Pause',
  openMenu: 'Open Menu',
  restart: 'Restart',
  retry: 'Retry',
  orbitCW: 'Orbit Clockwise',
  orbitCCW: 'Orbit Counter-Clockwise',
  toggleTheme: 'Toggle Day/Night Mode'
};

// ============================================================================
// UI INITIALIZATION
// ============================================================================

export function initControlsMenu() {
  const modal = document.getElementById('controlsModal');
  if (!modal) return;

  // Initialize currentGamepadId if gamepad is connected
  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      currentGamepadId = gamepads[i].id;
      break;
    }
  }

  // Setup tab system
  const kbTab = document.getElementById('controlsKBTab');
  const gpTab = document.getElementById('controlsGPTab');
  const kbContent = document.getElementById('controlsKBContent');
  const gpContent = document.getElementById('controlsGPContent');

  if (kbTab && gpTab && kbContent && gpContent) {
    kbTab.addEventListener('click', () => {
      kbTab.classList.add('active');
      gpTab.classList.remove('active');
      kbContent.style.display = 'block';
      gpContent.style.display = 'none';
    });

    gpTab.addEventListener('click', () => {
      gpTab.classList.add('active');
      kbTab.classList.remove('active');
      gpContent.style.display = 'block';
      kbContent.style.display = 'none';
      
      // Refresh gamepad ID when tab is clicked
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          currentGamepadId = gamepads[i].id;
          break;
        }
      }
    });

    // Default to keyboard tab
    kbTab.click();
  }

  // Build controls UI (both keyboard and gamepad)
  buildControlsList('both');

  // Setup close button
  const closeBtn = document.getElementById('controlsCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeControlsMenu);
  }

  // Setup reset buttons
  const resetKBBtn = document.getElementById('resetKBBindings');
  if (resetKBBtn) {
    resetKBBtn.addEventListener('click', () => {
      if (confirm('Reset keyboard bindings to defaults?')) {
        KeyboardInput.resetKbBindings();
        buildControlsList('keyboard');
      }
    });
  }

  const resetGPBtn = document.getElementById('resetGPBindings');
  if (resetGPBtn) {
    resetGPBtn.addEventListener('click', () => {
      if (confirm('Reset gamepad bindings to defaults?')) {
        GamepadInput.resetBindingsToDefaults();
        buildControlsList('gamepad');
      }
    });
  }
}

// ============================================================================
// CONTROLS LIST BUILDING
// ============================================================================

function buildControlsList(device) {
  const kbContent = document.getElementById('controlsKBContent');
  const gpContent = document.getElementById('controlsGPContent');
  if (!kbContent || !gpContent) return;

  // Clear existing content
  kbContent.innerHTML = '';
  gpContent.innerHTML = '';

  // Build keyboard side
  buildDeviceControls('keyboard', kbContent);
  
  // Build gamepad side
  buildDeviceControls('gamepad', gpContent);
}

function buildDeviceControls(device, container) {
  // Use appropriate categories based on device
  const categories = device === 'keyboard' ? ACTION_CATEGORIES_KB : ACTION_CATEGORIES_GP;

  // Add categories and controls
  for (const [categoryKey, category] of Object.entries(categories)) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'controls-category';

    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'controls-category-label';
    categoryLabel.textContent = category.label;
    categoryDiv.appendChild(categoryLabel);

    for (const action of category.actions) {
      const row = document.createElement('div');
      row.className = 'controls-row';

      // Action label
      const actionLabel = document.createElement('div');
      actionLabel.className = 'controls-action-label';
      actionLabel.textContent = ACTION_LABELS[action] || action;
      row.appendChild(actionLabel);

      // Binding cell
      const bindingCell = document.createElement('div');
      bindingCell.className = 'controls-binding-cell';
      bindingCell.id = `binding-${device}-${action}`;

      const bindingLabel = document.createElement('span');
      bindingLabel.className = 'binding-label';
      bindingCell.appendChild(bindingLabel);

      const remapBtn = document.createElement('button');
      remapBtn.className = 'controls-remap-btn';
      remapBtn.textContent = 'Remap';
      remapBtn.addEventListener('click', () => startRemapping(action, device));
      bindingCell.appendChild(remapBtn);

      row.appendChild(bindingCell);
      categoryDiv.appendChild(row);
    }

    container.appendChild(categoryDiv);
  }

  // Add right stick assignment section for gamepad if dual stick mode enabled
  if (device === 'gamepad' && getSetting('dualStickMode')) {
    const dualStickDiv = document.createElement('div');
    dualStickDiv.className = 'controls-category';

    const dualStickLabel = document.createElement('div');
    dualStickLabel.className = 'controls-category-label';
    dualStickLabel.textContent = 'Right Stick Assignment';
    dualStickDiv.appendChild(dualStickLabel);

    const row = document.createElement('div');
    row.className = 'controls-row';

    const label = document.createElement('div');
    label.className = 'controls-action-label';
    label.textContent = 'Right Stick';
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'right-stick-select';
    select.id = 'rightStickSelect';

    for (const [value, text] of Object.entries(RIGHT_STICK_OPTIONS)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    }

    select.value = getSetting('rightStickAssignment') || 'none';
    select.addEventListener('change', (e) => {
      saveSettings({ rightStickAssignment: e.target.value });
    });

    row.appendChild(select);
    dualStickDiv.appendChild(row);
    container.appendChild(dualStickDiv);
  }

  // Update all binding displays
  for (const [categoryKey, category] of Object.entries(categories)) {
    for (const action of category.actions) {
      updateBindingDisplay(action, device, document.getElementById(`binding-${device}-${action}`));
    }
  }
}

// ============================================================================
// BINDING DISPLAY
// ============================================================================

function updateBindingDisplay(action, device, element) {
  if (!element) return;

  const bindingLabel = element.querySelector('.binding-label');
  if (!bindingLabel) return;

  let displayText = '—';

  if (device === 'keyboard') {
    const kbBindings = KeyboardInput.getKbBindings();
    const keyCode = kbBindings[action];
    if (keyCode) {
      displayText = getKeyName(keyCode);
    }
  } else if (device === 'gamepad') {
    const gpBindings = GamepadInput.getGpBindings();
    const binding = gpBindings[action];
    if (binding) {
      // Handle object format {kind: 'button', index: X}
      if (typeof binding === 'object' && binding.kind === 'button') {
        displayText = ButtonMapper.getButtonName(binding.index, 'xbox');
      } else if (typeof binding === 'object' && binding.kind === 'axis') {
        displayText = ButtonMapper.getAxisLabel(binding.index, 'xbox');
      } else if (typeof binding === 'string') {
        // Handle string format from ButtonMapper
        displayText = ButtonMapper.getButtonLabel(binding, 'xbox');
      }
    }
  }

  bindingLabel.textContent = displayText;
}

// ============================================================================
// KEYBOARD KEY NAMES
// ============================================================================

function getKeyName(keyCode) {
  const keyNames = {
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    KeyQ: 'Q',
    KeyE: 'E',
    KeyZ: 'Z',
    KeyX: 'X',
    KeyC: 'C',
    KeyV: 'V',
    KeyB: 'B',
    KeyN: 'N',
    KeyM: 'M',
    KeyP: 'P',
    KeyI: 'I',
    KeyK: 'K',
    KeyL: 'L',
    KeyJ: 'J',
    KeyO: 'O',
    KeyU: 'U',
    KeyY: 'Y',
    KeyT: 'T',
    KeyR: 'R',
    KeyF: 'F',
    KeyG: 'G',
    KeyH: 'H',
    Digit0: '0',
    Digit1: '1',
    Digit2: '2',
    Digit3: '3',
    Digit4: '4',
    Digit5: '5',
    Digit6: '6',
    Digit7: '7',
    Digit8: '8',
    Digit9: '9',
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backquote: '`',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PgUp',
    PageDown: 'PgDn'
  };

  return keyNames[keyCode] || keyCode;
}

// ============================================================================
// REMAPPING LOGIC
// ============================================================================

function startRemapping(action, device) {
  if (remappingAction !== null) return; // Already remapping

  remappingAction = action;
  remappingDevice = device;

  const cell = document.getElementById(`binding-${device}-${action}`);
  if (cell) {
    cell.classList.add('remapping');
  }

  const bindingLabel = cell?.querySelector('.binding-label');
  if (bindingLabel) {
    bindingLabel.textContent = device === 'keyboard' ? 'Press a key...' : 'Press a button...';
  }

  if (device === 'keyboard') {
    // Listen for keyboard input
    document.addEventListener('keydown', handleRemapKeyDown, true);
  } else if (device === 'gamepad') {
    // Listen for gamepad input
    startGamepadRemappingListener();
  }
}

function handleRemapKeyDown(e) {
  if (!remappingAction || remappingDevice !== 'keyboard') return;

  e.preventDefault();
  e.stopPropagation();

  const keyCode = e.code;

  // Remove the listener immediately
  document.removeEventListener('keydown', handleRemapKeyDown, true);

  // Set the new binding
  KeyboardInput.setKbBinding(remappingAction, keyCode);

  // Update display
  const cell = document.getElementById(`binding-${remappingDevice}-${remappingAction}`);
  if (cell) {
    cell.classList.remove('remapping');
    updateBindingDisplay(remappingAction, remappingDevice, cell);
  }

  // Clear state
  remappingAction = null;
  remappingDevice = null;
}

function startGamepadRemappingListener() {
  let lastButtonPressed = null;
  let lastAxisValue = 0;
  const pollInterval = 50; // ms

  const listener = () => {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      if (!gamepads[i]) continue;

      const gamepad = gamepads[i];
      currentGamepadId = i;

      // Check buttons
      for (let j = 0; j < gamepad.buttons.length; j++) {
        if (gamepad.buttons[j].pressed && lastButtonPressed !== j) {
          lastButtonPressed = j;
          completeGamepadRemapping(j.toString());
          return;
        }
      }

      // Check axes
      for (let j = 0; j < gamepad.axes.length; j++) {
        const value = gamepad.axes[j];
        if (Math.abs(value) > 0.5 && Math.abs(lastAxisValue) <= 0.5) {
          lastAxisValue = value;
          completeGamepadRemapping(`axis:${j}`);
          return;
        }
        if (Math.abs(value) <= 0.5) {
          lastAxisValue = 0;
        }
      }
    }

    if (remappingAction) {
      requestAnimationFrame(listener);
    }
  };

  listener();
}

function completeGamepadRemapping(binding) {
  if (!remappingAction) return;

  // Convert string binding to proper format
  let formattedBinding;
  if (typeof binding === 'string') {
    if (binding.startsWith('axis:')) {
      const axisIndex = parseInt(binding.substring(5));
      formattedBinding = { kind: 'axis', index: axisIndex, direction: '+' };
    } else {
      const buttonIndex = parseInt(binding);
      formattedBinding = { kind: 'button', index: buttonIndex };
    }
  } else {
    formattedBinding = binding;
  }

  // Set the new binding (saves to localStorage and updates memory)
  GamepadInput.setGpBinding(remappingAction, formattedBinding);

  // Update display
  const cell = document.getElementById(`binding-${remappingDevice}-${remappingAction}`);
  if (cell) {
    cell.classList.remove('remapping');
    updateBindingDisplay(remappingAction, remappingDevice, cell);
  }

  // Clear state
  remappingAction = null;
  remappingDevice = null;
}

// ============================================================================
// MENU CONTROL
// ============================================================================

export function openControlsMenu() {
  const modal = document.getElementById('controlsModal');
  if (modal) {
    modal.style.display = 'block';
    buildControlsList('keyboard');
    buildControlsList('gamepad');
  }
}

export function closeControlsMenu() {
  const modal = document.getElementById('controlsModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Clean up any active remapping and listeners
  if (remappingAction) {
    if (remappingDevice === 'keyboard') {
      document.removeEventListener('keydown', handleRemapKeyDown, true);
    }
    remappingAction = null;
    remappingDevice = null;
  }
}

export function isRemapping() {
  return remappingAction !== null;
}

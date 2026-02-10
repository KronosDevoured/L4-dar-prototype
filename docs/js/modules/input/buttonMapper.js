/**
 * buttonMapper.js
 * Maps gamepad button indices to human-readable names
 * Supports Xbox, PS5, PS4, and generic controllers
 */

// ============================================================================
// CONTROLLER TYPE DETECTION
// ============================================================================

export function getControllerType(gamepadId) {
  const gamepad = navigator.getGamepads()[gamepadId];
  if (!gamepad) return 'generic';

  const id = gamepad.id.toLowerCase();

  if (id.includes('dualshock') || id.includes('dualsense')) {
    if (id.includes('dualsense') || id.includes('ps5')) {
      return 'ps5';
    }
    return 'ps4';
  }

  if (id.includes('xbox') || id.includes('xinput')) {
    return 'xbox';
  }

  return 'generic';
}

// ============================================================================
// BUTTON MAPPINGS
// ============================================================================

const XBOX_BUTTONS = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'RB',
  5: 'LB',
  6: 'LT',
  7: 'RT',
  8: 'Share',
  9: 'Start',
  10: 'LS Click',
  11: 'RS Click',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right'
};

const PS5_BUTTONS = {
  0: 'Cross',
  1: 'Circle',
  2: 'Square',
  3: 'Triangle',
  4: 'L1',
  5: 'R1',
  6: 'L2',
  7: 'R2',
  8: 'Share',
  9: 'Options',
  10: 'L3',
  11: 'R3',
  12: 'Touchpad'
};

const PS4_BUTTONS = {
  0: 'Cross',
  1: 'Circle',
  2: 'Square',
  3: 'Triangle',
  4: 'L1',
  5: 'R1',
  6: 'L2',
  7: 'R2',
  8: 'Share',
  9: 'Options',
  10: 'L3',
  11: 'R3'
};

const XBOX_AXES = {
  0: 'Left Stick X',
  1: 'Left Stick Y',
  2: 'Right Stick X',
  3: 'Right Stick Y',
  4: 'LT',
  5: 'RT'
};

const PS_AXES = {
  0: 'Left Stick X',
  1: 'Left Stick Y',
  2: 'Right Stick X',
  3: 'Right Stick Y',
  4: 'L2',
  5: 'R2'
};

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

export function getButtonLabel(binding, gamepadId) {
  if (!binding) return '—';

  // Handle axis bindings (format: axis:0, axis:1, etc.)
  if (binding.startsWith('axis:')) {
    const axisIndex = parseInt(binding.substring(5));
    return getAxisLabel(axisIndex, gamepadId);
  }

  // Handle button bindings
  const buttonIndex = parseInt(binding);
  if (!isNaN(buttonIndex)) {
    const controllerType = getControllerType(gamepadId);
    return getButtonName(buttonIndex, controllerType);
  }

  return '—';
}

export function getAxisLabel(axisIndex, gamepadId) {
  const controllerType = getControllerType(gamepadId);
  const axes = controllerType === 'xbox' ? XBOX_AXES : PS_AXES;
  return axes[axisIndex] || `Axis ${axisIndex}`;
}

export function getButtonName(buttonIndex, controllerType = 'generic') {
  if (controllerType === 'xbox') {
    return XBOX_BUTTONS[buttonIndex] || `Button ${buttonIndex}`;
  } else if (controllerType === 'ps5') {
    return PS5_BUTTONS[buttonIndex] || `Button ${buttonIndex}`;
  } else if (controllerType === 'ps4') {
    return PS4_BUTTONS[buttonIndex] || `Button ${buttonIndex}`;
  }
  return `Button ${buttonIndex}`;
}

export function getButtonNames(controllerType) {
  if (controllerType === 'xbox') {
    return XBOX_BUTTONS;
  } else if (controllerType === 'ps5') {
    return PS5_BUTTONS;
  } else if (controllerType === 'ps4') {
    return PS4_BUTTONS;
  }
  return {};
}

export function getAxisNames(controllerType) {
  if (controllerType === 'xbox') {
    return XBOX_AXES;
  }
  return PS_AXES;
}

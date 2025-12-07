/**
 * input.js - Input Handling Module Orchestrator
 *
 * Coordinates all input sources: touch, gamepad, and keyboard
 * Manages joystick, DAR button, boost button, and air roll controls
 */

import * as THREE from 'three';
import { saveSettings } from './settings.js';
import * as TouchInput from './input/touchInput.js';
import * as KeyboardInput from './input/keyboardInput.js';
import * as GamepadInput from './input/gamepadInput.js';
import * as AirRollController from './input/airRollController.js';

/* ===========================
 * DEVICE DETECTION
 * =========================== */

// Detect if on mobile/tablet or desktop
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
const isDesktop = !isMobile;

/* ===========================
 * MENU STATE
 * =========================== */

// Menu state (controlled externally but needed for input blocking)
let chromeShown = false;

// Menu navigation
let menuFocusIndex = 0;
let menuFocusableElements = [];
let menuNavigationCooldown = 0;
const MENU_NAV_COOLDOWN = 200; // ms between navigation inputs

function updateMenuFocusableElements() {
  // Get all interactive elements in the menu, including card headers
  menuFocusableElements = Array.from(document.querySelectorAll(
    '#menuPanel .card h3, #menuPanel button, #menuPanel input[type="range"], #menuPanel select'
  )).filter(el => {
    // Only include visible elements
    // For elements inside collapsed cards, check if parent card is collapsed
    const card = el.closest('.card');
    if (card && card.classList.contains('collapsed') && el.tagName !== 'H3') {
      return false; // Don't include elements in collapsed cards
    }
    return el.offsetParent !== null;
  });
}

function findClosestElementInDirection(direction) {
  if (menuFocusableElements.length === 0) return menuFocusIndex;

  const currentEl = menuFocusableElements[menuFocusIndex];
  const isHeader = currentEl.tagName === 'H3';

  // UP/DOWN behavior depends on what's focused
  if (direction === 'down' || direction === 'up') {
    const step = direction === 'down' ? 1 : -1;
    const currentCard = currentEl.closest('.card');

    // If on a card header (H3), jump to next/previous card header
    if (isHeader) {
      for (let i = 1; i < menuFocusableElements.length; i++) {
        const checkIndex = (menuFocusIndex + (i * step) + menuFocusableElements.length) % menuFocusableElements.length;
        const checkEl = menuFocusableElements[checkIndex];

        if (checkEl.tagName === 'H3') {
          return checkIndex;
        }
      }
    } else {
      // If on a control (slider/button), navigate within the card
      for (let i = 1; i < menuFocusableElements.length; i++) {
        const checkIndex = (menuFocusIndex + (i * step) + menuFocusableElements.length) % menuFocusableElements.length;
        const checkEl = menuFocusableElements[checkIndex];
        const checkCard = checkEl.closest('.card');

        // Stay within the same card
        if (checkCard === currentCard) {
          return checkIndex;
        }

        // If we've left the card, wrap to the card header
        const headerIndex = menuFocusableElements.findIndex(el =>
          el.tagName === 'H3' && el.closest('.card') === currentCard
        );
        if (headerIndex !== -1) return headerIndex;
      }
    }

    // Fallback
    return (menuFocusIndex + step + menuFocusableElements.length) % menuFocusableElements.length;
  }

  // LEFT/RIGHT: Navigate within current card (sequential)
  if (direction === 'left' || direction === 'right') {
    const step = direction === 'right' ? 1 : -1;
    const currentCard = currentEl.closest('.card');

    // Try to find next/previous element in same card
    for (let i = 1; i < menuFocusableElements.length; i++) {
      const checkIndex = (menuFocusIndex + (i * step) + menuFocusableElements.length) % menuFocusableElements.length;
      const checkEl = menuFocusableElements[checkIndex];
      const checkCard = checkEl.closest('.card');

      // If still in same card, return this element
      if (checkCard === currentCard) {
        return checkIndex;
      }

      // If we've left the card, wrap back to start/end of current card
      if (direction === 'right') {
        // Wrap to first element in card
        return menuFocusableElements.findIndex(el => el.closest('.card') === currentCard);
      } else {
        // Wrap to last element in card
        for (let j = menuFocusableElements.length - 1; j >= 0; j--) {
          if (menuFocusableElements[j].closest('.card') === currentCard) {
            return j;
          }
        }
      }
    }

    // Fallback to sequential
    return (menuFocusIndex + step + menuFocusableElements.length) % menuFocusableElements.length;
  }

  return menuFocusIndex;
}

function focusMenuElement(index) {
  // Remove previous focus styling
  menuFocusableElements.forEach(el => {
    el.style.outline = '';
    el.style.boxShadow = '';
  });

  if (menuFocusableElements.length === 0) return;

  // Wrap index
  menuFocusIndex = ((index % menuFocusableElements.length) + menuFocusableElements.length) % menuFocusableElements.length;

  // Add focus styling to current element
  const focusedEl = menuFocusableElements[menuFocusIndex];
  focusedEl.style.outline = '3px solid #4c8dff';
  focusedEl.style.boxShadow = '0 0 12px rgba(76, 141, 255, 0.6)';

  // Scroll into view - use 'center' to ensure it's fully visible
  // Use setTimeout to ensure it happens after any layout changes
  setTimeout(() => {
    focusedEl.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth'
    });
  }, 10);
}

function activateMenuElement() {
  if (menuFocusableElements.length === 0) return;
  const el = menuFocusableElements[menuFocusIndex];

  if (el.tagName === 'H3') {
    // Toggle collapse/expand for card headers
    el.click();
  } else if (el.tagName === 'BUTTON') {
    el.click();
  } else if (el.tagName === 'INPUT' && el.type === 'range') {
    // For sliders, we'll allow left/right to adjust them
    // Clicking just focuses it for now
  } else if (el.tagName === 'SELECT') {
    // For select, X button does nothing - use left/right to change options
  }
}

function adjustSliderValue(direction) {
  if (menuFocusableElements.length === 0) return;
  const el = menuFocusableElements[menuFocusIndex];

  if (el.tagName === 'INPUT' && el.type === 'range') {
    const step = parseFloat(el.step) || 1;
    const currentValue = parseFloat(el.value);
    const newValue = currentValue + (direction * step);
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);

    el.value = Math.max(min, Math.min(max, newValue));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function adjustSelectValue(direction) {
  if (menuFocusableElements.length === 0) return;
  const el = menuFocusableElements[menuFocusIndex];

  if (el.tagName === 'SELECT') {
    const currentIndex = el.selectedIndex;
    const newIndex = currentIndex + direction;

    // Clamp to valid range
    if (newIndex >= 0 && newIndex < el.options.length) {
      el.selectedIndex = newIndex;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

/* ===========================
 * RING MODE STATE
 * =========================== */

// Ring Mode boost state
let ringModeBoostActive = false;

// Ring Mode pause state (needed for input handling)
let ringModePaused = false;

// Ring Mode active state (needed for input handling)
let ringModeActive = false;

/* ===========================
 * CALLBACK REFERENCES
 * =========================== */

// Callback functions (set by main app)
let execBindingCallback = null;
let openMenuCallback = null;
let closeMenuCallback = null;
let retryCallback = null;
let getRingModeLives = () => 0;

/* ===========================
 * INPUT COORDINATION
 * =========================== */

/**
 * Handle gamepad air roll button states
 */
function handleGamepadAirRollButtons(rollStates) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();
  const currentAirRoll = AirRollController.getAirRoll();

  if (!airRollIsToggle) {
    // Hold mode: activate while held, deactivate when released
    if (rollStates.rollLeft) {
      if (currentAirRoll !== -1) AirRollController.setRoll(-1);
    } else if (rollStates.rollRight) {
      if (currentAirRoll !== 1) AirRollController.setRoll(1);
    } else if (rollStates.rollFree) {
      if (currentAirRoll !== 2) AirRollController.setRoll(2);
    } else {
      // No air roll buttons held - deactivate
      if (currentAirRoll !== 0) AirRollController.setRoll(0);
    }
  }
  // In toggle mode, air roll is handled by execBinding callback
}

/**
 * Execute a binding action (from gamepad or keyboard)
 */
function handleBindingExecution(action) {
  // Handle air roll actions
  if (action === 'rollLeft') {
    AirRollController.toggleRoll(-1);
  } else if (action === 'rollRight') {
    AirRollController.toggleRoll(1);
  } else if (action === 'rollFree') {
    AirRollController.toggleRoll(2);
  } else if (action === 'toggleDAR') {
    // Toggle between last active air roll and off
    const currentAirRoll = AirRollController.getAirRoll();
    if (currentAirRoll === 0) {
      AirRollController.setRoll(AirRollController.getLastActiveAirRoll());
    } else {
      AirRollController.setRoll(0);
    }
  } else {
    // Forward all other actions to the main callback
    if (execBindingCallback) {
      execBindingCallback(action);
    }
  }
}

/**
 * Handle keyboard input (WASD movement)
 */
function handleKeyboardMovement(input) {
  // Convert keyboard input to joystick-style movement
  const JOY_BASE_R = TouchInput.getJoyBaseR();
  const joyActive = TouchInput.getJoyActive();

  if (!joyActive) {
    // Map keyboard WASD input to joystick vector
    const kx = -input.yaw * JOY_BASE_R; // A/D -> left/right (inverted)
    const ky = -input.pitch * JOY_BASE_R; // W/S -> up/down (inverted)
    TouchInput.setJoyVec(kx, ky);
  }
}

/**
 * Handle gamepad stick input
 */
function handleGamepadStick(stick) {
  // Map gamepad stick to joystick vector
  const JOY_BASE_R = TouchInput.getJoyBaseR();
  const joyActive = TouchInput.getJoyActive();

  if (!joyActive) {
    TouchInput.setJoyVec(stick.x * JOY_BASE_R, stick.y * JOY_BASE_R);
  }
}

/**
 * Handle DAR button press
 */
function handleDARPress(pressed) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  if (airRollIsToggle) {
    // Toggle mode: toggle between last active and off
    const currentAirRoll = AirRollController.getAirRoll();
    if (currentAirRoll === 0) {
      AirRollController.setRoll(AirRollController.getLastActiveAirRoll());
    } else {
      AirRollController.setRoll(0);
    }
  } else {
    // Hold mode: activate on press
    if (AirRollController.getAirRoll() === 0) {
      AirRollController.setRoll(AirRollController.getLastActiveAirRoll());
    }
  }
}

/**
 * Handle DAR button release
 */
function handleDARRelease() {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // Release: only deactivate in hold mode
  if (!airRollIsToggle) {
    AirRollController.setRoll(0);
  }
}

/**
 * Handle boost button state changes
 */
function handleBoostChange(active) {
  ringModeBoostActive = active;
}

/* ===========================
 * INITIALIZATION & CLEANUP
 * =========================== */

export function initInput(hud, callbacks = {}) {
  // Store callbacks
  execBindingCallback = callbacks.execBinding || null;
  openMenuCallback = callbacks.openMenu || null;
  closeMenuCallback = callbacks.closeMenu || null;
  retryCallback = callbacks.retry || null;
  getRingModeLives = callbacks.getRingModeLives || (() => 0);

  // Initialize sub-modules
  const touchCallbacks = {
    onDARPress: handleDARPress,
    onDARRelease: handleDARRelease,
    onBoostPress: handleBoostChange,
    showJoyHint: () => {}, // No-op for now
    showDARHint: () => {}, // No-op for now
    positionHints: () => {} // Handled internally by TouchInput
  };

  const keyboardCallbacks = {
    onKeyboardInput: handleKeyboardMovement,
    onBoostChange: handleBoostChange,
    openMenu: openMenuCallback,
    closeMenu: closeMenuCallback
  };

  const gamepadCallbacks = {
    execBinding: handleBindingExecution,
    onGamepadStick: handleGamepadStick,
    onGamepadAirRoll: handleGamepadAirRollButtons,
    onBoostChange: handleBoostChange
  };

  // Initialize touch input
  TouchInput.initTouch(hud, touchCallbacks);

  // Initialize keyboard input
  KeyboardInput.initKeyboard();

  // Initialize gamepad input
  GamepadInput.initGamepad(callbacks.savedGpBindings, callbacks.savedGpEnabled);
  GamepadInput.setupGamepadUI();

  // Initialize air roll controller
  AirRollController.loadAirRollState(callbacks.savedAirRollState);

  console.log('Input module initialized (orchestrator)');
}

/**
 * Handle keyboard air roll in hold mode
 */
function handleKeyboardAirRoll(airRollKeys) {
  const currentAirRoll = AirRollController.getAirRoll();

  // Check if gamepad or DAR button is also pressing
  const gpPressingAirRoll = GamepadInput.isGamepadPressingAirRoll();
  const darPressed = TouchInput.getDarOn();

  // Activate whichever key is held
  if (airRollKeys.rollLeft) {
    if (currentAirRoll !== -1) AirRollController.setRoll(-1);
  } else if (airRollKeys.rollRight) {
    if (currentAirRoll !== 1) AirRollController.setRoll(1);
  } else if (airRollKeys.rollFree) {
    if (currentAirRoll !== 2) AirRollController.setRoll(2);
  } else if (!gpPressingAirRoll && !darPressed) {
    // No keys held and neither gamepad nor DAR is active - deactivate
    if (currentAirRoll !== 0) AirRollController.setRoll(0);
  }
}

export function updateInput(dt) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // Update keyboard input
  KeyboardInput.updateKeyboard(chromeShown, ringModePaused, {
    airRollIsToggle,
    execBinding: handleBindingExecution,
    onKeyboardInput: handleKeyboardMovement,
    onKeyboardAirRoll: handleKeyboardAirRoll,
    onBoostChange: handleBoostChange,
    openMenu: openMenuCallback,
    closeMenu: closeMenuCallback
  });

  // Update gamepad input
  GamepadInput.updateGamepad(chromeShown, {
    execBinding: handleBindingExecution,
    onGamepadStick: handleGamepadStick,
    onGamepadAirRoll: handleGamepadAirRollButtons,
    onBoostChange: handleBoostChange
  });

  // Update touch input (handles hold timers, etc.)
  TouchInput.updateTouch(dt);
}

export function handleResize() {
  TouchInput.clampJoyCenter();
  // DAR and Boost centers are clamped in touch module
}

export function updateJoystickSize(size) {
  TouchInput.setJoyBaseR(size);
  TouchInput.setJoyKnobR(Math.round(size * 0.32));
  TouchInput.clampJoyCenter();
}

export function setJoyBaseR(r) {
  TouchInput.setJoyBaseR(r);
}

export function setJoyKnobR(r) {
  TouchInput.setJoyKnobR(r);
}

export function clampJoyCenter() {
  TouchInput.clampJoyCenter();
}

export function positionHints() {
  // This is handled internally by TouchInput module
  // No-op here as hints are positioned on init and resize
}

export function cleanup() {
  KeyboardInput.cleanupKeyboard();
  GamepadInput.cleanupGamepad();
  // Touch cleanup is handled when HUD is removed
}

/* ===========================
 * MENU CONTROL FUNCTIONS
 * =========================== */

export function setChromeShown(shown) {
  chromeShown = shown;

  if (!shown) {
    // Clear focus styling when menu closes
    menuFocusableElements.forEach(el => {
      el.style.outline = '';
      el.style.boxShadow = '';
    });
  } else {
    // Initialize menu navigation
    updateMenuFocusableElements();
    menuFocusIndex = 0;
    if (menuFocusableElements.length > 0) {
      focusMenuElement(0);
    }
  }
}

/* ===========================
 * EXTERNAL STATE SETTERS
 * =========================== */

export function setRingModeActive(active) {
  ringModeActive = active;
  TouchInput.setShowBoostButton(active && isMobile);
}

export function setRingModePaused(paused) {
  ringModePaused = paused;
}

export function setAirRollIsToggle(isToggle) {
  AirRollController.setAirRollIsToggle(isToggle);
}

export function selectAirRoll(dir) {
  AirRollController.selectAirRoll(dir);
}

/* ===========================
 * GETTERS (READ-ONLY ACCESS)
 * =========================== */

// Joystick state (delegated to TouchInput)
export function getJoyVec() {
  const vec = TouchInput.getJoyVec();
  return { x: vec.x, y: vec.y };
}

export function getJoyActive() {
  return TouchInput.getJoyActive();
}

export function getJoyCenter() {
  const center = TouchInput.getJoyCenter();
  return { x: center.x, y: center.y };
}

export function getJoyBaseR() {
  return TouchInput.getJoyBaseR();
}

export function getJoyKnobR() {
  return TouchInput.getJoyKnobR();
}

// DAR button state (delegated to TouchInput)
export function getDarOn() {
  return TouchInput.getDarOn();
}

export function getDarCenter() {
  const center = TouchInput.getDarCenter();
  return { x: center.x, y: center.y };
}

export function getDarR() {
  return TouchInput.getDarR();
}

// Boost button state (delegated to TouchInput)
export function getBoostCenter() {
  const center = TouchInput.getBoostCenter();
  return { x: center.x, y: center.y };
}

export function getBoostR() {
  return TouchInput.getBoostR();
}

export function getShowBoostButton() {
  return TouchInput.getShowBoostButton();
}

export function getRingModeBoostActive() {
  return ringModeBoostActive;
}

// Air roll state (delegated to AirRollController)
export function getAirRoll() {
  return AirRollController.getAirRoll();
}

export function getLastActiveAirRoll() {
  return AirRollController.getLastActiveAirRoll();
}

export function getAirRollIsToggle() {
  return AirRollController.getAirRollIsToggle();
}

// Gamepad state (delegated to GamepadInput)
export function getGpEnabled() {
  return GamepadInput.getGpEnabled();
}

export function getGpBindings() {
  return GamepadInput.getGpBindings();
}

// Device type
export function getIsMobile() {
  return isMobile;
}

export function getIsDesktop() {
  return isDesktop;
}

// Menu state
export function getChromeShown() {
  return chromeShown;
}

// Constants
export const STICK_DEADZONE = TouchInput.STICK_DEADZONE;

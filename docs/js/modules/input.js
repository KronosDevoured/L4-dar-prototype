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
import * as RingMode from './ringMode.js';
import { MenuSystem } from './menuSystem.js';

/* ===========================
 * DEVICE DETECTION
 * =========================== */

// Detect if on mobile/tablet or desktop
const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
const touchPoints = (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number') ? navigator.maxTouchPoints : 0;
const isMobile = !!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  || (touchPoints && touchPoints > 2));
const isDesktop = !isMobile;

/* ===========================
 * MENU STATE
 * =========================== */

// Menu state (controlled externally but needed for input blocking)
let chromeShown = false;

// Short cooldown to prevent menu-close inputs from triggering gameplay actions
let menuInputCooldownUntil = 0;
const MENU_INPUT_COOLDOWN_MS = 150;

// MenuSystem reference (set by main app via initInput)
let menuSystem = null;

export function setMenuSystem(system) {
  menuSystem = system;
}

// Legacy menu navigation state (replaced by MenuSystem)
let menuFocusIndex = 0; // kept for backwards compatibility
let menuFocusableElements = []; // kept for backwards compatibility
let menuNavigationCooldown = 0; // kept for backwards compatibility
const MENU_NAV_COOLDOWN = 200; // ms between navigation inputs (legacy)

// No-op placeholder to preserve compatibility where invoked
function updateMenuFocusableElements() {
  // MenuSystem now owns focusable discovery
}

function findClosestElementInDirection(direction) {
  if (menuFocusableElements.length === 0) return menuFocusIndex;

  const currentEl = menuFocusableElements[menuFocusIndex];
  const currentRect = currentEl.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  const currentHeight = currentRect.height;
  const currentWidth = currentRect.width;
  const currentCard = currentEl.closest('.card');

  let candidates = [];
  let sameCardCandidates = [];

  // Find all elements in the target direction with their distances
  for (let i = 0; i < menuFocusableElements.length; i++) {
    if (i === menuFocusIndex) continue; // Skip self

    const el = menuFocusableElements[i];
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elCard = el.closest('.card');

    let isValid = false;
    let score = Infinity;
    const isSameCard = elCard === currentCard;

    if (direction === 'down') {
      // Element must be below current element
      if (centerY > currentCenterY) {
        const horizontalDist = Math.abs(centerX - currentCenterX);
        const verticalDist = centerY - currentCenterY;
        
        // Only consider if it's clearly more vertical than horizontal
        if (verticalDist > Math.max(currentHeight * 0.1, 10)) {
          isValid = true;
          // Strong penalty for horizontal misalignment
          score = horizontalDist * 3 + verticalDist * 0.5;
        }
      }
    } else if (direction === 'up') {
      // Element must be above current element
      if (centerY < currentCenterY) {
        const horizontalDist = Math.abs(centerX - currentCenterX);
        const verticalDist = currentCenterY - centerY;
        
        // Only consider if it's clearly more vertical than horizontal
        if (verticalDist > Math.max(currentHeight * 0.1, 10)) {
          isValid = true;
          // Strong penalty for horizontal misalignment
          score = horizontalDist * 3 + verticalDist * 0.5;
        }
      }
    } else if (direction === 'right') {
      // Element must be to the right of current element
      if (centerX > currentCenterX) {
        const verticalDist = Math.abs(centerY - currentCenterY);
        const horizontalDist = centerX - currentCenterX;
        
        // Only consider if it's clearly more horizontal than vertical
        if (horizontalDist > Math.max(currentWidth * 0.1, 10)) {
          isValid = true;
          // Strong penalty for vertical misalignment
          score = verticalDist * 3 + horizontalDist * 0.5;
        }
      }
    } else if (direction === 'left') {
      // Element must be to the left of current element
      if (centerX < currentCenterX) {
        const verticalDist = Math.abs(centerY - currentCenterY);
        const horizontalDist = currentCenterX - centerX;
        
        // Only consider if it's clearly more horizontal than vertical
        if (horizontalDist > Math.max(currentWidth * 0.1, 10)) {
          isValid = true;
          // Strong penalty for vertical misalignment
          score = verticalDist * 3 + horizontalDist * 0.5;
        }
      }
    }

    if (isValid) {
      candidates.push({ index: i, score });
      if (isSameCard && el.tagName !== 'H3') {
        sameCardCandidates.push({ index: i, score });
      }
    }
  }

  // Prefer elements in the same card for up/down navigation
  if ((direction === 'down' || direction === 'up') && sameCardCandidates.length > 0) {
    sameCardCandidates.sort((a, b) => a.score - b.score);
    return sameCardCandidates[0].index;
  }

  // If candidates found, return the one with the best score
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].index;
  }

  // Fallback: if no candidates in direction, stay on current element
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

function handleMenuNavigation(direction, ignoreReduced = false) {
  updateMenuFocusableElements();

  // Check cooldown
  const now = performance.now();
  if (!ignoreReduced && menuNavigationCooldown > now) return false;

  const newIndex = findClosestElementInDirection(direction);
  if (newIndex !== menuFocusIndex) {
    focusMenuElement(newIndex);
    menuNavigationCooldown = now + MENU_NAV_COOLDOWN;
    return true;
  }
  return false;
}

function handleMenuSelect() {
  const el = menuFocusableElements[menuFocusIndex];
  if (el) {
    if (el.tagName === 'H3') {
      el.click(); // Toggle card
    } else {
      el.click();
    }
  }
}

function handleMenuEscape() {
  closeMenuCallback?.();
}

function handleMenuOpen() {
  if (!menuSystem) return;
  menuSystem.updateFocusableElements();
  menuSystem.reset();
}

function activateMenuElement() {
  if (!menuSystem) return;
  menuSystem.activateElement();
}

function adjustSliderValue(direction) {
  if (!menuSystem) return;
  menuSystem.adjustSlider(direction < 0 ? 'left' : 'right');
}

function adjustSelectValue(direction) {
  if (!menuSystem) return;
  menuSystem.adjustSelect(direction < 0 ? 'left' : 'right');
}

/* ===========================
 * RING MODE STATE
 * =========================== */

// Ring Mode boost state
let ringModeBoostActive = false;
let keyboardBoostActive = false;
let gamepadBoostActive = false;
let touchBoostActive = false;

// Dual stick mode: right stick input and state tracking
let rightStickInput = { x: 0, y: 0 };
let rightStickWasActive = false;
let airRollBeforeRightStick = 0; // Store air roll state before right stick takes over

// Toggle DAR active state (X button on gamepad)
let toggleDARActive = false;
let toggleDARPressTime = 0; // Track when button was pressed to prevent immediate release

/* ===========================
 * CALLBACK REFERENCES
 * =========================== */

// Callback functions (set by main app)
let execBindingCallback = null;
let openMenuCallback = null;
let closeMenuCallback = null;
let retryCallback = null;
let getRingModeLives = () => 0;

// Ring Mode active state (tracked for boost button relocation logic)
let ringModeActiveState = false;

/* ===========================
 * INPUT COORDINATION
 * =========================== */

/**
 * Handle gamepad air roll button states
 */
function handleGamepadAirRollButtons(rollStates) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // Right stick ALWAYS has absolute priority, regardless of toggle mode
  if (rollStates.rightStickActive) {
    // Right stick just became active - save the current air roll state
    if (!rightStickWasActive) {
      airRollBeforeRightStick = AirRollController.getAirRoll();
      rightStickWasActive = true;
    }
    
    // Right stick is active - use its assignment exclusively (always in hold mode)
    // Right stick always has full intensity (1.0)
    if (rollStates.rollFree) {
      AirRollController.setRoll(2, true, 1.0);
    } else if (rollStates.rollLeft) {
      AirRollController.setRoll(-1, true, 1.0);
    } else if (rollStates.rollRight) {
      AirRollController.setRoll(1, true, 1.0);
    }
    return; // Right stick handled - done
  }

  // Right stick just became inactive - restore previous air roll state
  if (rightStickWasActive) {
    AirRollController.setRoll(airRollBeforeRightStick, true, 1.0);
    rightStickWasActive = false;
    return;
  }

  // Right stick not active - handle button presses based on mode
  if (!airRollIsToggle) {
    // Hold mode: check buttons and use analog intensity
    if (rollStates.rollLeft) {
      AirRollController.setRoll(-1, true, rollStates.rollLeftIntensity);
    } else if (rollStates.rollRight) {
      AirRollController.setRoll(1, true, rollStates.rollRightIntensity);
    } else if (rollStates.rollFree) {
      AirRollController.setRoll(2, true, rollStates.rollFreeIntensity);
    } else if (!toggleDARActive && !TouchInput.getDarOn()) {
      // No directional buttons held AND toggleDAR button not active AND menu DAR not active - deactivate
      AirRollController.setRoll(0, true, 1.0);
    }
    // If toggleDAR button is active or menu DAR is on, leave it alone
  }
  // In toggle mode, air roll is handled by execBinding callback
}

/**
 * Execute a binding action (from gamepad or keyboard)
 */
function handleBindingExecution(action) {
  if (chromeShown || performance.now() < menuInputCooldownUntil) {
    return;
  }
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // Handle air roll actions
  // In toggle mode: use toggleRoll for all air roll actions
  // In hold mode: only use toggleRoll for rollFree (since it has no continuous tracking)
  if (action === 'rollLeft') {
    if (airRollIsToggle) {
      AirRollController.toggleRoll(-1);
    }
    // In hold mode, rollLeft is handled by handleGamepadAirRollButtons/handleKeyboardAirRoll
  } else if (action === 'rollRight') {
    if (airRollIsToggle) {
      AirRollController.toggleRoll(1);
    }
    // In hold mode, rollRight is handled by handleGamepadAirRollButtons/handleKeyboardAirRoll
  } else if (action === 'rollFree') {
    // rollFree always uses toggleRoll (has continuous tracking in both modes)
    AirRollController.toggleRoll(2);
  } else if (action === 'toggleDAR') {
    // Gamepad toggleDAR button: switches between toggle and hold mode
    const currentMode = AirRollController.getAirRollIsToggle();
    AirRollController.setAirRollIsToggle(!currentMode);
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
    // Gamepad stick values are already -1.0 to +1.0, so just multiply by base radius
    // to convert to pixel space that matches touch input
    TouchInput.setJoyVec(stick.x * JOY_BASE_R, stick.y * JOY_BASE_R);
  }
}

/**
 * Handle DAR button press (touch screen)
 */
function handleDARPress(pressed) {
  // Touch screen DAR button always uses toggle mode
  // Toggles the selected air roll direction on/off
  const selectedAirRoll = AirRollController.getSelectedAirRoll();
  AirRollController.toggleRoll(selectedAirRoll, true);
}

/**
 * Handle DAR button release (touch screen)
 */
function handleDARRelease() {
  // Touch DAR is always toggle mode - release does nothing
  // (air roll stays active until tapped again)
}

/**
 * Handle keyboard boost state changes
 */
function handleKeyboardBoostChange(active) {
  keyboardBoostActive = active;
  // Combine all boost sources (keyboard, gamepad, touch)
  ringModeBoostActive = keyboardBoostActive || gamepadBoostActive || touchBoostActive;
}

/**
 * Handle gamepad boost state changes
 */
function handleGamepadBoostChange(active) {
  gamepadBoostActive = active;
  // Combine all boost sources (keyboard, gamepad, touch)
  ringModeBoostActive = keyboardBoostActive || gamepadBoostActive || touchBoostActive;
}

/**
 * Handle touch boost state changes
 */
function handleTouchBoostChange(active) {
  touchBoostActive = active;
  // Combine all boost sources (keyboard, gamepad, touch)
  ringModeBoostActive = keyboardBoostActive || gamepadBoostActive || touchBoostActive;
}

/**
 * Handle toggleDAR button state (no longer needed - toggleDAR just switches modes now)
 */
function handleToggleDARState() {
  // No-op: toggleDAR button now switches between toggle/hold mode via edge detection
  // Air roll activation is handled by the directional air roll buttons (L1/R1) or touch DAR
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
    onBoostPress: handleTouchBoostChange,
    onRetryPress: () => {
      if (retryCallback) {
        retryCallback();
      }
    },
    // Visibility/state helpers used by touch layer
    getRingModeLives: () => getRingModeLives(),
    showJoyHint: () => {}, // No-op for now
    showDARHint: () => {}, // No-op for now
    showBoostHint: () => {}, // No-op for now
    getRingModeActive: () => {
      // Import RingMode dynamically to check if it's active
      // This allows boost button relocation only when NOT in Ring Mode
      return ringModeActiveState;
    },
    getChromeShown: () => chromeShown,
    positionHints: () => {} // Handled internally by TouchInput
  };

  const keyboardCallbacks = {
    onKeyboardInput: handleKeyboardMovement,
    onBoostChange: handleKeyboardBoostChange,
    openMenu: openMenuCallback,
    closeMenu: closeMenuCallback
  };

  const gamepadCallbacks = {
    execBinding: handleBindingExecution,
    onGamepadStick: handleGamepadStick,
    onGamepadAirRoll: handleGamepadAirRollButtons,
    onBoostChange: handleGamepadBoostChange
  };

  // Initialize touch input
  TouchInput.initTouch(hud, touchCallbacks);

  // Initialize keyboard input with saved bindings
  KeyboardInput.initKeyboard(callbacks.savedKbBindings);

  // Initialize gamepad input
  GamepadInput.initGamepad(callbacks.savedGpBindings, callbacks.savedGpEnabled, callbacks.savedGpPreset);
  GamepadInput.setupGamepadUI();

  // Initialize air roll controller
  AirRollController.loadAirRollState(callbacks.savedAirRollState);

}

/**
 * Cleanup input module resources
 * Call this when shutting down the application to prevent memory leaks
 */
export function cleanupInput() {
  TouchInput.cleanup();
  KeyboardInput.cleanupKeyboard();
  GamepadInput.cleanupGamepad();
}

/**
 * Handle keyboard air roll in hold mode
 */
function handleKeyboardAirRoll(airRollKeys) {
  // Check if gamepad or DAR button is also pressing
  const gpPressingAirRoll = GamepadInput.isGamepadPressingAirRoll();
  const darPressed = TouchInput.getDarOn();

  // Activate whichever key is held
  if (airRollKeys.rollLeft) {
    AirRollController.setRoll(-1, true);
  } else if (airRollKeys.rollRight) {
    AirRollController.setRoll(1, true);
  } else if (airRollKeys.rollFree) {
    AirRollController.setRoll(2, true);
  } else if (!gpPressingAirRoll && !darPressed && !toggleDARActive) {
    // No keys held and neither gamepad nor DAR nor toggleDAR is active - deactivate
    AirRollController.setRoll(0, true);
  }
}

/**
 * Handle menu navigation from gamepad
 */
function handleMenuNavigate(direction) {
  if (!menuSystem) return;
  menuSystem.navigate(direction);
}

function handleMenuClose() {
  // Suppress gameplay inputs briefly so the close button press doesn't trigger actions
  menuInputCooldownUntil = performance.now() + MENU_INPUT_COOLDOWN_MS;
  if (closeMenuCallback) {
    closeMenuCallback();
  }
}

export function updateInput(dt) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();
  const suppressGameplay = chromeShown || performance.now() < menuInputCooldownUntil;

  // Update keyboard input
  KeyboardInput.updateKeyboard(chromeShown, RingMode.getRingModePaused(), {
    airRollIsToggle,
    execBinding: handleBindingExecution,
    onKeyboardInput: handleKeyboardMovement,
    onKeyboardAirRoll: handleKeyboardAirRoll,
    onBoostChange: handleKeyboardBoostChange,
    openMenu: openMenuCallback,
    closeMenu: handleMenuClose
  });

  // Update gamepad input (gameplay)
  GamepadInput.updateGamepad(suppressGameplay, {
    execBinding: handleBindingExecution,
    onGamepadStick: handleGamepadStick,
    onRightStick: (stick) => { rightStickInput = stick; },
    onGamepadAirRoll: handleGamepadAirRollButtons,
    onBoostChange: handleGamepadBoostChange,
    onToggleDARState: handleToggleDARState
  });

  // Update gamepad menu navigation (when menu is open)
  if (chromeShown && menuSystem) {
    GamepadInput.updateGamepadMenuNavigation({
      onMenuNavigate: handleMenuNavigate,
      onMenuActivate: activateMenuElement,
      onMenuClose: handleMenuClose
    });
  }

  // Update touch input (handles hold timers, etc.)
  TouchInput.updateTouch(dt);
}

export function handleResize() {
  TouchInput.handleTouchResize();
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

/* ===========================
 * MENU CONTROL FUNCTIONS
 * =========================== */

export function setChromeShown(shown) {
  chromeShown = shown;

  if (!menuSystem) return;

  if (!shown) {
    menuSystem.clearFocus();
  } else {
    // Allow layout to settle before capturing focusable elements
    menuSystem.updateFocusableElements();
    menuSystem.reset();
    setTimeout(() => {
      menuSystem.updateFocusableElements();
      if (menuSystem.getElements().length > 0) {
        menuSystem.reset();
      }
    }, 30);
  }
}

/* ===========================
 * EXTERNAL STATE SETTERS
 * =========================== */

export function setRingModeActive(active) {
  // Note: Ring Mode state is now owned by ringMode.js
  // This function only handles input-related side effects
  ringModeActiveState = active; // Track state for boost button relocation logic
  TouchInput.setShowBoostButton(active); // Show boost button on all devices when ring mode is active
}

export function setRingModePaused(paused) {
  // Note: Ring Mode pause state is now owned by ringMode.js
  // This function is kept for compatibility but does nothing
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

export function getRightStickInput() {
  return rightStickInput;
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

export function getAirRollIntensity() {
  return AirRollController.getAirRollIntensity();
}

export function getSelectedAirRoll() {
  return AirRollController.getSelectedAirRoll();
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

// ============================================================================
// CLEANUP AND MEMORY MANAGEMENT
// ============================================================================

/**
 * Cleanup input module resources
 * Call this when shutting down the application to prevent memory leaks
 */
export function cleanup() {
  // Reset all input state
  chromeShown = false;

  // Cleanup sub-modules
  TouchInput.cleanup();
  KeyboardInput.cleanup();
  GamepadInput.cleanup();
  AirRollController.cleanup();
}

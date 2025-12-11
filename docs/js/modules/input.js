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

  // UP/DOWN behavior - NEW LOGIC for better navigation
  if (direction === 'down' || direction === 'up') {
    const step = direction === 'down' ? 1 : -1;
    const currentCard = currentEl.closest('.card');

    if (isHeader) {
      if (direction === 'down') {
        // DOWN from header → Enter card ONLY if expanded, otherwise jump to next header
        const isCardExpanded = currentCard && !currentCard.classList.contains('collapsed');

        if (isCardExpanded) {
          // Card is expanded → Try to enter card (find first non-header element)
          for (let i = 1; i < menuFocusableElements.length; i++) {
            const checkIndex = (menuFocusIndex + i) % menuFocusableElements.length;
            const checkEl = menuFocusableElements[checkIndex];
            const checkCard = checkEl.closest('.card');

            // Found first element inside current card
            if (checkCard === currentCard && checkEl.tagName !== 'H3') {
              return checkIndex;
            }

            // Reached next card without finding elements → jump to next card header
            if (checkCard !== currentCard) {
              break;
            }
          }
        }

        // Card is collapsed OR has no elements → jump to next card header
        for (let i = 1; i < menuFocusableElements.length; i++) {
          const checkIndex = (menuFocusIndex + i) % menuFocusableElements.length;
          const checkEl = menuFocusableElements[checkIndex];
          if (checkEl.tagName === 'H3') {
            return checkIndex;
          }
        }
      } else {
        // UP from header → Go to previous card header
        for (let i = 1; i < menuFocusableElements.length; i++) {
          const checkIndex = (menuFocusIndex - i + menuFocusableElements.length) % menuFocusableElements.length;
          const checkEl = menuFocusableElements[checkIndex];
          if (checkEl.tagName === 'H3') {
            return checkIndex;
          }
        }
      }
    } else {
      // Currently on a control element (button/slider/select)
      if (direction === 'down') {
        // DOWN from control → Next element in card OR next card header
        for (let i = 1; i < menuFocusableElements.length; i++) {
          const checkIndex = (menuFocusIndex + i) % menuFocusableElements.length;
          const checkEl = menuFocusableElements[checkIndex];
          const checkCard = checkEl.closest('.card');

          // Still in same card → move to next element
          if (checkCard === currentCard && checkEl.tagName !== 'H3') {
            return checkIndex;
          }

          // Left card → jump to next card header
          if (checkCard !== currentCard && checkEl.tagName === 'H3') {
            return checkIndex;
          }
        }
      } else {
        // UP from control → Previous element in card OR card header
        for (let i = 1; i < menuFocusableElements.length; i++) {
          const checkIndex = (menuFocusIndex - i + menuFocusableElements.length) % menuFocusableElements.length;
          const checkEl = menuFocusableElements[checkIndex];
          const checkCard = checkEl.closest('.card');

          // Previous element in same card (including header)
          if (checkCard === currentCard) {
            return checkIndex;
          }
        }
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
    // Refresh focusable elements after expanding/collapsing card
    setTimeout(() => {
      updateMenuFocusableElements();
    }, 50);
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
let keyboardBoostActive = false;
let gamepadBoostActive = false;

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

/* ===========================
 * INPUT COORDINATION
 * =========================== */

/**
 * Handle gamepad air roll button states
 */
function handleGamepadAirRollButtons(rollStates) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  if (!airRollIsToggle) {
    // Hold mode: directional buttons have priority
    if (rollStates.rollLeft) {
      AirRollController.setRoll(-1, true);
    } else if (rollStates.rollRight) {
      AirRollController.setRoll(1, true);
    } else if (rollStates.rollFree) {
      AirRollController.setRoll(2, true);
    } else if (!toggleDARActive) {
      // No directional buttons held AND toggleDAR is not active - deactivate
      AirRollController.setRoll(0, true);
    }
    // If toggleDAR is active and no directional buttons held, leave it alone
  }
  // In toggle mode, air roll is handled by execBinding callback
}

/**
 * Execute a binding action (from gamepad or keyboard)
 */
function handleBindingExecution(action) {
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
    // toggleDAR behavior depends on airRollIsToggle setting
    if (airRollIsToggle) {
      // Toggle mode: press once to activate, press again to deactivate
      const currentAirRoll = AirRollController.getAirRoll();
      const lastActive = AirRollController.getLastActiveAirRoll();
      if (currentAirRoll === 0) {
        AirRollController.setRoll(lastActive, true);
        toggleDARActive = true;
      } else {
        AirRollController.setRoll(0, true);
        toggleDARActive = false;
      }
    }
    // In hold mode: handled entirely by handleToggleDARState (continuous tracking)
    // Don't activate here to avoid race condition with air roll button handler
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
      AirRollController.setRoll(AirRollController.getLastActiveAirRoll(), true);
    } else {
      AirRollController.setRoll(0, true);
    }
  } else {
    // Hold mode: activate on press
    if (AirRollController.getAirRoll() === 0) {
      AirRollController.setRoll(AirRollController.getLastActiveAirRoll(), true);
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
    AirRollController.setRoll(0, true);
  }
}

/**
 * Handle keyboard boost state changes
 */
function handleKeyboardBoostChange(active) {
  keyboardBoostActive = active;
  // Combine keyboard and gamepad boost
  ringModeBoostActive = keyboardBoostActive || gamepadBoostActive;
}

/**
 * Handle gamepad boost state changes
 */
function handleGamepadBoostChange(active) {
  gamepadBoostActive = active;
  // Combine keyboard and gamepad boost
  ringModeBoostActive = keyboardBoostActive || gamepadBoostActive;
}

/**
 * Handle touch boost state changes
 * Note: Touch boost is exclusive (only one input source active on mobile)
 */
function handleTouchBoostChange(active) {
  // On mobile, touch is the primary input, so just set directly
  ringModeBoostActive = active;
}

/**
 * Handle toggleDAR button state (continuous tracking for hold mode)
 */
function handleToggleDARState(pressed) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // In hold mode, track current button state
  if (!airRollIsToggle) {
    if (pressed && !toggleDARActive) {
      // Button just pressed - activate
      const lastActive = AirRollController.getLastActiveAirRoll();
      AirRollController.setRoll(lastActive, true);
      toggleDARActive = true;
    } else if (!pressed && toggleDARActive) {
      // Button just released - deactivate
      AirRollController.setRoll(0, true);
      toggleDARActive = false;
    }
  }
  // In toggle mode, button state is handled by edge detection in handleBindingExecution
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
    showJoyHint: () => {}, // No-op for now
    showDARHint: () => {}, // No-op for now
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

  // Initialize keyboard input
  KeyboardInput.initKeyboard();

  // Initialize gamepad input
  GamepadInput.initGamepad(callbacks.savedGpBindings, callbacks.savedGpEnabled, callbacks.savedGpPreset);
  GamepadInput.setupGamepadUI();

  // Initialize air roll controller
  AirRollController.loadAirRollState(callbacks.savedAirRollState);

  console.log('Input module initialized (orchestrator)');
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
function handleMenuNavigate(direction, currentTime) {
  // Check cooldown
  if (currentTime - menuNavigationCooldown < MENU_NAV_COOLDOWN) {
    return;
  }

  // Refresh focusable elements to account for any expanded/collapsed cards
  updateMenuFocusableElements();

  const focusedEl = menuFocusableElements[menuFocusIndex];
  const isSlider = focusedEl && focusedEl.tagName === 'INPUT' && focusedEl.type === 'range';
  const isSelect = focusedEl && focusedEl.tagName === 'SELECT';

  // Handle UP/DOWN navigation (always navigates, never adjusts values)
  if (direction === 'up' || direction === 'down') {
    const newIndex = findClosestElementInDirection(direction);
    focusMenuElement(newIndex);
    menuNavigationCooldown = currentTime;
  }
  // Handle LEFT/RIGHT navigation (adjust slider/select if focused, otherwise navigate)
  else if (direction === 'left') {
    if (isSlider) {
      adjustSliderValue(-1);
    } else if (isSelect) {
      adjustSelectValue(-1);
    } else {
      const newIndex = findClosestElementInDirection('left');
      focusMenuElement(newIndex);
    }
    menuNavigationCooldown = currentTime;
  }
  else if (direction === 'right') {
    if (isSlider) {
      adjustSliderValue(1);
    } else if (isSelect) {
      adjustSelectValue(1);
    } else {
      const newIndex = findClosestElementInDirection('right');
      focusMenuElement(newIndex);
    }
    menuNavigationCooldown = currentTime;
  }
}

export function updateInput(dt) {
  const airRollIsToggle = AirRollController.getAirRollIsToggle();

  // Update keyboard input
  KeyboardInput.updateKeyboard(chromeShown, RingMode.getRingModePaused(), {
    airRollIsToggle,
    execBinding: handleBindingExecution,
    onKeyboardInput: handleKeyboardMovement,
    onKeyboardAirRoll: handleKeyboardAirRoll,
    onBoostChange: handleKeyboardBoostChange,
    openMenu: openMenuCallback,
    closeMenu: closeMenuCallback
  });

  // Update gamepad input (gameplay)
  GamepadInput.updateGamepad(chromeShown, {
    execBinding: handleBindingExecution,
    onGamepadStick: handleGamepadStick,
    onGamepadAirRoll: handleGamepadAirRollButtons,
    onBoostChange: handleGamepadBoostChange,
    onToggleDARState: handleToggleDARState
  });

  // Update gamepad menu navigation (when menu is open)
  if (chromeShown && menuFocusableElements.length > 0) {
    GamepadInput.updateGamepadMenuNavigation({
      onMenuNavigate: handleMenuNavigate,
      onMenuActivate: activateMenuElement,
      onMenuClose: closeMenuCallback
    });
  }

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
  // Note: Ring Mode state is now owned by ringMode.js
  // This function only handles input-related side effects
  TouchInput.setShowBoostButton(active && isMobile);
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

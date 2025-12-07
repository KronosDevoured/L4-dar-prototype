/**
 * input.js - Input Handling Module
 *
 * Handles all input sources: touch, gamepad, and keyboard
 * Manages joystick, DAR button, boost button, and air roll controls
 */

import * as THREE from 'three';
import { loadSettings, saveSettings } from './settings.js';

/* ===========================
 * DEVICE DETECTION
 * =========================== */

// Detect if on mobile/tablet or desktop
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
const isDesktop = !isMobile;

/* ===========================
 * TOUCH INPUT - JOYSTICK
 * =========================== */

// Joystick configuration
let JOY_BASE_R = 100;
let JOY_KNOB_R = Math.round(JOY_BASE_R * 0.32);
let JOY_CENTER = new THREE.Vector2(130, window.innerHeight - 130); // Bottom left

// Joystick state
let joyActive = false;
let joyVec = new THREE.Vector2(0, 0);
let smJoy = new THREE.Vector2(0, 0);
const STICK_TAU_MS = 8;
const RELOCATE_HOLD_MS = 250;
const STICK_MIN = 0.02;

// Touch tracking
let activeId = null;
let relocating = false;
let holdTimer = null;
let activePointers = new Map(); // Track all active pointers for multi-touch

// Multi-touch state tracking (per pointer ID)
let joyPointerId = null;    // Pointer controlling joystick
let boostPointerId = null;  // Pointer controlling boost button
let darPointerId = null;    // Pointer controlling DAR button

// Joystick helper functions
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

function clampJoyCenter() {
  JOY_CENTER.x = Math.max(JOY_BASE_R + 20, Math.min(innerWidth - (JOY_BASE_R + 20), JOY_CENTER.x));
  JOY_CENTER.y = Math.max(JOY_BASE_R + 20, Math.min(innerHeight - (JOY_BASE_R + 20), JOY_CENTER.y));
}

/* ===========================
 * TOUCH INPUT - DAR BUTTON
 * =========================== */

// DAR button configuration
let DAR_R = 44;
let DAR_CENTER = new THREE.Vector2(window.innerWidth - 80, window.innerHeight - 130); // Bottom right

// DAR button state
let darOn = false;
let darRelocating = false;
let darHoldTimer = null;
let darPressT = 0;

// DAR button helper functions
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

/* ===========================
 * TOUCH INPUT - BOOST BUTTON
 * =========================== */

// Boost button configuration (for Ring Mode without gamepad)
let BOOST_R = 50;
let BOOST_CENTER = new THREE.Vector2(window.innerWidth - 80, window.innerHeight - 250); // Bottom right, below DAR

// Boost button state
let boostRelocating = false;
let boostHoldTimer = null;
let boostPressT = 0;
let showBoostButton = isMobile; // Only show on mobile/tablet, not desktop

// Boost button helper functions
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

/* ===========================
 * HINTS
 * =========================== */

const joyHint = document.getElementById('joyHint');
const darHint = document.getElementById('darHint');

function showHint(el, ms) {
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

function positionHints() {
  joyHint.style.left = (JOY_CENTER.x + JOY_BASE_R + 18) + 'px';
  joyHint.style.top = (JOY_CENTER.y - JOY_BASE_R - 18) + 'px';
  darHint.style.left = (DAR_CENTER.x + DAR_R + 18) + 'px';
  darHint.style.top = (DAR_CENTER.y - DAR_R - 18) + 'px';
}

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
 * AIR ROLL SYSTEM
 * =========================== */

// Air roll values: -1 = left, 0 = off, +1 = right, 2 = free
let airRoll = 0; // default to off
let lastActiveAirRoll = -1; // Remember last active for DAR toggle (default to Air Roll Left)
let airRollIsToggle = false; // Default: toggle for keyboard, hold for gamepad

// Air roll functions
function setRoll(dir, skipSave = false) {
  airRoll = dir;
  // Remember last active air roll for DAR toggle (but not 0)
  if (dir !== 0) lastActiveAirRoll = dir;
  // Sync darOn with air roll state (on if any air roll is active)
  darOn = (dir !== 0);
  if (!skipSave) saveSettings();
}

function toggleRoll(dir) {
  // For toggle mode: tap to activate, tap again to deactivate
  if (airRollIsToggle) {
    if (airRoll === dir) {
      setRoll(0); // Turn off if already active
    } else {
      setRoll(dir); // Switch to this mode
    }
  } else {
    // For hold mode: handled by gamepad button state
    setRoll(dir);
  }
}

/* ===========================
 * KEYBOARD INPUT
 * =========================== */

// Keyboard state
const keyState = new Map(); // Track which keys are currently held down
const keyPrevState = new Map(); // Track previous frame state for edge detection

// Keyboard event listeners (set up in init)
function onKeyDown(e) {
  keyState.set(e.code, true);
}

function onKeyUp(e) {
  keyState.set(e.code, false);
}

// Helper: Check if key was just pressed this frame (edge detection)
function keyJustPressed(code) {
  return keyState.get(code) && !keyPrevState.get(code);
}

// Helper: Check if key is currently held down
function keyHeld(code) {
  return keyState.get(code) || false;
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
 * GAMEPAD INPUT
 * =========================== */

// Gamepad UI elements
const gpEnableBtn = document.getElementById('gpEnable');
const gpStatusTag = document.getElementById('gpStatus');
const gpPresetSel = document.getElementById('gpPreset');
const gpActionSel = document.getElementById('gpAction');
const gpRemapBtn = document.getElementById('gpRemap');
const gpBindLabel = document.getElementById('gpBindLabel');

// Gamepad state variables
let gpEnabled = true;
let gpBindings = null; // Will be set to defaultGpBindings or loaded from settings
let gpIndex = -1;
let gpRemapping = false;
let gpRemapReady = false;  // true when all buttons/axes are released and ready to capture
let gpPrevActionPressed = {};
const GP_DEADZONE = 0.15;

// Default gamepad bindings (XInput style)
const defaultGpBindings = {
  toggleDAR: { kind: 'button', index: 1 },
  rollLeft: { kind: 'button', index: 4 },
  rollRight: { kind: 'button', index: 5 },
  rollFree: { kind: 'button', index: 7 },
  boost: { kind: 'button', index: 0 },
  pause: { kind: 'button', index: 9 },  // Options/Start button
  restart: { kind: 'button', index: 10 }, // Moved from 9
  orbitCW: { kind: 'button', index: 2 },
  orbitCCW: { kind: 'button', index: 3 },
  toggleTheme: { kind: 'button', index: 8 },
  openMenu: { kind: 'button', index: 6 }
};

// Gamepad presets
const GP_PRESETS = {
  ps5: {
    toggleDAR: { kind: 'button', index: 0 },  // Cross (X)
    rollLeft: { kind: 'button', index: 2 },  // Square
    rollRight: { kind: 'button', index: 1 },  // Circle
    rollFree: { kind: 'button', index: 4 },  // L1
    boost: { kind: 'button', index: 5 },  // R1
    pause: { kind: 'button', index: 12 }, // D-pad Up
    restart: { kind: 'button', index: 13 }, // D-pad Down
    orbitCW: { kind: 'button', index: 15 }, // D-pad Right
    orbitCCW: { kind: 'button', index: 14 }, // D-pad Left
    toggleTheme: { kind: 'button', index: 8 },  // Share/Select
    openMenu: { kind: 'button', index: 9 }   // Options/Start
  },
  xinput: {
    toggleDAR: { kind: 'button', index: 1 },  // B
    rollLeft: { kind: 'button', index: 4 },  // LB
    rollRight: { kind: 'button', index: 5 },  // RB
    rollFree: { kind: 'button', index: 7 },  // RT
    boost: { kind: 'button', index: 0 },  // A
    pause: { kind: 'button', index: 9 },  // Start
    restart: { kind: 'button', index: 10 }, // Xbox button
    orbitCW: { kind: 'button', index: 2 },  // X
    orbitCCW: { kind: 'button', index: 3 },  // Y
    toggleTheme: { kind: 'button', index: 8 },  // Back
    openMenu: { kind: 'button', index: 6 }   // LT
  }
};

// Gamepad helper functions
function bindingToLabel(b) {
  if (!b) return '—';
  if (b.kind === 'button') return `Button ${b.index}`;
  const d = b.dir > 0 ? '+' : '−';
  return `Axis ${b.axis}${d}`;
}

function setBindingPreset(name) {
  // Apply preset without confirmation
  const p = GP_PRESETS[name] || GP_PRESETS.ps5;
  gpBindings = JSON.parse(JSON.stringify(p));
  updateBindLabel();
  saveSettings();
}

function updateBindLabel() {
  const act = gpActionSel.value;
  gpBindLabel.textContent = bindingToLabel(gpBindings[act]);
}

function readPads() {
  const arr = (navigator.getGamepads?.() || []);
  if (gpIndex < 0) {
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p && p.mapping === 'standard') {
        gpIndex = i;
        break;
      }
    }
  }
  return { pad: (gpIndex >= 0 ? arr[gpIndex] : null), all: arr };
}

function isPressedForBinding(pad, binding) {
  if (!binding || !pad) return false;
  if (binding.kind === 'button') {
    const b = pad.buttons[binding.index];
    return !!(b && (b.value || 0) > 0.5);
  }
  if (binding.kind === 'axis') {
    const v = pad.axes[binding.axis] || 0;
    return binding.dir > 0 ? (v > 0.6) : (v < -0.6);
  }
  return false;
}

// Helper: Check if gamepad is currently pressing any air roll buttons
function isGamepadPressingAirRoll() {
  if (!gpEnabled) return false;
  const { pad } = readPads();
  if (!pad) return false;

  // Check if any air roll bindings are currently pressed
  if (gpBindings.rollLeft && isPressedForBinding(pad, gpBindings.rollLeft)) return true;
  if (gpBindings.rollRight && isPressedForBinding(pad, gpBindings.rollRight)) return true;
  if (gpBindings.rollFree && isPressedForBinding(pad, gpBindings.rollFree)) return true;

  return false;
}

function handleRemap(pad) {
  if (!gpRemapping || !pad) return;

  // First, wait for all buttons and axes to be released
  if (!gpRemapReady) {
    let allReleased = true;

    // Check if any button is pressed
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i] && (pad.buttons[i].value || 0) > 0.5) {
        allReleased = false;
        break;
      }
    }

    // Check if any axis is deflected
    if (allReleased) {
      for (let a = 0; a < pad.axes.length; a++) {
        const v = pad.axes[a] || 0;
        if (Math.abs(v) > 0.6) {
          allReleased = false;
          break;
        }
      }
    }

    if (allReleased) {
      gpRemapReady = true;
      gpBindLabel.textContent = 'Ready! Press button / move axis…';
    }
    return;
  }

  // Now we're ready to capture the new binding
  for (let i = 0; i < pad.buttons.length; i++) {
    if (pad.buttons[i] && (pad.buttons[i].value || 0) > 0.5) {
      const action = gpActionSel.value;
      gpBindings[action] = { kind: 'button', index: i };
      console.log(`Remapped ${action} to button ${i}`);
      console.log('Current gpBindings:', JSON.parse(JSON.stringify(gpBindings)));
      gpRemapping = false;
      gpRemapReady = false;
      updateBindLabel();
      saveSettings();
      console.log('saveSettings() called after remapping');
      return;
    }
  }
  for (let a = 0; a < pad.axes.length; a++) {
    const v = pad.axes[a] || 0;
    if (Math.abs(v) > 0.6) {
      const action = gpActionSel.value;
      gpBindings[action] = { kind: 'axis', axis: a, dir: (v > 0 ? +1 : -1) };
      console.log(`Remapped ${action} to axis ${a} dir ${v > 0 ? '+' : '-'}`);
      console.log('Current gpBindings:', JSON.parse(JSON.stringify(gpBindings)));
      gpRemapping = false;
      gpRemapReady = false;
      updateBindLabel();
      saveSettings();
      console.log('saveSettings() called after remapping');
      return;
    }
  }
}

/* ===========================
 * TOUCH EVENT HANDLERS
 * =========================== */

// These will be bound to the HUD element
let hudElement = null;

function onPointerDown(e) {
  try {
    hudElement.setPointerCapture(e.pointerId);
  } catch (_) { }

  // Track this pointer
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // Check for retry button click on game over screen
  if (ringModeActive && getRingModeLives() <= 0) {
    const retryButtonWidth = 200;
    const retryButtonHeight = 50;
    const retryButtonX = innerWidth / 2 - retryButtonWidth / 2;
    const retryButtonY = innerHeight / 2 + 30;

    if (e.clientX >= retryButtonX && e.clientX <= retryButtonX + retryButtonWidth &&
      e.clientY >= retryButtonY && e.clientY <= retryButtonY + retryButtonHeight) {
      // Trigger retry callback
      if (retryCallback) retryCallback();
      e.preventDefault();
      return;
    }
  }

  // Multi-touch: assign this pointer to a specific control FIRST (before checking relocation)
  if (showBoostButton && inBoost(e.clientX, e.clientY)) {
    boostPointerId = e.pointerId;
    // ringModeBoostActive is now set in updateKeyboardInput() based on boostPointerId
    e.preventDefault();
    return;
  }

  // Check for two-finger gesture outside buttons (for boost relocation)
  // IMPORTANT: Only check this AFTER we've checked if user pressed boost button
  if (activePointers.size === 2) {
    const pointers = Array.from(activePointers.values());
    const allOutsideButtons = pointers.every(p =>
      (showBoostButton ? !inBoost(p.x, p.y) : true) && !inDAR(p.x, p.y) && !inJoyLoose(p.x, p.y)
    );
    if (allOutsideButtons) {
      boostRelocating = true;
      e.preventDefault();
      return;
    }
  }

  if (inDAR(e.clientX, e.clientY)) {
    darPointerId = e.pointerId;
    darPressT = performance.now();

    // In toggle mode: toggle on press
    if (airRollIsToggle) {
      if (airRoll === 0) {
        setRoll(lastActiveAirRoll);
      } else {
        setRoll(0);
      }
      darOn = (airRoll !== 0);
    } else {
      // In hold mode: activate immediately on press
      if (airRoll === 0) {
        setRoll(lastActiveAirRoll);
      }
      darOn = true;
    }

    clearTimeout(darHoldTimer);
    darHoldTimer = setTimeout(() => {
      if (darPointerId === e.pointerId) {
        darRelocating = true;
        showHint(darHint, 2000);
      }
    }, RELOCATE_HOLD_MS);
    e.preventDefault();
    return;
  }

  if (inJoyLoose(e.clientX, e.clientY)) {
    joyPointerId = e.pointerId;
    joyActive = true;
    joyVec = vecFromJoyPx(e.clientX, e.clientY);
    e.preventDefault();
    return;
  }

  // If not on any control, set as active for relocation
  if (!chromeShown) {
    activeId = e.pointerId;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (activeId === e.pointerId && !chromeShown) {
        relocating = true;
        showHint(joyHint, 1800);
      }
    }, RELOCATE_HOLD_MS);
  }
  e.preventDefault();
}

function onPointerMove(e) {
  // Update pointer position in tracking
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  // Handle each pointer independently based on what it's controlling
  if (e.pointerId === joyPointerId && joyActive) {
    joyVec = vecFromJoyPx(e.clientX, e.clientY);
    e.preventDefault();
  }

  // DAR relocation uses darPointerId
  if (e.pointerId === darPointerId && darRelocating) {
    DAR_CENTER.set(e.clientX, e.clientY);
    clampDARCenter();
    positionHints();
    e.preventDefault();
  }

  // Joystick and boost relocation use activeId
  if (e.pointerId === activeId) {
    if (boostRelocating) {
      BOOST_CENTER.set(e.clientX, e.clientY);
      clampBoostCenter();
    } else if (relocating) {
      JOY_CENTER.set(e.clientX, e.clientY);
      clampJoyCenter();
      positionHints();
    }
    e.preventDefault();
  }
}

function endPtr(e) {
  // Remove pointer from tracking
  activePointers.delete(e.pointerId);

  // If we were relocating boost and lost a finger, stop relocating
  if (boostRelocating && activePointers.size < 2) {
    boostRelocating = false;
  }

  try {
    hudElement.releasePointerCapture(e.pointerId);
  } catch (_) { }

  // Handle each pointer release independently
  if (e.pointerId === boostPointerId) {
    // ringModeBoostActive is now automatically cleared in updateKeyboardInput() when boostPointerId = null
    boostPointerId = null;
  }

  if (e.pointerId === darPointerId) {
    if (!darRelocating && inDAR(e.clientX, e.clientY)) {
      const heldMs = performance.now() - darPressT;
      if (heldMs < RELOCATE_HOLD_MS) {
        // In toggle mode: nothing to do (already toggled on press)
        // In hold mode: deactivate on release
        if (!airRollIsToggle) {
          setRoll(0);
          darOn = false;
        }
      }
    }
    clearTimeout(darHoldTimer);
    darRelocating = false;
    darPointerId = null;
  }

  if (e.pointerId === joyPointerId) {
    joyActive = false;
    joyVec.set(0, 0);
    joyPointerId = null;
  }

  if (e.pointerId === activeId) {
    clearTimeout(holdTimer);
    relocating = false;
    activeId = null;
  }

  e.preventDefault();
}

/* ===========================
 * GAMEPAD EVENT HANDLERS
 * =========================== */

function onGamepadConnected(e) {
  if (gpIndex < 0) {
    gpIndex = e.gamepad.index;
  }
  gpStatusTag.textContent = `Connected: ${e.gamepad.id}`;
}

function onGamepadDisconnected(e) {
  if (e.gamepad.index === gpIndex) {
    gpIndex = -1;
  }
  gpStatusTag.textContent = gpEnabled ? 'Enabled (waiting for gamepad)' : 'No gamepad';
}

/* ===========================
 * INPUT UPDATE FUNCTIONS
 * =========================== */

// Callback functions (set by main app)
let execBindingCallback = null;
let openMenuCallback = null;
let closeMenuCallback = null;
let retryCallback = null;
let getRingModeLives = () => 0;

function updateKeyboardInput() {
  // Keyboard controls: W/A/S/D = movement, Q/E = air roll, Shift = free roll, Space = boost
  // I = menu toggle, Esc = pause (Ring Mode only)

  // Handle menu toggle (I key) - must be before early return
  if (keyJustPressed('KeyI')) {
    if (chromeShown) {
      if (closeMenuCallback) closeMenuCallback();
    } else {
      if (openMenuCallback) openMenuCallback();
    }
  }

  // Update previous key state for next frame (MUST be done every frame!)
  keyState.forEach((value, key) => {
    keyPrevState.set(key, value);
  });

  // If menu is open, don't process game input
  if (chromeShown) return;

  // Handle pause (Esc key - Ring Mode only)
  if (keyJustPressed('Escape') && ringModeActive) {
    ringModePaused = !ringModePaused;
    console.log('Ring Mode paused:', ringModePaused);
  }

  // Movement (WASD) - only when not dragging joystick manually
  if (!joyActive && !relocating && !darRelocating) {
    let kx = 0, ky = 0;

    if (keyHeld('KeyW')) ky -= 1; // Up
    if (keyHeld('KeyS')) ky += 1; // Down
    if (keyHeld('KeyA')) kx -= 1; // Left
    if (keyHeld('KeyD')) kx += 1; // Right

    // Normalize diagonal movement
    const mag = Math.hypot(kx, ky);
    if (mag > 0) {
      kx /= mag;
      ky /= mag;
      joyVec.set(kx * JOY_BASE_R, ky * JOY_BASE_R);
    } else if (!gpEnabled || !readPads().pad) {
      // Only clear joystick if no gamepad input either
      joyVec.set(0, 0);
    }
  }

  // Keyboard air roll handling depends on mode
  if (airRollIsToggle) {
    // Toggle mode: toggle on key press (edge detection)
    if (keyJustPressed('KeyQ')) {
      toggleRoll(-1);
    }
    if (keyJustPressed('KeyE')) {
      toggleRoll(1);
    }
    if (keyJustPressed('ShiftLeft') || keyJustPressed('ShiftRight')) {
      toggleRoll(2);
    }
  } else {
    // Hold mode: keyboard activates while held, deactivates when released
    const gpControllingAirRoll = isGamepadPressingAirRoll();
    const darButtonPressed = (darPointerId !== null);

    // Air Roll Left (Q)
    if (keyHeld('KeyQ')) {
      if (airRoll !== -1) setRoll(-1);
    } else if (!keyHeld('KeyE') && !keyHeld('ShiftLeft') && !keyHeld('ShiftRight') && !gpControllingAirRoll && !darButtonPressed) {
      // Only release if no other air roll keys are held AND gamepad/DAR button isn't controlling it
      if (airRoll === -1) setRoll(0);
    }

    // Air Roll Right (E)
    if (keyHeld('KeyE')) {
      if (airRoll !== 1) setRoll(1);
    } else if (!keyHeld('KeyQ') && !keyHeld('ShiftLeft') && !keyHeld('ShiftRight') && !gpControllingAirRoll && !darButtonPressed) {
      if (airRoll === 1) setRoll(0);
    }

    // Air Roll Free (Shift)
    if (keyHeld('ShiftLeft') || keyHeld('ShiftRight')) {
      if (airRoll !== 2) setRoll(2);
    } else if (!keyHeld('KeyQ') && !keyHeld('KeyE') && !gpControllingAirRoll && !darButtonPressed) {
      if (airRoll === 2) setRoll(0);
    }
  }

  // Boost (Space) - for Ring Mode
  // Combine keyboard and touch input (touch is handled separately in pointerdown/up)
  const keyboardBoost = keyHeld('Space');
  const touchBoost = (boostPointerId !== null); // If pointer assigned to boost, it's being held
  ringModeBoostActive = keyboardBoost || touchBoost;
}

function updateGamepadInput() {
  if (!gpEnabled) return;
  const { pad } = readPads();
  if (!pad) {
    gpStatusTag.textContent = 'Enabled (waiting for gamepad)';
    return;
  }
  gpStatusTag.textContent = `Connected: ${pad.id}`;

  // If remapping, ONLY handle remapping - block everything else
  if (gpRemapping) {
    handleRemap(pad);
    return; // Don't process any other input while remapping
  }

  // Handle menu navigation when menu is open (but not while remapping)
  if (chromeShown && menuFocusableElements.length > 0) {
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

    const focusedEl = menuFocusableElements[menuFocusIndex];

    // Check if enough time has passed since last navigation
    if (currentTime - menuNavigationCooldown >= MENU_NAV_COOLDOWN) {
      const isSlider = focusedEl && focusedEl.tagName === 'INPUT' && focusedEl.type === 'range';
      const isSelect = focusedEl && focusedEl.tagName === 'SELECT';

      // Handle UP/DOWN navigation (always navigates, never adjusts values)
      if (dpadUp || stickUp) {
        const newIndex = findClosestElementInDirection('up');
        focusMenuElement(newIndex);
        menuNavigationCooldown = currentTime;
      } else if (dpadDown || stickDown) {
        const newIndex = findClosestElementInDirection('down');
        focusMenuElement(newIndex);
        menuNavigationCooldown = currentTime;
      } else if (dpadLeft || stickLeft) {
        // Left: adjust slider/select if focused on one, otherwise navigate
        if (isSlider) {
          adjustSliderValue(-1);
        } else if (isSelect) {
          adjustSelectValue(-1);
        } else {
          const newIndex = findClosestElementInDirection('left');
          focusMenuElement(newIndex);
        }
        menuNavigationCooldown = currentTime;
      } else if (dpadRight || stickRight) {
        // Right: adjust slider/select if focused on one, otherwise navigate
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

    // X button (Cross) to activate/select (button 0)
    const xPressed = pad.buttons[0]?.pressed || false;
    const xWasPressed = !!gpPrevActionPressed['menu_x'];
    if (xPressed && !xWasPressed) {
      activateMenuElement();
    }
    gpPrevActionPressed['menu_x'] = xPressed;

    // Circle button to close menu (button 1)
    const circlePressed = pad.buttons[1]?.pressed || false;
    const circleWasPressed = !!gpPrevActionPressed['menu_circle'];
    if (circlePressed && !circleWasPressed) {
      if (closeMenuCallback) closeMenuCallback();
    }
    gpPrevActionPressed['menu_circle'] = circlePressed;

    // Check for openMenu binding to allow closing menu with it
    if (gpBindings.openMenu) {
      const openMenuPressed = isPressedForBinding(pad, gpBindings.openMenu);
      const openMenuWasPressed = !!gpPrevActionPressed['openMenu'];
      if (openMenuPressed && !openMenuWasPressed) {
        if (closeMenuCallback) closeMenuCallback();
      }
      gpPrevActionPressed['openMenu'] = openMenuPressed;
    }

    // Don't process normal game input when menu is open
    return;
  }

  // Left stick → on-screen stick (natural Y: up=up)
  if (!joyActive && !relocating && !darRelocating) {
    const lx = pad.axes[0] || 0;
    const ly = pad.axes[1] || 0;
    const mag = Math.hypot(lx, ly);
    let nx = 0, ny = 0;
    if (mag > GP_DEADZONE) {
      const k = (mag - GP_DEADZONE) / (1 - GP_DEADZONE);
      nx = (lx / (mag || 1)) * k;
      ny = (ly / (mag || 1)) * k;
    }
    joyVec.set(nx * JOY_BASE_R, ny * JOY_BASE_R);
  }

  // Check boost button state (hold-based, not toggle)
  if (gpBindings.boost) {
    ringModeBoostActive = isPressedForBinding(pad, gpBindings.boost);
  }

  // Fire actions on rising edge (or handle hold mode for air rolls)
  for (const action of Object.keys(gpBindings)) {
    const nowPressed = isPressedForBinding(pad, gpBindings[action]);
    const wasPressed = !!gpPrevActionPressed[action];

    // Boost is handled separately (hold-based)
    if (action === 'boost') {
      gpPrevActionPressed[action] = nowPressed;
      continue;
    }

    // Air roll buttons have special hold/toggle behavior
    const isAirRollAction = (action === 'rollLeft' || action === 'rollRight' || action === 'rollFree');

    if (isAirRollAction && !airRollIsToggle) {
      // Hold mode: activate on press, deactivate on release
      if (nowPressed && !wasPressed) {
        // Just pressed - activate this air roll
        const dir = action === 'rollLeft' ? -1 : action === 'rollRight' ? 1 : 2;
        setRoll(dir);
      } else if (!nowPressed && wasPressed && darPointerId === null) {
        // Just released - deactivate if this was the active one
        // BUT don't deactivate if DAR button is currently being held
        const dir = action === 'rollLeft' ? -1 : action === 'rollRight' ? 1 : 2;
        if (airRoll === dir) {
          setRoll(0);
        }
      }
    } else {
      // Normal toggle behavior for air rolls in toggle mode, or all other actions
      if (nowPressed && !wasPressed) {
        if (execBindingCallback) execBindingCallback(action);
      }
    }

    gpPrevActionPressed[action] = nowPressed;
  }
}

/* ===========================
 * INITIALIZATION & CLEANUP
 * =========================== */

export function initInput(hud, callbacks = {}) {
  // Store HUD element reference
  hudElement = hud;

  // Store callbacks
  execBindingCallback = callbacks.execBinding || null;
  openMenuCallback = callbacks.openMenu || null;
  closeMenuCallback = callbacks.closeMenu || null;
  retryCallback = callbacks.retry || null;
  getRingModeLives = callbacks.getRingModeLives || (() => 0);

  // Load settings
  const savedSettings = loadSettings();

  // Initialize gamepad settings
  gpEnabled = savedSettings.gpEnabled ?? true;
  gpBindings = savedSettings.gpBindings ?? null;

  // Set default bindings if not loaded
  if (!gpBindings) {
    gpBindings = defaultGpBindings;
  }
  console.log('Loaded gamepad bindings:', gpBindings);

  // Restore gamepad preset selection
  if (savedSettings.gpPreset) {
    gpPresetSel.value = savedSettings.gpPreset;
    console.log('Restored preset:', savedSettings.gpPreset);
  }

  // Only set default preset if no saved bindings exist
  if (!savedSettings.gpBindings) {
    setBindingPreset('ps5');
  }
  updateBindLabel();

  // Initialize air roll settings
  airRoll = savedSettings.airRoll ?? 0;
  lastActiveAirRoll = savedSettings.lastActiveAirRoll ?? -1;
  airRollIsToggle = savedSettings.airRollIsToggle ?? (savedSettings.gpEnabled === false);

  // Set initial air roll state (without saving)
  setRoll(airRoll, true);

  // Set up keyboard event listeners
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Set up touch event listeners
  hud.addEventListener('pointerdown', onPointerDown, { passive: false });
  hud.addEventListener('pointermove', onPointerMove, { passive: false });
  hud.addEventListener('pointerup', endPtr, { passive: false });
  hud.addEventListener('pointercancel', endPtr, { passive: false });

  // Set up gamepad event listeners
  window.addEventListener('gamepadconnected', onGamepadConnected);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

  // Set up gamepad UI event listeners
  gpEnableBtn.addEventListener('click', () => {
    gpEnabled = !gpEnabled;
    gpEnableBtn.classList.toggle('active', gpEnabled);
    gpStatusTag.textContent = gpEnabled ? 'Enabled' : 'Disabled';
    saveSettings();
  });

  gpPresetSel.addEventListener('change', () => setBindingPreset(gpPresetSel.value));
  gpActionSel.addEventListener('change', updateBindLabel);

  gpRemapBtn.addEventListener('click', () => {
    gpRemapping = true;
    gpBindLabel.textContent = 'Press button / move axis…';
  });

  document.getElementById('gpResetDefaults').addEventListener('click', () => {
    setBindingPreset(gpPresetSel.value);
    gpStatusTag.textContent = 'Bindings reset to defaults';
    setTimeout(() => {
      const { pad } = readPads();
      if (pad) gpStatusTag.textContent = `Connected: ${pad.id}`;
      else gpStatusTag.textContent = gpEnabled ? 'Enabled (waiting for gamepad)' : 'No gamepad';
    }, 2000);
  });

  // Restore gamepad enabled button state
  gpEnableBtn.classList.toggle('active', gpEnabled);
  gpStatusTag.textContent = gpEnabled ? 'Enabled (waiting for gamepad)' : 'Disabled';

  // Position hints
  positionHints();

  console.log('Input module initialized');
}

export function updateInput(dt) {
  // Update keyboard input
  updateKeyboardInput();

  // Update gamepad input
  updateGamepadInput();
}

export function handleResize() {
  clampJoyCenter();
  clampDARCenter();
  clampBoostCenter();
  positionHints();
}

export function updateJoystickSize(size) {
  JOY_BASE_R = size;
  JOY_KNOB_R = Math.round(JOY_BASE_R * 0.32);
  clampJoyCenter();
  positionHints();
}

export function cleanup() {
  // Remove event listeners
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('gamepadconnected', onGamepadConnected);
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);

  if (hudElement) {
    hudElement.removeEventListener('pointerdown', onPointerDown);
    hudElement.removeEventListener('pointermove', onPointerMove);
    hudElement.removeEventListener('pointerup', endPtr);
    hudElement.removeEventListener('pointercancel', endPtr);
  }
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

    // CRITICAL: Clear gamepad button state for air roll actions to prevent
    // stale button presses from being processed when menu closes
    gpPrevActionPressed['rollLeft'] = false;
    gpPrevActionPressed['rollRight'] = false;
    gpPrevActionPressed['rollFree'] = false;
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
}

export function setRingModePaused(paused) {
  ringModePaused = paused;
}

export function setAirRollIsToggle(isToggle) {
  airRollIsToggle = isToggle;
}

export function selectAirRoll(dir) {
  // Menu buttons: just select which air roll to use (don't activate it)
  lastActiveAirRoll = dir;
  saveSettings();
}

/* ===========================
 * GETTERS (READ-ONLY ACCESS)
 * =========================== */

// Joystick state
export function getJoyVec() {
  return { x: joyVec.x, y: joyVec.y };
}

export function getJoyActive() {
  return joyActive;
}

export function getJoyCenter() {
  return { x: JOY_CENTER.x, y: JOY_CENTER.y };
}

export function getJoyBaseR() {
  return JOY_BASE_R;
}

export function getJoyKnobR() {
  return JOY_KNOB_R;
}

// DAR button state
export function getDarOn() {
  return darOn;
}

export function getDarCenter() {
  return { x: DAR_CENTER.x, y: DAR_CENTER.y };
}

export function getDarR() {
  return DAR_R;
}

// Boost button state
export function getBoostCenter() {
  return { x: BOOST_CENTER.x, y: BOOST_CENTER.y };
}

export function getBoostR() {
  return BOOST_R;
}

export function getShowBoostButton() {
  return showBoostButton;
}

export function getRingModeBoostActive() {
  return ringModeBoostActive;
}

// Air roll state
export function getAirRoll() {
  return airRoll;
}

export function getLastActiveAirRoll() {
  return lastActiveAirRoll;
}

export function getAirRollIsToggle() {
  return airRollIsToggle;
}

// Gamepad state
export function getGpEnabled() {
  return gpEnabled;
}

export function getGpBindings() {
  return gpBindings;
}

// Device type
export function getIsMobile() {
  return isMobile;
}

export function getIsDesktop() {
  return isDesktop;
}

// Constants
export const STICK_DEADZONE = STICK_MIN;

/**
 * airRollController.js
 * Air roll state management system
 * Handles toggle vs hold modes for directional air roll
 */

import { saveSettings } from '../settings.js';

// ============================================================================
// STATE
// ============================================================================

// Air roll values: -1 = left, 0 = off, +1 = right, 2 = free
let airRoll = 0;
let lastActiveAirRoll = -1; // Remember last active for DAR toggle
let airRollIsToggle = false; // Default: hold mode

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export function setRoll(dir, skipSave = false) {
  airRoll = dir;
  // Remember last active air roll for DAR toggle (but not 0)
  if (dir !== 0) {
    lastActiveAirRoll = dir;
  }
  if (!skipSave) {
    saveSettings({ airRoll, lastActiveAirRoll });
  }
  return dir;
}

export function toggleRoll(dir) {
  // For toggle mode: tap to activate, tap again to deactivate
  // Skip save - this is called during gameplay (gamepad/keyboard)
  if (airRollIsToggle) {
    if (airRoll === dir) {
      setRoll(0, true); // Turn off if already active
    } else {
      setRoll(dir, true); // Switch to this mode
    }
  } else {
    // For hold mode: handled by button state
    setRoll(dir, true);
  }
}

export function selectAirRoll(dir) {
  setRoll(dir);
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export function setAirRollIsToggle(isToggle) {
  airRollIsToggle = isToggle;
  saveSettings({ airRollIsToggle });
}

export function loadAirRollState(savedState) {
  if (savedState) {
    airRoll = savedState.airRoll ?? 0;
    lastActiveAirRoll = savedState.lastActiveAirRoll ?? -1;
    airRollIsToggle = savedState.airRollIsToggle ?? false;
  }
}

// ============================================================================
// GETTERS
// ============================================================================

export function getAirRoll() {
  return airRoll;
}

export function getLastActiveAirRoll() {
  return lastActiveAirRoll;
}

export function getAirRollIsToggle() {
  return airRollIsToggle;
}

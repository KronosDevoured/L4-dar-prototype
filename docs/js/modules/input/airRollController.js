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
let airRoll = 0; // Currently active air roll
let selectedAirRoll = -1; // User's selection from menu (Left/Right/Free)
let airRollIsToggle = false; // Default: hold mode (for gamepad)

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export function setRoll(dir, skipSave = false) {
  airRoll = dir;
  if (!skipSave) {
    saveSettings({ airRoll });
  }
  return dir;
}

export function toggleRoll(dir, skipSave = false) {
  // For toggle mode: tap to activate, tap again to deactivate
  // For hold mode: directly set the direction
  if (airRollIsToggle) {
    if (airRoll === dir) {
      setRoll(0, skipSave); // Turn off if already active
    } else {
      setRoll(dir, skipSave); // Switch to this direction
    }
  } else {
    // For hold mode: handled by button state
    setRoll(dir, skipSave);
  }
}

export function selectAirRoll(dir) {
  // Menu selection - just remember the choice, don't activate
  selectedAirRoll = dir;
  saveSettings({ selectedAirRoll });
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
    selectedAirRoll = savedState.selectedAirRoll ?? -1;
    airRollIsToggle = savedState.airRollIsToggle ?? false;
  }
}

// ============================================================================
// GETTERS
// ============================================================================

export function getAirRoll() {
  return airRoll;
}

export function getSelectedAirRoll() {
  return selectedAirRoll;
}

export function getAirRollIsToggle() {
  return airRollIsToggle;
}

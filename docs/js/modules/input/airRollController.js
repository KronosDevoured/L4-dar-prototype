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
let lastActiveAirRoll = 0; // Remember last non-zero roll selection

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export function setRoll(dir, skipSave = false) {
  airRoll = dir;
  if (dir !== 0) {
    lastActiveAirRoll = dir;
  }
  if (!skipSave) {
    saveSettings({ airRoll, lastActiveAirRoll });
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
  // Menu selection - remember the choice
  selectedAirRoll = dir;
  saveSettings({ selectedAirRoll });

  // If toggle mode is active and an air roll is currently on,
  // switch immediately to the newly selected direction.
  if (airRollIsToggle && airRoll !== 0) {
    setRoll(dir, true);
  }
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
    lastActiveAirRoll = savedState.lastActiveAirRoll ?? 0;
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

export function getLastActiveAirRoll() {
  return lastActiveAirRoll;
}

// ============================================================================
// CLEANUP AND MEMORY MANAGEMENT
// ============================================================================

/**
 * Cleanup air roll controller resources
 * Call this when shutting down the application to prevent memory leaks
 */
export function cleanup() {
  // Reset all state to defaults
  airRoll = 0;
  selectedAirRoll = -1;
  airRollIsToggle = false;
  lastActiveAirRoll = 0;
}

/**
 * settings.js
 * LocalStorage management and settings persistence
 * Handles saving/loading all app settings
 */

import { PHYSICS_DEFAULTS } from './constants.js';

// ============================================================================
// SETTINGS STATE (PRIVATE)
// ============================================================================

// Private settings object - not exported directly to prevent external mutation
let _settings = {
  // Physics
  maxAccelPitch: PHYSICS_DEFAULTS.accelPitch,
  maxAccelYaw: PHYSICS_DEFAULTS.accelYaw,
  maxAccelRoll: PHYSICS_DEFAULTS.accelRoll,
  inputPow: PHYSICS_DEFAULTS.curve,
  damp: PHYSICS_DEFAULTS.damp,
  dampDAR: PHYSICS_DEFAULTS.dampDAR,
  brakeOnRelease: PHYSICS_DEFAULTS.brake,
  wMax: PHYSICS_DEFAULTS.wmax,
  wMaxPitch: PHYSICS_DEFAULTS.wmaxPitch,
  wMaxYaw: PHYSICS_DEFAULTS.wmaxYaw,
  wMaxRoll: PHYSICS_DEFAULTS.wmaxRoll,

  // View
  circleTiltAngle: 34,
  circleTiltModifier: 0,
  circleScale: 0.3,
  zoom: 1.0,
  arrowScale: 4.0,
  showArrow: true,
  showCircle: true,

  // Theme
  isDarkMode: true,
  brightnessDark: 1.0,
  brightnessLight: 1.0,

  // Air Roll
  airRoll: 0,
  lastActiveAirRoll: -1,
  airRollIsToggle: false,

  // Gamepad
  gpEnabled: true,
  gpBindings: null,
  gpPreset: 'ps5',

  // Car
  selectedCarBody: 'octane',

  // Audio
  gameSoundsEnabled: true,
  gameMusicEnabled: true,

  // Ring Mode
  ringModeHighScore: 0,
  ringDifficulty: 'normal',
  ringCameraSpeed: 0.1
};

// ============================================================================
// LOAD/SAVE
// ============================================================================

/**
 * Load settings from localStorage
 */
export function loadSettings() {
  const saved = localStorage.getItem('darSettings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      // Merge saved settings with defaults
      _settings = { ..._settings, ...parsed };
      return { ..._settings }; // Return copy to prevent external mutation
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
      return { ..._settings }; // Return copy
    }
  }
  return { ..._settings }; // Return copy
}

/**
 * Save current settings to localStorage
 */
export function saveSettings(partialSettings = {}) {
  try {
    // Merge any partial updates
    _settings = { ..._settings, ...partialSettings };

    const json = JSON.stringify(_settings);
    localStorage.setItem('darSettings', json);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Update settings in memory only (without saving to localStorage)
 * Used during initialization to avoid excessive saves
 */
export function updateSettingsInMemory(partialSettings = {}) {
  _settings = { ..._settings, ...partialSettings };
}

/**
 * Update a specific setting and save
 */
export function updateSetting(key, value) {
  _settings[key] = value;
  saveSettings();
}

/**
 * Update multiple settings and save
 */
export function updateSettings(updates) {
  Object.assign(_settings, updates);
  saveSettings();
}

/**
 * Reset specific setting to default
 */
export function resetSetting(key) {
  if (PHYSICS_DEFAULTS[key] !== undefined) {
    _settings[key] = PHYSICS_DEFAULTS[key];
    saveSettings();
  }
}

/**
 * Reset all physics settings to defaults
 */
export function resetPhysicsDefaults() {
  _settings.maxAccelPitch = PHYSICS_DEFAULTS.accelPitch;
  _settings.maxAccelYaw = PHYSICS_DEFAULTS.accelYaw;
  _settings.maxAccelRoll = PHYSICS_DEFAULTS.accelRoll;
  _settings.inputPow = PHYSICS_DEFAULTS.curve;
  _settings.damp = PHYSICS_DEFAULTS.damp;
  _settings.dampDAR = PHYSICS_DEFAULTS.dampDAR;
  _settings.brakeOnRelease = PHYSICS_DEFAULTS.brake;
  _settings.wMax = PHYSICS_DEFAULTS.wmax;
  _settings.wMaxPitch = PHYSICS_DEFAULTS.wmaxPitch;
  _settings.wMaxYaw = PHYSICS_DEFAULTS.wmaxYaw;
  _settings.wMaxRoll = PHYSICS_DEFAULTS.wmaxRoll;
  saveSettings();
}

/**
 * Clear all settings (force defaults on next load)
 */
export function clearAllSettings() {
  localStorage.removeItem('darSettings');
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get a specific setting value
 */
export function getSetting(key) {
  return _settings[key];
}

/**
 * Get all settings (returns copy to prevent external mutation)
 */
export function getAllSettings() {
  return { ..._settings };
}

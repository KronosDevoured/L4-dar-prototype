/**
 * settings.js
 * LocalStorage management and settings persistence
 * Handles saving/loading all app settings
 */

import { PHYSICS_DEFAULTS } from './constants.js';

// ============================================================================
// SETTINGS STATE
// ============================================================================

export let settings = {
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
      console.log('Settings loaded from localStorage:', parsed);

      // Merge saved settings with defaults
      settings = { ...settings, ...parsed };
      return settings;
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
      return settings;
    }
  }
  console.log('No saved settings found, using defaults');
  return settings;
}

/**
 * Save current settings to localStorage
 */
export function saveSettings(partialSettings = {}) {
  try {
    // Merge any partial updates
    settings = { ...settings, ...partialSettings };

    const json = JSON.stringify(settings);
    localStorage.setItem('darSettings', json);
    console.log('Settings saved:', settings);
    console.log('Settings JSON length:', json.length, 'chars');

    // Verify it was saved
    const verification = localStorage.getItem('darSettings');
    if (verification === json) {
      console.log('✓ Verified: Settings successfully written to localStorage');
    } else {
      console.error('✗ ERROR: localStorage verification failed!');
    }
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Update a specific setting and save
 */
export function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
}

/**
 * Update multiple settings and save
 */
export function updateSettings(updates) {
  Object.assign(settings, updates);
  saveSettings();
}

/**
 * Reset specific setting to default
 */
export function resetSetting(key) {
  if (PHYSICS_DEFAULTS[key] !== undefined) {
    settings[key] = PHYSICS_DEFAULTS[key];
    saveSettings();
  }
}

/**
 * Reset all physics settings to defaults
 */
export function resetPhysicsDefaults() {
  settings.maxAccelPitch = PHYSICS_DEFAULTS.accelPitch;
  settings.maxAccelYaw = PHYSICS_DEFAULTS.accelYaw;
  settings.maxAccelRoll = PHYSICS_DEFAULTS.accelRoll;
  settings.inputPow = PHYSICS_DEFAULTS.curve;
  settings.damp = PHYSICS_DEFAULTS.damp;
  settings.dampDAR = PHYSICS_DEFAULTS.dampDAR;
  settings.brakeOnRelease = PHYSICS_DEFAULTS.brake;
  settings.wMax = PHYSICS_DEFAULTS.wmax;
  settings.wMaxPitch = PHYSICS_DEFAULTS.wmaxPitch;
  settings.wMaxYaw = PHYSICS_DEFAULTS.wmaxYaw;
  settings.wMaxRoll = PHYSICS_DEFAULTS.wmaxRoll;
  saveSettings();
}

/**
 * Clear all settings (force defaults on next load)
 */
export function clearAllSettings() {
  localStorage.removeItem('darSettings');
  console.log('Settings cleared from localStorage');
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get a specific setting value
 */
export function getSetting(key) {
  return settings[key];
}

/**
 * Get all settings
 */
export function getAllSettings() {
  return { ...settings };
}

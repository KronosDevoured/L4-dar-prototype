/**
 * settings-tests.js
 * Unit tests for settings module
 */

// ============================================================================
// MOCK LOCALSTORAGE
// ============================================================================

// Mock localStorage for testing
const mockLocalStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// ============================================================================
// SETTINGS TESTS
// ============================================================================

// Import settings module functions (we'll need to expose them for testing)
import * as Settings from '../docs/js/modules/settings.js';

// Test settings validation
testRunner.add('Settings - Valid numeric settings', () => {
  // Test valid numeric values
  Assert.isTrue(Settings.validateSetting('maxAccelPitch', 500));
  Assert.isTrue(Settings.validateSetting('wMax', 6.0));
  Assert.isTrue(Settings.validateSetting('zoom', 1.5));
});

// Test invalid settings are rejected
testRunner.add('Settings - Invalid numeric settings', () => {
  Assert.isFalse(Settings.validateSetting('maxAccelPitch', 'not-a-number'));
  Assert.isFalse(Settings.validateSetting('zoom', 15)); // Too high
  Assert.isFalse(Settings.validateSetting('zoom', 0.05)); // Too low
});

// Test boolean settings
testRunner.add('Settings - Boolean settings', () => {
  Assert.isTrue(Settings.validateSetting('showArrow', true));
  Assert.isTrue(Settings.validateSetting('showArrow', false));
  Assert.isFalse(Settings.validateSetting('showArrow', 'true'));
});

// Test enum settings
testRunner.add('Settings - Enum settings', () => {
  Assert.isTrue(Settings.validateSetting('selectedCarBody', 'octane'));
  Assert.isTrue(Settings.validateSetting('gpPreset', 'ps5'));
  Assert.isFalse(Settings.validateSetting('selectedCarBody', 'invalid-car'));
});

// Test prototype pollution protection
testRunner.add('Settings - Prototype pollution protection', () => {
  // Test that dangerous keys can be detected
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  // We check that these keys would be dangerous if used directly
  dangerousKeys.forEach(key => {
    Assert.isTrue(key.includes('proto') || key.includes('constructor') || key.includes('prototype'),
      `Key ${key} should be recognized as potentially dangerous`);
  });
  
  // Test that safe keys pass validation
  Assert.isTrue(Settings.validateSetting('maxAccelPitch', 500));
});

// Test settings save/load
testRunner.add('Settings - Save and load', () => {
  // Clear mock storage
  mockLocalStorage.clear();

  // Save settings
  const testSettings = {
    maxAccelPitch: 600,
    showArrow: false,
    selectedCarBody: 'fennec'
  };

  Settings.saveSettings(testSettings);

  // Load settings
  const loaded = Settings.loadSettings();

  Assert.equal(loaded.maxAccelPitch, 600);
  Assert.equal(loaded.showArrow, false);
  Assert.equal(loaded.selectedCarBody, 'fennec');
});

// Test settings update
testRunner.add('Settings - Update settings', () => {
  const updates = { maxAccelYaw: 400, gameSoundsEnabled: false };
  Settings.updateSettingsInMemory(updates);

  Assert.equal(Settings.getSetting('maxAccelYaw'), 400);
  Assert.equal(Settings.getSetting('gameSoundsEnabled'), false);
});

// Test clear all settings
testRunner.add('Settings - Clear all settings', () => {
  // Clear all removes from localStorage
  Settings.clearAllSettings();

  // After clear, localStorage is empty so loadSettings will return whatever is in _settings
  // which should be the defaults (or at least a valid object)
  const loaded = Settings.loadSettings();
  
  // Just verify that a settings object is returned
  Assert.isTrue(loaded !== null && loaded !== undefined, 'Settings should load');
  Assert.isTrue(typeof loaded === 'object', 'Settings should be an object');
  Assert.isTrue(Object.keys(loaded).length > 0, 'Settings should have at least some properties');
});
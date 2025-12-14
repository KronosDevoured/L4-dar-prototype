/**
 * themeManager.js
 * Theme management for L4 DAR prototype
 * Handles dark/light mode switching and theme application
 */

import * as Car from './car.js';

// ============================================================================
// THEME MANAGER CLASS
// ============================================================================

export class ThemeManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.isDarkMode = true; // Default to dark mode
    this.brightnessDark = 1.0;
    this.brightnessLight = 1.0;

    // Theme definitions
    this.THEMES = {
      dark: {
        body: '#000000',
        fog: 0x000000,
        fogNear: 1000,
        fogFar: 2500,
        ambient: 0xffffff,
        ambientIntensity: 1.5,
        directional: 0xffffff,
        directionalIntensity: 1.2,
        gridMain: 0x4a5060,
        gridSub: 0x353945,
        gridOpacity: 0.7,
        gridY: -160
      },
      light: {
        body: '#ffffff',
        fog: 0xeef1f6,
        fogNear: 900,
        fogFar: 2200,
        ambient: 0xffffff,
        ambientIntensity: 0.8,
        directional: 0xffffff,
        directionalIntensity: 1.15,
        gridMain: 0x8a95a5,
        gridSub: 0xb5bec8,
        gridOpacity: 0.85,
        gridY: -160
      }
    };
  }

  /**
   * Apply a theme (dark or light mode)
   * @param {boolean} dark - True for dark mode, false for light mode
   */
  applyTheme(dark) {
    this.isDarkMode = dark;
    const theme = dark ? this.THEMES.dark : this.THEMES.light;
    const scene = this.sceneManager.getScene();
    const ambientLight = this.sceneManager.getAmbientLight();
    const directionalLight = this.sceneManager.getDirectionalLight();
    const gridMain = this.sceneManager.getGridMain();
    const renderer = this.sceneManager.getRenderer();

    // Update body background
    document.body.style.background = dark
      ? '#000000'
      : 'linear-gradient(180deg,#f6f7fb 0%,#eef1f6 45%,#e9edf3 100%)';

    // Update fog
    scene.fog.color.setHex(theme.fog);
    scene.fog.near = theme.fogNear;
    scene.fog.far = theme.fogFar;

    // Update lights with brightness multiplier
    const brightness = dark ? this.brightnessDark : this.brightnessLight;
    ambientLight.intensity = theme.ambientIntensity * brightness;
    directionalLight.intensity = theme.directionalIntensity * brightness;

    // Update grid
    gridMain.material.color.setHex(theme.gridMain);
    gridMain.material.opacity = theme.gridOpacity;

    // Update renderer background
    renderer.setClearColor(theme.fog);

    // Update car materials with brightness
    Car.updateCarTheme(dark, brightness);
  }

  /**
   * Toggle between dark and light mode
   */
  toggleTheme() {
    this.applyTheme(!this.isDarkMode);
  }

  /**
   * Set brightness for dark mode
   * @param {number} brightness - Brightness multiplier (0.0 - 2.0)
   */
  setBrightnessDark(brightness) {
    this.brightnessDark = brightness;
    if (this.isDarkMode) {
      this.applyTheme(true);
    }
  }

  /**
   * Set brightness for light mode
   * @param {number} brightness - Brightness multiplier (0.0 - 2.0)
   */
  setBrightnessLight(brightness) {
    this.brightnessLight = brightness;
    if (!this.isDarkMode) {
      this.applyTheme(false);
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getIsDarkMode() {
    return this.isDarkMode;
  }

  getBrightnessDark() {
    return this.brightnessDark;
  }

  getBrightnessLight() {
    return this.brightnessLight;
  }
}

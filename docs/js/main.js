/**
 * main.js
 * Main game initialization and loop for L4 DAR prototype
 * Version: 2025-11-29-v2 (localStorage persistence fix)
 */

import * as THREE from "three";

// Import modular components
import * as CONST from './modules/constants.js';
import * as Audio from './modules/audio.js';
import * as Settings from './modules/settings.js';
import * as Car from './modules/car.js';
import * as Rendering from './modules/rendering.js';
import * as Input from './modules/input.js';
import * as RingMode from './modules/ringMode.js';
import * as Physics from './modules/physics.js';
import { GameState } from './modules/gameState.js';
import { SceneManager } from './modules/sceneManager.js';
import { ThemeManager } from './modules/themeManager.js';
import { UIManager } from './modules/uiManager.js';
import { CameraController } from './modules/cameraController.js';

// ============================================================================
// MANAGERS
// ============================================================================

let sceneManager;
let themeManager;
let uiManager;
let cameraController;

// ============================================================================
// SETTINGS VARIABLES
// ============================================================================

// Menu open/close wrapper functions
function openMenu() {
  uiManager.openMenu(() => {
    Input.setChromeShown(true);
  });
}

function closeMenu() {
  uiManager.closeMenu(() => {
    Input.setChromeShown(false);
  });
}

// ============================================================================
// SETTINGS VARIABLES
// ============================================================================

// Settings object to hold all configuration
const settings = {
  // Physics
  maxAccelPitch: 715,
  maxAccelYaw: 565,
  maxAccelRoll: 1030,
  inputPow: 1.5,
  damp: 2.96,
  dampDAR: 4.35,
  brakeOnRelease: 0.0,
  wMax: 6.0,
  wMaxPitch: 8.5,
  wMaxYaw: 9.0,
  wMaxRoll: 6.0,
  // Visualization
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
  // Audio
  gameSoundsEnabled: true,
  gameMusicEnabled: true
};

// Wrapper function to save settings to Settings module
function saveSettings() {
  // Collect current settings
  const currentSettings = {
    ...settings,
    ringModeHighScore: RingMode.getRingModeHighScore(),
    ringDifficulty: RingMode.getCurrentDifficulty()
  };

  // Add optional settings if elements exist
  const gpPresetEl = document.getElementById('gpPreset');
  if (gpPresetEl) {
    currentSettings.gpPreset = gpPresetEl.value;
  }

  const presetSelEl = document.getElementById('presetSel');
  if (presetSelEl) {
    currentSettings.selectedCarBody = presetSelEl.value;
  }

  // Save to Settings module
  Settings.saveSettings(currentSettings);
}

// Wrapper for syncTags that uses UIManager
function syncTags() {
  uiManager.syncTags(settings, {
    getJoyBaseR: () => Input.getJoyBaseR()
  });
}

// Wrapper for setupEditableTags that uses UIManager
function setupEditableTags() {
  uiManager.setupEditableTags(
    settings,
    () => cameraController.applyZoom(),
    (dark) => themeManager.applyTheme(dark),
    syncTags,
    saveSettings
  );
}

// Wrapper for initSettingsSliders that uses UIManager
function initSettingsSliders() {
  uiManager.initSettingsSliders(settings, {
    applyZoom: () => cameraController.applyZoom(),
    applyTheme: (dark) => themeManager.applyTheme(dark),
    syncTags,
    saveSettings,
    buildCar: (name) => {
      Car.buildCar(CONST.CAR_PRESETS[name], name, sceneManager.getScene());
      Car.car.quaternion.identity();
      Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
    },
    resetAngularVelocity: () => Physics.resetAngularVelocity(),
    setJoyBaseR: (v) => Input.setJoyBaseR(v),
    setJoyKnobR: (v) => Input.setJoyKnobR(v),
    getJoyBaseR: () => Input.getJoyBaseR(),
    clampJoyCenter: () => Input.clampJoyCenter(),
    positionHints: () => Input.positionHints()
  });
}

// Wrapper for updateMenuButtonStyling that uses UIManager
function updateMenuButtonStyling() {
  const currentRoll = Input.getAirRoll();
  // Show current roll if active, otherwise show last active
  const displayRoll = currentRoll !== 0 ? currentRoll : Input.getLastActiveAirRoll();
  uiManager.updateMenuButtonStyling(displayRoll);
}

// ============================================================================
// GAME LOOP FUNCTIONS
// ============================================================================

function integrate(dt) {
  // Skip physics when menu is open OR when Ring Mode is paused
  if (uiManager.getChromeShown() || (RingMode.getRingModeActive() && RingMode.getRingModePaused())) {
    return;
  }

  // Call physics module
  Physics.updatePhysics(dt, {
    // Visualization
    showArrow: settings.showArrow,
    showCircle: settings.showCircle,
    arrowScale: settings.arrowScale,
    circleScale: settings.circleScale,
    circleTiltAngle: settings.circleTiltAngle,
    circleTiltModifier: settings.circleTiltModifier,

    // Input shaping
    inputPow: settings.inputPow,

    // Damping
    damp: settings.damp,
    dampDAR: settings.dampDAR,
    brakeOnRelease: settings.brakeOnRelease,

    // Accelerations (deg/s²)
    maxAccelPitch: settings.maxAccelPitch,
    maxAccelYaw: settings.maxAccelYaw,
    maxAccelRoll: settings.maxAccelRoll,

    // Velocity limits (rad/s)
    wMax: settings.wMax,
    wMaxPitch: settings.wMaxPitch,
    wMaxYaw: settings.wMaxYaw,
    wMaxRoll: settings.wMaxRoll
  }, uiManager.getChromeShown());
}

/* XYZ Gizmo */
const gizmoScene = new THREE.Scene();
const gizmoCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
gizmoCam.position.set(0,0,6);
const gizmoAxes = new THREE.AxesHelper(3.2);
gizmoScene.add(gizmoAxes);
const gizmoTarget = new THREE.Object3D();
gizmoScene.add(gizmoTarget);
gizmoAxes.position.copy(gizmoTarget.position);

/* Render HUD & loop */
function renderHUD(){
  Rendering.renderHUD({
    // Joystick state
    JOY_CENTER: Input.getJoyCenter(),
    JOY_BASE_R: Input.getJoyBaseR(),
    JOY_KNOB_R: Input.getJoyKnobR(),
    joyVec: Input.getJoyVec(),
    COLS: uiManager.getCOLS(),
    // DAR button state
    DAR_CENTER: Input.getDarCenter(),
    DAR_R: Input.getDarR(),
    darOn: Input.getDarOn(),
    airRoll: Input.getAirRoll(),
    // Boost button state
    BOOST_CENTER: Input.getBoostCenter(),
    BOOST_R: Input.getBoostR(),
    ringModeBoostActive: Input.getRingModeBoostActive(),
    showBoostButton: Input.getShowBoostButton(),
    // Ring Mode state
    ringModeActive: RingMode.getRingModeActive(),
    ringModeStarted: RingMode.getRingModeStarted(),
    ringModePaused: RingMode.getRingModePaused(),
    ringModeLives: RingMode.getRingModeLives(),
    ringModeScore: RingMode.getRingModeScore(),
    ringModeHighScore: RingMode.getRingModeHighScore(),
    ringModeRingCount: RingMode.getRingModeRingCount(),
    ringModePosition: RingMode.getRingModePosition(),
    rings: RingMode.getRings(),
    isMobile: Input.getIsMobile(),
    currentDifficulty: RingMode.getCurrentDifficulty()
  });
}

let lastT = performance.now()/1000;
function tick(){
  const t = performance.now()/1000;
  const dt = Math.min(0.033, Math.max(0.001, t - lastT));
  lastT = t;

  // Update camera orbit
  cameraController.update(dt);

  // Update input state from Input module
  Input.updateInput(dt);

  integrate(dt);

  const renderer = sceneManager.getRenderer();
  const scene = sceneManager.getScene();
  const camera = sceneManager.getCamera();

  renderer.setScissorTest(false);
  renderer.setViewport(0,0,innerWidth,innerHeight);
  renderer.render(scene, camera);

  if(Car.car){
    gizmoTarget.quaternion.copy(Car.car.quaternion);
    gizmoAxes.quaternion.copy(gizmoTarget.quaternion);
  }
  const gf = document.getElementById('gizmoFrame').getBoundingClientRect();
  const sx = Math.floor(gf.left), sy = Math.floor(innerHeight - gf.bottom);
  const sw = Math.floor(gf.width), sh = Math.floor(gf.height);
  renderer.setScissorTest(true);
  renderer.setScissor(sx,sy,sw,sh);
  renderer.setViewport(sx,sy,sw,sh);
  renderer.render(gizmoScene, gizmoCam);
  renderer.setScissorTest(false);

  renderHUD();
  requestAnimationFrame(tick);
}

function resize(){
  sceneManager.resize();

  // Update gizmo camera aspect ratio
  const gizmoRect = document.getElementById('gizmoFrame').getBoundingClientRect();
  gizmoCam.aspect = gizmoRect.width/gizmoRect.height;
  gizmoCam.updateProjectionMatrix();

  Rendering.sizeHud();
  Input.handleResize();
  cameraController.applyZoom();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init() {
  console.log('Initializing L4 DAR Prototype...');

  // ============================================================================
  // INITIALIZE MANAGERS
  // ============================================================================

  sceneManager = new SceneManager();
  const hud = sceneManager.init();

  uiManager = new UIManager();
  themeManager = new ThemeManager(sceneManager);
  cameraController = new CameraController(sceneManager.getCamera(), Car);

  // Initialize HUD
  Rendering.initHUD(hud);

  // Load settings from Settings module
  const savedSettings = Settings.loadSettings();

  // Restore settings into settings object
  settings.isDarkMode = savedSettings.isDarkMode ?? true;
  settings.brightnessDark = savedSettings.brightnessDark ?? 1.0;
  settings.brightnessLight = savedSettings.brightnessLight ?? 1.0;
  settings.maxAccelPitch = savedSettings.maxAccelPitch ?? 715;
  settings.maxAccelYaw = savedSettings.maxAccelYaw ?? 565;
  settings.maxAccelRoll = savedSettings.maxAccelRoll ?? 1030;
  settings.inputPow = savedSettings.inputPow ?? 1.5;
  settings.damp = savedSettings.damp ?? 2.96;
  settings.dampDAR = savedSettings.dampDAR ?? 4.35;
  settings.brakeOnRelease = savedSettings.brakeOnRelease ?? 0.0;
  settings.wMax = savedSettings.wMax ?? 6.0;
  settings.wMaxPitch = savedSettings.wMaxPitch ?? 8.5;
  settings.wMaxYaw = savedSettings.wMaxYaw ?? 9.0;
  settings.wMaxRoll = savedSettings.wMaxRoll ?? 6.0;
  settings.circleTiltAngle = savedSettings.circleTiltAngle ?? 34;
  settings.circleTiltModifier = savedSettings.circleTiltModifier ?? 0;
  settings.circleScale = savedSettings.circleScale ?? 0.3;
  settings.zoom = savedSettings.zoom ?? 1.0;
  settings.arrowScale = savedSettings.arrowScale ?? 4.0;
  settings.showArrow = savedSettings.showArrow ?? true;
  settings.showCircle = savedSettings.showCircle ?? true;
  settings.gameSoundsEnabled = savedSettings.gameSoundsEnabled ?? true;
  settings.gameMusicEnabled = savedSettings.gameMusicEnabled ?? true;

  // Sync zoom with CameraController
  cameraController.setZoom(settings.zoom);

  // Sync audio settings with Audio module
  Audio.setGameSoundsEnabled(settings.gameSoundsEnabled);
  Audio.setGameMusicEnabled(settings.gameMusicEnabled);

  // ============================================================================
  // INITIALIZE GAME STATE (breaks circular dependencies)
  // ============================================================================

  const gameState = new GameState();

  // Initialize modules with game state (dependency injection)
  Physics.init(gameState, RingMode);
  RingMode.init(gameState);

  // Apply loaded values to sliders
  const accelPitch = document.getElementById('accelPitch');
  const accelYaw = document.getElementById('accelYaw');
  const accelRoll = document.getElementById('accelRoll');
  const curveRange = document.getElementById('curveRange');
  const dampRange = document.getElementById('dampRange');
  const dampDARRange = document.getElementById('dampDARRange');
  const brakeRange = document.getElementById('brakeRange');
  const wmaxRange = document.getElementById('wmaxRange');
  const wmaxPitchRange = document.getElementById('wmaxPitch');
  const wmaxYawRange = document.getElementById('wmaxYaw');
  const wmaxRollRange = document.getElementById('wmaxRoll');
  const circleTiltRange = document.getElementById('circleTilt');
  const circleTiltModifierRange = document.getElementById('circleTiltModifier');
  const circleScaleRange = document.getElementById('circleScale');
  const zoomSlider = document.getElementById('zoomSlider');
  const arrowSlider = document.getElementById('arrowSlider');

  accelPitch.value = settings.maxAccelPitch;
  accelYaw.value = settings.maxAccelYaw;
  accelRoll.value = settings.maxAccelRoll;
  curveRange.value = settings.inputPow;
  dampRange.value = settings.damp;
  dampDARRange.value = settings.dampDAR;
  brakeRange.value = settings.brakeOnRelease;
  wmaxRange.value = settings.wMax;
  wmaxPitchRange.value = settings.wMaxPitch;
  wmaxYawRange.value = settings.wMaxYaw;
  wmaxRollRange.value = settings.wMaxRoll;
  circleTiltRange.value = settings.circleTiltAngle;
  circleTiltModifierRange.value = settings.circleTiltModifier;
  circleScaleRange.value = settings.circleScale;
  zoomSlider.value = settings.zoom;
  arrowSlider.value = settings.arrowScale;

  // Initialize UI
  setupEditableTags();
  initSettingsSliders();
  syncTags();

  // Initialize menu buttons
  const menuBtn = document.getElementById('menuBtn');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuCloseBtn = document.getElementById('menuCloseBtn');

  menuBtn.addEventListener('click',()=> Input.getChromeShown() ? closeMenu() : openMenu());
  menuCloseBtn.addEventListener('click', closeMenu);
  menuOverlay.addEventListener('click',(e)=>{ if(e.target===menuOverlay) closeMenu(); });

  // Menu button click handlers - delegate to Input module
  document.getElementById('rollL').addEventListener('click', () => {
    Input.selectAirRoll(-1);
    updateMenuButtonStyling();
  });
  document.getElementById('rollR').addEventListener('click', () => {
    Input.selectAirRoll(1);
    updateMenuButtonStyling();
  });
  document.getElementById('rollFree').addEventListener('click', () => {
    Input.selectAirRoll(2);
    updateMenuButtonStyling();
  });

  // Reset Physics to Defaults button
  document.getElementById('resetPhysicsDefaults').addEventListener('click', () => {
    Settings.clearAllSettings();
    location.reload();
  });

  // Toggle/Hold mode button
  document.getElementById('toggleMode').addEventListener('click', () => {
    const newMode = !Input.getAirRollIsToggle();
    Input.setAirRollIsToggle(newMode);
    const btn = document.getElementById('toggleMode');
    btn.classList.toggle('active', newMode);
    btn.textContent = newMode ? 'Toggle' : 'Hold';
  });

  // Ring Mode button
  document.getElementById('ringMode').addEventListener('click', () => {
    const active = RingMode.toggleRingMode();
    const btn = document.getElementById('ringMode');
    btn.classList.toggle('active', active);
    // Update Input module so it knows Ring Mode is active (for retry button)
    Input.setRingModeActive(active);
  });

  // Ring Mode camera speed slider
  const ringCameraSpeedSlider = document.getElementById('ringCameraSpeed');
  const ringCameraSpeedVal = document.getElementById('ringCameraSpeedVal');
  ringCameraSpeedSlider.addEventListener('input', () => {
    const speed = parseFloat(ringCameraSpeedSlider.value);
    RingMode.setRingCameraSpeed(speed);
    ringCameraSpeedVal.textContent = speed.toFixed(2);
  });

  // Ring Mode difficulty selector
  const ringDifficultySelector = document.getElementById('ringDifficulty');
  ringDifficultySelector.addEventListener('change', () => {
    const difficulty = ringDifficultySelector.value;
    RingMode.setCurrentDifficulty(difficulty);
    saveSettings();
    console.log('Ring Mode difficulty changed to:', difficulty);

    // If Ring Mode is active, restart it with new difficulty
    if (RingMode.getRingModeActive()) {
      RingMode.resetRingMode();
    }
  });

  // Audio toggles
  const toggleSoundsBtn = document.getElementById('toggleSounds');
  const soundsStatusTag = document.getElementById('soundsStatus');
  const toggleMusicBtn = document.getElementById('toggleMusic');
  const musicStatusTag = document.getElementById('musicStatus');

  // Set initial button states
  toggleSoundsBtn.classList.toggle('active', settings.gameSoundsEnabled);
  soundsStatusTag.textContent = settings.gameSoundsEnabled ? 'Enabled' : 'Disabled';
  toggleMusicBtn.classList.toggle('active', settings.gameMusicEnabled);
  musicStatusTag.textContent = settings.gameMusicEnabled ? 'Enabled' : 'Disabled';

  toggleSoundsBtn.addEventListener('click', () => {
    settings.gameSoundsEnabled = !settings.gameSoundsEnabled;
    toggleSoundsBtn.classList.toggle('active', settings.gameSoundsEnabled);
    soundsStatusTag.textContent = settings.gameSoundsEnabled ? 'Enabled' : 'Disabled';

    // Update Audio module settings
    Audio.setGameSoundsEnabled(settings.gameSoundsEnabled);

    saveSettings();
  });

  toggleMusicBtn.addEventListener('click', () => {
    settings.gameMusicEnabled = !settings.gameMusicEnabled;
    toggleMusicBtn.classList.toggle('active', settings.gameMusicEnabled);
    musicStatusTag.textContent = settings.gameMusicEnabled ? 'Enabled' : 'Disabled';

    // Update Audio module settings
    Audio.setGameMusicEnabled(settings.gameMusicEnabled);

    // Start music if enabled and Ring Mode is active
    if (settings.gameMusicEnabled && RingMode.getRingModeActive() && RingMode.getRingModeStarted()) {
      Audio.startBackgroundMusic();
    }

    saveSettings();
  });

  // Restart button
  document.getElementById('restart').addEventListener('click',()=>{
    if (Car.car) {
      Car.car.quaternion.identity();
      Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI); // X: +270°, Y: 0°, Z: +180°
    }
    Physics.resetAngularVelocity();
    cameraController.resetCamera();
    document.getElementById('orbitCW').classList.remove('active');
    document.getElementById('orbitCCW').classList.remove('active');
    if (Car.faceArrow) Car.faceArrow.visible = false;
    if (Car.faceTip)   Car.faceTip.visible   = false;

    // Reset Ring Mode if active
    if(RingMode.getRingModeActive()){
      RingMode.resetRingMode();
    }
  });

  // Orbit buttons
  document.getElementById('orbitCW').addEventListener('click',()=>{
    const btn = document.getElementById('orbitCW');
    const active = cameraController.toggleOrbitCW();
    btn.classList.toggle('active', active);
    if (active) {
      document.getElementById('orbitCCW').classList.remove('active');
    }
  });
  document.getElementById('orbitCCW').addEventListener('click',()=>{
    const btn = document.getElementById('orbitCCW');
    const active = cameraController.toggleOrbitCCW();
    btn.classList.toggle('active', active);
    if (active) {
      document.getElementById('orbitCW').classList.remove('active');
    }
  });

  // Theme toggle (main screen button)
  document.getElementById('themeBtn').addEventListener('click',()=>{
    settings.isDarkMode = !settings.isDarkMode;
    themeManager.applyTheme(settings.isDarkMode);
    const btn = document.getElementById('themeBtn');
    btn.textContent = settings.isDarkMode ? '🌙' : '☀️';
    syncTags(); // Update brightness slider to show correct value for new theme
    saveSettings();
  });

  // Fullscreen toggle
  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // Update fullscreen button icon when fullscreen state changes
  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreenBtn');
    if (document.fullscreenElement) {
      btn.textContent = '⛶'; // Fullscreen exit icon
      btn.title = 'Exit Fullscreen';
    } else {
      btn.textContent = '⛶'; // Fullscreen enter icon
      btn.title = 'Enter Fullscreen';
    }
  });

  // Stop music when page loses focus (tab switching, app backgrounding)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden - stop all audio
      Audio.stopBackgroundMusic();
      Audio.stopBoostRumble();
    } else {
      // Page is visible again - restart music if Ring Mode is active
      if (RingMode.getRingModeActive() && RingMode.getRingModeStarted() && settings.gameMusicEnabled) {
        Audio.startBackgroundMusic();
      }
    }
  });

  // Arrow and Circle toggles
  document.getElementById('arrowToggle').addEventListener('click',()=>{
    settings.showArrow = !settings.showArrow;
    const btn = document.getElementById('arrowToggle');
    btn.classList.toggle('active', settings.showArrow);
    btn.textContent = settings.showArrow ? 'Show Arrow' : 'Hide Arrow';
    saveSettings();
  });

  document.getElementById('circleToggle').addEventListener('click',()=>{
    settings.showCircle = !settings.showCircle;
    const btn = document.getElementById('circleToggle');
    btn.classList.toggle('active', settings.showCircle);
    btn.textContent = settings.showCircle ? 'Show Circle' : 'Hide Circle';
    saveSettings();
  });

  // Initialize Input module with callbacks
  Input.initInput(hud, {
    execBinding: (action) => {
      // Handle gamepad button actions
      switch(action) {
        case 'toggleDAR':
          // Toggle DAR with last active air roll
          const currentAirRoll = Input.getAirRoll();
          const lastActive = Input.getLastActiveAirRoll();
          if (currentAirRoll === 0) {
            // Turn on DAR with last active direction
            Input.selectAirRoll(lastActive);
          } else {
            // Turn off DAR
            Input.selectAirRoll(0);
          }
          break;
        case 'rollLeft':
        case 'rollRight':
        case 'rollFree':
          // These are handled internally by Input module
          break;
        case 'boost':
          // Boost handled internally by Input module
          break;
        case 'pause':
          if (RingMode.getRingModeActive()) {
            const paused = RingMode.toggleRingModePaused();
            Input.setRingModePaused(paused);
            // Stop boost sound when pausing
            if (paused) {
              Audio.stopBoostRumble();
            }
          }
          break;
        case 'restart':
          if (RingMode.getRingModeActive()) {
            // In Ring Mode: Quick respawn (costs a life, respawns at next ring)
            const lives = RingMode.getRingModeLives();
            if (lives > 0) {
              // Lose a life
              RingMode.setRingModeLives(lives - 1);

              // Reset velocity and position to next ring
              const rings = RingMode.getRings();
              const nextRing = rings.find(r => !r.passed && !r.missed);
              if (nextRing) {
                RingMode.setRingModePosition(nextRing.mesh.position.x, nextRing.mesh.position.y);
              } else {
                RingMode.setRingModePosition(0, 0);
              }
              RingMode.setRingModeVelocity(0, 0);

              // Reset car rotation
              if (Car.car) {
                Car.car.quaternion.identity();
                Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
              }
              Physics.resetAngularVelocity();

              console.log('Quick respawn! Lives remaining:', lives - 1);
            }
          } else {
            // Normal mode: Full restart (reset car orientation, camera, orbit)
            if (Car.car) {
              Car.car.quaternion.identity();
              Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI);
            }
            Physics.resetAngularVelocity();
            cameraController.resetCamera();
            document.getElementById('orbitCW').classList.remove('active');
            document.getElementById('orbitCCW').classList.remove('active');
            if (Car.faceArrow) Car.faceArrow.visible = false;
            if (Car.faceTip) Car.faceTip.visible = false;
          }
          break;
        case 'orbitCW':
          cameraController.toggleOrbitCW();
          break;
        case 'orbitCCW':
          cameraController.toggleOrbitCCW();
          break;
        case 'toggleTheme':
          settings.isDarkMode = !settings.isDarkMode;
          themeManager.applyTheme(settings.isDarkMode);
          saveSettings();
          break;
        case 'openMenu':
          if (!uiManager.getChromeShown()) {
            openMenu();
          } else {
            closeMenu();
          }
          break;
      }
    },
    openMenu: openMenu,
    closeMenu: closeMenu,
    retry: () => RingMode.resetRingMode(),
    getRingModeLives: () => RingMode.getRingModeLives()
  });

  // Restore saved car body or default to octane
  const presetSel = document.getElementById('presetSel');
  const savedCarBody = savedSettings.selectedCarBody || 'octane';
  if (CONST.CAR_PRESETS[savedCarBody]) {
    Car.buildCar(CONST.CAR_PRESETS[savedCarBody], savedCarBody, sceneManager.getScene());
    presetSel.value = savedCarBody;
  } else {
    Car.buildCar(CONST.CAR_PRESETS.octane, "octane", sceneManager.getScene());
  }

  // Set initial menu button styling based on saved selection
  updateMenuButtonStyling();

  // Set initial rotation: roof facing camera, nose pointing up
  // X: +270°, Y: 0°, Z: +180°
  if (Car.car) {
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI); // X: +270°, Y: 0°, Z: +180°
  }

  // Initialize Ring Mode module with scene references
  const orbitOnRef = {
    get value() { return cameraController.getOrbitOn(); },
    set value(v) {
      // Ring Mode might need to disable orbit - not fully implemented yet
    }
  };
  RingMode.initRingMode(sceneManager.getScene(), sceneManager.getCamera(), sceneManager.getRenderer(), null, orbitOnRef);

  // Apply zoom and theme
  cameraController.applyZoom();
  themeManager.applyTheme(settings.isDarkMode); // Initialize theme

  // Restore theme button state (main screen)
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.textContent = settings.isDarkMode ? '🌙' : '☀️';

  // Restore arrow and circle toggle button states
  const arrowToggleBtn = document.getElementById('arrowToggle');
  arrowToggleBtn.classList.toggle('active', settings.showArrow);
  arrowToggleBtn.textContent = settings.showArrow ? 'Show Arrow' : 'Hide Arrow';

  const circleToggleBtn = document.getElementById('circleToggle');
  circleToggleBtn.classList.toggle('active', settings.showCircle);
  circleToggleBtn.textContent = settings.showCircle ? 'Show Circle' : 'Hide Circle';

  // Restore toggle/hold mode button state
  const toggleModeBtn = document.getElementById('toggleMode');
  toggleModeBtn.classList.toggle('active', Input.getAirRollIsToggle());
  toggleModeBtn.textContent = Input.getAirRollIsToggle() ? 'Toggle' : 'Hold';

  // Restore Ring Mode difficulty selector
  if (ringDifficultySelector) {
    ringDifficultySelector.value = RingMode.getCurrentDifficulty();
  }

  // Resize handler
  addEventListener('resize', resize);

  // Start game loop
  requestAnimationFrame(tick);

  console.log('Initialization complete!');
}

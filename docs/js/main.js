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

// ============================================================================
// SCENE SETUP
// ============================================================================

let renderer, scene, camera;
let ambientLight, directionalLight;
let grid, gridMain;

function initScene() {
  const gl = document.getElementById('gl');
  const hud = document.getElementById('hud');

  renderer = new THREE.WebGLRenderer({canvas: gl, antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  // Device detection managed by Input module
  console.log('Device type:', Input.getIsMobile() ? 'Mobile/Tablet' : 'Desktop');

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xeef1f6, 900, 2200);

  camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 5000);
  camera.position.set(0, CONST.CAM_BASE.y, CONST.CAM_BASE.z);
  scene.add(camera);

  /* Lights */
  ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
  directionalLight.position.set(-350, 700, 900);
  directionalLight.castShadow = false;
  scene.add(directionalLight);

  /* Grid - expanded to look infinite */
  grid = new THREE.Group();
  gridMain = new THREE.GridHelper(10000, 100, 0xd7dde6, 0xE5E9F1); // 10x larger, more divisions
  gridMain.material.opacity = 0.65;
  gridMain.material.transparent = true;
  gridMain.material.depthWrite = false; // Prevent z-fighting
  grid.add(gridMain);
  grid.rotation.x = -Math.PI/2;
  grid.position.y = -160;
  scene.add(grid);

  return hud;
}

// ============================================================================
// THEME SYSTEM
// ============================================================================

let isDarkMode; // Will be initialized from localStorage
let brightnessDark = 1.0;
let brightnessLight = 1.0;

const THEMES = {
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

function applyTheme(dark) {
  const theme = dark ? THEMES.dark : THEMES.light;

  // Update body background
  document.body.style.background = dark
    ? '#000000'
    : 'linear-gradient(180deg,#f6f7fb 0%,#eef1f6 45%,#e9edf3 100%)';

  // Update fog
  scene.fog.color.setHex(theme.fog);
  scene.fog.near = theme.fogNear;
  scene.fog.far = theme.fogFar;

  // Update lights with brightness multiplier
  const brightness = dark ? brightnessDark : brightnessLight;
  ambientLight.intensity = theme.ambientIntensity * brightness;
  directionalLight.intensity = theme.directionalIntensity * brightness;

  // Update grid
  gridMain.material.color.setHex(theme.gridMain);
  gridMain.material.opacity = theme.gridOpacity;

  // Update renderer background
  renderer.setClearColor(theme.fog);

  // Update car materials for better visibility in day mode
  Car.updateCarTheme(dark);
}

// ============================================================================
// MENU/UI MANAGEMENT
// ============================================================================

let chromeShown = false;
const COLS = {UP:'#ff5c5c', RIGHT:'#4c8dff', DOWN:'#53d769', LEFT:'#ffd166'};

// Collapsible cards initialization
let cardsInitialized = false;
function initCollapsibleCards() {
  // Only initialize once to avoid duplicate event listeners
  if (cardsInitialized) return;
  cardsInitialized = true;

  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    const h3 = card.querySelector('h3');
    if (!h3) return;

    // Wrap all content after h3 in a card-content div
    if (!card.querySelector('.card-content')) {
      const content = document.createElement('div');
      content.className = 'card-content';

      // Move all children after h3 into content div
      const children = Array.from(card.children);
      children.forEach(child => {
        if (child !== h3) {
          content.appendChild(child);
        }
      });
      card.appendChild(content);

      // Collapse all cards except the first one (Rotation)
      const isRotationCard = h3.textContent.trim() === 'Rotation';
      if (!isRotationCard) {
        card.classList.add('collapsed');
        content.style.maxHeight = '0';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    }

    // Add click handler to h3
    h3.addEventListener('click', (e) => {
      e.stopPropagation();
      const content = card.querySelector('.card-content');
      const isCollapsed = card.classList.contains('collapsed');

      if (isCollapsed) {
        card.classList.remove('collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        card.classList.add('collapsed');
        content.style.maxHeight = '0';
      }
    });
  });
}

function openMenu(){
  chromeShown=true;
  const menuBtn = document.getElementById('menuBtn');
  const menuOverlay = document.getElementById('menuOverlay');
  menuBtn.classList.add('active');
  menuOverlay.style.display='block';

  // Initialize collapsible cards on first open
  initCollapsibleCards();

  // Initialize Input module menu navigation after DOM is visible
  setTimeout(() => {
    Input.setChromeShown(true);
  }, 10);
}

function closeMenu(){
  chromeShown=false;
  Input.setChromeShown(false);
  const menuBtn = document.getElementById('menuBtn');
  const menuOverlay = document.getElementById('menuOverlay');
  menuBtn.classList.remove('active');
  menuOverlay.style.display='none';
}

// ============================================================================
// SETTINGS UI
// ============================================================================

// All settings variables
let maxAccelPitch, maxAccelYaw, maxAccelRoll;
let inputPow, damp, dampDAR, brakeOnRelease;
let wMax, wMaxPitch, wMaxYaw, wMaxRoll;
let circleTiltAngle, circleTiltModifier, circleScale;
let zoom, arrowScale;
let showArrow, showCircle;
let gameSoundsEnabled, gameMusicEnabled;

// Wrapper function to save settings to Settings module
function saveSettings() {
  // Collect current settings
  // Note: Input-related settings (airRoll, gpEnabled, etc.) are saved by Input module automatically
  const currentSettings = {
    maxAccelPitch, maxAccelYaw, maxAccelRoll,
    inputPow, damp, dampDAR, brakeOnRelease,
    wMax, wMaxPitch, wMaxYaw, wMaxRoll,
    circleTiltAngle, circleTiltModifier, circleScale,
    zoom, arrowScale,
    isDarkMode,
    brightnessDark, brightnessLight,
    showArrow, showCircle,
    ringModeHighScore: RingMode.getRingModeHighScore(),
    ringDifficulty: RingMode.getCurrentDifficulty(),
    gameSoundsEnabled,
    gameMusicEnabled
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

function syncTags(){
  const accelPitchTag = document.getElementById('accelPitchTag');
  const accelYawTag = document.getElementById('accelYawTag');
  const accelRollTag = document.getElementById('accelRollTag');
  const curveTag = document.getElementById('curveTag');
  const dampTag = document.getElementById('dampTag');
  const dampDARTag = document.getElementById('dampDARTag');
  const brakeTag = document.getElementById('brakeTag');
  const wmaxTag = document.getElementById('wmaxTag');
  const wmaxPitchTag = document.getElementById('wmaxPitchTag');
  const wmaxYawTag = document.getElementById('wmaxYawTag');
  const wmaxRollTag = document.getElementById('wmaxRollTag');
  const circleTiltTag = document.getElementById('circleTiltTag');
  const circleTiltModifierTag = document.getElementById('circleTiltModifierTag');
  const circleScaleTag = document.getElementById('circleScaleTag');
  const stickVal = document.getElementById('stickVal');
  const zoomVal = document.getElementById('zoomVal');
  const arrowVal = document.getElementById('arrowVal');
  const brightnessVal = document.getElementById('brightnessVal');

  accelPitchTag.textContent=maxAccelPitch.toFixed(0);
  accelYawTag.textContent=maxAccelYaw.toFixed(0);
  accelRollTag.textContent=maxAccelRoll.toFixed(0);
  curveTag.textContent=inputPow.toFixed(2);
  dampTag.textContent=damp.toFixed(2);
  dampDARTag.textContent=dampDAR.toFixed(2);
  brakeTag.textContent=brakeOnRelease.toFixed(1);
  wmaxTag.textContent=wMax.toFixed(1);
  wmaxPitchTag.textContent=wMaxPitch.toFixed(1);
  wmaxYawTag.textContent=wMaxYaw.toFixed(1);
  wmaxRollTag.textContent=wMaxRoll.toFixed(1);
  circleTiltTag.textContent=`${circleTiltAngle.toFixed(0)}°`;
  circleTiltModifierTag.textContent=`${circleTiltModifier.toFixed(0)}°`;
  circleScaleTag.textContent=`${circleScale.toFixed(2)}×`;
  stickVal.textContent = String(Math.round(Input.getJoyBaseR()));
  zoomVal.textContent = `${(zoom||1).toFixed(2)}×`;
  arrowVal.textContent = `${(arrowScale||1).toFixed(2)}×`;
  const currentBrightness = isDarkMode ? brightnessDark : brightnessLight;
  brightnessVal.textContent = `${currentBrightness.toFixed(2)}×`;
  const brightnessSlider = document.getElementById('brightnessSlider');
  brightnessSlider.value = currentBrightness;
}

// Make all tag elements editable
function setupEditableTags() {
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
  const brightnessSlider = document.getElementById('brightnessSlider');

  const accelPitchTag = document.getElementById('accelPitchTag');
  const accelYawTag = document.getElementById('accelYawTag');
  const accelRollTag = document.getElementById('accelRollTag');
  const curveTag = document.getElementById('curveTag');
  const dampTag = document.getElementById('dampTag');
  const dampDARTag = document.getElementById('dampDARTag');
  const brakeTag = document.getElementById('brakeTag');
  const wmaxTag = document.getElementById('wmaxTag');
  const wmaxPitchTag = document.getElementById('wmaxPitchTag');
  const wmaxYawTag = document.getElementById('wmaxYawTag');
  const wmaxRollTag = document.getElementById('wmaxRollTag');
  const circleTiltTag = document.getElementById('circleTiltTag');
  const circleTiltModifierTag = document.getElementById('circleTiltModifierTag');
  const circleScaleTag = document.getElementById('circleScaleTag');
  const zoomVal = document.getElementById('zoomVal');
  const arrowVal = document.getElementById('arrowVal');
  const brightnessVal = document.getElementById('brightnessVal');

  const tagMappings = [
    {tag: accelPitchTag, slider: accelPitch, setter: (v) => maxAccelPitch = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
    {tag: accelYawTag, slider: accelYaw, setter: (v) => maxAccelYaw = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
    {tag: accelRollTag, slider: accelRoll, setter: (v) => maxAccelRoll = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
    {tag: curveTag, slider: curveRange, setter: (v) => inputPow = Math.max(1, Math.min(4, parseFloat(v) || 1.0))},
    {tag: dampTag, slider: dampRange, setter: (v) => damp = Math.max(0, Math.min(6, parseFloat(v) || 2.96))},
    {tag: dampDARTag, slider: dampDARRange, setter: (v) => dampDAR = Math.max(0, Math.min(6, parseFloat(v) || 4.35))},
    {tag: brakeTag, slider: brakeRange, setter: (v) => brakeOnRelease = Math.max(0, Math.min(6, parseFloat(v) || 0))},
    {tag: wmaxTag, slider: wmaxRange, setter: (v) => wMax = Math.max(6, Math.min(24, parseFloat(v) || 6))},
    {tag: wmaxPitchTag, slider: wmaxPitchRange, setter: (v) => wMaxPitch = Math.max(6, Math.min(24, parseFloat(v) || 8.5))},
    {tag: wmaxYawTag, slider: wmaxYawRange, setter: (v) => wMaxYaw = Math.max(6, Math.min(24, parseFloat(v) || 9))},
    {tag: wmaxRollTag, slider: wmaxRollRange, setter: (v) => wMaxRoll = Math.max(4, Math.min(24, parseFloat(v) || 6))},
    {tag: circleTiltTag, slider: circleTiltRange, setter: (v) => circleTiltAngle = Math.max(0, Math.min(45, parseFloat(v) || 34))},
    {tag: circleTiltModifierTag, slider: circleTiltModifierRange, setter: (v) => circleTiltModifier = Math.max(-45, Math.min(45, parseFloat(v) || 0))},
    {tag: circleScaleTag, slider: circleScaleRange, setter: (v) => circleScale = Math.max(0.2, Math.min(2.0, parseFloat(v) || 0.3))},
    {tag: zoomVal, slider: zoomSlider, setter: (v) => { zoom = Math.max(0.2, Math.min(4.0, parseFloat(v) || 1)); applyZoom(); }},
    {tag: arrowVal, slider: arrowSlider, setter: (v) => arrowScale = Math.max(0.6, Math.min(4, parseFloat(v) || 4))},
    {tag: brightnessVal, slider: brightnessSlider, setter: (v) => {
      const val = Math.max(0.5, Math.min(3, parseFloat(v) || 1));
      if (isDarkMode) brightnessDark = val; else brightnessLight = val;
      applyTheme(isDarkMode);
    }}
  ];

  tagMappings.forEach(mapping => {
    mapping.tag.contentEditable = true;
    mapping.tag.style.cursor = 'text';

    mapping.tag.addEventListener('click', (e) => {
      e.target.select?.() || document.execCommand('selectAll', false, null);
    });

    mapping.tag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });

    mapping.tag.addEventListener('blur', (e) => {
      const rawValue = e.target.textContent.replace(/[^\d.-]/g, '');
      mapping.setter(rawValue);
      mapping.slider.value = parseFloat(rawValue) || 0;
      syncTags();
      saveSettings();
    });
  });
}

function initSettingsSliders() {
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
  const sizeSlider = document.getElementById('stickSizeSlider');
  const zoomSlider = document.getElementById('zoomSlider');
  const arrowSlider = document.getElementById('arrowSlider');
  const brightnessSlider = document.getElementById('brightnessSlider');
  const presetSel = document.getElementById('presetSel');

  accelPitch.addEventListener('input',()=>{maxAccelPitch=parseFloat(accelPitch.value)||400; syncTags(); saveSettings();});
  accelYaw.addEventListener('input',()=>{maxAccelYaw=parseFloat(accelYaw.value)||400; syncTags(); saveSettings();});
  accelRoll.addEventListener('input',()=>{maxAccelRoll=parseFloat(accelRoll.value)||400; syncTags(); saveSettings();});
  curveRange.addEventListener('input',()=>{inputPow=parseFloat(curveRange.value)||1.0; syncTags(); saveSettings();});
  dampRange.addEventListener('input',()=>{damp=parseFloat(dampRange.value)||2.96; syncTags(); saveSettings();});
  dampDARRange.addEventListener('input',()=>{dampDAR=parseFloat(dampDARRange.value)||4.35; syncTags(); saveSettings();});
  brakeRange.addEventListener('input',()=>{brakeOnRelease=parseFloat(brakeRange.value)||0.0; syncTags(); saveSettings();});
  wmaxRange.addEventListener('input',()=>{wMax=parseFloat(wmaxRange.value)||6.0; syncTags(); saveSettings();});
  wmaxPitchRange.addEventListener('input',()=>{wMaxPitch=parseFloat(wmaxPitchRange.value)||8.5; syncTags(); saveSettings();});
  wmaxYawRange.addEventListener('input',()=>{wMaxYaw=parseFloat(wmaxYawRange.value)||9.0; syncTags(); saveSettings();});
  wmaxRollRange.addEventListener('input',()=>{wMaxRoll=parseFloat(wmaxRollRange.value)||6.0; syncTags(); saveSettings();});
  circleTiltRange.addEventListener('input',()=>{circleTiltAngle=parseFloat(circleTiltRange.value)||38; syncTags(); saveSettings();});
  circleTiltModifierRange.addEventListener('input',()=>{circleTiltModifier=parseFloat(circleTiltModifierRange.value)||0; syncTags(); saveSettings();});
  circleScaleRange.addEventListener('input',()=>{circleScale=parseFloat(circleScaleRange.value)||0.3; syncTags(); saveSettings();});
  sizeSlider.addEventListener('input',()=>{Input.setJoyBaseR(parseInt(sizeSlider.value,10)||100); Input.setJoyKnobR(Math.round(Input.getJoyBaseR()*0.32)); Input.clampJoyCenter(); Input.positionHints(); syncTags();});
  zoomSlider.addEventListener('input',()=>{zoom=parseFloat(zoomSlider.value)||1.0; applyZoom(); syncTags(); saveSettings();});
  arrowSlider.addEventListener('input',()=>{arrowScale=parseFloat(arrowSlider.value)||4.0; syncTags(); saveSettings();});
  brightnessSlider.addEventListener('input',()=>{
    const val = parseFloat(brightnessSlider.value) || 1.0;
    if (isDarkMode) {
      brightnessDark = val;
    } else {
      brightnessLight = val;
    }
    applyTheme(isDarkMode);
    syncTags();
    saveSettings();
  });
  presetSel.addEventListener('change',()=>{
    const name = presetSel.value;
    Car.buildCar(CONST.CAR_PRESETS[name], name, scene);
    Car.car.quaternion.identity();
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI); // X: +270°, Y: 0°, Z: +180°
    Physics.resetAngularVelocity();
    saveSettings(); // Save selected car body
  });
}

// Helper function to update menu button styling based on Input module state
function updateMenuButtonStyling(){
  const lastActive = Input.getLastActiveAirRoll();
  document.getElementById('rollL').classList.toggle('active', lastActive === -1);
  document.getElementById('rollR').classList.toggle('active', lastActive === 1);
  document.getElementById('rollFree').classList.toggle('active', lastActive === 2);
}

// ============================================================================
// GAME LOOP FUNCTIONS
// ============================================================================

let orbitOn = false;
let orbitDir = 1;
let orbitPhase = 0;

function integrate(dt) {
  // Skip physics when menu is open OR when Ring Mode is paused
  if (chromeShown || (RingMode.getRingModeActive() && RingMode.getRingModePaused())) {
    return;
  }

  // Call physics module
  Physics.updatePhysics(dt, {
    // Visualization
    showArrow,
    showCircle,
    arrowScale,
    circleScale,
    circleTiltAngle,
    circleTiltModifier,

    // Input shaping
    inputPow,

    // Damping
    damp,
    dampDAR,
    brakeOnRelease,

    // Accelerations (deg/s²)
    maxAccelPitch,
    maxAccelYaw,
    maxAccelRoll,

    // Velocity limits (rad/s)
    wMax,
    wMaxPitch,
    wMaxYaw,
    wMaxRoll
  }, chromeShown);
}

/* Camera zoom/orbit */
function applyZoom(){
  const f = Math.max(0.7, Math.min(1.6, zoom||1));
  const dist = CONST.CAM_BASE.z / f;
  const h = CONST.CAM_BASE.y / f;
  if(!orbitOn){
    camera.position.set(0, h, dist);
    camera.lookAt(0, Car.car ? Car.car.position.y : 0, 0);
  }
}

function orbitStep(t){
  const f = Math.max(0.7, Math.min(1.6, zoom||1));
  const R = (CONST.CAM_BASE.z / f);
  const h = (CONST.CAM_BASE.y / f);
  const sp = 0.35 * orbitDir;
  const x = Math.sin(t*sp)*R;
  const z = Math.cos(t*sp)*R;
  camera.position.set(x, h, z);
  camera.lookAt(0, Car.car ? Car.car.position.y : 0, 0);
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
    COLS,
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

  if(orbitOn){ orbitPhase += dt; orbitStep(orbitPhase); }

  // Update input state from Input module
  Input.updateInput(dt);

  integrate(dt);

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
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();

  // Update gizmo camera aspect ratio
  const gizmoRect = document.getElementById('gizmoFrame').getBoundingClientRect();
  gizmoCam.aspect = gizmoRect.width/gizmoRect.height;
  gizmoCam.updateProjectionMatrix();

  Rendering.sizeHud();
  Input.handleResize();
  applyZoom();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init() {
  console.log('Initializing L4 DAR Prototype...');

  // Initialize scene
  const hud = initScene();

  // Initialize HUD
  Rendering.initHUD(hud);

  // Load settings from Settings module
  const savedSettings = Settings.loadSettings();

  // Restore theme mode (default to true = dark mode)
  isDarkMode = savedSettings.isDarkMode ?? true;
  brightnessDark = savedSettings.brightnessDark ?? 1.0;
  brightnessLight = savedSettings.brightnessLight ?? 1.0;

  // Initialize settings variables
  maxAccelPitch = savedSettings.maxAccelPitch ?? 715;
  maxAccelYaw = savedSettings.maxAccelYaw ?? 565;
  maxAccelRoll = savedSettings.maxAccelRoll ?? 1030;
  inputPow = savedSettings.inputPow ?? 1.5;
  damp = savedSettings.damp ?? 2.96;
  dampDAR = savedSettings.dampDAR ?? 4.35;
  brakeOnRelease = savedSettings.brakeOnRelease ?? 0.0;
  wMax = savedSettings.wMax ?? 6.0;
  wMaxPitch = savedSettings.wMaxPitch ?? 8.5;
  wMaxYaw = savedSettings.wMaxYaw ?? 9.0;
  wMaxRoll = savedSettings.wMaxRoll ?? 6.0;
  circleTiltAngle = savedSettings.circleTiltAngle ?? 34;
  circleTiltModifier = savedSettings.circleTiltModifier ?? 0;
  circleScale = savedSettings.circleScale ?? 0.3;
  zoom = savedSettings.zoom ?? 1.0;
  arrowScale = savedSettings.arrowScale ?? 4.0;
  showArrow = savedSettings.showArrow ?? true;
  showCircle = savedSettings.showCircle ?? true;

  // Audio settings
  gameSoundsEnabled = savedSettings.gameSoundsEnabled ?? true;
  gameMusicEnabled = savedSettings.gameMusicEnabled ?? true;

  // Sync audio settings with Audio module
  Audio.setGameSoundsEnabled(gameSoundsEnabled);
  Audio.setGameMusicEnabled(gameMusicEnabled);

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

  accelPitch.value = maxAccelPitch;
  accelYaw.value = maxAccelYaw;
  accelRoll.value = maxAccelRoll;
  curveRange.value = inputPow;
  dampRange.value = damp;
  dampDARRange.value = dampDAR;
  brakeRange.value = brakeOnRelease;
  wmaxRange.value = wMax;
  wmaxPitchRange.value = wMaxPitch;
  wmaxYawRange.value = wMaxYaw;
  wmaxRollRange.value = wMaxRoll;
  circleTiltRange.value = circleTiltAngle;
  circleTiltModifierRange.value = circleTiltModifier;
  circleScaleRange.value = circleScale;
  zoomSlider.value = zoom;
  arrowSlider.value = arrowScale;

  // Initialize UI
  setupEditableTags();
  initSettingsSliders();
  syncTags();

  // Initialize menu buttons
  const menuBtn = document.getElementById('menuBtn');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuCloseBtn = document.getElementById('menuCloseBtn');

  menuBtn.addEventListener('click',()=> chromeShown ? closeMenu() : openMenu());
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
  toggleSoundsBtn.classList.toggle('active', gameSoundsEnabled);
  soundsStatusTag.textContent = gameSoundsEnabled ? 'Enabled' : 'Disabled';
  toggleMusicBtn.classList.toggle('active', gameMusicEnabled);
  musicStatusTag.textContent = gameMusicEnabled ? 'Enabled' : 'Disabled';

  toggleSoundsBtn.addEventListener('click', () => {
    gameSoundsEnabled = !gameSoundsEnabled;
    toggleSoundsBtn.classList.toggle('active', gameSoundsEnabled);
    soundsStatusTag.textContent = gameSoundsEnabled ? 'Enabled' : 'Disabled';

    // Update Audio module settings
    Audio.setGameSoundsEnabled(gameSoundsEnabled);

    saveSettings();
  });

  toggleMusicBtn.addEventListener('click', () => {
    gameMusicEnabled = !gameMusicEnabled;
    toggleMusicBtn.classList.toggle('active', gameMusicEnabled);
    musicStatusTag.textContent = gameMusicEnabled ? 'Enabled' : 'Disabled';

    // Update Audio module settings
    Audio.setGameMusicEnabled(gameMusicEnabled);

    // Start music if enabled and Ring Mode is active
    if (gameMusicEnabled && RingMode.getRingModeActive() && RingMode.getRingModeStarted()) {
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
    orbitOn = false;
    orbitDir = 1;
    document.getElementById('orbitCW').classList.remove('active');
    document.getElementById('orbitCCW').classList.remove('active');
    orbitPhase = 0;
    camera.position.set(0, 220, 650);
    camera.lookAt(0,0,0);
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
    if (orbitOn && orbitDir === 1) {
      // Turn off if already orbiting CW
      orbitOn = false;
      btn.classList.remove('active');
    } else {
      // Turn on CW orbit
      orbitOn = true;
      orbitDir = 1;
      btn.classList.add('active');
      document.getElementById('orbitCCW').classList.remove('active');
    }
  });
  document.getElementById('orbitCCW').addEventListener('click',()=>{
    const btn = document.getElementById('orbitCCW');
    if (orbitOn && orbitDir === -1) {
      // Turn off if already orbiting CCW
      orbitOn = false;
      btn.classList.remove('active');
    } else {
      // Turn on CCW orbit
      orbitOn = true;
      orbitDir = -1;
      btn.classList.add('active');
      document.getElementById('orbitCW').classList.remove('active');
    }
  });

  // Theme toggle (main screen button)
  document.getElementById('themeBtn').addEventListener('click',()=>{
    isDarkMode = !isDarkMode;
    applyTheme(isDarkMode);
    const btn = document.getElementById('themeBtn');
    btn.textContent = isDarkMode ? '🌙' : '☀️';
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
      if (RingMode.getRingModeActive() && RingMode.getRingModeStarted() && gameMusicEnabled) {
        Audio.startBackgroundMusic();
      }
    }
  });

  // Arrow and Circle toggles
  document.getElementById('arrowToggle').addEventListener('click',()=>{
    showArrow = !showArrow;
    const btn = document.getElementById('arrowToggle');
    btn.classList.toggle('active', showArrow);
    btn.textContent = showArrow ? 'Show Arrow' : 'Hide Arrow';
    saveSettings();
  });

  document.getElementById('circleToggle').addEventListener('click',()=>{
    showCircle = !showCircle;
    const btn = document.getElementById('circleToggle');
    btn.classList.toggle('active', showCircle);
    btn.textContent = showCircle ? 'Show Circle' : 'Hide Circle';
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
            orbitOn = false;
            orbitDir = 1;
            document.getElementById('orbitCW').classList.remove('active');
            document.getElementById('orbitCCW').classList.remove('active');
            orbitPhase = 0;
            camera.position.set(0, 220, 650);
            camera.lookAt(0,0,0);
            if (Car.faceArrow) Car.faceArrow.visible = false;
            if (Car.faceTip) Car.faceTip.visible = false;
          }
          break;
        case 'orbitCW':
          if (orbitOn && orbitDir === 1) {
            // Turn off if already orbiting CW
            orbitOn = false;
          } else {
            // If switching from CCW to CW, maintain camera position
            if (orbitOn && orbitDir === -1) {
              orbitPhase = -orbitPhase;
            }
            // Turn on CW orbit
            orbitOn = true;
            orbitDir = 1;
          }
          break;
        case 'orbitCCW':
          if (orbitOn && orbitDir === -1) {
            // Turn off if already orbiting CCW
            orbitOn = false;
          } else {
            // If switching from CW to CCW, maintain camera position
            if (orbitOn && orbitDir === 1) {
              orbitPhase = -orbitPhase;
            }
            // Turn on CCW orbit
            orbitOn = true;
            orbitDir = -1;
          }
          break;
        case 'toggleTheme':
          isDarkMode = !isDarkMode;
          applyTheme(isDarkMode);
          saveSettings();
          break;
        case 'openMenu':
          if (!chromeShown) {
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
    Car.buildCar(CONST.CAR_PRESETS[savedCarBody], savedCarBody, scene);
    presetSel.value = savedCarBody;
  } else {
    Car.buildCar(CONST.CAR_PRESETS.octane, "octane", scene);
  }

  // Set initial menu button styling based on saved selection
  updateMenuButtonStyling();

  // Set initial rotation: roof facing camera, nose pointing up
  // X: +270°, Y: 0°, Z: +180°
  if (Car.car) {
    Car.car.rotation.set(Math.PI * 1.5, 0, Math.PI); // X: +270°, Y: 0°, Z: +180°
  }

  // Initialize Ring Mode module with scene references
  const orbitOnRef = { get value() { return orbitOn; }, set value(v) { orbitOn = v; } };
  RingMode.initRingMode(scene, camera, renderer, null, orbitOnRef);

  // Apply zoom and theme
  applyZoom();
  applyTheme(isDarkMode); // Initialize theme

  // Restore theme button state (main screen)
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.textContent = isDarkMode ? '🌙' : '☀️';

  // Restore arrow and circle toggle button states
  const arrowToggleBtn = document.getElementById('arrowToggle');
  arrowToggleBtn.classList.toggle('active', showArrow);
  arrowToggleBtn.textContent = showArrow ? 'Show Arrow' : 'Hide Arrow';

  const circleToggleBtn = document.getElementById('circleToggle');
  circleToggleBtn.classList.toggle('active', showCircle);
  circleToggleBtn.textContent = showCircle ? 'Show Circle' : 'Hide Circle';

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

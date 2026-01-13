# Integration Example - How to Use the Extracted Modules

## Current Status

### ✅ Completed and Ready to Use:
- **constants.js** - All configuration constants
- **audio.js** - Sound effects and music system
- **settings.js** - LocalStorage management

### 🔄 To Be Created:
- car.js, input.js, ringMode.js, physics.js, rendering.js, main.js

## Step-by-Step Integration (Safe Approach)

### Step 1: Add Module Imports (Top of <script type="module"> section)

**In index.html, replace line ~430:**

```javascript
// OLD (line ~430):
// Version: 2025-11-29-v2 (localStorage persistence fix)
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js";

// NEW - Add these imports:
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js";

// Import refactored modules
import {
  isMobile,
  isDesktop,
  CAM_BASE,
  COL_UP,
  COL_RIGHT,
  COL_DOWN,
  COL_LEFT,
  COLS,
  THEMES,
  CAR_PRESETS,
  CAR_WIDTH,
  CAR_HEIGHT,
  CAR_SCALE,
  STICK_TAU_MS,
  RELOCATE_HOLD_MS,
  STICK_MIN,
  PHYSICS_DEFAULTS,
  RING_MAX_SPEED,
  RING_BOOST_ACCEL,
  RING_GRAVITY,
  RING_GRID_BOUNDS,
  INITIAL_RING_SIZE,
  RING_TUBE_RADIUS,
  RING_SPAWN_DISTANCE,
  RING_DESPAWN_DISTANCE,
  RING_BASE_SPEED,
  RING_BASE_SPAWN_INTERVAL,
  RING_COLORS,
  DIFFICULTY_SETTINGS,
  RING_PATTERNS,
  PATTERN_UNLOCK_THRESHOLDS,
  CHORD_PROGRESSION,
  MENU_NAV_COOLDOWN
} from './js/modules/constants.js';

import {
  playRingPassSound,
  playRingMissSound,
  startBoostRumble,
  stopBoostRumble,
  startBackgroundMusic,
  stopBackgroundMusic,
  setGameSoundsEnabled,
  setGameMusicEnabled,
  isGameSoundsEnabled,
  isGameMusicEnabled
} from './js/modules/audio.js';

import {
  settings,
  loadSettings,
  saveSettings,
  updateSetting,
  updateSettings,
  resetPhysicsDefaults as resetPhysicsDefaultsFromModule,
  clearAllSettings,
  getSetting,
  getAllSettings
} from './js/modules/settings.js';
```

### Step 2: Remove Duplicate Constants (Lines to DELETE)

**Delete these lines since they're now in constants.js:**

```javascript
// DELETE lines ~442-444:
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
const isDesktop = !isMobile;

// DELETE lines ~451:
const CAM_BASE = { y: 280, z: 760 };

// DELETE lines ~475-478:
const COL_UP   = 0xff5c5c;
const COL_RIGHT= 0x4c8dff;
const COL_DOWN = 0x53d769;
const COL_LEFT = 0xffd166;

// DELETE lines ~492-521 (THEMES object)

// DELETE lines ~571-575 (presets object, now CAR_PRESETS)

// DELETE lines ~800 (STICK_TAU_MS, RELOCATE_HOLD_MS, STICK_MIN)

// DELETE lines ~808 (COLS object)

// DELETE lines ~916 (MENU_NAV_COOLDOWN)

// DELETE lines ~1529-1532 (Ring physics constants)

// DELETE lines ~1825-1832 (RING_COLORS)

// DELETE lines ~1841-1850 (Ring sizing and movement constants)

// DELETE lines ~1855-1905 (DIFFICULTY_SETTINGS)

// DELETE lines ~1619-1624 (chordProgression, now CHORD_PROGRESSION)
```

### Step 3: Replace Audio Functions (Lines to REPLACE)

**Replace audio functions with imports:**

```javascript
// DELETE lines ~1542-1785 (all audio functions)
// They are now imported from audio.js:
// - playRingPassSound()
// - playRingMissSound()
// - startBoostRumble()
// - stopBoostRumble()
// - startBackgroundMusic()
// - stopBackgroundMusic()

// UPDATE audio toggle button handlers (lines ~2380-2405):
// OLD:
document.getElementById('toggleSounds').addEventListener('click', () => {
  gameSoundsEnabled = !gameSoundsEnabled;
  // ... rest of code
});

// NEW:
document.getElementById('toggleSounds').addEventListener('click', () => {
  const enabled = !isGameSoundsEnabled();
  setGameSoundsEnabled(enabled);
  const btn = document.getElementById('toggleSounds');
  btn.classList.toggle('active', enabled);
  document.getElementById('soundsStatus').textContent = enabled ? 'Enabled' : 'Disabled';
  saveSettings({ gameSoundsEnabled: enabled });
});

document.getElementById('toggleMusic').addEventListener('click', () => {
  const enabled = !isGameMusicEnabled();
  setGameMusicEnabled(enabled);
  const btn = document.getElementById('toggleMusic');
  btn.classList.toggle('active', enabled);
  document.getElementById('musicStatus').textContent = enabled ? 'Enabled' : 'Disabled';
  saveSettings({ gameMusicEnabled: enabled });
});
```

### Step 4: Replace Settings Functions (Lines to REPLACE)

**Replace settings management:**

```javascript
// DELETE lines ~1208-1269 (loadSettings and saveSettings functions)
// They are now imported from settings.js

// UPDATE initialization (lines ~1271):
// OLD:
const savedSettings = loadSettings();

// NEW:
loadSettings(); // This populates the settings object

// UPDATE all saveSettings() calls throughout the file:
// OLD:
saveSettings();

// NEW (examples):
saveSettings();  // Still works! Or use specific updates:
updateSetting('isDarkMode', true);
updateSettings({ zoom: 1.5, arrowScale: 2.0 });

// UPDATE physics reset button (line ~1397):
// OLD:
document.getElementById('resetPhysicsDefaults').addEventListener('click', () => {
  // ... manual reset code
  location.reload();
});

// NEW:
document.getElementById('resetPhysicsDefaults').addEventListener('click', () => {
  resetPhysicsDefaultsFromModule();
  // Update UI sliders to match new values
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
  syncTags(); // Update tag displays
});

// UPDATE variable initializations (lines ~1274-1303):
// OLD:
let gpEnabled = savedSettings.gpEnabled ?? true;
let gpBindings = savedSettings.gpBindings ?? null;
isDarkMode = savedSettings.isDarkMode ?? true;
let maxAccelPitch = savedSettings.maxAccelPitch ?? parseFloat(accelPitch.value);
// ... etc

// NEW:
let gpEnabled = settings.gpEnabled;
let gpBindings = settings.gpBindings;
let isDarkMode = settings.isDarkMode;
let maxAccelPitch = settings.maxAccelPitch;
let maxAccelYaw = settings.maxAccelYaw;
let maxAccelRoll = settings.maxAccelRoll;
let inputPow = settings.inputPow;
let damp = settings.damp;
let dampDAR = settings.dampDAR;
let brakeOnRelease = settings.brakeOnRelease;
let wMax = settings.wMax;
let wMaxPitch = settings.wMaxPitch;
let wMaxYaw = settings.wMaxYaw;
let wMaxRoll = settings.wMaxRoll;
let circleTiltAngle = settings.circleTiltAngle;
let circleTiltModifier = settings.circleTiltModifier;
let circleScale = settings.circleScale;
let zoom = settings.zoom;
let arrowScale = settings.arrowScale;
let brightnessDark = settings.brightnessDark;
let brightnessLight = settings.brightnessLight;
let airRoll = settings.airRoll;
let lastActiveAirRoll = settings.lastActiveAirRoll;
let airRollIsToggle = settings.airRollIsToggle;
let showArrow = settings.showArrow;
let showCircle = settings.showCircle;
let ringModeHighScore = settings.ringModeHighScore;
let currentDifficulty = settings.ringDifficulty;
let ringCameraSpeed = settings.ringCameraSpeed || 0.1;
```

### Step 5: Update Settings Saves Throughout

**Find all saveSettings() calls and update them:**

```javascript
// Pattern to find: saveSettings()
// Many places in the code, examples:

// Slider changes (lines ~1355-1390):
// OLD:
accelPitch.oninput = () => {
  maxAccelPitch = +accelPitch.value;
  syncTags();
  saveSettings(); // <-- Update this
};

// NEW:
accelPitch.oninput = () => {
  maxAccelPitch = +accelPitch.value;
  syncTags();
  updateSetting('maxAccelPitch', maxAccelPitch);
};

// Or keep using saveSettings() but ensure it saves all current values:
accelPitch.oninput = () => {
  maxAccelPitch = +accelPitch.value;
  syncTags();
  saveSettings({
    maxAccelPitch,
    maxAccelYaw,
    maxAccelRoll,
    inputPow,
    damp,
    dampDAR,
    brakeOnRelease,
    wMax,
    wMaxPitch,
    wMaxYaw,
    wMaxRoll
  });
};
```

## Testing After Integration

1. **Load the page** - Check console for errors
2. **Open DevTools Console** - Verify logs show "Settings loaded from localStorage"
3. **Test settings persistence:**
   - Change a physics slider
   - Reload page
   - Verify slider is at new value
4. **Test audio:**
   - Start Ring Mode
   - Verify background music plays
   - Pass through a ring - verify "thunk" sound
   - Miss a ring - verify "ding" sound
5. **Test constants:**
   - Verify car colors match COL_* values
   - Verify ring colors cycle through RING_COLORS
   - Verify physics behaves correctly with PHYSICS_DEFAULTS

## Troubleshooting

### "Uncaught SyntaxError: Cannot use import statement outside a module"
**Fix:** Ensure `<script type="module">` in index.html

### "Failed to resolve module specifier"
**Fix:** Check file paths - should be `./js/modules/constants.js` not `js/modules/constants.js`

### "settings is not defined"
**Fix:** Make sure you imported `settings` from settings.js

### "playRingPassSound is not defined"
**Fix:** Make sure you imported the audio functions from audio.js

### Settings don't persist
**Fix:** Make sure you're calling `saveSettings()` or `updateSetting()` after changes

## Next Steps

After this integration is working:
1. Extract car.js (car building and model loading)
2. Extract rendering.js (HUD drawing)
3. Extract input.js (touch, keyboard, gamepad)
4. Extract ringMode.js (ring spawning, collision)
5. Extract physics.js (rotation physics, Ring Mode movement)
6. Extract main.js (scene setup, animation loop)

Each extraction should be:
- Committed to git separately
- Tested thoroughly before moving to next
- Backed up before starting

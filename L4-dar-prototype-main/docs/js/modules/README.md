# L4 DAR Prototype - Module Refactoring Guide

## Overview

This directory contains the modular refactoring of the L4 DAR prototype. The refactoring is designed to be done incrementally to minimize risk.

## Completed Modules

### ✅ constants.js
**Status:** Complete
**Exports:**
- Device detection (isMobile, isDesktop)
- Camera config (CAM_BASE)
- Colors (COL_UP, COL_RIGHT, COL_DOWN, COL_LEFT, COLS)
- Themes (THEMES)
- Car presets (CAR_PRESETS, CAR_WIDTH, CAR_HEIGHT, CAR_SCALE)
- Joystick constants (STICK_TAU_MS, RELOCATE_HOLD_MS, STICK_MIN)
- Physics defaults (PHYSICS_DEFAULTS)
- Ring Mode configuration (all RING_* constants)
- Difficulty settings (DIFFICULTY_SETTINGS)
- Ring patterns (RING_PATTERNS, PATTERN_UNLOCK_THRESHOLDS)
- Audio (CHORD_PROGRESSION)
- Menu (MENU_NAV_COOLDOWN)

### ✅ audio.js
**Status:** Complete
**Exports:**
- `playRingPassSound()` - Play ring pass sound effect
- `playRingMissSound()` - Play ring miss sound effect
- `startBoostRumble()` - Start continuous boost rumble
- `stopBoostRumble()` - Stop boost rumble
- `startBackgroundMusic()` - Start 8-bit background music
- `stopBackgroundMusic()` - Stop background music
- `setGameSoundsEnabled(bool)` - Enable/disable sound effects
- `setGameMusicEnabled(bool)` - Enable/disable music
- `isGameSoundsEnabled()` - Get sound effects state
- `isGameMusicEnabled()` - Get music state

### ✅ settings.js
**Status:** Complete
**Exports:**
- `settings` - Settings object
- `loadSettings()` - Load from localStorage
- `saveSettings(partial)` - Save to localStorage
- `updateSetting(key, value)` - Update single setting
- `updateSettings(obj)` - Update multiple settings
- `resetSetting(key)` - Reset one setting to default
- `resetPhysicsDefaults()` - Reset all physics settings
- `clearAllSettings()` - Clear localStorage
- `getSetting(key)` - Get single setting
- `getAllSettings()` - Get all settings

## Modules To Be Created

### 🔄 car.js
**Priority:** High
**What to extract from index.html:**
- Lines ~576-783: Car model loading and building functions
- `loadCarModel(presetName)` - Load GLB models
- `clearCar()` - Dispose car resources
- `buildCar(boxDims, presetName)` - Build car with hitbox
- `addEdge()`, `addWheel()`, `addCabin()`, `addSpoiler()`, `addBumper()`, `addFlares()`
- `buildPlaceholderFancy()`, `buildOctane()`, `buildDominus()`
- Materials (MAT_BODY, MAT_GLASS, MAT_ACCENT, MAT_DARK, MAT_EDGE, MAT_TIRE_F, MAT_TIRE_B, MAT_HUB)

**Dependencies:**
- THREE.js
- GLTFLoader
- constants.js (COL_*, CAR_PRESETS, CAR_SCALE)
- Needs access to: scene, car (shared state)

**Exports:**
- Car building functions
- Car state (car, BOX, faceArrow, faceTip, tornadoCircle)
- Materials

### 🔄 rendering.js
**Priority:** High
**What to extract from index.html:**
- Lines ~786-794: HUD drawing utilities
- Lines ~810-893: Joystick, DAR, and Boost button drawing
- `Hclear()`, `Hcircle()`, `HfillCircle()`, `Harc()`, `Hline()`, `Htri()`
- `drawJoystick()`, `drawDAR()`, `drawBoost()`
- `sizeHud()` - Resize HUD canvas
- Ring Mode HUD (score, lives, instructions overlay)
- Visual effects (boost flames, ring glows)

**Dependencies:**
- constants.js (COLS, RING_COLORS)
- Needs access to: hud canvas, hctx, joy/DAR/BOOST state

**Exports:**
- HUD drawing functions
- Visual state management

### 🔄 input.js
**Priority:** High
**What to extract from index.html:**
- Lines ~797-905: Joystick touch input
- Lines ~1330-1350: Keyboard input helpers
- Lines ~2600-2806: Pointer events (pointerdown, pointermove, pointerup)
- Lines ~2807-3100: Gamepad support
- Touch input state (joyActive, joyVec, DAR state, BOOST state)
- Gamepad bindings and remapping
- Keyboard state tracking
- Menu navigation with gamepad

**Dependencies:**
- constants.js (STICK_TAU_MS, RELOCATE_HOLD_MS, STICK_MIN, MENU_NAV_COOLDOWN)
- settings.js (save/load gamepad bindings)
- THREE.js (Vector2)

**Exports:**
- Input state (joyVec, smJoy, darOn, boostActive)
- Input polling functions
- Event handlers

### 🔄 ringMode.js
**Priority:** Medium
**What to extract from index.html:**
- Lines ~1519-1535: Ring Mode state
- Lines ~1792-1821: `resetRingMode()`
- Lines ~1824-2200: Ring spawning, patterns, collision detection
- Ring geometry caching
- Pattern selection logic
- Collision detection
- Scoring system
- Lives management
- Camera targeting for next ring

**Dependencies:**
- THREE.js
- constants.js (RING_*, DIFFICULTY_SETTINGS, RING_PATTERNS)
- audio.js (playRingPassSound, playRingMissSound)
- settings.js (currentDifficulty, ringModeHighScore)
- Needs access to: scene, renderer, camera, car

**Exports:**
- Ring Mode state
- Ring management functions
- Collision detection
- Score/lives tracking

### 🔄 physics.js
**Priority:** Medium
**What to extract from index.html:**
- Lines ~3200-3400: Rotation physics (pitch, yaw, roll)
- Lines ~1526-1535: Ring Mode physics (velocity, position, boost, gravity)
- Angular velocity (w) calculations
- Input curve application
- Damping calculations
- Max velocity clamping
- Orbit mode physics

**Dependencies:**
- THREE.js (Vector3, Quaternion, Euler)
- constants.js (RING_MAX_SPEED, RING_BOOST_ACCEL, RING_GRAVITY, RING_GRID_BOUNDS)
- settings.js (physics settings)
- Needs access to: car, w (angular velocity)

**Exports:**
- Physics state (w, ringModeVelocity, ringModePosition)
- Physics update functions
- Boost/gravity applications

### 🔄 main.js
**Priority:** High (do this last)
**What to extract from index.html:**
- Lines ~434-472: Scene, camera, renderer setup
- Lines ~3900-4378: Main animation loop
- Scene lighting
- Grid setup
- Theme application (applyTheme function)
- Resize handling
- Animation loop coordination
- Module initialization

**Dependencies:**
- All other modules
- THREE.js

**Exports:**
- Main entry point
- Animation loop
- Shared state (scene, camera, renderer, car, etc.)

## Migration Strategy

### Phase 1: Import Completed Modules (SAFE - Do This First)
1. Add module imports to index.html for constants, audio, settings
2. Replace inline constants with imports
3. Replace inline audio functions with imports
4. Replace localStorage code with settings module
5. Test thoroughly - everything should still work

### Phase 2: Extract car.js (Medium Risk)
1. Create car.js with all car building functions
2. Export materials and car state
3. Import in index.html
4. Test car switching and model loading

### Phase 3: Extract rendering.js (Medium Risk)
1. Create rendering.js with HUD drawing functions
2. Export drawing utilities
3. Import in index.html
4. Test HUD rendering, joystick, DAR button

### Phase 4: Extract input.js (High Risk - Be Careful)
1. Create input.js with touch, keyboard, gamepad
2. Export input state and handlers
3. Import in index.html
4. Test all input methods thoroughly

### Phase 5: Extract ringMode.js (Medium Risk)
1. Create ringMode.js with ring spawning and collision
2. Export ring management functions
3. Import in index.html
4. Test Ring Mode gameplay

### Phase 6: Extract physics.js (High Risk - Be Careful)
1. Create physics.js with rotation and Ring Mode physics
2. Export physics state and update functions
3. Import in index.html
4. Test rotation behavior and Ring Mode movement

### Phase 7: Extract main.js (Highest Risk - Do Last)
1. Create main.js with scene setup and animation loop
2. Move remaining code from index.html
3. Update index.html to be minimal HTML + module imports
4. Test everything end-to-end

## Shared State Management

Some variables need to be shared across modules. Options:

### Option A: Export from main.js (Recommended)
```javascript
// main.js
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(...);
export const renderer = new THREE.WebGLRenderer(...);
export let car = null;
export const w = new THREE.Vector3(0,0,0);

// Other modules import from main.js
import { scene, camera, car, w } from './main.js';
```

### Option B: Pass as parameters
```javascript
// car.js
export function buildCar(scene, boxDims, presetName) {
  // scene passed as parameter
}

// main.js
import { buildCar } from './car.js';
buildCar(scene, presets.octane, 'octane');
```

### Option C: Create shared state module
```javascript
// state.js
export const state = {
  scene: null,
  camera: null,
  renderer: null,
  car: null,
  w: new THREE.Vector3(0,0,0)
};

// main.js
import { state } from './state.js';
state.scene = new THREE.Scene();

// Other modules
import { state } from './state.js';
state.car.rotation.set(...);
```

## Testing Checklist

After each phase:
- [ ] Page loads without errors
- [ ] Menu opens and closes
- [ ] Settings persist across reloads
- [ ] Joystick works (touch)
- [ ] Keyboard controls work
- [ ] Gamepad works (if connected)
- [ ] Car rotates correctly
- [ ] DAR toggle works
- [ ] Air Roll Left/Right work
- [ ] Ring Mode starts
- [ ] Rings spawn and move
- [ ] Collision detection works
- [ ] Score/lives update
- [ ] Boost works
- [ ] Sound effects play
- [ ] Background music plays
- [ ] Theme toggle works
- [ ] All settings save/load correctly

## Rollback Plan

If anything breaks:
1. Revert to backup: `L4 backup/docs_backup_20251206_231039`
2. Copy index.html back to docs/
3. Continue refactoring more carefully

## Notes

- Keep backup before each major change
- Test on both mobile and desktop after changes
- Test with and without gamepad
- Commit to git after each successful phase
- Document any issues encountered

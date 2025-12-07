# State Ownership Documentation

This document defines clear ownership of state across modules in the L4 DAR prototype.

## State Management Principles

1. **Single Source of Truth**: Each piece of state has exactly one owner
2. **Encapsulation**: State is private within modules, accessed via getters
3. **Immutability**: External code receives copies, not direct references
4. **Explicit Updates**: State changes happen through explicit setter functions

## Module State Ownership

### GameState (`gameState.js`)
**Owner of**: Shared game state that breaks circular dependencies

**State**:
- Ring Mode state (active, paused, started, lives, score, highScore, ringCount, position, velocity)
- Physics state (angular velocity)
- Camera state (orbitOn, zoom)

**API**:
- `getRingModeActive()` / `setRingModeActive(active)`
- `getRingModePaused()` / `setRingModePaused(paused)`
- `getAngularVelocity()` / `setAngularVelocity(x, y, z)`
- etc.

### Settings (`settings.js`)
**Owner of**: User preferences and configuration

**State** (Private - `_settings`):
- Physics settings (maxAccelPitch, maxAccelYaw, maxAccelRoll, inputPow, damp, dampDAR, brake, wMax, etc.)
- View settings (circleTiltAngle, circleScale, zoom, arrowScale, showArrow, showCircle)
- Theme settings (isDarkMode, brightnessDark, brightnessLight)
- Air Roll settings (airRoll, lastActiveAirRoll, airRollIsToggle)
- Gamepad settings (gpEnabled, gpBindings, gpPreset)
- Car settings (selectedCarBody)
- Audio settings (gameSoundsEnabled, gameMusicEnabled)
- Ring Mode settings (ringModeHighScore, ringDifficulty, ringCameraSpeed)

**API**:
- `loadSettings()` - Returns copy of all settings
- `saveSettings(partialSettings)` - Saves settings to localStorage
- `getSetting(key)` - Gets single setting value
- `getAllSettings()` - Returns copy of all settings
- `updateSetting(key, value)` - Updates single setting
- `updateSettings(updates)` - Updates multiple settings
- `resetSetting(key)` - Reset to default
- `resetPhysicsDefaults()` - Reset all physics to defaults
- `clearAllSettings()` - Clear localStorage

**Design Pattern**:
- State is private (`_settings`)
- External access only through getters (returns copies)
- Updates only through explicit setter functions
- Prevents external mutation

### Input (`input.js`)
**Owner of**: Input orchestration and menu navigation

**State**:
- Chrome shown (menu open/close)
- Menu navigation state (focusIndex, focusableElements)
- Ring Mode state references (active, paused, boost)
- Callback references

**Delegates to**:
- `touchInput.js` - Touch/pointer input
- `keyboardInput.js` - Keyboard input
- `gamepadInput.js` - Gamepad input
- `airRollController.js` - Air roll state

**API**: 28+ exported functions for getting input state

### TouchInput (`input/touchInput.js`)
**Owner of**: Touch input state

**State**:
- Joystick (center, baseR, knobR, vec, active, smoothedVec)
- DAR button (center, radius, on, relocating)
- Boost button (center, radius, showButton, relocating)
- Pointer tracking (activePointers, joyPointerId, darPointerId, boostPointerId)
- Hold timers
- Hints

**API**:
- Getters: `getJoyVec()`, `getJoyActive()`, `getDarOn()`, etc.
- Setters: `setJoyBaseR(r)`, `setShowBoostButton(show)`, etc.
- Event handlers: `onPointerDown()`, `onPointerMove()`, `endPtr()`

### KeyboardInput (`input/keyboardInput.js`)
**Owner of**: Keyboard state

**State**:
- Key state map (current frame)
- Previous key state map (for edge detection)

**API**:
- `initKeyboard()` - Set up event listeners
- `updateKeyboard(chromeShown, ringModePaused, callbacks)` - Process keyboard input
- `cleanupKeyboard()` - Remove event listeners

### GamepadInput (`input/gamepadInput.js`)
**Owner of**: Gamepad state

**State**:
- Gamepad enabled flag
- Gamepad index
- Gamepad bindings
- Remapping state
- Previous button state (for edge detection)

**API**:
- `initGamepad(savedBindings)` - Initialize gamepad
- `updateGamepad(chromeShown, callbacks)` - Poll gamepad
- `setupGamepadUI()` - Wire up UI elements
- `setBindingPreset(name)` - Apply preset bindings
- `getGpEnabled()`, `getGpBindings()`, `isGamepadPressingAirRoll()`

### AirRollController (`input/airRollController.js`)
**Owner of**: Air roll state

**State**:
- Current air roll value (-1=left, 0=off, +1=right, 2=free)
- Last active air roll (for toggle back)
- Toggle vs hold mode flag

**API**:
- `setRoll(dir, skipSave)` - Set air roll direction
- `toggleRoll(dir)` - Toggle air roll (mode-aware)
- `selectAirRoll(dir)` - Menu selection
- `setAirRollIsToggle(isToggle)` - Set mode
- `loadAirRollState(savedState)` - Restore from save
- `getAirRoll()`, `getLastActiveAirRoll()`, `getAirRollIsToggle()` - Getters

### SceneManager (`sceneManager.js`)
**Owner of**: THREE.js scene resources

**State**:
- Scene object
- Camera object
- Renderer object
- Lights (ambient, directional)
- Grid objects

**API**:
- `init()` - Create scene, camera, renderer, HUD
- `resize()` - Handle window resize
- Getters for all scene objects

### ThemeManager (`themeManager.js`)
**Owner of**: Theme configuration

**State**:
- Current theme (dark/light)
- Brightness multipliers (dark mode, light mode)
- Theme definitions (colors, fog, light intensities)

**API**:
- `applyTheme(dark)` - Apply dark or light theme
- `toggleTheme()` - Switch between themes
- `setBrightnessDark(brightness)`, `setBrightnessLight(brightness)`
- `getIsDarkMode()`, `getBrightnessDark()`, `getBrightnessLight()`

### UIManager (`uiManager.js`)
**Owner of**: UI state and menu management

**State**:
- Chrome shown (menu open/close)
- Collapsible card state
- Menu colors
- Editable tag references

**API**:
- `openMenu(callback)`, `closeMenu(callback)`
- `setupCollapsibleCards()`
- `setupEditableTags(settings, ...callbacks)`
- `initSettingsSliders(settings, callbacks)`
- `syncTags(settings, getters)`
- Various UI update methods

### CameraController (`cameraController.js`)
**Owner of**: Camera positioning and orbit

**State**:
- Zoom level
- Orbit state (on/off, CW/CCW, speed)
- Camera angle
- Target position

**API**:
- `update(dt)` - Update camera position
- `applyZoom()` - Apply zoom level
- `resetCamera()` - Reset to default
- `toggleOrbitCW()`, `toggleOrbitCCW()`
- `setZoom(zoom)`, `getOrbitOn()`

### Physics (`physics.js`)
**Owner of**: Physics simulation state

**State**:
- Angular velocity (via GameState)
- Target indicators (spheres, arrow, circle)

**API**:
- `init(gameState, ringMode)` - Initialize with dependencies
- `updatePhysics(dt, settings, chromeShown)` - Run physics step
- `resetAngularVelocity()` - Reset to zero
- Indicator visibility methods

### RingMode (`ringMode.js`)
**Owner of**: Ring Mode game state

**State**:
- Active, paused, started flags (via GameState)
- Score, lives, ring count (via GameState)
- Position, velocity (via GameState)
- Rings array
- Spawn state
- Difficulty settings
- Camera lerping state

**API**:
- `init(gameState)` - Initialize with GameState dependency
- `initRingMode(scene, camera, renderer, ...)` - Set up scene refs
- `startRingMode()`, `resetRingMode()`, `togglePause()`
- `updateRingMode(dt, ...)` - Game loop
- Various getters for UI

### Audio (`audio.js`)
**Owner of**: Audio state

**State**:
- Audio context
- Sound enabled flags
- Music enabled flags
- Sound buffers

**API**:
- Audio playback functions
- `setGameSoundsEnabled(enabled)`, `setGameMusicEnabled(enabled)`

### Car (`car.js`)
**Owner of**: Car model and visuals

**State**:
- Car mesh
- Car body materials
- Face arrow/tip indicators
- Car quaternion

**API**:
- `buildCar(preset, name, scene)` - Create car
- `updateCarTheme(dark)` - Update materials for theme

## State Flow Patterns

### 1. Settings Flow
```
User Input → Settings.saveSettings(partial) → _settings (private) → localStorage
↓
Settings.getSetting(key) → Returns value copy
↓
Consuming Module (reads only)
```

### 2. Game State Flow
```
Physics/RingMode → GameState.set*() → Private state
↓
GameState.get*() → Returns value/copy
↓
Other modules (read-only access)
```

### 3. Input Flow
```
Hardware Input → Input Sub-Module → Input Orchestrator
↓
Callbacks → Main.js → Other Modules
```

## Anti-Patterns to Avoid

❌ **Mutable Exports**: Never `export let state = {}`
✅ **Private State**: Use `let _state = {}` with getters

❌ **Direct Mutation**: External code changing internal state
✅ **Setter Functions**: Explicit `setState()` functions

❌ **Shared References**: Returning direct object references
✅ **Copies**: Return `{ ...state }` or clones

❌ **Circular Dependencies**: Module A imports Module B imports Module A
✅ **Dependency Injection**: Use shared GameState or callbacks

## Testing State Ownership

To verify correct state ownership:

1. **Check for mutable exports**: `grep -r "export let" docs/js/modules/`
2. **Verify getters return copies**: Check that objects/arrays are cloned
3. **Test external mutation**: Verify that mutating returned values doesn't affect internal state
4. **Review imports**: Ensure no circular dependencies

## Last Updated

2025-12-07 - Phase 4 Complete

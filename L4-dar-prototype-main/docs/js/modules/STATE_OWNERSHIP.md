# State Ownership Documentation

This document defines clear ownership of state across modules in the L4 DAR prototype.

## State Management Principles

1. **Single Source of Truth**: Each piece of state has exactly ONE owner
2. **Encapsulation**: State is private within modules, accessed via getters
3. **No Duplication**: State is never cached in multiple modules
4. **Explicit Updates**: State changes happen through explicit setter functions

## Module State Ownership

### GameState (`gameState.js`)
**Owner of**: Minimal shared state for breaking circular dependencies between Physics and RingMode

**State** (MINIMAL - only what physics.js needs):
- Ring Mode active flag (boolean)
- Ring Mode paused flag (boolean)
- Physics angular velocity (THREE.Vector3 - shared reference)

**API**:
- `getRingModeActive()` / `setRingModeActive(active)`
- `getRingModePaused()` / `setRingModePaused(paused)`
- `isRingModePaused()` - Helper that combines active && paused check
- `getAngularVelocity()` - Returns copy
- `setAngularVelocity(x, y, z)` - Sets value
- `resetAngularVelocity()` - Reset to zero
- `getAngularVelocityRef()` - Returns shared reference (physics.js only)
- `reset()` - Reset all state
- `resetRingMode()` - Reset Ring Mode state

**Design Notes**:
- Intentionally minimal - only contains state needed by physics.js
- Angular velocity uses shared reference pattern (physics.js modifies directly)
- Ring Mode owns its own state (score, lives, position, etc.)

### Settings (`settings.js`)
**Owner of**: ALL user preferences and configuration

**State** (Private - `_settings`):
- Physics settings (maxAccelPitch, maxAccelYaw, maxAccelRoll, inputPow, damp, dampDAR, brakeOnRelease, wMax, wMaxPitch, wMaxYaw, wMaxRoll)
- View settings (circleTiltAngle, circleTiltModifier, circleScale, zoom, arrowScale, showArrow, showCircle)
- Theme settings (isDarkMode, brightnessDark, brightnessLight)
- Air Roll settings (airRoll, lastActiveAirRoll, airRollIsToggle)
- Gamepad settings (gpEnabled, gpBindings, gpPreset)
- Car settings (selectedCarBody)
- Audio settings (gameSoundsEnabled, gameMusicEnabled)
- Ring Mode settings (ringModeHighScore, ringDifficulty, ringCameraSpeed)

**API**:
- `loadSettings()` - Load from localStorage, returns copy
- `saveSettings(partialSettings)` - Merge partial updates and save to localStorage
- `getSetting(key)` - Get single setting value
- `getAllSettings()` - Returns copy of all settings
- `updateSetting(key, value)` - Update single setting and save
- `updateSettings(updates)` - Update multiple settings and save
- `resetSetting(key)` - Reset to default
- `resetPhysicsDefaults()` - Reset all physics to defaults
- `clearAllSettings()` - Clear localStorage

**Design Pattern**:
- State is private (`_settings`)
- External access only through getters (returns copies)
- Updates only through explicit setter functions
- Prevents external mutation
- **main.js uses Proxy pattern** to read/write from Settings module (no local copy)

### RingMode (`ringMode.js`)
**Owner of**: Ring Mode game state and logic

**State** (Local - private variables):
- `ringModeActive` - Is Ring Mode running (synced to gameState)
- `ringModeScore` - Current score
- `ringModeHighScore` - Best score (from settings)
- `ringModeLives` - Current lives
- `ringModeRingCount` - Rings collected
- `ringModeVelocity` - Car velocity (2D)
- `ringModePosition` - Car position (2D)
- `ringModeStarted` - Has player boosted at least once
- `ringModePaused` - Is game paused (synced to gameState)
- `ignoreBoostUntilRelease` - Block boost after respawn
- `rings[]` - Active rings in scene
- `currentDifficulty` - Selected difficulty
- `ringCameraSpeed` - Camera lerp speed
- Spawn state, pattern state, camera targets, etc.

**API**:
- `init(gameState)` - Initialize with GameState dependency
- `initRingMode(scene, camera, renderer, orbitOnRef, externalUpdateCar)` - Set up scene refs
- `startRingMode()` - Start game (syncs active to gameState)
- `stopRingMode()` - Stop game (syncs active to gameState)
- `resetRingMode()` - Reset to initial state
- `toggleRingModePaused()` - Toggle pause (syncs to gameState)
- `updateRingMode(dt)` - Visual updates
- `updateRingModePhysics(dt, inputState, carQuaternion)` - Physics step
- `getRingModeActive()`, `getRingModeScore()`, `getRingModeLives()`, etc. - Getters

**Design Notes**:
- RingMode owns ALL gameplay state (score, lives, position, velocity, etc.)
- Only `active` and `paused` are synced to gameState (for physics.js access)
- startRingMode()/stopRingMode() call `gameState.setRingModeActive()` to keep in sync
- toggleRingModePaused() calls `gameState.setRingModePaused()` to keep in sync

### Input (`input.js`)
**Owner of**: Input orchestration and boost aggregation

**State**:
- `chromeShown` - Is menu open
- `ringModeBoostActive` - Combined boost from all sources
- `keyboardBoostActive` - Keyboard boost state
- `gamepadBoostActive` - Gamepad boost state
- `toggleDARActive` - X button on gamepad (hold mode tracking)
- `toggleDARPressTime` - Prevent immediate release
- Callback references

**Delegates to**:
- `touchInput.js` - Touch/pointer input
- `keyboardInput.js` - Keyboard input
- `gamepadInput.js` - Gamepad input
- `airRollController.js` - Air roll state

**Reads from** (no local copies):
- `RingMode.getRingModePaused()` - For keyboard input blocking

**API**: 28+ exported functions for getting input state

**Design Notes**:
- Does NOT cache Ring Mode state anymore (reads from RingMode.js)
- `setRingModeActive(active)` kept for compatibility but only handles side effects (boost button visibility)
- `setRingModePaused(paused)` kept for compatibility but is a no-op
- Boost state uses proper aggregation pattern for keyboard/gamepad/touch

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
- Setters: `setJoyBaseR(r)`, `setShowBoostButton(show)`, `setJoyVec(x, y)` (for keyboard/gamepad delegation)
- Event handlers: `onPointerDown()`, `onPointerMove()`, `endPtr()`

**Design Notes**:
- TouchInput is the authority for joystick position
- Keyboard and gamepad write to TouchInput's joystick (delegation pattern)

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
- `initGamepad(savedBindings, savedEnabled, savedPreset)` - Initialize
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
- `setZoom(zoom)`, `getZoom()`, `getOrbitOn()`

**Design Notes**:
- CameraController is the ONLY owner of camera state (zoom, orbit)
- GameState does NOT manage camera state

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
- `setupEditableTags(settings, ...callbacks)` - Now receives proxy to Settings
- `initSettingsSliders(settings, callbacks)` - Now receives proxy to Settings
- `syncTags(settings, getters)` - Now receives proxy to Settings
- Various UI update methods

### Physics (`physics.js`)
**Owner of**: Physics simulation state

**State**:
- Angular velocity (shared reference from GameState)
- Target indicators (spheres, arrow, circle)

**API**:
- `init(gameState, ringMode)` - Initialize with dependencies
- `updatePhysics(dt, settings, chromeShown)` - Run physics step
- `resetAngularVelocity()` - Reset to zero
- Indicator visibility methods

**Design Notes**:
- Uses `gameState.getAngularVelocityRef()` to get shared reference
- Modifies angular velocity directly (shared object pattern)

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

### 1. Settings Flow (Proxy Pattern)
```
User Input → main.js settings proxy → Settings.saveSettings()
                                     ↓
                               _settings (private)
                                     ↓
                               localStorage

Settings.getSetting(key) ← Physics/Rendering/etc.
```

**Key**: main.js uses JavaScript Proxy to delegate all reads/writes to Settings module

### 2. Ring Mode State Flow
```
User Action → RingMode.startRingMode()
                ↓
          ringModeActive = true (local)
                ↓
          gameState.setRingModeActive(true)  ← Sync for physics
                ↓
          Physics.updatePhysics() reads gameState.getRingModeActive()
```

**Key**: RingMode owns state, syncs active/paused to GameState for physics access

### 3. Input Flow
```
Hardware Input → Input Sub-Module (touch/keyboard/gamepad)
                        ↓
                  Input Orchestrator (input.js)
                        ↓
                  Aggregates boost state
                        ↓
                  Callbacks → Main.js → Physics/RingMode
```

**Key**: Input.js aggregates boost from multiple sources before passing to physics

## Anti-Patterns Fixed

### Before (Duplicate State)
❌ ringModeActive existed in: ringMode.js, input.js, gameState.js (3 copies!)
❌ settings object existed in: settings.js AND main.js (2 copies!)
❌ Touch boost bypassed aggregation pattern

### After (Single Source of Truth)
✅ ringModeActive: ringMode.js owns, gameState.js syncs for physics access
✅ settings: Settings.js owns, main.js uses Proxy (no copy)
✅ Touch boost uses proper handler (handleTouchBoostChange)

## Testing State Ownership

To verify correct state ownership:

1. **Check for mutable exports**: `grep -r "export let" docs/js/modules/`
2. **Verify getters return copies**: Check that objects/arrays are cloned
3. **Test external mutation**: Verify that mutating returned values doesn't affect internal state
4. **Review imports**: Ensure no circular dependencies
5. **Check for duplicate state**: Search for same state variable in multiple files

## Common Pitfalls

1. **Caching state from other modules** - Always read from source, don't cache
2. **Forgetting to sync to GameState** - If physics needs it, sync it!
3. **Using spread operator on Proxy objects** - Won't work, use getters instead
4. **Setting state in multiple places** - Only the owner should set state

## Last Updated

2025-12-07 - State Duplication Cleanup (Option B Complete)
- Removed ringModeActive/ringModePaused from input.js
- Converted main.js settings to Proxy pattern
- Removed unused properties from gameState.js
- Fixed touch boost aggregation pattern

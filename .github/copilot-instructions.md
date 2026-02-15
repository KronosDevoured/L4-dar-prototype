# L4 DAR Prototype - AI Coding Agent Instructions

## Project Overview
Three.js-based web simulator for Rocket League's Directional Air Roll (DAR) physics. Features modular ES6 architecture, gamepad/keyboard/touch input, and validated physics matching real RL measurements.

**Live demo:** https://kronosdevoured.github.io/L4-dar-prototype/

**Current Focus (Feb 2025):** Implementing controller/keyboard/touch input bindings to match Rocket League's control scheme. Physics validation is complete.

## Architecture

### Module System (ES6)
- **20+ modules** in `docs/js/modules/` with explicit exports/imports
- **Dependency injection pattern** to avoid circular dependencies between `physics.js` ↔ `ringMode.js`
- See `init(dependencies)` functions in modules that need cross-references

Example from [physics.js](docs/js/modules/physics.js#L142-L150):
```javascript
export function init(dependencies) {
  gameState = dependencies.gameState;
  RingMode = dependencies.RingMode;  // Injected to avoid circular import
  loadAxisDataFromStorage();
}
```

### State Management
- **State ownership documented** in [STATE_OWNERSHIP.md](docs/js/modules/STATE_OWNERSHIP.md)
- `gameState.js` - Minimal shared state (ring mode flags, angular velocity reference)
- `settings.js` - ALL user preferences with localStorage persistence
- **Settings proxy pattern** in [main.js](docs/js/main.js#L65-L78) wraps Settings module for backward compatibility

### Core Systems
- **Physics**: PD controller in [physics.js](docs/js/modules/physics.js) with separate DAR/no-DAR tuning
- **Input**: Modular system in `docs/js/modules/input/` (gamepad, keyboard, touch, air roll controller)
- **Rendering**: Three.js scene management in [sceneManager.js](docs/js/modules/sceneManager.js)
- **Car**: Quaternion-based orientation in [car.js](docs/js/modules/car.js)

## Physics System

### Key Concepts
- **DAR Mode**: Directional Air Roll with minimal damping (4.35 vs 2.96) for snappy tornado spins
- **Angular velocity** (`w`): THREE.Vector3 in rad/s, capped at 5.5 rad/s global magnitude
- **Accelerations**: Configured in deg/s² (e.g., pitch: 733°/s²), converted to rad/s² internally
- **PD Control**: Proportional controller (Kp=200, Kd=0) drives angular velocity toward stick input targets

### Validated Parameters
Physics constants in [constants.js](docs/js/modules/constants.js#L167-L183) match Rocket League measurements:
- Max accel: Pitch 733°/s², Yaw 528°/s², Roll 898°/s² (no-DAR)
- Damping: 2.96 (no-DAR), 4.35 (DAR)
- DAR multipliers: Pitch 0.997, Yaw 1.00, Roll 0.98

Python validation scripts in `analysis-archive/` simulate JS physics headlessly and compare to RL CSV data.

## Development Workflow

### Starting Development
```bash
# Start local server (kills existing on :8000, opens browser)
start-server.bat

# Validate setup
validate-setup.bat
```
Server runs at `http://localhost:8000/docs/`

### Git Workflow
⚠️ **IMPORTANT**: Always work in the local repository. Do NOT commit or push to GitHub unless explicitly instructed.
- **Default**: Make all changes locally only
- **Commit trigger**: Only commit to GitHub when user says "commit to github"
- Local and GitHub repos are separate - stabilize locally before pushing

### Testing
**Browser-based test runner** at `http://localhost:8000/tests/test-runner.html`
- Unit tests: settings, physics, input modules
- Integration tests: app startup, accessibility
- Physics validation: accuracy against RL measurements
- Performance tests: frame rate stability

Add tests in `tests/*-tests.js` using the Assert API:
```javascript
testRunner.add('Test Name', () => {
  Assert.equal(actualValue, expectedValue);
});
```

### Physics Validation (Python) - COMPLETE
Physics has been validated against real Rocket League measurements. Validation scripts remain available for reference:
```bash
# Activate virtual environment first
.venv\Scripts\Activate.ps1

# Run physics validation (reference only)
python analysis-archive/test_l4_physics.py
```
Compares headless JS physics simulation to RL CSV data in `automated_tests/`. **Validation complete - physics parameters finalized.**

## Code Conventions

### Module Patterns
- **Exports**: Use named exports: `export function myFunc() {}`
- **Dependencies**: Inject via `init(deps)` for circular dependency avoidance
- **Constants**: Import from `constants.js`: `import * as CONST from './constants.js'`
- **Three.js**: Always use `THREE.Vector3`, `THREE.Quaternion` for 3D math

### Settings Access
**In main.js**: Use proxy pattern `settings.propertyName`
**In modules**: Import from settings.js:
```javascript
import { getSetting, saveSettings } from './settings.js';
const dampValue = getSetting('damp');
```

### Input System
- `input.js` - High-level API (getStickInput, getDARPressed, etc.)
- `input/gamepadInput.js` - Gamepad polling
- `input/touchInput.js` - On-screen virtual joystick
- `input/airRollController.js` - DAR state machine (toggle vs hold)

### Physics Integration
Call `Physics.performStep(car, dt, gameState)` in animation loop. Physics module:
1. Reads input via `Input.getStickInput()`, `Input.getDARPressed()`
2. Updates angular velocity `w` using PD control
3. Integrates quaternion: `car.quaternion.multiply(deltaQ)`

## Critical Files

### Must Read Before Major Changes
- [STATE_OWNERSHIP.md](docs/js/modules/STATE_OWNERSHIP.md) - State management rules
- [README.md](docs/js/modules/README.md) - Module refactoring guide (317 lines)
- [constants.js](docs/js/modules/constants.js) - All configuration constants
- [L4_PHYSICS_TEST_PROTOCOL.md](analysis-archive/L4_PHYSICS_TEST_PROTOCOL.md) - Physics validation targets

### Module Checklist (STATUS.md)
See [STATUS.md](docs/js/modules/STATUS.md) for refactoring completion status. Partially complete modularization.

## Common Tasks

### Adding New Input Binding (CURRENT PRIORITY)
1. Register action in [buttonMapper.js](docs/js/modules/input/buttonMapper.js) - defines available actions
2. Add to default bindings in [settings.js](docs/js/modules/settings.js) - `gpBindings`/`kbBindings`
3. Add UI in [controlsMenu.js](docs/js/modules/controlsMenu.js) - remapping interface
4. Handle in appropriate input module:
   - Gamepad: [gamepadInput.js](docs/js/modules/input/gamepadInput.js)
   - Keyboard: [keyboardInput.js](docs/js/modules/input/keyboardInput.js)
   - Touch: [touchInput.js](docs/js/modules/input/touchInput.js)
5. Read input in [input.js](docs/js/modules/input.js) high-level API
6. Test with all input devices (gamepad/keyboard/touch)

**Rocket League binding reference:**
- Throttle/Brake on triggers (analog)
- Air Roll Left/Right on bumpers
- Jump on face button
- Boost on face button
- Look around on right stick (camera control)

### Adding a New Physics Parameter
1. Add to `PHYSICS_DEFAULTS` in [constants.js](docs/js/modules/constants.js#L167)
2. Update Settings module default in [settings.js](docs/js/modules/settings.js)
3. Access in physics.js via `Settings.getSetting('paramName')`
4. Add UI control in [index.html](docs/index.html) settings panel
5. Test in `tests/physics-tests.js`
⚠️ **Physics is validated - avoid changes unless necessary**

### Modifying DAR Behavior
DAR logic in [physics.js](docs/js/modules/physics.js) `performStep()`:
- Check `darOn` flag for mode switching
- Apply DAR multipliers to accelerations (lines ~502-516)
- Use higher damping coefficient (4.35 vs 2.96) for DAR response characteristics
⚠️ **Physics parameters are finalized - changes should match RL measurements**

## Integration Points

### Three.js Dependencies
- Version: 0.164.0 (CDN imported in HTML)
- GLTFLoader for car models ([GLB files](docs/models/))
- All 3D math via THREE.Vector3, Quaternion, Euler

### External Systems
- **localStorage**: Settings persistence via [settings.js](docs/js/modules/settings.js)
- **Web Audio API**: Sound effects and music in [audio.js](docs/js/modules/audio.js)
- **Gamepad API**: Polling in [gamepadInput.js](docs/js/modules/input/gamepadInput.js)

### Python Analysis
Python scripts use headless simulation (`L4Physics` class in `test_l4_physics.py`) matching JS implementation for validation against RL CSV data.
Working with Geometric Concepts

### Translating Human Spatial Language → Three.js Code
The user often describes spatial/orientation concepts in natural language. Your role is to translate these into geometric/mathematical terms:

**Common patterns:**
- "The car should point toward..." → Use `lookAt()` or calculate direction vector with `subVectors()` and `normalize()`
- "Rotate around the..." → Identify axis vector and use `applyAxisAngle()` or quaternion multiplication
- "The circle tilted at angle..." → Create rotation quaternion or Euler angles, apply to normal vector
- "When spinning in this direction..." → Analyze angular velocity vector components and their signs
- "How the car is facing..." → Extract direction from quaternion using `getWorldDirection()` or basis vectors

**Three.js tools for geometric reasoning:**
- `Vector3`: positions, directions, axes, angular velocity
- `Quaternion`: orientations, rotations (prefer over Euler for physics)
- `Matrix4`: transformations, local↔world space conversions
- `Euler`: human-readable angles (use for UI/debugging only)

**Example interpretation:**
```
User: "Make the arrow point where the car's nose is facing"
→ car.getWorldDirection(targetVector);
→ arrow.position.copy(car.position);
→ arrow.lookAt(targetVector.add(car.position));
```

## Gotchas

- **Unit confusion**: Settings store deg/s², physics calculates in rad/s² (convert with `* Math.PI / 180`)
- **Circular imports**: Use dependency injection via `init()`, don't import physics.js ↔ ringMode.js directly
- **Quaternion order**: Three.js uses `w,x,y,z` not `x,y,z,w`
- **DAR toggle**: State machine in [airRollController.js](docs/js/modules/input/airRollController.js), not simple boolean
- **LocalStorage**: Settings save is deferred during app initialization to avoid 23+ writes
- **Coordinate spaces**: Distinguish local (car-relative) vs world space - use `applyQuaternion()` to transform vectors

## Questions?

Check existing docs first:
- Module architecture: [README.md](docs/js/modules/README.md)
- Integration guide: [INTEGRATION_EXAMPLE.md](docs/js/modules/INTEGRATION_EXAMPLE.md)
- State rules: [STATE_OWNERSHIP.md](docs/js/modules/STATE_OWNERSHIP.md)
- Physics protocol: [L4_PHYSICS_TEST_PROTOCOL.md](analysis-archive/L4_PHYSICS_TEST_PROTOCOL.md)

# L4 DAR Prototype

Comprehensive Rocket League aerial control sandbox with three game modes, advanced input customization, and validated physics. Built with Three.js and ES6 modules.

**Live demo:** https://kronosdevoured.github.io/L4-dar-prototype/

## Features

### Game Modes
- **Free Flight**: Unrestricted aerial movement with tunable physics
- **Ring Mode**: Catch falling rings for points with increasing difficulty
- **Rhythm Mode**: Hit rings to the beat with music-synchronized gameplay

### Input & Control
- **Touch interface**: On-screen analog stick with drag-to-relocate
- **Gamepad support**: Full remappable action binding (PS5/Xbox/generic gamepads)
- **Keyboard controls**: Full flight control mapping
- **Per-stick customization**: Independent deadzone (0-0.5) and sensitivity (0.01-10.00) sliders for left and right sticks
- **Input Assist**: Visual compass showing which direction to push stick to reach target (Ring Mode only)
- **DAR controls**: Toggle or hold modes with visual indicator

### Physics & Dynamics
- **Validated physics**: Acceleration/damping constants verified against real Rocket League measurements
- **Game speed control**: Adjust time flow from 5% to 150% for slow-motion or fast-motion practice
- **Tunable parameters**: Adjust acceleration limits, damping, PD control gains, and angular velocity caps
- **Directional Air Roll (DAR)**: Rapid tornado spins with minimal damping for snappy direction changes
- **Two-stick mode**: Option to use right stick for separate control input

### Models & Visualization
- **GLB car model loading**: Choose local file or load from URL
- **3D visualization**: Three.js rendering with tunable HUD elements
- **Orbit camera**: Blender-style view control with XYZ gizmo, grid, and zoom
- **Direction indicators**: Compass rose, landing zone preview, target tracking

### Audio
- **Sound effects**: Control feedback with toggleable sound
- **Background music**: Selectable music library for Rhythm Mode
- **Adjustable levels**: Independent volume controls

## Physics Behavior

### Control Model
The car uses a **PD controller** (proportional-derivative) to track desired angular velocities:
- Proportional gain: Responds to velocity error
- Derivative gain: Dampens oscillation
- Always respects acceleration and angular velocity limits

### Directional Air Roll (DAR)
When DAR is active:
- **Higher damping coefficient** (4.35 vs 2.96) for snappier response
- **Roll-specific multipliers** tuned to match Real Rocket League measurements
- **Pitch/Yaw constraints** to prevent runaway spinning during tornado rotations
- **Minimal deceleration** when stick is released for immediate direction changes

### Normal Mode
Standard Rocket League physics with:
- Standard damping (2.96)
- Full responsiveness to all three axes
- Brake-on-release option for additional control

## Quick Start (GitHub Pages)
The build is a single file at `docs/index.html`. Just visit the live link above.

## Development Setup
1. Clone the repository
2. Run `start-server.bat` to start the local development server on `http://localhost:8000`
3. Open `http://localhost:8000/docs/index.html` in your browser

## Testing & Validation
Comprehensive automated testing ensures code quality and physics accuracy.

### Running Tests
1. Start the server: `start-server.bat`
2. Open `http://localhost:8000/tests/test-runner.html` in your browser
3. Tests run automatically and display results

### Test Coverage
- **Unit Tests**: Settings, physics calculations, input processing
- **Integration Tests**: Full app startup, mode transitions, accessibility
- **Physics Validation**: Accuracy against Rocket League CSV measurement data
- **Performance Tests**: Frame rate stability, memory usage

### Setup Validation
Run `validate-setup.bat` to verify the development environment is configured correctly.

## Controls

### Analog Stick / On-Screen Joystick
- **Up/Down**: Pitch (nose up/down)
- **Left/Right**: Yaw (rotate left/right)

### Buttons & Actions (Remappable via Menu)
- **Jump**: Face button or Space
- **Boost**: Face button or B (gamepad) / Shift (keyboard)
- **Air Roll Left**: Bumper or Q (keyboard)
- **Air Roll Right**: Bumper or E (keyboard)
- **DAR Button**: Face button or Tab (keyboard) - hold to reposition, tap to toggle direction
- **Menu**: Hamburger icon or Escape

### Camera & View (Free Flight & Ring Mode)
- **Orbit camera**: Middle mouse button drag or right-click drag
- **Zoom**: Mouse wheel or pinch (trackpad)
- **Reset view**: XYZ gizmo buttons or menu

### Ring Mode Specific
- **Boost**: Required to catch rings
- **Look around**: Right stick (camera control) when not in dual-stick mode

## Settings & Customization

### Gamepad Settings
- Remappable action bindings for all buttons and triggers
- Per-stick deadzone adjustment
- Per-stick sensitivity scaling

### Physics Settings
- **Acceleration limits**: Pitch, Yaw, Roll (in °/s²)
- **Angular velocity caps**: Pitch, Yaw, Roll, Global maximum
- **Damping**: Normal mode and DAR mode
- **Brake on Release**: Additional deceleration when stick is released
- **Input curve**: Non-linearity applied to stick input

### Display Settings
- **Show/hide HUD elements**: Arrow, circle, front-face, direction indicator
- **Circle tilt angle**: Customize tornado spin visualization
- **Input assist**: Enable/disable target direction indicator (Ring Mode)

### Audio Settings
- **Game sounds**: Toggle sound effects on/off
- **Background music**: Enable/disable
- **Volume levels**: Independent master, effects, and music controls

### Game Speed
Adjust simulation speed from **5% to 150%** for slow-motion analysis or speedrun practice.

## Model
- Default model: `docs/models/octane.glb` (Rocket League Octane-inspired)
- Load custom models via file picker or URL in the menu

## Project Structure

### Architecture
- **ES6 Modules**: Clean separation of concerns with dependency injection pattern
- **Physics Engine**: Validates against real RL measurements (analysis-archive/)
- **Input System**: Unified interface for keyboard, gamepad, and touch
- **Rendering Pipeline**: Three.js-based 3D visualization with canvas HUD overlay
- **State Management**: Centralized settings with localStorage persistence

### Key Files
- `docs/index.html` - Entry point
- `docs/js/main.js` - Application bootstrap
- `docs/js/modules/` - 20+ modules for physics, input, rendering, game modes, etc.
- `tests/` - Test suite with runner
- `analysis-archive/` - Physics validation scripts and measurement data (reference only)

## Credits & License
See [CREDITS.md](CREDITS.md) for model attribution (CC-BY).
This project is fan-made and non-commercial. Rocket League and Octane are trademarks of Psyonix/Epic Games.

## References
- **Physics Test Protocol**: [L4_PHYSICS_TEST_PROTOCOL.md](analysis-archive/L4_PHYSICS_TEST_PROTOCOL.md)
- **Module Architecture**: [docs/js/modules/README.md](docs/js/modules/README.md)
- **State Ownership**: [docs/js/modules/STATE_OWNERSHIP.md](docs/js/modules/STATE_OWNERSHIP.md)


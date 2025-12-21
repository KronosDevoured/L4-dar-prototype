# L4-dar-prototype

Interactive Rocket League–style air-roll sandbox with joystick + gamepad support, face-direction HUD, and DAR (Directional Air Roll) toggle. Built with Three.js.

**Live demo:** https://kronosdevoured.github.io/L4-dar-prototype/

## Features
- On-screen analog stick + DAR button (drag to relocate).
- PS5/Generic gamepad support with **remappable** actions.
- GLB car model loading (local file picker or hosted URL).
- Blender-style view orbit, XYZ gizmo, grid, zoom.
- Tunable dynamics (accel, damping, caps, input curve).
- **Snappy DAR physics** - Immediate direction changes with minimal deceleration.

## Physics Behavior

### Directional Air Roll (DAR) Mode
When DAR is active, the car physics are optimized for snappy, responsive movement:
- **Higher PD gains** (400 vs 200) for faster response to input changes
- **Minimal damping** when stick is released, allowing immediate direction changes
- **Continuous PD control** even during stick transitions
- **Reduced deceleration** for smoother tornado spins

### Normal Flight Mode
Standard Rocket League-style physics with proper damping and control response.

## Quick Start (GitHub Pages)
The build is a single file at `docs/index.html`. Just visit the live link above.

## Development Setup
1. Clone the repository
2. Run `start-server.bat` to start the local development server
3. Open `http://localhost:8000/docs/index.html` in your browser

## Testing & Validation
This project includes comprehensive automated testing to ensure code quality and physics accuracy.

### Running Tests
1. Start the server: `start-server.bat`
2. Open `http://localhost:8000/tests/test-runner.html` in your browser
3. Tests will run automatically and show results

### Test Coverage
- **Unit Tests**: Core module functionality (settings, physics, input)
- **Integration Tests**: Full application startup and accessibility
- **Physics Validation**: Accuracy against Rocket League measurements
- **Performance Tests**: Frame rate stability and memory usage

### Validation Script
Run `validate-setup.bat` to quickly check if the development environment is properly configured.

## Controls
- **Left stick / on-screen stick:** pitch/yaw.
- **DAR button:** tap = toggle roll, hold = relocate.
- **Buttons:** restart, orbit, roll direction (via menu).
- **Gamepad:** remap via *Gamepad → Remap Action…* in the menu.

## Model
- Default model: `docs/models/octane.glb`

## Credits & License
See [CREDITS.md](CREDITS.md) for model attribution (CC-BY).
This project is fan-made and non-commercial. Rocket League/Octane are trademarks of Psyonix/Epic Games.

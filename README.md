# L4-dar-prototype

Interactive Rocket League–style air-roll sandbox with joystick + gamepad support, face-direction HUD, and DAR (Digital Auto Roll) toggle. Built with Three.js.

**Live demo:** https://kronosdevoured.github.io/L4-dar-prototype/

## Features
- On-screen analog stick + DAR button (drag to relocate).
- PS5/Generic gamepad support with **remappable** actions.
- GLB car model loading (local file picker or hosted URL).
- Blender-style view orbit, XYZ gizmo, grid, zoom.
- Tunable dynamics (accel, damping, caps, input curve).

## Quick Start (GitHub Pages)
The build is a single file at `docs/index.html`. Just visit the live link above.

## Controls
- **Left stick / on-screen stick:** pitch/yaw.
- **DAR button:** tap = toggle roll, hold = relocate.
- **Buttons:** restart, orbit, roll direction (via menu).
- **Gamepad:** remap via *Gamepad → Remap Action…* in the menu.

## Model
- Default model: `docs/models/octane.glb`
- Load your own via *Car → Load GLB…* or replace the hosted file.

## Credits & License
See [CREDITS.md](CREDITS.md) for model attribution (CC-BY).
This project is fan-made and non-commercial. Rocket League/Octane are trademarks of Psyonix/Epic Games.

## Roadmap (short)
- Save/restore settings to `localStorage`.
- Per-device gamepad presets.
- Screenshot/export pose.


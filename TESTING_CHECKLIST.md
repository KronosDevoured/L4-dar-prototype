# Input System Testing Checklist
**Date**: 2025-12-07
**Phase**: Post-Phase 3 Input Module Integration
**Purpose**: Systematic verification of all input systems after modularization

---

## Test Environment Setup
- [ ] Browser: _______________
- [ ] Window size: _______________
- [ ] localStorage cleared (fresh start): Y/N
- [ ] Console open for error monitoring: Y/N

---

## 1. TOUCH INPUT (Mobile/Mouse)

### 1.1 On-Screen Joystick
- [ ] **Visual Rendering**
  - [ ] Joystick base circle appears in bottom-left
  - [ ] Joystick has colored arcs (up/down/left/right indicators)
  - [ ] Center crosshair visible

- [ ] **Basic Movement**
  - [ ] Click/touch inside joystick area activates it
  - [ ] Knob (small circle) follows pointer within base radius
  - [ ] Knob stops at edge when dragged beyond base radius
  - [ ] Car rotates in response to joystick movement
  - [ ] Releasing pointer returns knob to center
  - [ ] Car stops rotating when joystick released (if brake enabled)

- [ ] **Joystick Relocation**
  - [ ] Hold stationary on joystick for 250ms → hint appears
  - [ ] After hint, entire joystick follows cursor
  - [ ] Moving >10px before 250ms cancels relocation
  - [ ] Joystick stays in new position after release
  - [ ] Joystick cannot be moved outside screen bounds

- [ ] **Multi-touch**
  - [ ] Can use joystick with one finger
  - [ ] Can press DAR button with another finger simultaneously
  - [ ] Both inputs work independently

### 1.2 DAR Button (Directional Air Roll)
- [ ] **Visual Rendering**
  - [ ] DAR button appears in bottom-right
  - [ ] Shows current air roll direction indicator
  - [ ] Visual feedback when pressed

- [ ] **Toggle Mode** (if toggle enabled in settings)
  - [ ] First tap activates DAR (last used direction)
  - [ ] Car starts rolling
  - [ ] Second tap deactivates DAR
  - [ ] Car stops rolling

- [ ] **Hold Mode** (if toggle disabled in settings)
  - [ ] Press and hold activates DAR
  - [ ] Car rolls while held
  - [ ] Release deactivates DAR
  - [ ] Car stops rolling when released

- [ ] **DAR Relocation**
  - [ ] Hold stationary on button for 250ms
  - [ ] Button relocates to new position
  - [ ] Button cannot be moved outside screen bounds

### 1.3 Boost Button (Ring Mode Only)
- [ ] **Visibility**
  - [ ] Button NOT visible in free flight mode
  - [ ] Button appears when Ring Mode starts
  - [ ] Button positioned above DAR button

- [ ] **Functionality**
  - [ ] Press and hold activates boost
  - [ ] Boost sound plays (if enabled)
  - [ ] Release deactivates boost
  - [ ] Boost sound stops

---

## 2. KEYBOARD INPUT

### 2.1 Movement (WASD)
- [ ] **W Key** - Pitch up (nose up)
- [ ] **S Key** - Pitch down (nose down)
- [ ] **A Key** - Yaw left
- [ ] **D Key** - Yaw right
- [ ] **W+A** - Diagonal movement (up-left)
- [ ] **W+D** - Diagonal movement (up-right)
- [ ] **S+A** - Diagonal movement (down-left)
- [ ] **S+D** - Diagonal movement (down-right)
- [ ] Releasing keys stops movement (if brake enabled)

### 2.2 Air Roll (QE + Shift)
- [ ] **Toggle Mode** (if enabled)
  - [ ] Q tap → Roll left activates
  - [ ] Q tap again → Roll left deactivates
  - [ ] E tap → Roll right activates
  - [ ] E tap again → Roll right deactivates
  - [ ] Shift tap → Free roll activates
  - [ ] Shift tap again → Free roll deactivates

- [ ] **Hold Mode** (if disabled)
  - [ ] Q hold → Roll left active
  - [ ] Q release → Roll left stops
  - [ ] E hold → Roll right active
  - [ ] E release → Roll right stops
  - [ ] Shift hold → Free roll active
  - [ ] Shift release → Free roll stops

### 2.3 Boost
- [ ] **Spacebar** (Ring Mode only)
  - [ ] Hold activates boost
  - [ ] Release deactivates boost
  - [ ] Boost sound plays/stops

### 2.4 Menu Navigation
- [ ] **Escape** - Opens/closes menu
- [ ] Menu opens when pressed
- [ ] Menu closes when pressed again
- [ ] Physics paused while menu open

---

## 3. GAMEPAD INPUT

### 3.1 Connection
- [ ] **Gamepad Detection**
  - [ ] Connect gamepad
  - [ ] Status shows "Connected: [gamepad name]"
  - [ ] Disconnect gamepad
  - [ ] Status shows "Enabled (waiting for gamepad)"

### 3.2 Analog Sticks
- [ ] **Left Stick**
  - [ ] Move up → Pitch up
  - [ ] Move down → Pitch down
  - [ ] Move left → Yaw left
  - [ ] Move right → Yaw right
  - [ ] Diagonal movements work
  - [ ] Deadzone prevents drift when centered
  - [ ] Returns to neutral when released

### 3.3 Buttons (Default XInput)
- [ ] **Button 1** (B) - Toggle DAR
- [ ] **Button 4** (LB) - Roll left
- [ ] **Button 5** (RB) - Roll right
- [ ] **Button 7** (LT) - Roll free
- [ ] **Button 0** (A) - Boost
- [ ] **Button 9** (Start) - Pause
- [ ] **Button 10** (Select) - Restart
- [ ] **Button 2** (X) - Orbit CW
- [ ] **Button 3** (Y) - Orbit CCW
- [ ] **Button 8** (View) - Toggle theme
- [ ] **Button 6** (Menu) - Open menu

### 3.4 Air Roll (Shoulder Buttons)
- [ ] **Toggle Mode** (if enabled)
  - [ ] LB tap → Roll left toggles on/off
  - [ ] RB tap → Roll right toggles on/off
  - [ ] LT tap → Free roll toggles on/off

- [ ] **Hold Mode** (if disabled)
  - [ ] LB hold → Roll left active
  - [ ] LB release → Roll left stops
  - [ ] RB hold → Roll right active
  - [ ] RB release → Roll right stops
  - [ ] LT hold → Free roll active
  - [ ] LT release → Free roll stops

### 3.5 Gamepad Settings (Menu)
- [ ] **Enable/Disable Toggle**
  - [ ] Click "Enabled" button → becomes "Disabled"
  - [ ] Gamepad stops working
  - [ ] Click "Disabled" button → becomes "Enabled"
  - [ ] Gamepad works again

- [ ] **Preset Selection**
  - [ ] Select "PS5" preset
  - [ ] Bindings update to PS5 layout
  - [ ] Select "XInput" preset
  - [ ] Bindings update to XInput layout

- [ ] **Button Remapping**
  - [ ] Select action from dropdown
  - [ ] Current binding shows (e.g., "Button 4")
  - [ ] Click "Remap" button
  - [ ] Button shows "Release all buttons..."
  - [ ] Release all buttons
  - [ ] Button shows "Press a button..."
  - [ ] Press a new button
  - [ ] Binding updates and saves
  - [ ] New button works for that action

---

## 4. MENU CONTROLS

### 4.1 Air Roll Selection Buttons
- [ ] **Visual State**
  - [ ] Currently active roll direction highlighted
  - [ ] When DAR off, last used direction highlighted

- [ ] **Roll Left Button**
  - [ ] Click activates roll left
  - [ ] Car starts rolling left
  - [ ] Button highlights

- [ ] **Roll Right Button**
  - [ ] Click activates roll right
  - [ ] Car starts rolling right
  - [ ] Button highlights

- [ ] **Roll Free Button**
  - [ ] Click activates free roll
  - [ ] Car starts free rolling
  - [ ] Button highlights

- [ ] **DAR Off Button**
  - [ ] Click deactivates air roll
  - [ ] Car stops rolling
  - [ ] Last used direction still highlighted (dim)

### 4.2 Toggle vs Hold Mode
- [ ] **Toggle Switch**
  - [ ] Shows current mode
  - [ ] Click switches mode
  - [ ] Setting saves to localStorage
  - [ ] Affects keyboard behavior immediately
  - [ ] Affects gamepad behavior immediately
  - [ ] Affects DAR button behavior immediately

---

## 5. SETTINGS PERSISTENCE

### 5.1 Save/Load
- [ ] **Initial Load**
  - [ ] Page loads settings from localStorage
  - [ ] Console shows "Settings loaded from localStorage"
  - [ ] Previous air roll state restored
  - [ ] Previous gamepad bindings restored
  - [ ] Previous toggle mode restored

- [ ] **Auto-Save**
  - [ ] Change air roll direction
  - [ ] Console shows "Settings saved"
  - [ ] Refresh page
  - [ ] Setting restored correctly

- [ ] **Gamepad Bindings**
  - [ ] Remap a button
  - [ ] Console shows "Settings saved"
  - [ ] Refresh page
  - [ ] Binding still remapped

### 5.2 Physics Settings
- [ ] **Slider Changes**
  - [ ] Move any physics slider
  - [ ] Console shows "Settings saved"
  - [ ] Refresh page
  - [ ] Slider at saved position

- [ ] **Reset to Defaults**
  - [ ] Click "Reset Physics" button
  - [ ] All physics sliders return to default
  - [ ] Console shows "Settings saved"
  - [ ] Refresh page
  - [ ] Defaults still applied

---

## 6. RING MODE SPECIFIC

### 6.1 Boost Button
- [ ] **Appearance**
  - [ ] Not visible in free flight
  - [ ] Appears when Ring Mode starts
  - [ ] Positioned correctly

- [ ] **Functionality**
  - [ ] Touch/click activates boost
  - [ ] Spacebar activates boost
  - [ ] Gamepad button activates boost
  - [ ] All boost inputs work simultaneously
  - [ ] Boost affects movement speed
  - [ ] Boost sound plays

### 6.2 Pause/Resume
- [ ] **Pause**
  - [ ] Keyboard (Escape/P) pauses
  - [ ] Gamepad pause button works
  - [ ] Physics stops
  - [ ] Input still reads (can see joystick move)

- [ ] **Resume**
  - [ ] Click resume in pause screen
  - [ ] Physics resumes
  - [ ] All controls work

---

## 7. CROSS-INPUT COORDINATION

### 7.1 Input Priority
- [ ] **Movement Priority**
  - [ ] Touch joystick active → keyboard WASD ignored
  - [ ] Touch joystick active → gamepad stick ignored
  - [ ] Touch joystick released → keyboard WASD works
  - [ ] Touch joystick released → gamepad stick works

- [ ] **Air Roll Stacking**
  - [ ] Hold Q (keyboard roll left)
  - [ ] Press LB (gamepad roll left)
  - [ ] Release Q → still rolling (gamepad active)
  - [ ] Release LB → stops rolling

- [ ] **Boost Stacking**
  - [ ] Hold spacebar
  - [ ] Press gamepad boost
  - [ ] Release spacebar → still boosting
  - [ ] Release gamepad → stops boosting

---

## 8. ERROR CONDITIONS

### 8.1 Console Errors
- [ ] **On Page Load**
  - [ ] No errors in console
  - [ ] All modules load successfully

- [ ] **During Gameplay**
  - [ ] No errors while using touch
  - [ ] No errors while using keyboard
  - [ ] No errors while using gamepad
  - [ ] No errors when switching inputs

- [ ] **Menu Interactions**
  - [ ] No errors when opening menu
  - [ ] No errors when changing settings
  - [ ] No errors when closing menu

### 8.2 Edge Cases
- [ ] **Rapid Input Changes**
  - [ ] Quickly switch between touch/keyboard/gamepad
  - [ ] No jerky movement
  - [ ] No stuck inputs

- [ ] **Window Resize**
  - [ ] Resize browser window
  - [ ] Joystick stays in bounds
  - [ ] DAR button stays in bounds
  - [ ] Controls still work

- [ ] **Tab Switch**
  - [ ] Switch to another tab
  - [ ] Switch back
  - [ ] All controls still work
  - [ ] No stuck keys

---

## 9. VISUAL FEEDBACK

### 9.1 HUD Rendering
- [ ] **Joystick**
  - [ ] Base circle renders
  - [ ] Knob renders
  - [ ] Knob position matches input
  - [ ] Smooth animation

- [ ] **DAR Button**
  - [ ] Button renders
  - [ ] Arrow shows direction
  - [ ] Highlight when pressed
  - [ ] Smooth transitions

- [ ] **Boost Button**
  - [ ] Renders in Ring Mode
  - [ ] Highlight when pressed
  - [ ] Disappears in free flight

### 9.2 Car Response
- [ ] **Rotation**
  - [ ] Car rotates in response to all inputs
  - [ ] Rotation is smooth
  - [ ] Rotation stops when input released (brake)

- [ ] **Air Roll**
  - [ ] Car rolls around correct axis
  - [ ] Roll direction matches input
  - [ ] Roll stops when released

- [ ] **Boost**
  - [ ] Visible speed increase
  - [ ] Boost particles (if applicable)

---

## SUMMARY

### Issues Found
1. ________________________________________
2. ________________________________________
3. ________________________________________
4. ________________________________________
5. ________________________________________

### Working Systems
- [ ] Touch input
- [ ] Keyboard input
- [ ] Gamepad input
- [ ] Menu controls
- [ ] Settings persistence
- [ ] Ring Mode features
- [ ] Cross-input coordination

### Priority Fixes Needed
1. ________________________________________
2. ________________________________________
3. ________________________________________

---

**Tester Notes:**
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

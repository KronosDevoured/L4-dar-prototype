# Stick Input Behavior Analysis - Air Roll Left with DAR

**Date:** 2025-12-19
**Test Data Source:** tornado_measurements.csv (24 valid measurements)

## Question Being Analyzed

"How do RL physics handle stick inputs with DAR active when moving the stick counter-clockwise at max input while the car is spinning?"

## Data Overview

The measurement bot captured **static snapshots** at 5 different stick angles:
- 0° (stick pointing forward)
- 22.5° (stick pointing forward-right)
- 45° (stick pointing right)
- 67.5° (stick pointing back-right)
- 90° (stick pointing backward)

Each angle was tested at 5 magnitudes: 0.10, 0.25, 0.50, 0.75, 1.00

## Key Finding: Axis Tilt vs Stick Angle

| Stick Angle | Avg Axis Tilt | Axis Behavior |
|-------------|---------------|---------------|
| 0.0° | 42.5° | Forward stick → ~43° tilt from vertical |
| 22.5° | 59.4° | Forward-right → ~59° tilt |
| 45.0° | 83.5° | Right stick → ~84° tilt (nearly horizontal!) |
| 67.5° | 68.3° | Back-right → ~68° tilt |
| 90.0° | 49.8° | Backward stick → ~50° tilt |

**Pattern Discovered:**
- The axis tilt **peaks** at 45° stick angle (~83-84° from vertical)
- This creates an **asymmetric response curve** as the stick rotates
- Moving the stick counter-clockwise would experience **varying rotation axis angles**

## Axis Direction Changes (in World Space)

Analyzing the axis vector components at magnitude 1.0:

| Stick Angle | Axis X | Axis Y | Axis Z | Notes |
|-------------|--------|--------|--------|-------|
| 0.0° | -0.394 | -0.519 | -0.758 | Pointing down-back-left |
| 22.5° | -0.363 | -0.720 | -0.592 | Rotated toward Y-axis |
| 45.0° | -0.368 | -0.916 | -0.159 | Almost aligned with Y-axis! |
| 67.5° | -0.370 | -0.853 | 0.369 | Z component flipped positive |
| 90.0° | -0.318 | -0.755 | 0.574 | Pointing up-back-left |

**Key Observation:**
- The axis rotates smoothly in world space as stick angle changes
- Z component transitions from **negative** (-0.758) to **positive** (0.574)
- Y component remains strongly negative (dominant -Y direction)
- X component stays relatively constant (~-0.35)

## Tornado Radius vs Stick Angle (at max magnitude 1.0)

| Stick Angle | Radius (uu) | Change from Previous |
|-------------|-------------|----------------------|
| 0.0° | 22.83 | - |
| 22.5° | 19.15 | -3.68 uu (-16.1%) |
| 45.0° | 15.35 | -3.80 uu (-19.8%) |
| 67.5° | 17.37 | +2.02 uu (+13.2%) |
| 90.0° | 18.39 | +1.02 uu (+5.9%) |

**Critical Finding:**
- Tornado radius is **NOT constant** across stick angles
- **Minimum radius** occurs at 45° stick angle (15.35 uu)
- **Maximum radius** occurs at 0° stick angle (22.83 uu)
- This represents a **48.7% variation** in radius!

## What This Means for Counter-Clockwise Stick Movement

If you hold Air Roll Left and move the stick counter-clockwise at max input:

### Phase 1: 0° → 45° (Forward → Right)
- **Axis tilt increases** from 43° to 84° (becoming more horizontal)
- **Radius decreases** from 22.83 uu to 15.35 uu (**-32.8% shrink**)
- **Movement becomes tighter/sharper** as radius contracts
- The car's tornado cone "flattens out" significantly

### Phase 2: 45° → 90° (Right → Backward)
- **Axis tilt decreases** from 84° to 50° (becoming more vertical again)
- **Radius increases** from 15.35 uu to 18.39 uu (**+19.8% expansion**)
- **Movement becomes wider/looser** as radius expands
- The tornado cone tilts back toward vertical

### Phase 3: 90° → 180° (Backward → Left)
- *Not measured in current dataset* - would need additional angles
- Likely mirrors the 0° → 90° pattern due to symmetry

### Phase 4: 180° → 360° (Left → Forward)
- *Not measured in current dataset*
- Likely completes the symmetric pattern

## "Sharpness" Analysis

**Sharp turns occur when:**
1. **Radius is small** (tight circle)
2. **Angular velocity is high** (fast spin rate)

From the data:
- **Sharpest movement**: 45° stick angle (smallest radius 15.35 uu)
- **Widest movement**: 0° stick angle (largest radius 22.83 uu)
- **Difference**: 48.7% variation in "sharpness"

**This means:**
- Moving the stick counter-clockwise while spinning creates **non-uniform movement**
- The car traces a **variable-radius path** not a perfect circle
- When stick passes through 45°, the tornado tightens significantly
- When stick is at 0° or 90°, the tornado is wider and smoother

## Additional Data Needed

To fully answer "how sharply the car moves as the stick is moving":

1. **More stick angles** (need 8-16 angles for full circle, currently have 5)
2. **Angles beyond 90°** (need 135°, 180°, 225°, 270°, 315° to see full pattern)
3. **Dynamic measurement** (current data is static snapshots, not continuous stick movement)
4. **Angular velocity tracking** during stick rotation (not just radius/axis)

## Conclusion

**The data reveals Rocket League does NOT treat all stick directions equally during DAR:**

1. ✅ **Stick angle directly affects axis tilt** (43° to 84° range)
2. ✅ **Stick angle directly affects tornado radius** (15-23 uu range)
3. ✅ **45° stick angle produces tightest/sharpest movement** (minimum radius)
4. ✅ **Movement "sharpness" varies by ~50%** across different stick angles
5. ⚠️ **Full 360° pattern unknown** (only measured 0-90° quadrant)

**For L4 DAR prototype:**
- Must implement **non-uniform radius** based on stick angle
- Must implement **variable axis tilt** (not fixed 34°!)
- Peak tilt (~84°) occurs at 45° stick angle
- Minimum radius occurs at 45° stick angle

**To perfectly match RL behavior, L4 needs:**
- Lookup table or formula for `axis_tilt(stick_angle)`
- Lookup table or formula for `tornado_radius(stick_angle, magnitude)`
- These should be **independent** of the car's current orientation

## Next Steps

To complete this analysis, recommend:
1. **Extended measurement bot** to capture 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° (8 angles)
2. **Dynamic test** that moves stick continuously and tracks car path
3. **Angular velocity measurements** during stick rotation
4. **Comparison** of clockwise vs counter-clockwise stick movement

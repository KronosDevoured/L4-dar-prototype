# L4 DAR Prototype - Recommended Settings Based on RL Measurements

**Date:** 2025-12-19
**Data Source:** Test 2 - 25 valid tornado spin measurements (Air Roll Left)

## Current L4 Dynamics Card Sliders

Based on analysis of the measurement data and the L4 Physics Test Protocol, here are the **recommended settings**:

### ✅ Settings That Match Protocol (Already Correct)

| Slider | Current Value | Recommended | Status |
|--------|---------------|-------------|--------|
| **Max Pitch Accel** | 714°/s² | **733°/s²** | ⚠️ Adjust +19 |
| **Max Yaw Accel** | 521°/s² | **528°/s²** | ⚠️ Adjust +7 |
| **Max Roll Accel** | 2153°/s² | **898°/s² (no-DAR)** | ❌ Too high! |
| **Input Curve** | 1.0 | **1.0** | ✅ Correct |
| **Damp (No-DAR)** | 2.96 | **2.96** | ✅ Correct |
| **Damp (DAR)** | 4.35 | **4.35** | ✅ Correct |
| **Release Brake** | 0.0 | **0.0** | ✅ Correct |
| **Max ω (global)** | 5.5 rad/s | **5.5 rad/s** | ✅ Correct |
| **Max Pitch ω** | 24.0 rad/s | **24.0 rad/s** | ✅ Correct (effectively unlimited) |
| **Max Yaw ω** | 24.0 rad/s | **24.0 rad/s** | ✅ Correct (effectively unlimited) |
| **Max Roll ω** | 24.0 rad/s | **24.0 rad/s** | ✅ Correct (effectively unlimited) |
| **Stick Range** | 1.0 | **1.0** | ✅ Correct |

## Recommended Adjustments

### 1. Max Pitch Accel (No-DAR)
- **Current:** 714°/s²
- **Protocol:** 733°/s²
- **Action:** Increase to **733**

### 2. Max Yaw Accel (No-DAR)
- **Current:** 521°/s²
- **Protocol:** 528°/s²
- **Action:** Increase to **528**

### 3. Max Roll Accel (No-DAR)
- **Current:** 2153°/s²
- **Protocol:** 898°/s²
- **Action:** **Decrease to 898** (currently more than 2x too high!)

## ⚠️ CRITICAL FINDING: Circle Tilt Angle is NOT Constant!

### Protocol Says:
- Circle Tilt Angle: **34°** (fixed value)

### Measurements Show:
The axis tilt **varies dramatically** with stick input direction:

| Stick Angle | Measured Tilt Range | Average |
|-------------|---------------------|---------|
| 0.0° (Forward) | 37.94° - 44.26° | **41.5°** |
| 22.5° (Forward-Right) | 56.39° - 62.79° | **59.8°** |
| 45.0° (Right) | 81.07° - 88.28° | **84.9°** |
| 67.5° (Back-Right) | 68.44° - 72.23° | **69.8°** |
| 90.0° (Backward) | 44.34° - 57.21° | **49.4°** |

**This means:**
- ❌ There is NO single "Circle Tilt Angle" value
- ✅ Axis tilt is a **function of stick angle**
- ✅ Tilt ranges from **~38° to ~88°** (2.3x variation!)
- ✅ Peak tilt occurs at **45° stick angle** (~85°)

## 🔧 Implementation Recommendations

### Option 1: Add Lookup Table for Axis Tilt (Recommended)

The L4 prototype needs to implement **dynamic axis tilt calculation** based on stick input:

```javascript
// Pseudocode for axis tilt calculation
function getAxisTilt(stickAngle) {
  // Lookup table from measurements (0-90° quadrant)
  const tiltMap = {
    0.0: 41.5,    // Forward
    22.5: 59.8,   // Forward-right
    45.0: 84.9,   // Right (peak tilt)
    67.5: 69.8,   // Back-right
    90.0: 49.4    // Backward
  };

  // Interpolate between values
  // Mirror for other quadrants (90-180°, 180-270°, 270-360°)
  return interpolate(stickAngle, tiltMap);
}
```

### Option 2: Mathematical Model (If pattern is symmetric)

If full 360° measurements confirm symmetry, the tilt might follow a formula like:
- Peak at 45°, 135°, 225°, 315° (~85°)
- Minimum at 0°, 90°, 180°, 270° (~41-49°)

Could potentially fit to a periodic function (sine wave or similar).

## 📊 Tornado Radius Scaling

The measurements also show **radius varies with stick angle**:

### At Maximum Magnitude (1.0):

| Stick Angle | Radius (uu) | Relative to 45° |
|-------------|-------------|-----------------|
| 0.0° | 23.99 uu | +40.2% larger |
| 22.5° | 19.15 uu | +11.9% larger |
| 45.0° | 17.11 uu | **Baseline (minimum)** |
| 67.5° | 16.81 uu | -1.8% smaller |
| 90.0° | 18.53 uu | +8.3% larger |

**Pattern:**
- **Smallest radius** at 45° and 67.5° stick angles (~17 uu)
- **Largest radius** at 0° stick angle (~24 uu)
- **40% variation** in tornado radius across stick directions!

### Radius Scaling by Magnitude:

| Magnitude | Average Radius | Scaling Factor |
|-----------|----------------|----------------|
| 0.10 | 1.79 uu | 1.0x (baseline) |
| 0.25 | 4.79 uu | 2.68x |
| 0.50 | 10.35 uu | 5.78x |
| 0.75 | 15.08 uu | 8.43x |
| 1.00 | 18.92 uu | 10.57x |

**Non-linear relationship:** Radius scales roughly as `magnitude^1.5` to `magnitude^2`

## 🎯 Summary: What Needs to Change in L4

### Immediate Slider Adjustments:
1. ✅ **Max Pitch Accel:** 714 → **733°/s²**
2. ✅ **Max Yaw Accel:** 521 → **528°/s²**
3. ❌ **Max Roll Accel:** 2153 → **898°/s²** (MAJOR FIX)

### Code Implementation Required:
4. ⚠️ **Remove fixed "Circle Tilt Angle" (34°)**
5. ⚠️ **Implement dynamic axis tilt** based on stick angle (37-88° range)
6. ⚠️ **Implement dynamic tornado radius** based on stick angle (17-24 uu at mag 1.0)
7. ⚠️ **Verify DAR acceleration rates** (should be ~2x higher than no-DAR)

### DAR Acceleration Rates (From Protocol):
When DAR is active (handbrake held):
- **Pitch accel (DAR):** 1711°/s² (vs 733 no-DAR = 2.33x multiplier)
- **Yaw accel (DAR):** 1562°/s² (vs 528 no-DAR = 2.96x multiplier)
- **Roll accel (DAR):** 1437°/s² (vs 898 no-DAR = 1.60x multiplier)

**Note:** L4 might need separate sliders or multipliers for DAR-active acceleration rates.

## 📁 Reference Files

- Protocol: `L4_PHYSICS_TEST_PROTOCOL.md`
- Test 2 Data: `tornado_measurements.csv`
- Test 1 vs 2 Comparison: `TEST2_VERIFICATION.md`
- Stick Input Analysis: `STICK_INPUT_ANALYSIS.md`
- This guide: `L4_SETTINGS_GUIDE.md`

## Next Steps

1. ✅ Adjust slider values for pitch/yaw/roll acceleration
2. ⚠️ Remove or make "Circle Tilt Angle" dynamic (not fixed at 34°)
3. ⚠️ Implement stick-angle-dependent axis tilt calculation
4. ⚠️ Implement stick-angle-dependent radius scaling
5. 🔬 Consider measuring full 360° (8 angles) to confirm symmetry
6. 🔬 Verify DAR acceleration multipliers are correct

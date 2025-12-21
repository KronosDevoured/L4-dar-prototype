# L4 Tornado Spin Speed Diagnostic

**Issue:** Tornado spins completing in 0.79 seconds instead of expected 1.14 seconds

## Problem Summary

**Expected:**
- One full tornado cycle: 1.143 seconds
- Angular velocity: 5.5 rad/s
- Based on RL measurements

**Observed in L4:**
- One full tornado cycle: **0.79 seconds**
- Implied angular velocity: **7.95 rad/s** (1.45x too fast!)

## Calculations

```
Expected time = 2π / 5.5 rad/s = 1.142 seconds
Observed time = 0.79 seconds
Speed ratio = 1.142 / 0.79 = 1.446x too fast

Implied ω = 2π / 0.79 = 7.95 rad/s
Difference = 7.95 / 5.5 = 1.45x
```

## Code Review Findings

### ✅ Correct Settings:
1. **Target roll speed** (line 471): `targetRollSpeed = 5.5 rad/s` ✅
2. **Global cap** (line 833-839): Applies to total magnitude ✅
3. **Quaternion integration** (line 841-853): Standard formula ✅
4. **Timestep** (main.js:249): Variable dt, capped at 0.033s ✅

### ⚠️ Potential Issues Found:

#### 1. DAR Acceleration Multiplier (Line 448)
```javascript
maxAccelRollRad *= 0.98;     // DAR: 2153→2110 deg/s²
```

**Problem:** This comment references the OLD incorrect roll accel value (2153°/s²)
**Current slider value:** 898°/s²
**Calculation:** 898 × 0.98 = 880°/s²

**Question:** Should this multiplier be updated based on new slider values?
- RL DAR roll accel: 1437°/s²
- RL no-DAR roll accel: 898°/s²
- Multiplier should be: 1437 / 898 = **1.60x** (not 0.98x!)

**This could cause the car to reach max speed faster, but shouldn't affect final velocity...**

#### 2. Unknown Browser/System Time Scaling?
- Could `performance.now()` be running at different rate?
- Could browser be running at higher refresh rate and dt is smaller?

#### 3. Possible Double-Application of Roll?
- Need to verify `Input.getAirRoll()` returns exactly -1 or 1
- Could it be returning a larger value?

## Questions to Investigate

### Question 1: How are you measuring the 0.79 seconds?
- Using in-browser timer?
- Watching the yellow rotation indicator complete one loop?
- Counting frames?

### Question 2: What mode are you testing?
- Air Roll Left + stick input?
- Air Roll Right + stick input?
- DAR button + menu selection?
- Free air roll?

### Question 3: What stick magnitude?
- Full magnitude (1.0)?
- Partial magnitude?
- Which stick angle (0°, 45°, 90°)?

### Question 4: Is the 5.5 rad/s cap being applied?
- Can you check the browser console?
- Add this debug logging to physics.js after line 839:

```javascript
// Debug: Log angular velocity magnitude
if (Input.getDarOn() && stickMag > 0.5) {
  console.log(`ω magnitude: ${totalMag.toFixed(3)} rad/s, w.z: ${w.z.toFixed(3)}`);
}
```

### Question 5: Frame rate?
- What FPS is the browser running at?
- Could check via `1/dt` average

## Hypothesis

**Most Likely:** There's a multiplier or scaling factor somewhere that's amplifying the roll speed by ~1.45x.

**Possible causes:**
1. `Input.getAirRoll()` returning value > 1 (e.g., 1.45 instead of 1.0)
2. Hidden time scaling in Three.js or browser
3. DAR acceleration too high causing overshoot past 5.5 rad/s cap
4. Global cap not being applied correctly despite code looking right
5. Measurement error (less likely given precise 0.79s value)

## Next Steps

1. **Add debug logging** to verify actual angular velocity values
2. **Check Input.getAirRoll()** return value
3. **Verify dt values** are correct (should average ~0.0167s at 60 FPS)
4. **Test different modes** (Air Roll Left vs Right vs Free)
5. **Fix DAR acceleration multiplier** (line 448)

## Proposed Fix for DAR Acceleration

```javascript
// BEFORE:
if (Input.getDarOn()) {
  maxAccelPitchRad *= 0.997;  // DAR: 714→712 deg/s²
  maxAccelYawRad *= 1.00;      // DAR: 521→522 deg/s² (no change)
  maxAccelRollRad *= 0.98;     // DAR: 2153→2110 deg/s² (WRONG!)
}

// AFTER:
if (Input.getDarOn()) {
  maxAccelPitchRad *= 2.33;   // DAR: 733→1711 deg/s² (2.33x multiplier)
  maxAccelYawRad *= 2.96;     // DAR: 528→1562 deg/s² (2.96x multiplier)
  maxAccelRollRad *= 1.60;    // DAR: 898→1437 deg/s² (1.60x multiplier)
}
```

**From protocol:**
- Pitch: 733°/s² (no-DAR) → 1711°/s² (DAR) = 2.33x
- Yaw: 528°/s² (no-DAR) → 1562°/s² (DAR) = 2.96x
- Roll: 898°/s² (no-DAR) → 1437°/s² (DAR) = 1.60x

But this affects **acceleration**, not max velocity, so it shouldn't cause 1.45x speed increase...

## Summary

The code **looks correct** for limiting to 5.5 rad/s, but the tornado is empirically spinning **1.45x too fast**.

**Critical need:** Debug logging to see actual `w.z` and `totalMag` values during tornado spin.

Without seeing the actual runtime values, I cannot definitively identify the bug.

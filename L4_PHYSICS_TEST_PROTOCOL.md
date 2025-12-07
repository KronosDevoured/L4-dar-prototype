# L4 DAR Prototype Physics Validation Protocol

## Objective
Validate that L4 simulator physics match the real Rocket League measurements.

## Target Measurements from Real Rocket League

### Max Angular Velocity
- **Global cap**: 5.5 rad/s (315°/s) - applies to total magnitude
- **Individual axes**: No per-axis limits, only global magnitude cap

### Acceleration Rates (No-DAR)
- **Pitch**: 733°/s² (12.80 rad/s²)
- **Yaw**: 528°/s² (9.22 rad/s²)
- **Roll**: 898°/s² (15.68 rad/s²)

### Acceleration Rates (DAR)
- **Pitch**: 1711°/s² (29.86 rad/s²)
- **Yaw**: 1562°/s² (27.26 rad/s²)
- **Roll**: 1437°/s² (25.08 rad/s²)

### Damping Coefficients
- **No-DAR**: 2.96 (exponential decay constant)
- **DAR**: 4.35 (exponential decay constant)

### Deceleration Times (from max velocity to stop)
- **To 5% of max**:
  - Pitch no-DAR: 1.025s
  - Pitch DAR: 0.842s
  - Yaw no-DAR: 1.533s
  - Yaw DAR: 1.183s
  - Roll no-DAR: 0.600s
  - Roll DAR: 0.592s

- **To 1% of max**:
  - Pitch no-DAR: 1.558s
  - Pitch DAR: 1.383s
  - Yaw no-DAR: 2.333s
  - Yaw DAR: 1.983s
  - Roll no-DAR: 0.933s
  - Roll DAR: 0.933s

## Current L4 Settings (After Updates)

```
Max Pitch Accel: 733°/s²
Max Yaw Accel: 528°/s²
Max Roll Accel: 898°/s²
Input Curve: 1.0
Damp (No-DAR): 2.96
Damp (DAR): 4.35
Release Brake: 0.0
Max ω (global): 5.5 rad/s
Max Pitch ω: 24.0 rad/s (effectively unlimited)
Max Yaw ω: 24.0 rad/s (effectively unlimited)
Max Roll ω: 24.0 rad/s (effectively unlimited)
Circle Tilt Angle: 34°
```

## Test Protocol

### Test 1: Max Angular Velocity Check
**Goal**: Verify 5.5 rad/s cap is working correctly

1. Hold full pitch input for 5+ seconds
2. Measure time to reach max velocity
3. Measure max angular velocity achieved
4. **Expected**: ~5.5 rad/s, reached in ~0.4s (no-DAR)

### Test 2: Acceleration Rate - Pitch (No-DAR)
**Goal**: Verify acceleration matches 733°/s²

1. Start from rest
2. Apply full pitch input
3. Measure angular velocity at 0.1s intervals
4. Calculate: time to reach 95% of max (should be ~0.4s)
5. **Expected**: Linear acceleration region shows ~12.8 rad/s² slope

### Test 3: Acceleration Rate - Pitch (DAR)
**Goal**: Verify acceleration matches 1711°/s²

1. Activate DAR (handbrake)
2. Start from rest
3. Apply full pitch input
4. Measure angular velocity at 0.1s intervals
5. **Expected**: Reaches 95% max in ~0.175s

### Test 4: Deceleration - Pitch (No-DAR)
**Goal**: Verify damping coefficient 2.96 is correct

1. Accelerate to max velocity (5.5 rad/s)
2. Release all inputs
3. Measure angular velocity decay
4. Time how long to reach 5% of max (~0.275 rad/s)
5. **Expected**: ~1.0 seconds
6. Time to reach 1% of max (~0.055 rad/s)
7. **Expected**: ~1.56 seconds

### Test 5: Deceleration - Pitch (DAR)
**Goal**: Verify DAR damping coefficient 4.35 is correct

1. Activate DAR
2. Accelerate to max velocity (5.5 rad/s)
3. Release pitch input (keep DAR active)
4. Measure angular velocity decay
5. Time to 5% of max
6. **Expected**: ~0.84 seconds
7. Time to 1% of max
8. **Expected**: ~1.38 seconds

### Test 6: Roll Characteristics
**Goal**: Verify roll behaves correctly

1. Apply full roll input for 5 seconds
2. Measure max angular velocity magnitude
3. **Expected**: Total magnitude = 5.5 rad/s
4. Check time for one full rotation
5. **Expected**: ~1.14 seconds per rotation

### Test 7: Multi-Axis Tornado Spin
**Goal**: Verify no artificial tornado cone limitations

1. Activate DAR with Air Roll Left/Right
2. Apply diagonal stick input (e.g., up-right)
3. Verify the car responds with full authority
4. The tornado circle should show natural physics
5. **Expected**: No sluggish feeling, full 5.5 rad/s magnitude

## How to Record Data

If you can add console logging or telemetry to L4:

```javascript
// Add to physics update loop
if (testMode) {
  console.log(`${time.toFixed(3)},${w.length().toFixed(3)},${w.x.toFixed(3)},${w.y.toFixed(3)},${w.z.toFixed(3)}`);
}
```

Then save to CSV for analysis.

## Analysis Checklist

- [ ] Max velocity reaches 5.5 rad/s ±0.05
- [ ] Acceleration rates within 10% of target
- [ ] Deceleration times within 15% of target
- [ ] No artificial slow-down during tornado spins
- [ ] Roll feels responsive (1 rotation per 1.1-1.2 seconds)
- [ ] DAR increases acceleration ~2x vs no-DAR
- [ ] DAR increases damping ~1.47x vs no-DAR

## If Values Don't Match

### Max velocity too high/low
→ Adjust "Max ω (global)" slider

### Acceleration too fast/slow
→ Adjust "Max [Axis] Accel" sliders

### Deceleration too fast (stops too quickly)
→ Decrease "Damp" sliders

### Deceleration too slow (drifts too long)
→ Increase "Damp" sliders

### Different behavior when inputs released
→ Check "Release Brake" is at 0.0

### Tornado spins feel slow/limited
→ Verify per-axis max ω sliders are at 24.0
→ Check that tornado cone angle code was removed

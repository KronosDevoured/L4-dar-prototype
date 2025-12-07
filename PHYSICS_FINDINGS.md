# L4 Physics Tuning - Key Findings

## Critical Discovery: Damping Only Applies When Inputs Released

**THE BIG FIX**: Damping should NOT be applied during active stick input!

- During active input: Only PD control limits velocity
- When stick released: Damping kicks in (2.96 for no-DAR, 4.35 for DAR)
- This allows the car to reach the full 5.5 rad/s global cap

**Before fix**: L4 reached only 3-4 rad/s (equilibrium between acceleration and damping)
**After fix**: L4 reaches exactly 5.5 rad/s ✓

## Measured Values from Rocket League

### Max Angular Velocity
- **Global cap: 5.5 rad/s** (applies to magnitude, not individual axes)
- Per-axis caps: Set to 24.0 (effectively unlimited, only global cap matters)

### Damping Coefficients (Release Only!)
- **No-DAR: 2.96**
- **DAR: 4.35** (47% stronger)
- Release brake: 0.0 (no additional braking in RL)

### Instantaneous Acceleration Limits (from frame-by-frame analysis)

**Pitch:**
- No-DAR: ~713.7°/s² (12.46 rad/s²)
- DAR: Higher (need to measure)

**Yaw:**
- No-DAR: ~91.5°/s² (1.60 rad/s²) ⚠️ MUCH SLOWER THAN PITCH!
- DAR: Higher (need to measure)

**Roll:**
- Analysis shows highly variable acceleration
- Need more careful measurement

### Average Acceleration to 95% Max (from comprehensive tests)
These are AVERAGE rates, not instantaneous limits:

**No-DAR:**
- Pitch: 733°/s²
- Yaw: 528°/s²
- Roll: 898°/s²

**DAR:**
- Pitch: 1711°/s²
- Yaw: 1562°/s²
- Roll: 1437°/s²

## Current L4 Status

✓ **Max velocity**: Perfect (5.5 rad/s)
✗ **Acceleration rates**: Too fast (L4 accelerates 40-60% faster than RL)

### Comparison Results:
```
Test          L4 Time to 95%   RL Time to 95%   Difference
Pitch No-DAR      0.567s           0.925s          38.7% faster
Pitch DAR         0.567s           0.683s          17.1% faster
Yaw No-DAR        0.400s           1.075s          62.8% faster ⚠️
Yaw DAR           0.400s           0.700s          42.9% faster
Roll No-DAR       0.333s           0.842s          60.4% faster
Roll DAR          0.333s           0.717s          53.5% faster
```

## Next Steps

1. **Measure actual instantaneous acceleration limits** for each axis and DAR state
2. **Update L4 max acceleration sliders** to match measured instantaneous limits (not average rates)
3. **Special attention to yaw**: Much slower than pitch (~91°/s² vs ~714°/s²)

## Implementation Notes

### In automated_physics_test.py (FIXED):
```python
# Damping only when no stick input
no_stick = eff < 0.02
if no_stick:
    base_damp = self.damp_dar if self.dar_on else self.damp
    damp_eff = base_damp + (self.brake_on_release if not self.dar_on else 0)
    scale = math.exp(-damp_eff * dt)
    w.multiply_scalar(scale)
```

### In index.html (FIXED):
```javascript
// --- 7. Damping + release brake ---
// CRITICAL: Damping only applies when inputs are released!
const noStick = eff < 0.02;
if (noStick) {
    const baseDamp = darOn ? dampDAR : damp;
    const dampEff = (baseDamp || 0) + ((!darOn) ? (brakeOnRelease || 0) : 0);
    const scale = Math.exp(-dampEff * dt);
    w.multiplyScalar(scale);
}
```

## Roll Testing Notes

Roll tests needed special handling:
- Use Air Roll (Free) mode (air_roll = 2) with stick input
- NOT Air Roll Left/Right buttons without stick
- This matches how RL tests measured roll (using analog input)

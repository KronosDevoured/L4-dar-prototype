# Tornado Spin Rotation Rate Analysis

**Date:** 2025-12-19
**Data Source:** L4 Physics Test Protocol + Test 2 Measurements

## Time for One Complete Tornado Spin

### Based on Max Angular Velocity (5.5 rad/s)

During DAR tornado spins, the car rolls at the maximum angular velocity cap:

**Max Angular Velocity:** 5.5 rad/s = 315°/s

**Time for 360° rotation:**
```
Time = 360° / 315°/s = 1.143 seconds
```

Or in radians:
```
Time = 2π radians / 5.5 rad/s = 1.142 seconds
```

### Verification from L4 Protocol

The L4 Physics Test Protocol (line 471) confirms:
```
DAR roll speed: 5.5 rad/s (one full roll every ~1.14 seconds)
```

✅ **Answer: ~1.14 seconds per complete tornado rotation**

## Rotation Rates at Different Angular Velocities

| Angular Velocity | Degrees/sec | Time per 360° | RPM |
|------------------|-------------|---------------|-----|
| 5.5 rad/s | 315°/s | **1.143 s** | **52.6 RPM** |
| 5.0 rad/s | 286°/s | 1.258 s | 47.7 RPM |
| 4.0 rad/s | 229°/s | 1.572 s | 38.2 RPM |
| 3.0 rad/s | 172°/s | 2.093 s | 28.6 RPM |

**Note:** Rocket League tornado spins occur at the maximum 5.5 rad/s rate when DAR is active.

## Angular Velocity Components During Tornado Spin

From the protocol's reference to `yaw_dar_test.csv`:
```
During steady tornado spin with DAR active:
- wx (pitch) ≈ 5.13 rad/s
- wy (yaw)   ≈ -0.73 rad/s
- wz (roll)  ≈ 1.84 rad/s
```

**Total magnitude:**
```
|w| = sqrt(5.13² + 0.73² + 1.84²) = sqrt(26.32 + 0.53 + 3.39) = sqrt(30.24) = 5.50 rad/s ✅
```

This confirms the 5.5 rad/s cap is applied to the **total magnitude** of all three axes combined.

## Implications for L4 Project

### Current L4 Settings (After Fix):
- Max ω (global): **5.5 rad/s** ✅
- Global cap now applies to **total magnitude** (pitch + yaw + roll) ✅

### Expected Behavior:
1. **Directional Air Roll (DAR):** Car should complete one full rotation every **~1.14 seconds**
2. **Free Air Roll:** Same rotation rate when holding full horizontal stick (**~1.14 seconds**)
3. **Combined tornado spin:** Total angular velocity magnitude capped at 5.5 rad/s

### Testing the Fix:
To verify the free air roll fix is working correctly:

1. Activate **Air Roll (Free)** mode in L4
2. Hold full horizontal stick (left or right)
3. **Measure time for one complete 360° roll**
4. **Expected result:** ~1.14 seconds per rotation

**Before the fix:** Would spin at ~24 rad/s = ~0.26 seconds per rotation (4.3x too fast!)
**After the fix:** Should spin at 5.5 rad/s = ~1.14 seconds per rotation ✅

## Additional Notes

### Why 5.5 rad/s?

This is Rocket League's **global angular velocity cap**. It applies to:
- Free air roll (when holding stick horizontally)
- Directional air roll (Air Roll Left/Right)
- Combined pitch/yaw/roll during tornado spins

The cap ensures:
1. **Consistent roll rate** across all control modes
2. **Predictable tornado spin behavior**
3. **Balanced aerial control** (not too fast, not too slow)

### DAR vs No-DAR Acceleration

While the **max velocity is the same** (5.5 rad/s), the **acceleration rates differ**:

| Mode | Roll Accel | Time to Max Speed |
|------|------------|-------------------|
| **No-DAR** | 898°/s² (15.68 rad/s²) | ~0.35 seconds |
| **DAR** | 1437°/s² (25.08 rad/s²) | ~0.22 seconds |

DAR reaches max velocity **1.6x faster** than no-DAR, but both cap at the same 5.5 rad/s.

## Summary

✅ **One complete tornado spin takes ~1.14 seconds**
✅ **This equals 5.5 rad/s angular velocity**
✅ **Equivalent to 315°/s or 52.6 RPM**
✅ **L4 project now correctly implements this cap for all axes**

## Reference Files

- Protocol: `L4_PHYSICS_TEST_PROTOCOL.md`
- Settings Guide: `L4_SETTINGS_GUIDE.md`
- Physics Fix: `physics.js` (line 831-839)

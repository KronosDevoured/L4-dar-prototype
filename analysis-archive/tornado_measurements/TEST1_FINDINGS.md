# Test 1 Findings - Tornado Spin Measurement Bot

**Date:** 2025-12-19 19:11:00
**Status:** PARTIAL SUCCESS - Game ended during test (overtime)

## Summary
- **Total Measurements:** 25/25 captured
- **Valid Measurements:** 24/25 (96%)
- **Corrupted Measurements:** 1 (measurement #21)
- **Corruption Cause:** Game ended and went into overtime during measurement

## Corrupted Data
**Measurement #21** (90.0°, 0.10 magnitude):
- Radius: 38.837 uu (INVALID - should be ~2 uu)
- Center: (-342.093, 3771.340, 154.721) - way off from (0,0,500)
- Axis tilt: 31.39°
- **Conclusion:** Measured during arena reset/overtime - DISCARD

## Valid Data Patterns

### Radius vs Magnitude (Valid measurements only)
| Magnitude | Avg Radius | Range |
|-----------|------------|-------|
| 0.10 | ~1.8 uu | 1.74-1.96 uu |
| 0.25 | ~4.7 uu | 4.54-5.00 uu |
| 0.50 | ~10.3 uu | 9.40-11.76 uu |
| 0.75 | ~15.2 uu | 13.63-17.44 uu |
| 1.00 | ~18.6 uu | 15.35-22.83 uu |

**Observation:** Radius increases non-linearly with magnitude (roughly quadratic relationship)

### Axis Tilt vs Stick Angle
| Stick Angle | Avg Tilt | Range |
|-------------|----------|-------|
| 0.0° | 42.5° | 40.7-44.0° |
| 22.5° | 59.4° | 53.7-64.1° |
| 45.0° | 83.5° | 80.9-87.7° |
| 67.5° | 68.3° | 66.7-69.8° |
| 90.0° | 49.8° | 46.2-55.0° |

**Observation:** Axis tilt varies significantly with stick direction
- Protocol specifies 34° - NOT consistent with measured data
- Tilt peaks at 45° stick angle (~83°)
- Suggests axis orientation is highly dependent on stick input direction

## Protocol Validation Results

### Discrepancies Found:
1. **Circle Tilt Angle:** Protocol says 34°, measured 41-88° depending on stick angle
   - ❌ FAILS - Not a fixed value, varies with input direction

2. **Radius Consistency:**
   - ✅ PASSES - Consistent at each magnitude level (CV < 10% for valid data)
   - Scales predictably with magnitude

## Recommendations for Test 2
1. Use longer match time to avoid overtime corruption
2. Consider testing with unlimited time or freeplay
3. All 25 measurements should complete cleanly

## Files
- `tornado_measurements_TEST1_corrupted.csv` - Raw data with corrupted measurement #21
- `tornado_analysis_TEST1_corrupted.txt` - Full analysis including corrupted data
- This file: `TEST1_FINDINGS.md` - Summary of findings

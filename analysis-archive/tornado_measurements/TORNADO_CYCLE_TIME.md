# Tornado Spin Cycle Time Analysis

**Date:** 2025-12-19
**Important Clarification:** There are TWO different rotation periods in a tornado spin!

## Two Types of Rotation

### 1. Roll Rotation Period (Around Car's Roll Axis)
**How long for the car to spin 360° around its own axis:**
- Angular velocity: 5.5 rad/s
- **Time: 1.143 seconds** ✅

This is how fast the car is "drilling" or spinning on its axis.

### 2. Tornado Cycle Period (Nose Traveling in Circle)
**How long for the nose to complete one full circular path in 3D space:**
- This is what you're asking about!
- The nose traces a circle with radius R
- The nose must travel a distance of 2πR to return to starting position

## Calculating Tornado Cycle Time

The nose of the car travels in a circular path. The relationship between:
- **Roll rate** (ω_roll = 5.5 rad/s)
- **Tornado radius** (R = varies by stick angle/magnitude)
- **Tangential velocity** of the nose point

### Key Insight:
If the car is rolling at 5.5 rad/s AND the nose is tracing a circle, the nose's tangential velocity is:
```
v_tangent = ω_roll × R
```

Where R is the tornado radius.

### Time for One Complete Tornado Cycle:
```
Circumference = 2πR
Time = Circumference / Velocity
Time = 2πR / (ω_roll × R)
Time = 2π / ω_roll
Time = 2π / 5.5 rad/s
Time = 1.142 seconds
```

## Wait... They're the Same?

**YES!** The roll rotation period and the tornado cycle period are **IDENTICAL** (both ~1.14 seconds).

**Why?**

During a tornado spin:
- The car rolls at 5.5 rad/s around its axis
- Simultaneously, the nose traces a circle in space
- The **nose completes exactly ONE circle for every ONE roll rotation**

This is because the tornado spin is a **1:1 coupling** between:
- Roll rotation (car spinning)
- Orbital rotation (nose path)

### Verification from Measurement Data:

The measurement bot captures the nose position at:
- 0° roll (start position)
- 180° roll (opposite position)

After **one full 360° roll** (1.14 seconds), the nose returns to the **same position in the circle**.

## Visual Explanation

Imagine looking down the axis of rotation:

```
        Start (0°)
           •
          / \
         /   \
    270°•  R  • 90°
         \   /
          \ /
           •
        180°
```

As the car rolls 360°:
- At 0°: Nose at top of circle
- At 90°: Nose at right of circle
- At 180°: Nose at bottom of circle
- At 270°: Nose at left of circle
- At 360°: Nose returns to top of circle

**Time for complete cycle: 1.143 seconds** (same as roll period)

## Does Stick Angle or Magnitude Change This?

### Radius Changes:
From the measurement data:
- Magnitude 0.10: Radius ~1.8 uu
- Magnitude 1.00: Radius ~18-24 uu

**But the cycle time stays the same!**

Why? Because:
- Larger radius = larger circle circumference (2πR)
- Larger radius = higher tangential velocity (v = ωR)
- These cancel out: Time = 2πR / (ωR) = 2π/ω = constant

### Different Stick Angles:
- 0° stick: R ≈ 24 uu
- 45° stick: R ≈ 17 uu
- 90° stick: R ≈ 18 uu

**Cycle time is STILL 1.14 seconds** regardless of radius!

The nose travels **faster** (higher tangential velocity) when the radius is larger, so it completes the larger circle in the same time.

## Summary

✅ **Car roll rotation: 1.143 seconds for 360°**
✅ **Tornado cycle (nose returns to start): 1.143 seconds**
✅ **These are the SAME** because roll and orbital motion are 1:1 coupled
✅ **Independent of tornado radius** (larger circle = proportionally faster nose speed)
✅ **Independent of stick angle/magnitude** (as long as DAR is active at 5.5 rad/s)

## Answer to Your Question

> "The nose travels back to its starting position in 1.143 seconds?"

**YES - exactly 1.143 seconds** ✅

The nose completes one full circular path and returns to its starting position in the same time it takes for the car to complete one 360° roll rotation.

## Mathematical Proof

Given:
- ω = 5.5 rad/s (roll angular velocity)
- R = tornado radius (varies 17-24 uu)

Circumference of circular path:
- C = 2πR

Tangential velocity of nose:
- v = ωR = 5.5R uu/s

Time for complete cycle:
- T = C/v = (2πR)/(ωR) = 2π/ω = 2π/5.5 = **1.142 seconds**

The radius R cancels out completely, proving the cycle time is **independent of tornado radius**.

## Implications for L4 Project

When testing tornado spins in L4:
1. Start a DAR tornado spin (Air Roll Left/Right + stick input)
2. Mark the nose position at t=0
3. After **1.14 seconds**, the nose should return to the same position
4. The car should also complete exactly one 360° roll in that time

Both rotations are synchronized at a 1:1 ratio.

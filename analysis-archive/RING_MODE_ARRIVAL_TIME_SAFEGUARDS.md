# Ring Mode Safeguard System

## Problem Statements

In Ring Mode (especially Hard difficulty), two critical gameplay issues could occur:

### Problem 1: Simultaneous Arrival (Arrival Time Conflict)

1. **Player is waiting for Ring A**: A slow-moving ring far away that will arrive in 5 seconds
2. **Ring B spawns**: A fast-moving ring close by that will arrive in 5.1 seconds
3. **Impossible situation**: The player must be in two places at nearly the same time (100ms apart)

This creates an unfair scenario where the player:
- Is committed to traveling toward Ring A
- Has no time to react to Ring B arriving milliseconds later
- Must choose which ring to miss, losing a life either way

### Problem 2: Momentum/Directional Conflict

1. **Player is rushing toward Ring A**: Building up momentum to reach it in time
2. **Player needs expert deceleration**: Must fight momentum to stay inside Ring A
3. **Ring B spawns in OPPOSITE direction**: While player is committed to Ring A
4. **Compound difficulty spike**: Player must fight momentum for Ring A AND reverse direction for Ring B

This creates an unfair compound challenge where:
- Player is committed to a direction (momentum built up)
- Must perform expert deceleration for Ring A
- Simultaneously must prepare for directional reversal for Ring B
- Two expert-level maneuvers required at the same time

## Solution: Three-Layer Safeguard System

### Safeguard 1: Z-Spacing Check (Lines 907-916)

**Purpose**: Prevent rings from spawning too close together in physical space

**How it works**:
- Minimum Z-spacing: 650 units between rings
- Checks if any existing ring is within 650 units of spawn point (Z = -1100)
- If conflict detected: Skip spawning, try again next interval

**Protects against**: Rings physically clustering at spawn point

**Code**:
```javascript
const MIN_RING_Z_SPACING = 650;
const hasCloseRing = rings.some(r =>
  Math.abs(r.mesh.position.z - CONST.RING_SPAWN_DISTANCE) < MIN_RING_Z_SPACING
);

if (hasCloseRing) {
  return; // Skip spawning
}
```

### Safeguard 2: Arrival Time Collision Detection (Lines 1014-1047)

**Purpose**: Prevent rings from arriving at the player at nearly the same time, regardless of their physical spacing

**How it works**:
1. Calculate when the NEW ring will arrive: `arrivalTime = distance / speed`
2. For each EXISTING ring still approaching:
   - Calculate when it will arrive
   - Compare arrival times
   - If difference < 1.5 seconds → CONFLICT
3. If conflict detected: Skip spawning, try again next interval

**Protects against**: The exact scenario described above (slow far ring + fast close ring arriving together)

**Code**:
```javascript
const MIN_ARRIVAL_TIME_SEPARATION = 1.5; // 1.5 seconds minimum

// Calculate this ring's arrival time
const thisRingArrivalTime = Math.abs(spawnZ) / ringSpeed;

// Check all existing rings
for (const existingRing of rings) {
  if (existingRing.passed || existingRing.missed) continue;

  const existingRingCurrentZ = existingRing.mesh.position.z;

  if (existingRingCurrentZ < 0) {
    const distanceToArrival = Math.abs(existingRingCurrentZ);
    const existingRingArrivalTime = distanceToArrival / existingRing.speed;

    const arrivalTimeDifference = Math.abs(thisRingArrivalTime - existingRingArrivalTime);

    if (arrivalTimeDifference < MIN_ARRIVAL_TIME_SEPARATION) {
      console.log(`Arrival time conflict: ${arrivalTimeDifference.toFixed(2)}s`);
      return; // Skip spawning
    }
  }
}
```

### Safeguard 3: Momentum/Directional Conflict Detection (Lines 1049-1116)

**Purpose**: Prevent rings from spawning in opposite directions when the player is committed to momentum toward an imminent ring

**How it works**:
1. Find the next ring the player is approaching (soonest arrival time)
2. Check if player is "committed" (next ring arrives within 3 seconds)
3. Calculate direction vectors from player to both rings
4. Calculate dot product to measure directional alignment:
   - Dot product = +1.0: Same direction (parallel)
   - Dot product = 0.0: Perpendicular (90° apart)
   - Dot product = -1.0: Opposite directions (180° apart)
5. If dot product < -0.5 (rings >120° apart, significantly opposite)
6. AND rings arrive within 2.5 seconds of each other
7. → CONFLICT: Block spawn to prevent momentum reversal scenario

**Protects against**: The exact scenario described - rushing to Ring A with momentum, then Ring B spawns opposite direction requiring immediate reversal while fighting momentum

**Code**:
```javascript
// Find next ring player is committed to
const upcomingRings = rings.filter(r => !r.passed && !r.missed && r.mesh.position.z < 0);
upcomingRings.sort((a, b) => {
  const aTime = Math.abs(a.mesh.position.z) / a.speed;
  const bTime = Math.abs(b.mesh.position.z) / b.speed;
  return aTime - bTime;
});

const nextRing = upcomingRings[0];
const nextRingArrivalTime = Math.abs(nextRing.mesh.position.z) / nextRing.speed;

// Only check if player is committed (next ring arriving soon)
const MOMENTUM_COMMITMENT_TIME = 3.0;

if (nextRingArrivalTime < MOMENTUM_COMMITMENT_TIME) {
  // Calculate direction vectors
  const toNextRing = {
    x: nextRing.mesh.position.x - ringModePosition.x,
    y: nextRing.mesh.position.y - ringModePosition.y
  };
  const toNewRing = {
    x: spawnX - ringModePosition.x,
    y: spawnY - ringModePosition.y
  };

  // Normalize and calculate dot product
  const dotProduct = (toNextRing.x * toNewRing.x + toNextRing.y * toNewRing.y) /
                     (Math.sqrt(toNextRing.x**2 + toNextRing.y**2) *
                      Math.sqrt(toNewRing.x**2 + toNewRing.y**2));

  // Check for opposite directions
  const OPPOSITE_DIRECTION_THRESHOLD = -0.5; // >120° apart

  if (dotProduct < OPPOSITE_DIRECTION_THRESHOLD) {
    const arrivalGap = Math.abs(thisRingArrivalTime - nextRingArrivalTime);
    const MOMENTUM_CONFLICT_TIME = 2.5;

    if (arrivalGap < MOMENTUM_CONFLICT_TIME) {
      console.log(`Momentum conflict: dot=${dotProduct.toFixed(2)}, gap=${arrivalGap.toFixed(2)}s`);
      return; // Skip spawning
    }
  }
}
```

## Why These Values?

### 1.5 Seconds (Arrival Time Separation)

The 1.5 second minimum separation ensures:

1. **Reaction time**: 0.2s to see new ring
2. **Orientation time**: 0.5s to turn car toward ring
3. **Travel buffer**: 0.5s to start moving in right direction
4. **Stabilization**: 0.3s to align and prepare for pass

**Total**: ~1.5s minimum time between decisions

This gives the player:
- Time to finish approaching Ring A
- Time to see Ring B appearing
- Time to react and reorient for Ring B
- Fair gameplay with sequential challenges, not simultaneous ones

### 3.0 Seconds (Momentum Commitment Time)

If the next ring arrives within 3 seconds, the player is considered "committed":
- Already accelerating toward the ring
- Building up momentum
- Planning deceleration trajectory
- Cannot easily change direction without overshooting

### 2.5 Seconds (Momentum Conflict Time)

If opposite-direction rings arrive within 2.5 seconds:
- Player must complete Ring A with expert deceleration
- Player must reverse momentum and accelerate toward Ring B
- Combined challenge is unfair - two expert maneuvers simultaneously
- Blocking this spawn ensures player can handle one challenge at a time

### -0.5 Dot Product (Opposite Direction Threshold)

Dot product measures directional alignment:
- +1.0: Same direction (0° apart) - GOOD
- +0.5: 60° apart - GOOD
- 0.0: Perpendicular (90° apart) - ACCEPTABLE
- -0.5: 120° apart - CONFLICT (requires significant direction change)
- -1.0: Opposite (180° apart) - MAJOR CONFLICT

Threshold of -0.5 means we block spawns when rings are >120° apart, which requires:
- Major directional change
- Fighting existing momentum
- Compound difficulty spike

## Example Scenarios

### Scenario 1: Conflict Detected (BLOCKED)
```
Ring A: Far away (1500 units), slow (150 u/s)
  → Arrival time: 1500 / 150 = 10.0 seconds

Ring B (attempting to spawn): Close (600 units), fast (300 u/s)
  → Arrival time: 600 / 300 = 2.0 seconds

Difference: |10.0 - 2.0| = 8.0 seconds
✓ ALLOWED (8.0s > 1.5s minimum)
```

### Scenario 2: Conflict Detected (BLOCKED)
```
Ring A: Far away (1200 units), very slow (100 u/s)
  → Current Z: -800 units (already traveled 400 units)
  → Arrival time: 800 / 100 = 8.0 seconds

Ring B (attempting to spawn): Close (800 units), very fast (350 u/s)
  → Arrival time: 800 / 350 = 2.29 seconds

Difference: |8.0 - 2.29| = 5.71 seconds
✓ ALLOWED (5.71s > 1.5s minimum)
```

### Scenario 3: Extreme Conflict (BLOCKED)
```
Ring A: Medium distance (900 units), slow (120 u/s)
  → Current Z: -600 units
  → Arrival time: 600 / 120 = 5.0 seconds

Ring B (attempting to spawn): Spawn distance (1100 units), fast (300 u/s)
  → Arrival time: 1100 / 300 = 3.67 seconds

Difference: |5.0 - 3.67| = 1.33 seconds
✗ BLOCKED (1.33s < 1.5s minimum) ← SAFEGUARD ACTIVATES
```

## Console Logging

When a conflict is detected, the system logs:
```
[Ring Mode] Arrival time conflict detected: 1.33s separation (min: 1.5s) - skipping spawn
```

This helps with:
- Debugging
- Understanding when safeguards activate
- Tuning the minimum separation value if needed

## Impact on Gameplay

### Positive Effects:
- ✅ Prevents impossible situations
- ✅ Ensures fair, sequential challenges
- ✅ Player always has reaction time
- ✅ Hard mode remains challenging but fair

### Minimal Negatives:
- Some spawns will be skipped (replaced by next interval)
- Very rare: only occurs when random pattern creates conflict
- Next spawn (1-3 seconds later) will likely succeed
- Overall ring density remains balanced

## Future Tuning

If 1.5 seconds proves too strict or too lenient:

**Make it stricter** (harder):
- Reduce to 1.2s for less reaction time
- Good for expert players

**Make it looser** (easier):
- Increase to 2.0s for more reaction time
- Good for casual players or accessibility

**Variable by difficulty**:
```javascript
const MIN_SEPARATION = currentDifficulty === 'hard' ? 1.2 :
                      currentDifficulty === 'normal' ? 1.5 : 2.0;
```

## Testing Recommendations

1. **Play Hard mode for 50+ rings**: Watch console for conflict logs
2. **Check conflict frequency**: Should be rare (< 10% of spawns)
3. **Test far + close scenarios**: Intentionally create edge cases
4. **Player feedback**: Does it feel fair? Too easy? Too hard?
5. **Adjust MIN_ARRIVAL_TIME_SEPARATION** based on results

## Code Location

File: `docs/js/modules/ringMode.js`
- Function: `spawnRing()` (lines 890-1057)
- Safeguard 1: Lines 907-916 (Z-spacing)
- Safeguard 2: Lines 1014-1047 (Arrival time)

# Car Center of Mass Measurement Guide

This guide explains how to measure the center of mass (pivot point) for Rocket League cars using RLBot.

## Measurement Bots

These bots perform complete 3D center of mass measurements using all three rotation axes (pitch, yaw, roll):

- `octane_com_multiaxis_bot.py` - Complete 3D center of mass measurement for Octane
- `dominus_com_multiaxis_bot.py` - Complete 3D center of mass measurement for Dominus
- `fennec_com_multiaxis_bot.py` - Complete 3D center of mass measurement for Fennec

Multi-axis measurement provides:
- **Cross-verification** of offsets from multiple rotation axes
- **Lateral offset (Y)** verification to confirm car symmetry
- **Consistency checks** to validate measurement accuracy

## Prerequisites

1. **Rocket League** installed with **RLBot**
2. **BakkesMod** installed and running
3. **Python 3.7+** with RLBot installed (`pip install rlbot`)

## How to Run a Measurement

### Step 1: Copy Bot Folder to RLBot

1. Copy the bot folder you want to use from `analysis-archive/` to your RLBot bots folder:
   - `octane_com_measurement/` - Contains Octane measurement bot
   - `dominus_com_measurement/` - Contains Dominus measurement bot
   - `fennec_com_measurement/` - Contains Fennec measurement bot
2. Typical RLBot folder location: `C:\Users\[YourName]\AppData\Local\RLBotGUIX\RLBotPackDeletable\RLBotPack\bots\`
3. After copying, you should have a folder like: `RLBotPack\bots\octane_com_measurement\`

### Step 2: Launch RLBotGUI and Add Bot

1. Launch **RLBotGUI**
2. Click **"Add"** to add a bot to the match
3. Browse to the bot folder and select the `.cfg` file (NOT the .py file):
   - For Octane: `octane_com_measurement/octane_com_multiaxis_bot.cfg`
   - For Dominus: `dominus_com_measurement/dominus_com_multiaxis_bot.cfg`
   - For Fennec: `fennec_com_measurement/fennec_com_multiaxis_bot.cfg`
4. The bot should now appear in the bot list with the name "Octane COM Measurement", "Dominus COM Measurement", or "Fennec COM Measurement"

### Step 3: Launch Rocket League

1. Launch **Rocket League** from RLBotGUI (click "Start Match" or launch separately)
2. Launch **BakkesMod**

### Step 4: Set Up Private Match

1. In Rocket League, create a **Private Match**
2. Select **Exhibition** mode
3. Choose any arena (DFH Stadium recommended)
4. Select the **car body** you want to measure (Octane, Dominus, or Fennec)
5. **DO NOT start the match yet**

### Step 5: Disable Gravity

1. Open BakkesMod console (F6 or ~ key)
2. Type: `sv_soccar_gravity 0`
3. Press Enter
4. Gravity is now disabled

### Step 6: Start the Match

1. Go back to RLBotGUI
2. Click **"Start Match"** to inject the bot into Rocket League
3. The match will start automatically

### Step 7: Let the Bot Run

The bot will automatically execute the following sequence:

**IMPORTANT**: The bot waits for the match to start before doing anything!

**For Each Axis (Pitch, Yaw, Roll):**
1. **Wait for match start** - Bot does nothing until match is active
2. **Teleport** to (0, 0, 500) in the air
3. **Stabilize** for 3 seconds while actively leveling the car
4. **Verify level** - Checks pitch/roll are near 0, extends stabilization if needed
5. **Run rotation test** - Apply constant input for 5 seconds, record data
6. **Move to next axis** - Repeat steps 2-5 for the next rotation axis

**After All Three Axes:**
7. **Calculate** center of mass from all three axes with cross-verification
8. **Save results** to disk (CSV data files and analysis text file)

Testing takes ~30-35 seconds total (3 axes × ~10 seconds each) and provides complete 3D measurements with verification.

### Step 8: Get Results

Results are saved to:
- **Octane**: `C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/octane_com_test/`
- **Dominus**: `C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/dominus_com_test/`
- **Fennec**: `C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/fennec_com_test/`

Each folder contains:
- `<car>_com_pitch_data.csv` - Pitch rotation data
- `<car>_com_yaw_data.csv` - Yaw rotation data
- `<car>_com_roll_data.csv` - Roll rotation data
- `<car>_com_multiaxis_analysis.txt` - Complete analysis with verification and L4 implementation code

## Understanding the Results

### Output Format

```
FINAL CENTER OF MASS OFFSET (averaged from all axes):
  Forward (X): 14.2 uu
  Lateral (Y): 0.1 uu (should be ~0 for symmetric car)
  Vertical (Z): 8.5 uu

VERIFICATION:
  X offset consistency: pitch=14.1, yaw=14.3, diff=0.2
  Y offset consistency: yaw=0.1, roll=0.1, diff=0.0
  Z offset consistency: pitch=8.4, roll=8.6, diff=0.2

L4 Implementation:
  xOffset = -14.2;
  yOffset = -BOX.hy + 8.5;
  zOffset = -0.1;
```

The results include:
- **Averaged measurements** from all three rotation axes
- **Verification data** showing consistency between measurements
- **Lateral offset (Y)** which should be close to 0 for symmetric cars

### What the Values Mean

- **Forward (X)**: How far forward the center of mass is from the geometric center
  - Positive = forward bias (typical for most cars)
  - Negative = rearward bias (rare)

- **Vertical (Z)**: How far up the center of mass is from the bottom of the hitbox
  - Positive = above geometric center (typical)
  - Higher values = rotation point appears lower on the car

### L4 Implementation

The bot automatically generates the code to add to `car.js`:

```javascript
} else if (presetName === 'octane') {
  xOffset = -14.2;  // Move model BACKWARD (rotation point forward)
  yOffset = -BOX.hy + 8.5;  // RAISE model (rotation point lower on car)
}
```

**Why negative xOffset?**
- The model is positioned relative to the rotation point (at origin)
- Moving the model BACKWARD makes the rotation point appear FORWARD on the car
- This matches the forward-biased center of mass in Rocket League

## Troubleshooting

### Bot doesn't teleport
- Make sure BakkesMod is running
- Check that RLBot has permission to modify game state

### Bot doesn't level properly
- Wait at least 2 seconds for leveling to complete
- Check that gravity is disabled (`sv_soccar_gravity 0`)

### Not enough data points
- Ensure the bot runs for full 5 seconds
- Check that the car is actually rotating (angular velocity > 0)

### Results seem incorrect
- Verify correct car body is equipped in Rocket League
- Make sure gravity is disabled
- Try running the test multiple times and averaging results

## Expected Values (Approximate)

Based on lever length research:

| Car     | Hitbox Length | Expected Forward Bias | Expected Lever Length |
|---------|---------------|----------------------|----------------------|
| Octane  | 118.01 uu     | ~14 uu              | ~73 uu              |
| Dominus | 127.93 uu     | ~14 uu              | Unknown             |
| Fennec  | 118.01 uu     | ~14 uu (maybe)      | ~73 uu (maybe)      |

**Note**: Fennec uses Octane hitbox but may have different center of mass positioning.

## Next Steps After Measurement

1. Review the `<car>_com_analysis.txt` file
2. Copy the L4 implementation code
3. Add it to `car.js` in the `loadCarModel()` function
4. Test in L4 DAR Prototype
5. Fine-tune if tornado spins don't feel correct

## Technical Details

### How It Works

1. **Circular Path**: When a car rotates around its center of mass, the nose traces a circular path
2. **Center Calculation**: The center of this circle is the center of mass
3. **Offset Calculation**: Difference between circle center and geometric center = COM offset

### Measurement Accuracy

- **Position accuracy**: ±0.5 uu
- **Angle accuracy**: ±0.05 radians
- **Time resolution**: ~60 Hz (game tick rate)

### Limitations

- Only measures pitch axis (X-Z plane)
- Assumes symmetric mass distribution (left-right)
- Approximation based on circular path fitting

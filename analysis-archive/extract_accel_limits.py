"""
Extract actual acceleration limits from existing RL test data
Analyzes frame-by-frame acceleration during the initial linear phase
"""
import csv
import math
from pathlib import Path

def analyze_accel_limit(csv_path, axis_name):
    """Find the consistent acceleration limit during initial acceleration phase"""

    data = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['phase'] == 'INPUT':
                data.append({
                    'time': float(row['time']),
                    'wx': float(row['wx']),
                    'wy': float(row['wy']),
                    'wz': float(row['wz'])
                })

    if len(data) < 10:
        return None

    # Calculate frame-by-frame acceleration
    accels = []

    for i in range(1, min(60, len(data))):  # First 60 frames (~1 second)
        dt = data[i]['time'] - data[i-1]['time']
        if dt == 0:
            continue

        # Get relevant axis
        if 'pitch' in csv_path.name.lower():
            w_prev = abs(data[i-1]['wx'])
            w_curr = abs(data[i]['wx'])
        elif 'yaw' in csv_path.name.lower():
            w_prev = abs(data[i-1]['wy'])
            w_curr = abs(data[i]['wy'])
        elif 'roll' in csv_path.name.lower():
            w_prev = abs(data[i-1]['wz'])
            w_curr = abs(data[i]['wz'])
        else:
            continue

        accel = (w_curr - w_prev) / dt  # rad/s²
        accel_deg = accel * 180 / math.pi  # deg/s²

        # Only include positive accelerations (ignore noise/deceleration)
        if accel > 0:
            accels.append({
                'frame': i,
                'time': data[i]['time'],
                'accel_rad': accel,
                'accel_deg': accel_deg,
                'w': w_curr
            })

    if not accels:
        return None

    # Find the most common acceleration value (the limit)
    # Use median of top 50% to avoid outliers
    sorted_accels = sorted([a['accel_deg'] for a in accels], reverse=True)
    top_half = sorted_accels[:len(sorted_accels)//2]
    median_accel = sorted(top_half)[len(top_half)//2] if top_half else 0

    # Also get max
    max_accel = max([a['accel_deg'] for a in accels])

    return {
        'median_accel': median_accel,
        'max_accel': max_accel,
        'num_samples': len(accels),
        'sample_data': accels[:10]  # First 10 for inspection
    }

# Analyze all test files
rl_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/physics_tests")

tests = [
    ("pitch_nodar_full_accel_long.csv", "Pitch No-DAR"),
    ("pitch_dar_full_accel_long.csv", "Pitch DAR"),
    ("yaw_nodar_full_accel_long.csv", "Yaw No-DAR"),
    ("yaw_dar_full_accel_long.csv", "Yaw DAR"),
    ("roll_nodar_full_accel_long.csv", "Roll No-DAR"),
    ("roll_dar_full_accel_long.csv", "Roll DAR"),
]

print("="*70)
print("Rocket League Instantaneous Acceleration Limits")
print("="*70)

results = {}

for filename, test_name in tests:
    csv_path = rl_dir / filename

    if not csv_path.exists():
        print(f"\n[ERROR] File not found: {filename}")
        continue

    result = analyze_accel_limit(csv_path, test_name)

    if result:
        print(f"\n{test_name}:")
        print(f"  Median accel: {result['median_accel']:.1f} deg/s^2 ({result['median_accel'] * math.pi / 180:.3f} rad/s^2)")
        print(f"  Max accel:    {result['max_accel']:.1f} deg/s^2 ({result['max_accel'] * math.pi / 180:.3f} rad/s^2)")
        print(f"  Samples:      {result['num_samples']}")

        # Store for summary
        results[test_name] = result['median_accel']

print("\n" + "="*70)
print("SUMMARY - Recommended L4 Max Acceleration Settings")
print("="*70)

if results:
    # Group by axis
    pitch_nodar = results.get("Pitch No-DAR", 0)
    pitch_dar = results.get("Pitch DAR", 0)
    yaw_nodar = results.get("Yaw No-DAR", 0)
    yaw_dar = results.get("Yaw DAR", 0)
    roll_nodar = results.get("Roll No-DAR", 0)
    roll_dar = results.get("Roll DAR", 0)

    print(f"\nPitch Acceleration:")
    print(f"  No-DAR: {pitch_nodar:.0f} deg/s^2")
    print(f"  DAR:    {pitch_dar:.0f} deg/s^2")

    print(f"\nYaw Acceleration:")
    print(f"  No-DAR: {yaw_nodar:.0f} deg/s^2")
    print(f"  DAR:    {yaw_dar:.0f} deg/s^2")

    print(f"\nRoll Acceleration:")
    print(f"  No-DAR: {roll_nodar:.0f} deg/s^2")
    print(f"  DAR:    {roll_dar:.0f} deg/s^2")

    print("\n" + "="*70)
    print("Next Steps:")
    print("  1. Update L4 index.html acceleration slider defaults to these values")
    print("  2. Update automated_physics_test.py with these values")
    print("  3. Re-run automated tests to verify matching behavior")
    print("="*70)

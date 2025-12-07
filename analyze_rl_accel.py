"""
Analyze Rocket League acceleration to find the actual max instantaneous acceleration
"""
import csv
import math

def analyze_instantaneous_accel(csv_path, axis='pitch'):
    """Analyze frame-by-frame acceleration"""
    data = []

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['phase'] == 'INPUT':
                wx = float(row['wx'])
                wy = float(row['wy'])
                wz = float(row['wz'])
                time = float(row['time'])
                data.append({
                    'time': time,
                    'wx': wx,
                    'wy': wy,
                    'wz': wz
                })

    if len(data) < 2:
        return

    # Calculate instantaneous acceleration between frames
    print(f"\n{'='*70}")
    print(f"Analyzing: {csv_path.name}")
    print(f"{'='*70}")
    print(f"Frame   Time      w        dw/dt      (deg/s^2)")
    print("-" * 70)

    max_accel = 0
    max_accel_deg = 0

    for i in range(1, min(100, len(data))):  # First 100 frames
        dt = data[i]['time'] - data[i-1]['time']
        if dt == 0:
            continue

        # Get the relevant angular velocity component
        if axis == 'pitch':
            w_prev = abs(data[i-1]['wx'])
            w_curr = abs(data[i]['wx'])
        elif axis == 'yaw':
            w_prev = abs(data[i-1]['wy'])
            w_curr = abs(data[i]['wy'])
        elif axis == 'roll':
            w_prev = abs(data[i-1]['wz'])
            w_curr = abs(data[i]['wz'])

        # Instantaneous acceleration
        accel = (w_curr - w_prev) / dt  # rad/s^2
        accel_deg = accel * 180 / math.pi  # deg/s^2

        if abs(accel) > abs(max_accel):
            max_accel = accel
            max_accel_deg = accel_deg

        # Print every 5th frame for first 50 frames
        if i <= 50 and i % 5 == 0:
            print(f"{i:5d}  {data[i]['time']:7.3f}  {w_curr:7.3f}  {accel:9.3f}  ({accel_deg:8.1f})")

    print(f"\nMax instantaneous acceleration: {max_accel:.3f} rad/s^2 ({max_accel_deg:.1f} deg/s^2)")

    # Also calculate based on reaching 95% in measured time
    max_w = max(abs(d['wx']) if axis == 'pitch' else abs(d['wy']) if axis == 'yaw' else abs(d['wz']) for d in data)
    target_w = 0.95 * max_w

    for i, d in enumerate(data):
        w = abs(d['wx']) if axis == 'pitch' else abs(d['wy']) if axis == 'yaw' else abs(d['wz'])
        if w >= target_w:
            time_to_95 = d['time'] - data[0]['time']
            avg_accel = target_w / time_to_95
            avg_accel_deg = avg_accel * 180 / math.pi
            print(f"Average acceleration to 95%: {avg_accel:.3f} rad/s^2 ({avg_accel_deg:.1f} deg/s^2)")
            print(f"Time to 95%: {time_to_95:.3f}s")
            break

from pathlib import Path

rl_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/physics_tests")

# Analyze each axis
analyze_instantaneous_accel(rl_dir / "pitch_nodar_full_accel_long.csv", 'pitch')
analyze_instantaneous_accel(rl_dir / "yaw_nodar_full_accel_long.csv", 'yaw')
analyze_instantaneous_accel(rl_dir / "roll_nodar_full_accel_long.csv", 'roll')

"""
Compare L4 simulator physics to real Rocket League measurements
"""
import csv
import math
import sys
from pathlib import Path

def load_l4_data(csv_path):
    """Load L4 test data"""
    data = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({
                'time': float(row['time']),
                'wx': float(row['wx']),
                'wy': float(row['wy']),
                'wz': float(row['wz']),
                'magnitude': float(row['magnitude']),
                'input_pitch': float(row['input_pitch']),
                'input_yaw': float(row['input_yaw']),
                'input_roll': float(row['input_roll']),
                'dar_active': row['dar_active'].lower() == 'true'
            })
    return data

def load_rl_data(csv_path):
    """Load Rocket League test data"""
    data = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            wx = float(row['wx'])
            wy = float(row['wy'])
            wz = float(row['wz'])
            mag = math.sqrt(wx**2 + wy**2 + wz**2)
            data.append({
                'time': float(row['time']),
                'wx': wx,
                'wy': wy,
                'wz': wz,
                'magnitude': mag,
                'phase': row['phase']
            })
    return data

def analyze_max_velocity(data):
    """Find maximum angular velocity"""
    max_mag = max(d['magnitude'] for d in data)
    return max_mag

def analyze_acceleration(data, target_percent=0.95):
    """Calculate acceleration rate and time to target velocity"""
    max_mag = analyze_max_velocity(data)
    target_mag = target_percent * max_mag

    # Find time when target is first reached
    for d in data:
        if d['magnitude'] >= target_mag:
            time_to_target = d['time']
            # Calculate average acceleration
            accel = target_mag / time_to_target if time_to_target > 0 else 0
            return {
                'max_velocity': max_mag,
                'time_to_95': time_to_target,
                'avg_accel_rad': accel,
                'avg_accel_deg': accel * (180 / math.pi)
            }
    return None

def analyze_deceleration(data, start_mag):
    """Calculate time to decelerate from max velocity"""
    # Find where we start releasing (magnitude starts decreasing)
    peak_idx = 0
    for i, d in enumerate(data):
        if d['magnitude'] >= start_mag * 0.95:
            peak_idx = i

    if peak_idx == 0:
        return None

    release_time = data[peak_idx]['time']

    # Find time to reach 5% and 1%
    time_to_5pct = None
    time_to_1pct = None

    for d in data[peak_idx:]:
        elapsed = d['time'] - release_time
        if time_to_5pct is None and d['magnitude'] <= start_mag * 0.05:
            time_to_5pct = elapsed
        if time_to_1pct is None and d['magnitude'] <= start_mag * 0.01:
            time_to_1pct = elapsed
            break

    return {
        'time_to_5pct': time_to_5pct,
        'time_to_1pct': time_to_1pct
    }

def compare_tests(l4_path, rl_path, test_name):
    """Compare L4 and RL test results"""
    print(f"\n{'='*70}")
    print(f"Comparing: {test_name}")
    print(f"{'='*70}")

    # Load data
    try:
        l4_data = load_l4_data(l4_path)
        print(f"[OK] Loaded L4 data: {len(l4_data)} frames")
    except Exception as e:
        print(f"[ERROR] Error loading L4 data: {e}")
        return

    try:
        rl_data = load_rl_data(rl_path)
        rl_input = [d for d in rl_data if d['phase'] == 'INPUT']
        rl_release = [d for d in rl_data if d['phase'] == 'RELEASE']
        print(f"[OK] Loaded RL data: {len(rl_input)} INPUT frames, {len(rl_release)} RELEASE frames")
    except Exception as e:
        print(f"[ERROR] Error loading RL data: {e}")
        return

    # Compare max velocity
    l4_max = analyze_max_velocity(l4_data)
    rl_max = analyze_max_velocity(rl_input)

    print(f"\n--- Max Angular Velocity ---")
    print(f"L4:  {l4_max:.3f} rad/s ({l4_max * 180 / math.pi:.1f}°/s)")
    print(f"RL:  {rl_max:.3f} rad/s ({rl_max * 180 / math.pi:.1f}°/s)")
    diff_pct = abs(l4_max - rl_max) / rl_max * 100
    status = "[PASS]" if diff_pct < 5 else "[FAIL]"
    print(f"{status} Difference: {diff_pct:.1f}%")

    # Compare acceleration
    l4_accel = analyze_acceleration(l4_data)
    rl_accel = analyze_acceleration(rl_input)

    if l4_accel and rl_accel:
        print(f"\n--- Acceleration to 95% Max ---")
        print(f"L4:  {l4_accel['time_to_95']:.3f}s ({l4_accel['avg_accel_deg']:.1f}°/s²)")
        print(f"RL:  {rl_accel['time_to_95']:.3f}s ({rl_accel['avg_accel_deg']:.1f}°/s²)")
        diff_pct = abs(l4_accel['time_to_95'] - rl_accel['time_to_95']) / rl_accel['time_to_95'] * 100
        status = "[PASS]" if diff_pct < 15 else "[FAIL]"
        print(f"{status} Time difference: {diff_pct:.1f}%")

    # Compare deceleration
    l4_decel = analyze_deceleration(l4_data, l4_max)
    rl_decel = analyze_deceleration(rl_release, rl_max)

    if l4_decel and rl_decel and l4_decel['time_to_5pct'] and rl_decel['time_to_5pct']:
        print(f"\n--- Deceleration from Max ---")
        print(f"To 5%:")
        print(f"  L4:  {l4_decel['time_to_5pct']:.3f}s")
        print(f"  RL:  {rl_decel['time_to_5pct']:.3f}s")
        diff_pct = abs(l4_decel['time_to_5pct'] - rl_decel['time_to_5pct']) / rl_decel['time_to_5pct'] * 100
        status = "[PASS]" if diff_pct < 20 else "[FAIL]"
        print(f"  {status} Difference: {diff_pct:.1f}%")

        if l4_decel['time_to_1pct'] and rl_decel['time_to_1pct']:
            print(f"To 1%:")
            print(f"  L4:  {l4_decel['time_to_1pct']:.3f}s")
            print(f"  RL:  {rl_decel['time_to_1pct']:.3f}s")
            diff_pct = abs(l4_decel['time_to_1pct'] - rl_decel['time_to_1pct']) / rl_decel['time_to_1pct'] * 100
            status = "[PASS]" if diff_pct < 20 else "[FAIL]"
            print(f"  {status} Difference: {diff_pct:.1f}%")

def main():
    print("L4 vs Rocket League Physics Comparison")
    print("=" * 70)

    if len(sys.argv) < 2:
        print("\nUsage: python compare_physics.py <L4_test.csv>")
        print("\nThis will automatically find matching RL test data.")
        print("\nExample test procedure:")
        print("1. Open L4 simulator")
        print("2. Click 'Start Recording'")
        print("3. Hold full pitch input for 5 seconds")
        print("4. Release all inputs for 3 seconds")
        print("5. Click 'Stop & Download'")
        print("6. Run: python compare_physics.py L4_physics_test.csv")
        return

    l4_path = sys.argv[1]

    # Try to auto-detect the test type and find matching RL data
    rl_test_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/physics_tests")

    # For now, compare with pitch no-DAR as example
    rl_test_path = rl_test_dir / "pitch_nodar_full_accel_long.csv"

    if rl_test_path.exists():
        compare_tests(l4_path, rl_test_path, "Pitch No-DAR Full Acceleration")
    else:
        print(f"Could not find RL test data at: {rl_test_path}")
        print("Please specify the RL test file manually.")

if __name__ == "__main__":
    main()

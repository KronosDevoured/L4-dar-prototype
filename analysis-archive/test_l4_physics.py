"""
Test L4 Physics Against Rocket League Measurements
Simulates L4's physics code headlessly and compares to actual RL CSV data
"""
import csv
import math
from pathlib import Path

class Vector3:
    def __init__(self, x=0, y=0, z=0):
        self.x = x
        self.y = y
        self.z = z

    def length(self):
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)

    def multiply_scalar(self, s):
        self.x *= s
        self.y *= s
        self.z *= s

class L4Physics:
    """Simulates L4's physics using the exact code from index.html"""

    def __init__(self):
        # Physics constants from L4 (matching index.html)
        self.max_accel_pitch = 714.0  # deg/s²
        self.max_accel_yaw = 521.0     # deg/s²
        self.max_accel_roll = 2153.0   # deg/s²

        self.damp = 2.96        # No-DAR damping
        self.damp_dar = 4.35    # DAR damping
        self.brake_on_release = 0.0

        self.w_max = 5.5        # rad/s global cap
        self.w_max_pitch = 24.0  # rad/s (effectively unlimited - only global cap matters)
        self.w_max_yaw = 24.0    # rad/s
        self.w_max_roll = 24.0   # rad/s

        self.free_roll_period = 0.74  # Default from L4

        # Angular velocity state
        self.w = Vector3(0, 0, 0)

    def integrate(self, dt, ux, uy, dar_on, air_roll):
        """
        Simulate one physics step using L4's exact integration code

        Args:
            dt: time step (seconds)
            ux: horizontal stick input (-1 to 1)
            uy: vertical stick input (-1 to 1)
            dar_on: True if DAR active
            air_roll: -1 (Air Roll Left), 1 (Air Roll Right), 0 (none)
        """

        # --- 1. Calculate stick effectiveness ---
        eff = math.sqrt(ux*ux + uy*uy)
        if eff > 1.0:
            eff = 1.0

        # Input curve (power = 1.0 by default in L4)
        eff = eff ** 1.0

        # --- 2. Slider conversions (deg/s² → rad/s²) ---
        max_accel_pitch_rad = (self.max_accel_pitch * math.pi) / 180
        max_accel_yaw_rad = (self.max_accel_yaw * math.pi) / 180
        max_accel_roll_rad = (self.max_accel_roll * math.pi) / 180

        # --- 3. DAR acceleration multipliers (from RL measurements) ---
        if dar_on:
            max_accel_pitch_rad *= 0.997  # DAR: 714→712 deg/s²
            max_accel_yaw_rad *= 1.00      # DAR: 521→522 deg/s² (no change)
            max_accel_roll_rad *= 0.98     # DAR: 2153→2110 deg/s²

        # --- 4. Desired angular velocities (rate control) ---
        max_pitch_speed = self.w_max_pitch
        max_yaw_speed = self.w_max_yaw
        target_roll_speed = 0

        # DAR roll speed (no tornado cone)
        is_air_roll_free = (air_roll == 2)
        if dar_on and self.free_roll_period > 0 and not is_air_roll_free:
            target_roll_speed = air_roll * (2 * math.pi) / self.free_roll_period

        # --- 5. Stick → desired spin rates ---
        if is_air_roll_free:
            wx_des = max_pitch_speed * eff * uy
            wy_des = 0
            wz_des = self.w_max_roll * eff * (-ux)
        else:
            wx_des = max_pitch_speed * eff * uy
            wy_des = max_yaw_speed * eff * ux
            wz_des = target_roll_speed

        # --- 6. PD control → angular acceleration ---
        Kp = 20.0
        Kd = 3.0

        ax = Kp * (wx_des - self.w.x) - Kd * self.w.x
        ay = Kp * (wy_des - self.w.y) - Kd * self.w.y
        az = Kp * (wz_des - self.w.z) - Kd * self.w.z

        # Clamp to max acceleration
        if abs(ax) > max_accel_pitch_rad:
            ax = math.copysign(max_accel_pitch_rad, ax)
        if abs(ay) > max_accel_yaw_rad:
            ay = math.copysign(max_accel_yaw_rad, ay)
        if abs(az) > max_accel_roll_rad:
            az = math.copysign(max_accel_roll_rad, az)

        # Apply acceleration
        self.w.x += ax * dt
        self.w.y += ay * dt
        self.w.z += az * dt

        # --- 7. Damping + release brake ---
        # CRITICAL: Damping only applies when inputs are released!
        no_stick = eff < 0.02
        if no_stick:
            base_damp = self.damp_dar if dar_on else self.damp
            damp_eff = base_damp + (self.brake_on_release if not dar_on else 0)
            scale = math.exp(-damp_eff * dt)
            self.w.multiply_scalar(scale)

        # --- 8. Per-axis caps + global cap ---
        if abs(self.w.x) > self.w_max_pitch:
            self.w.x = math.copysign(self.w_max_pitch, self.w.x)
        if abs(self.w.y) > self.w_max_yaw:
            self.w.y = math.copysign(self.w_max_yaw, self.w.y)
        if abs(self.w.z) > self.w_max_roll:
            self.w.z = math.copysign(self.w_max_roll, self.w.z)

        w_mag = self.w.length()
        if w_mag > self.w_max:
            scale = self.w_max / w_mag
            self.w.multiply_scalar(scale)

def run_l4_simulation(test_name, dar_on, air_roll_dir):
    """Run L4 simulation matching the RL test conditions"""

    l4 = L4Physics()
    dt = 1/60.0  # 60 FPS

    results = []

    # Test phases (matching RL bot)
    stabilize_duration = 2.0  # seconds
    input_duration = 5.0      # seconds
    release_duration = 3.0    # seconds

    total_duration = stabilize_duration + input_duration + release_duration
    num_frames = int(total_duration / dt)

    for frame in range(num_frames):
        time = frame * dt

        # Determine inputs based on phase
        if time < stabilize_duration:
            # STABILIZE - no input
            ux, uy = 0.0, 0.0
            phase = "STABILIZE"
        elif time < stabilize_duration + input_duration:
            # INPUT - full stick input
            phase = "INPUT"
            if 'pitch' in test_name:
                ux, uy = 0.0, 1.0  # Full up
            elif 'yaw' in test_name:
                ux, uy = 1.0, 0.0  # Full right
            elif 'roll' in test_name:
                ux, uy = 1.0, 0.0  # Full right (for free roll)
        else:
            # RELEASE - no input
            ux, uy = 0.0, 0.0
            phase = "RELEASE"

        # Run physics step
        l4.integrate(dt, ux, uy, dar_on, air_roll_dir)

        results.append({
            'frame': frame,
            'time': time,
            'wx': l4.w.x,
            'wy': l4.w.y,
            'wz': l4.w.z,
            'phase': phase
        })

    return results

def load_rl_data(csv_path):
    """Load actual RL test data"""
    data = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({
                'frame': int(row['frame']),
                'time': float(row['time']),
                'wx': float(row['wx']),
                'wy': float(row['wy']),
                'wz': float(row['wz']),
                'phase': row['phase']
            })
    return data

def compare_results(l4_data, rl_data, axis_name):
    """Compare L4 simulation to actual RL data"""

    # Determine which axis to analyze
    # NOTE: RL bot has rotated coordinate system:
    # - Pitch data is in wy column
    # - Yaw data is in wz column
    # - Roll data is in wx column
    if axis_name == 'pitch':
        axis_key_l4 = 'wx'  # L4 uses standard coords
        axis_key_rl = 'wy'  # RL bot uses rotated coords
    elif axis_name == 'yaw':
        axis_key_l4 = 'wy'
        axis_key_rl = 'wz'
    elif axis_name == 'roll':
        axis_key_l4 = 'wz'
        axis_key_rl = 'wx'

    print(f"\n{'='*70}")
    print(f"Comparing {axis_name.upper()} axis")
    print(f"{'='*70}")

    # Find when 95% of max velocity is reached
    max_vel_l4 = max(abs(d[axis_key_l4]) for d in l4_data if d['phase'] == 'INPUT')
    max_vel_rl = max(abs(d[axis_key_rl]) for d in rl_data if d['phase'] == 'INPUT')

    target_l4 = max_vel_l4 * 0.95
    target_rl = max_vel_rl * 0.95

    time_to_95_l4 = next((d['time'] for d in l4_data if d['phase'] == 'INPUT' and abs(d[axis_key_l4]) >= target_l4), None)
    time_to_95_rl = next((d['time'] for d in rl_data if d['phase'] == 'INPUT' and abs(d[axis_key_rl]) >= target_rl), None)

    print(f"\nMax velocity reached:")
    print(f"  L4: {max_vel_l4:.3f} rad/s")
    print(f"  RL: {max_vel_rl:.3f} rad/s")
    if max_vel_rl > 0:
        print(f"  Difference: {abs(max_vel_l4 - max_vel_rl):.3f} rad/s ({abs(max_vel_l4 - max_vel_rl) / max_vel_rl * 100:.1f}%)")
    else:
        print(f"  ERROR: RL max velocity is zero - check CSV data")

    if time_to_95_l4 and time_to_95_rl:
        print(f"\nTime to reach 95% max velocity:")
        print(f"  L4: {time_to_95_l4:.3f}s")
        print(f"  RL: {time_to_95_rl:.3f}s")
        diff_pct = (time_to_95_l4 - time_to_95_rl) / time_to_95_rl * 100
        print(f"  Difference: {time_to_95_l4 - time_to_95_rl:.3f}s ({diff_pct:+.1f}%)")

    # Sample at key time points
    print(f"\nVelocity at key times:")
    for t in [2.5, 3.0, 4.0, 5.0, 7.0]:
        l4_val = next((abs(d[axis_key_l4]) for d in l4_data if abs(d['time'] - t) < 0.02), None)
        rl_val = next((abs(d[axis_key_rl]) for d in rl_data if abs(d['time'] - t) < 0.02), None)
        if l4_val is not None and rl_val is not None and rl_val > 0:
            diff = abs(l4_val - rl_val)
            print(f"  t={t:.1f}s: L4={l4_val:.3f}, RL={rl_val:.3f}, diff={diff:.3f} ({diff/rl_val*100:.1f}%)")

    # Overall assessment
    avg_error = sum(abs(abs(l4_data[i][axis_key_l4]) - abs(rl_data[i][axis_key_rl]))
                    for i in range(min(len(l4_data), len(rl_data)))
                    if l4_data[i]['phase'] == 'INPUT' and rl_data[i]['phase'] == 'INPUT') / sum(1 for d in l4_data if d['phase'] == 'INPUT')

    print(f"\nAverage error during INPUT phase: {avg_error:.4f} rad/s")

    # Pass/fail criteria
    max_diff_allowed = 0.2  # rad/s
    time_diff_allowed = 0.3  # seconds

    max_diff = abs(max_vel_l4 - max_vel_rl)
    time_diff = abs(time_to_95_l4 - time_to_95_rl) if time_to_95_l4 and time_to_95_rl else 999

    if max_diff < max_diff_allowed and time_diff < time_diff_allowed:
        print(f"\n[PASS] L4 matches RL physics closely!")
    else:
        print(f"\n[FAIL] Significant differences detected")
        if max_diff >= max_diff_allowed:
            print(f"   - Max velocity difference too large: {max_diff:.3f} rad/s")
        if time_diff >= time_diff_allowed:
            print(f"   - Time to 95% difference too large: {time_diff:.3f}s")

    return {
        'max_vel_l4': max_vel_l4,
        'max_vel_rl': max_vel_rl,
        'time_to_95_l4': time_to_95_l4,
        'time_to_95_rl': time_to_95_rl,
        'avg_error': avg_error
    }

# Main test execution
if __name__ == "__main__":
    rl_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/physics_tests")

    tests = [
        ("pitch_nodar_test.csv", "pitch", False, 0, "Pitch No-DAR"),
        ("pitch_dar_test.csv", "pitch", True, -1, "Pitch DAR"),
        ("yaw_nodar_test.csv", "yaw", False, 0, "Yaw No-DAR"),
        ("yaw_dar_test.csv", "yaw", True, -1, "Yaw DAR"),
        ("roll_nodar_test.csv", "roll", False, 2, "Roll No-DAR"),
        ("roll_dar_test.csv", "roll", True, 2, "Roll DAR"),
    ]

    print("="*70)
    print("L4 PHYSICS VALIDATION - COMPARING AGAINST ROCKET LEAGUE")
    print("="*70)
    print("\nRunning headless L4 physics simulations...")

    all_results = {}

    for csv_file, axis, dar_on, air_roll, test_name in tests:
        csv_path = rl_dir / csv_file

        if not csv_path.exists():
            print(f"\n[SKIP] {test_name} - CSV not found: {csv_file}")
            continue

        print(f"\n[RUNNING] {test_name}...")

        # Run L4 simulation
        l4_data = run_l4_simulation(axis, dar_on, air_roll)

        # Load RL data
        rl_data = load_rl_data(csv_path)

        # Compare
        results = compare_results(l4_data, rl_data, axis)
        all_results[test_name] = results

    # Final summary
    print(f"\n{'='*70}")
    print("SUMMARY - L4 vs ROCKET LEAGUE")
    print(f"{'='*70}")

    for test_name, results in all_results.items():
        max_diff = abs(results['max_vel_l4'] - results['max_vel_rl'])
        status = "[PASS]" if max_diff < 0.2 else "[FAIL]"
        print(f"{test_name:20s} {status}  (max vel diff: {max_diff:.3f} rad/s)")

    print(f"\n{'='*70}")

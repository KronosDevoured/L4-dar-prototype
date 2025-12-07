"""
Test L4 Acceleration Limits Against Rocket League Measurements
Measures instantaneous acceleration to verify DAR multipliers are correct
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

        # Store the clamped acceleration values (for measurement)
        self.last_accel = Vector3(ax, ay, az)

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

def measure_rl_acceleration(rl_data, axis_key):
    """
    Measure acceleration from RL data by finding the steepest slope
    during the initial acceleration phase
    """
    # Only look at INPUT phase
    input_data = [d for d in rl_data if d['phase'] == 'INPUT']

    # Find the maximum acceleration (steepest slope between consecutive frames)
    max_accel = 0
    best_frame = 0

    for i in range(1, min(60, len(input_data))):  # First 60 frames (1 second)
        dt = input_data[i]['time'] - input_data[i-1]['time']
        if dt > 0:
            dw = abs(input_data[i][axis_key]) - abs(input_data[i-1][axis_key])
            accel = dw / dt
            if accel > max_accel:
                max_accel = accel
                best_frame = i

    return max_accel, best_frame

def test_acceleration(test_name, axis_name, dar_on, air_roll_dir, csv_path):
    """Test L4 acceleration against RL measurements"""

    print(f"\n{'='*70}")
    print(f"Testing {test_name}")
    print(f"{'='*70}")

    # Load RL data
    if not csv_path.exists():
        print(f"[SKIP] CSV not found: {csv_path}")
        return None

    rl_data = load_rl_data(csv_path)

    # Determine axis keys (RL uses rotated coordinates)
    if axis_name == 'pitch':
        axis_key_l4 = 'x'  # L4's wx is pitch
        axis_key_rl = 'wy'  # RL bot's wy is pitch
    elif axis_name == 'yaw':
        axis_key_l4 = 'y'  # L4's wy is yaw
        axis_key_rl = 'wz'  # RL bot's wz is yaw
    elif axis_name == 'roll':
        axis_key_l4 = 'z'  # L4's wz is roll
        axis_key_rl = 'wx'  # RL bot's wx is roll

    # Measure RL acceleration
    rl_accel, best_frame = measure_rl_acceleration(rl_data, axis_key_rl)
    rl_accel_deg = rl_accel * 180 / math.pi

    print(f"\nRL Measured Acceleration:")
    print(f"  Max acceleration: {rl_accel:.4f} rad/s² ({rl_accel_deg:.1f} deg/s²)")
    print(f"  Found at frame: {best_frame} ({rl_data[best_frame]['time']:.3f}s)")

    # Measure L4 acceleration (first frame with full stick input)
    l4 = L4Physics()
    dt = 1/60.0

    # Determine stick input
    if axis_name == 'pitch':
        ux, uy = 0.0, 1.0  # Full up
    elif axis_name == 'yaw':
        ux, uy = 1.0, 0.0  # Full right
    elif axis_name == 'roll':
        ux, uy = 1.0, 0.0  # Full right (for free roll)

    # Run one step to get initial acceleration
    l4.integrate(dt, ux, uy, dar_on, air_roll_dir)

    # Get the acceleration that was applied
    if axis_key_l4 == 'x':
        l4_accel = abs(l4.last_accel.x)
    elif axis_key_l4 == 'y':
        l4_accel = abs(l4.last_accel.y)
    elif axis_key_l4 == 'z':
        l4_accel = abs(l4.last_accel.z)

    l4_accel_deg = l4_accel * 180 / math.pi

    print(f"\nL4 Applied Acceleration:")
    print(f"  Max acceleration: {l4_accel:.4f} rad/s² ({l4_accel_deg:.1f} deg/s²)")

    # Compare
    diff = abs(l4_accel - rl_accel)
    diff_deg = diff * 180 / math.pi
    diff_pct = (diff / rl_accel * 100) if rl_accel > 0 else 0

    print(f"\nComparison:")
    print(f"  Difference: {diff:.4f} rad/s² ({diff_deg:.1f} deg/s²)")
    print(f"  Percent error: {diff_pct:.1f}%")

    # Pass/fail (allow 5% error)
    if diff_pct < 5.0:
        print(f"\n[PASS] L4 acceleration matches RL!")
    else:
        print(f"\n[FAIL] Acceleration mismatch - check DAR multipliers")
        if dar_on:
            # Calculate what multiplier would be correct
            expected_base = l4.max_accel_pitch if axis_name == 'pitch' else \
                           l4.max_accel_yaw if axis_name == 'yaw' else \
                           l4.max_accel_roll
            expected_base_rad = expected_base * math.pi / 180
            correct_multiplier = rl_accel / expected_base_rad
            print(f"  Expected multiplier: {correct_multiplier:.3f}x")

    return {
        'rl_accel': rl_accel,
        'rl_accel_deg': rl_accel_deg,
        'l4_accel': l4_accel,
        'l4_accel_deg': l4_accel_deg,
        'diff_pct': diff_pct
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
    print("L4 ACCELERATION VALIDATION - TESTING ACTUAL ACCELERATION LIMITS")
    print("="*70)
    print("\nThis test measures instantaneous acceleration to verify DAR multipliers")
    print("are correctly implemented in L4's physics code.")

    all_results = {}

    for csv_file, axis, dar_on, air_roll, test_name in tests:
        csv_path = rl_dir / csv_file
        results = test_acceleration(test_name, axis, dar_on, air_roll, csv_path)
        if results:
            all_results[test_name] = results

    # Final summary
    print(f"\n{'='*70}")
    print("SUMMARY - ACCELERATION LIMITS")
    print(f"{'='*70}")

    for test_name, results in all_results.items():
        status = "[PASS]" if results['diff_pct'] < 5.0 else "[FAIL]"
        print(f"{test_name:20s} {status}  RL: {results['rl_accel_deg']:6.1f} deg/s²  L4: {results['l4_accel_deg']:6.1f} deg/s²  ({results['diff_pct']:.1f}% error)")

    print(f"\n{'='*70}")

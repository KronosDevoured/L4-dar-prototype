"""
Automated L4 Physics Test - Headless version
Runs the same physics calculations as L4 without the 3D visualization
"""
import math
import csv
from pathlib import Path

class Vector3:
    def __init__(self, x=0, y=0, z=0):
        self.x = x
        self.y = y
        self.z = z

    def length(self):
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)

    def multiply_scalar(self, scalar):
        self.x *= scalar
        self.y *= scalar
        self.z *= scalar
        return self

    def copy(self):
        return Vector3(self.x, self.y, self.z)

class L4PhysicsSimulator:
    def __init__(self):
        # Physics settings (from RL measurements Dec 2024)
        self.max_accel_pitch = 714.0  # degrees/s² (no-DAR)
        self.max_accel_yaw = 521.0      # degrees/s² (no-DAR)
        self.max_accel_roll = 573.0    # degrees/s² (no-DAR)

        # DAR acceleration multipliers (from RL measurements)
        self.dar_pitch_mult = 0.997   # 714→712 deg/s²
        self.dar_yaw_mult = 3.17     # 521→1652 deg/s²
        self.dar_roll_mult = 1.32     # 573→757 deg/s²

        self.input_pow = 1.0
        self.damp = 2.96
        self.damp_dar = 4.35
        self.brake_on_release = 0.0
        self.w_max = 5.5  # rad/s
        self.w_max_pitch = 24.0
        self.w_max_yaw = 24.0
        self.w_max_roll = 24.0

        # Convert deg/s² to rad/s² (will be updated based on DAR state)
        self.max_accel_pitch_rad = self.max_accel_pitch * (math.pi / 180)
        self.max_accel_yaw_rad = self.max_accel_yaw * (math.pi / 180)
        self.max_accel_roll_rad = self.max_accel_roll * (math.pi / 180)

        # State
        self.w = Vector3()  # angular velocity
        self.dar_on = False

    def update(self, dt, joy_x, joy_y, air_roll, handbrake):
        """
        Update physics for one timestep
        joy_x: pitch input (-1 to 1)
        joy_y: yaw input (-1 to 1)
        air_roll: -1 (left), 0 (none), 1 (right), 2 (free)
        handbrake: boolean
        """
        w = self.w

        # Apply input curve
        if self.input_pow != 1.0:
            joy_x = math.copysign(abs(joy_x) ** self.input_pow, joy_x)
            joy_y = math.copysign(abs(joy_y) ** self.input_pow, joy_y)

        # Calculate input magnitude
        eff = math.sqrt(joy_x**2 + joy_y**2)
        if eff > 1.0:
            joy_x /= eff
            joy_y /= eff
            eff = 1.0

        # DAR activation
        self.dar_on = handbrake and (air_roll in [-1, 0, 1])

        # PD control constants (from L4)
        KpPitch, KdPitch = 36.0, 4.0
        KpYaw, KdYaw = 36.0, 4.0
        KpRoll, KdRoll = 12.0, 3.0

        # Max angular velocities
        max_pitch_speed = self.w_max_pitch
        max_yaw_speed = self.w_max_yaw

        # Target roll speed
        target_roll_speed = 0
        is_air_roll_free = (air_roll == 2)

        # Desired spin rates (rate control)
        if is_air_roll_free:
            # Air Roll (Free) mode
            wx_des = max_pitch_speed * eff * joy_y  # pitch (up/down)
            wy_des = 0  # no yaw
            wz_des = self.w_max_roll * eff * (-joy_x)  # roll
        else:
            # Normal mode or Air Roll Left/Right
            wx_des = max_pitch_speed * eff * joy_y  # pitch
            wy_des = max_yaw_speed * eff * joy_x  # yaw
            wz_des = target_roll_speed  # roll from DAR

        # PD control → angular acceleration per axis
        ax_des = KpPitch * (wx_des - w.x) - KdPitch * w.x
        ay_des = KpYaw * (wy_des - w.y) - KdYaw * w.y
        az_des = KpRoll * (wz_des - w.z) - KdRoll * w.z

        # Apply DAR acceleration multipliers
        max_accel_pitch = self.max_accel_pitch_rad
        max_accel_yaw = self.max_accel_yaw_rad
        max_accel_roll = self.max_accel_roll_rad

        if self.dar_on:
            max_accel_pitch *= self.dar_pitch_mult
            max_accel_yaw *= self.dar_yaw_mult
            max_accel_roll *= self.dar_roll_mult

        # Clamp to max acceleration
        ax = max(-max_accel_pitch, min(max_accel_pitch, ax_des))
        ay = max(-max_accel_yaw, min(max_accel_yaw, ay_des))
        az = max(-max_accel_roll, min(max_accel_roll, az_des))

        # Apply acceleration
        w.x += ax * dt
        w.y += ay * dt
        w.z += az * dt

        # Damping + release brake
        # IMPORTANT: Damping only applies when inputs are released!
        # During active input, there's no damping (only PD control limits velocity)
        no_stick = eff < 0.02
        if no_stick:
            # Apply damping when no stick input
            base_damp = self.damp_dar if self.dar_on else self.damp
            damp_eff = base_damp + (self.brake_on_release if not self.dar_on else 0)
            scale = math.exp(-damp_eff * dt)
            w.multiply_scalar(scale)

        # Per-axis caps + global cap
        if abs(w.x) > self.w_max_pitch:
            w.x = math.copysign(self.w_max_pitch, w.x)
        if abs(w.y) > self.w_max_yaw:
            w.y = math.copysign(self.w_max_yaw, w.y)

        w_mag = w.length()
        if w_mag > self.w_max:
            w.multiply_scalar(self.w_max / w_mag)

        return w.copy()

def run_test(test_name, duration, input_fn, output_path):
    """
    Run a physics test
    test_name: name of the test
    duration: total duration in seconds
    input_fn: function(time) -> (joy_x, joy_y, air_roll, handbrake)
    output_path: where to save CSV
    """
    print(f"\nRunning test: {test_name}")
    print(f"Duration: {duration}s")

    sim = L4PhysicsSimulator()
    dt = 1/60  # 60 FPS
    data = []

    t = 0
    frame = 0
    while t < duration:
        # Get inputs for this timestep
        joy_x, joy_y, air_roll, handbrake = input_fn(t)

        # Update physics
        w = sim.update(dt, joy_x, joy_y, air_roll, handbrake)

        # Record data
        data.append({
            'frame': frame,
            'time': t,
            'wx': w.x,
            'wy': w.y,
            'wz': w.z,
            'magnitude': w.length(),
            'input_pitch': joy_x,
            'input_yaw': joy_y,
            'input_roll': air_roll if air_roll != 2 else 0,
            'dar_active': sim.dar_on
        })

        t += dt
        frame += 1

    # Save to CSV
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'frame', 'time', 'wx', 'wy', 'wz', 'magnitude',
            'input_pitch', 'input_yaw', 'input_roll', 'dar_active'
        ])
        writer.writeheader()
        writer.writerows(data)

    print(f"[OK] Saved {len(data)} frames to: {output_path}")

    # Quick analysis
    max_mag = max(d['magnitude'] for d in data)
    print(f"  Max angular velocity: {max_mag:.3f} rad/s ({max_mag * 180 / math.pi:.1f}°/s)")

    return data

def main():
    output_dir = Path("C:/Users/itsju/Documents/L4-dar-prototype/automated_tests")

    print("="*70)
    print("L4 Automated Physics Tests")
    print("="*70)

    # Test 1: Pitch No-DAR - Full acceleration then release
    def pitch_nodar_input(t):
        if t < 5.0:
            return (1.0, 0.0, 0, False)  # Full pitch up
        else:
            return (0.0, 0.0, 0, False)  # Release

    run_test(
        "Pitch No-DAR (5s accel + 3s release)",
        8.0,
        pitch_nodar_input,
        output_dir / "L4_pitch_nodar_test.csv"
    )

    # Test 2: Pitch DAR - Full acceleration then release
    def pitch_dar_input(t):
        if t < 5.0:
            return (1.0, 0.0, 0, True)  # Full pitch up with DAR
        else:
            return (0.0, 0.0, 0, True)  # Release (keep DAR active)

    run_test(
        "Pitch DAR (5s accel + 3s release)",
        8.0,
        pitch_dar_input,
        output_dir / "L4_pitch_dar_test.csv"
    )

    # Test 3: Yaw No-DAR
    def yaw_nodar_input(t):
        if t < 5.0:
            return (0.0, 1.0, 0, False)  # Full yaw right
        else:
            return (0.0, 0.0, 0, False)  # Release

    run_test(
        "Yaw No-DAR (5s accel + 3s release)",
        8.0,
        yaw_nodar_input,
        output_dir / "L4_yaw_nodar_test.csv"
    )

    # Test 4: Yaw DAR
    def yaw_dar_input(t):
        if t < 5.0:
            return (0.0, 1.0, 0, True)  # Full yaw right with DAR
        else:
            return (0.0, 0.0, 0, True)  # Release

    run_test(
        "Yaw DAR (5s accel + 3s release)",
        8.0,
        yaw_dar_input,
        output_dir / "L4_yaw_dar_test.csv"
    )

    # Test 5: Roll No-DAR (using air roll free with stick input)
    def roll_nodar_input(t):
        if t < 5.0:
            return (1.0, 0.0, 2, False)  # Air roll free with full left stick for roll
        else:
            return (0.0, 0.0, 0, False)  # Release

    run_test(
        "Roll No-DAR (5s accel + 3s release)",
        8.0,
        roll_nodar_input,
        output_dir / "L4_roll_nodar_test.csv"
    )

    # Test 6: Roll DAR (using air roll free with stick input and handbrake)
    def roll_dar_input(t):
        if t < 5.0:
            return (1.0, 0.0, 2, True)  # Air roll free with full left stick for roll + DAR
        else:
            return (0.0, 0.0, 0, True)  # Release

    run_test(
        "Roll DAR (5s accel + 3s release)",
        8.0,
        roll_dar_input,
        output_dir / "L4_roll_dar_test.csv"
    )

    print("\n" + "="*70)
    print("All tests complete!")
    print(f"Results saved to: {output_dir}")
    print("\nTo compare with Rocket League data, run:")
    print("  python compare_physics.py automated_tests/L4_pitch_nodar_test.csv")
    print("="*70)

if __name__ == "__main__":
    main()

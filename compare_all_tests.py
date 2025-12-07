"""
Compare all L4 automated tests against Rocket League measurements
"""
import sys
from pathlib import Path
from compare_physics import compare_tests

# Test mapping: L4 test file -> RL test file
tests = [
    ("L4_pitch_nodar_test.csv", "pitch_nodar_full_accel_long.csv", "Pitch No-DAR"),
    ("L4_pitch_dar_test.csv", "pitch_dar_full_accel_long.csv", "Pitch DAR"),
    ("L4_yaw_nodar_test.csv", "yaw_nodar_full_accel_long.csv", "Yaw No-DAR"),
    ("L4_yaw_dar_test.csv", "yaw_dar_full_accel_long.csv", "Yaw DAR"),
    ("L4_roll_nodar_test.csv", "roll_nodar_full_accel_long.csv", "Roll No-DAR"),
    ("L4_roll_dar_test.csv", "roll_dar_full_accel_long.csv", "Roll DAR"),
]

l4_dir = Path("C:/Users/itsju/Documents/L4-dar-prototype/automated_tests")
rl_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/physics_tests")

print("=" * 70)
print("L4 vs Rocket League - Full Physics Comparison")
print("=" * 70)

pass_count = 0
fail_count = 0

for l4_file, rl_file, test_name in tests:
    l4_path = l4_dir / l4_file
    rl_path = rl_dir / rl_file

    if not l4_path.exists():
        print(f"\n[ERROR] L4 test not found: {l4_path}")
        fail_count += 1
        continue

    if not rl_path.exists():
        print(f"\n[ERROR] RL test not found: {rl_path}")
        fail_count += 1
        continue

    try:
        compare_tests(l4_path, rl_path, test_name)
        pass_count += 1
    except Exception as e:
        print(f"\n[ERROR] Comparison failed for {test_name}: {e}")
        fail_count += 1

print("\n" + "=" * 70)
print(f"Summary: {pass_count} tests completed, {fail_count} tests failed")
print("=" * 70)

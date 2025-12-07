"""
Debug script to trace physics calculations step by step
"""
import math

# Constants from L4
max_pitch_speed = 24.0  # rad/s
KpPitch = 36.0
KdPitch = 4.0
max_accel_pitch_rad = 733.0 * (math.pi / 180)  # ~12.79 rad/s²
damp = 2.96
w_max = 5.5  # rad/s
dt = 1/60  # 60 FPS

# Initial state
wx = 0.0

# Full stick input
joy_y = 1.0
eff = 1.0

print("=" * 70)
print("L4 Physics Debug: Pitch No-DAR Full Stick")
print("=" * 70)
print(f"Target: {w_max} rad/s global cap")
print(f"Per-axis cap: {max_pitch_speed} rad/s")
print(f"Max accel: {max_accel_pitch_rad:.3f} rad/s² ({733}°/s²)")
print(f"Damping: {damp}")
print(f"dt: {dt:.4f}s")
print()

# Simulate 5 seconds
print("Time    wx      wx_des  PD_accel  Clamped  After_accel  Damp_scale  After_damp")
print("-" * 90)

for frame in range(300):  # 5 seconds at 60fps
    t = frame * dt

    # Desired angular velocity
    wx_des = max_pitch_speed * eff * joy_y

    # PD control
    ax_des = KpPitch * (wx_des - wx) - KdPitch * wx

    # Clamp to max acceleration
    ax = max(-max_accel_pitch_rad, min(max_accel_pitch_rad, ax_des))

    # Apply acceleration
    wx_before_damp = wx + ax * dt

    # Damping
    scale = math.exp(-damp * dt)
    wx_after_damp = wx_before_damp * scale

    # Update state
    wx = wx_after_damp

    # Print every 30 frames (0.5 seconds)
    if frame % 30 == 0 or frame < 5:
        print(f"{t:5.2f}s  {wx:6.3f}  {wx_des:6.3f}  {ax_des:8.3f}  {ax:7.3f}  {wx_before_damp:11.3f}  {scale:10.6f}  {wx_after_damp:10.3f}")

print()
print(f"Final velocity: {wx:.3f} rad/s ({wx * 180 / math.pi:.1f}°/s)")
print(f"Expected: {w_max} rad/s (315.1°/s)")
print(f"Achieved: {wx / w_max * 100:.1f}%")
print()

# Now let's check equilibrium - where does acceleration balance damping?
print("=" * 70)
print("Equilibrium Analysis")
print("=" * 70)
print()
print("At equilibrium: acceleration from PD control = damping force")
print()

# At steady state, wx stops changing when:
# (acceleration * dt) = wx * (1 - exp(-damp * dt))
# Rearranging: ax * dt = wx * (1 - scale)

# PD control gives: ax = KpPitch * (wx_des - wx) - KdPitch * wx
# At equilibrium: ax * dt = wx * (1 - scale)
# So: [KpPitch * (wx_des - wx) - KdPitch * wx] * dt = wx * (1 - scale)

# Let's solve for equilibrium wx numerically
wx_test = 0.0
for i in range(100):
    wx_test += 0.1
    wx_des = max_pitch_speed
    ax_des = KpPitch * (wx_des - wx_test) - KdPitch * wx_test
    ax = min(max_accel_pitch_rad, ax_des)  # assuming positive direction

    accel_term = ax * dt
    damp_term = wx_test * (1 - math.exp(-damp * dt))

    if i < 10 or abs(accel_term - damp_term) < 0.01:
        print(f"wx={wx_test:5.2f}: accel_term={accel_term:.4f}, damp_term={damp_term:.4f}, diff={accel_term - damp_term:.4f}")

    if accel_term < damp_term:
        print(f"\nEquilibrium point: wx ≈ {wx_test:.3f} rad/s ({wx_test * 180 / math.pi:.1f}°/s)")
        break

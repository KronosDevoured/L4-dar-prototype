"""
Fennec Center of Mass Multi-Axis Measurement Script
Measures the actual rotation center by recording nose position during pitch, yaw, and roll rotations
This provides a complete 3D center of mass measurement with verification
Note: Fennec uses Octane hitbox (118.01 uu length) but may have different COM
"""

import math
import time
from pathlib import Path

from rlbot.agents.base_agent import BaseAgent, SimpleControllerState
from rlbot.utils.structures.game_data_struct import GameTickPacket
from rlbot.utils.game_state_util import GameState, CarState, Physics, Vector3, Rotator


class FennecCenterOfMassMultiAxis(BaseAgent):
    def __init__(self, name, team, index):
        super().__init__(name, team, index)
        self.test_start_time = None
        self.test_duration = 5.0  # 5 seconds per axis
        self.data_points = []
        self.test_complete = False
        self.setup_complete = False
        self.leveling = False
        self.level_start_time = None

        # Test phases: pitch, yaw, roll
        self.current_axis = 'pitch'
        self.axes_complete = []
        self.all_data = {
            'pitch': [],
            'yaw': [],
            'roll': []
        }

        # Fennec uses Octane hitbox
        self.car_length = 118.01  # Octane hitbox length in uu
        self.nose_offset = self.car_length / 2

        # Output directory
        self.output_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/fennec_com_test")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_agent(self):
        """Called once when bot starts"""
        self.logger.info("Fennec Multi-Axis Center of Mass Measurement Bot initialized")

    def get_output(self, packet: GameTickPacket) -> SimpleControllerState:
        """Main bot logic"""
        controller = SimpleControllerState()

        if self.test_complete:
            return controller

        car = packet.game_cars[self.index]

        # Phase 1: Setup - Teleport to center position
        if not self.setup_complete:
            self.teleport_to_center()
            self.setup_complete = True
            self.leveling = True
            self.level_start_time = time.time()
            self.logger.info(f"Setup complete - Starting leveling for {self.current_axis}")
            return controller

        # Phase 2: Auto-level the car
        if self.leveling:
            if time.time() - self.level_start_time > 2.0:
                # Check if level
                pitch = car.physics.rotation.pitch
                roll = car.physics.rotation.roll

                if abs(pitch) < 0.05 and abs(roll) < 0.05:
                    self.leveling = False
                    self.test_start_time = time.time()
                    self.logger.info(f"Car leveled - Starting {self.current_axis} rotation test")
                    return controller
                else:
                    # Continue leveling
                    self.level_start_time = time.time()

            # Apply leveling input
            controller.pitch = -car.physics.rotation.pitch * 5.0
            controller.roll = -car.physics.rotation.roll * 5.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))
            return controller

        # Phase 3: Run the rotation test
        if self.test_start_time is None:
            self.test_start_time = time.time()

        elapsed = time.time() - self.test_start_time

        if elapsed < self.test_duration:
            # Apply constant input for current axis
            if self.current_axis == 'pitch':
                controller.pitch = 1.0
            elif self.current_axis == 'yaw':
                controller.yaw = 1.0
            elif self.current_axis == 'roll':
                controller.roll = 1.0

            # Record data
            self.record_data_point(elapsed, car)

        else:
            # Current axis test complete
            if self.current_axis not in self.axes_complete:
                self.all_data[self.current_axis] = self.data_points.copy()
                self.axes_complete.append(self.current_axis)
                self.logger.info(f"{self.current_axis} test complete - {len(self.data_points)} points")

                # Move to next axis
                if self.current_axis == 'pitch':
                    self.current_axis = 'yaw'
                    self.reset_for_next_axis()
                elif self.current_axis == 'yaw':
                    self.current_axis = 'roll'
                    self.reset_for_next_axis()
                else:
                    # All axes complete - analyze
                    self.analyze_and_save()
                    self.test_complete = True
                    self.logger.info("All tests complete - Data saved")

        return controller

    def reset_for_next_axis(self):
        """Reset state for next axis measurement"""
        self.data_points = []
        self.test_start_time = None
        self.setup_complete = False
        self.leveling = False
        self.logger.info(f"Resetting for {self.current_axis} test")

    def teleport_to_center(self):
        """Teleport car to (0, 0, 500) facing forward"""
        car_state = CarState(
            physics=Physics(
                location=Vector3(0, 0, 500),
                velocity=Vector3(0, 0, 0),
                angular_velocity=Vector3(0, 0, 0),
                rotation=Rotator(0, 0, 0)  # Level, facing +X
            )
        )

        game_state = GameState(cars={self.index: car_state})
        self.set_game_state(game_state)
        self.logger.info("Teleported to center (0, 0, 500)")

    def record_data_point(self, elapsed, car):
        """Record car position and rotation"""
        pos = car.physics.location
        rot = car.physics.rotation
        ang_vel = car.physics.angular_velocity

        # Calculate nose position in world space
        nose_x = pos.x + self.nose_offset * math.cos(rot.pitch) * math.cos(rot.yaw)
        nose_y = pos.y + self.nose_offset * math.cos(rot.pitch) * math.sin(rot.yaw)
        nose_z = pos.z + self.nose_offset * math.sin(rot.pitch)

        data = {
            'time': elapsed,
            'pos_x': pos.x,
            'pos_y': pos.y,
            'pos_z': pos.z,
            'rot_pitch': rot.pitch,
            'rot_yaw': rot.yaw,
            'rot_roll': rot.roll,
            'ang_vel_x': ang_vel.x,
            'ang_vel_y': ang_vel.y,
            'ang_vel_z': ang_vel.z,
            'nose_x': nose_x,
            'nose_y': nose_y,
            'nose_z': nose_z
        }

        self.data_points.append(data)

    def analyze_and_save(self):
        """Analyze rotation data from all three axes to find center of mass"""
        for axis in ['pitch', 'yaw', 'roll']:
            if len(self.all_data[axis]) < 10:
                self.logger.error(f"Not enough data points for {axis}")
                return

        # Save raw data to CSV files
        for axis in ['pitch', 'yaw', 'roll']:
            csv_file = self.output_dir / f"fennec_com_{axis}_data.csv"
            with open(csv_file, 'w') as f:
                f.write("time,pos_x,pos_y,pos_z,rot_pitch,rot_yaw,rot_roll,")
                f.write("ang_vel_x,ang_vel_y,ang_vel_z,nose_x,nose_y,nose_z\n")

                for point in self.all_data[axis]:
                    f.write(f"{point['time']:.3f},")
                    f.write(f"{point['pos_x']:.3f},{point['pos_y']:.3f},{point['pos_z']:.3f},")
                    f.write(f"{point['rot_pitch']:.4f},{point['rot_yaw']:.4f},{point['rot_roll']:.4f},")
                    f.write(f"{point['ang_vel_x']:.4f},{point['ang_vel_y']:.4f},{point['ang_vel_z']:.4f},")
                    f.write(f"{point['nose_x']:.3f},{point['nose_y']:.3f},{point['nose_z']:.3f}\n")

            self.logger.info(f"Raw {axis} data saved to {csv_file}")

        # Calculate center of rotation from each axis
        # PITCH: Rotation in X-Z plane (forward-vertical)
        pitch_data = self.all_data['pitch']
        pitch_positions = [(p['nose_x'], p['nose_z']) for p in pitch_data]
        pitch_center_x = sum(p[0] for p in pitch_positions) / len(pitch_positions)
        pitch_center_z = sum(p[1] for p in pitch_positions) / len(pitch_positions)

        # YAW: Rotation in X-Y plane (forward-lateral)
        yaw_data = self.all_data['yaw']
        yaw_positions = [(p['nose_x'], p['nose_y']) for p in yaw_data]
        yaw_center_x = sum(p[0] for p in yaw_positions) / len(yaw_positions)
        yaw_center_y = sum(p[1] for p in yaw_positions) / len(yaw_positions)

        # ROLL: Rotation in Y-Z plane (lateral-vertical)
        roll_data = self.all_data['roll']
        roll_positions = [(p['nose_y'], p['nose_z']) for p in roll_data]
        roll_center_y = sum(p[0] for p in roll_positions) / len(roll_positions)
        roll_center_z = sum(p[1] for p in roll_positions) / len(roll_positions)

        # Get geometric center
        car_center_x = pitch_data[0]['pos_x']
        car_center_y = pitch_data[0]['pos_y']
        car_center_z = pitch_data[0]['pos_z']

        # Calculate offsets from each measurement
        offset_x_pitch = pitch_center_x - car_center_x
        offset_z_pitch = pitch_center_z - car_center_z

        offset_x_yaw = yaw_center_x - car_center_x
        offset_y_yaw = yaw_center_y - car_center_y

        offset_y_roll = roll_center_y - car_center_y
        offset_z_roll = roll_center_z - car_center_z

        # Average measurements where they overlap
        offset_x = (offset_x_pitch + offset_x_yaw) / 2
        offset_y = (offset_y_yaw + offset_y_roll) / 2
        offset_z = (offset_z_pitch + offset_z_roll) / 2

        # Calculate rotation radii
        radius_pitch = math.sqrt((pitch_positions[0][0] - pitch_center_x)**2 +
                                 (pitch_positions[0][1] - pitch_center_z)**2)
        radius_yaw = math.sqrt((yaw_positions[0][0] - yaw_center_x)**2 +
                               (yaw_positions[0][1] - yaw_center_y)**2)
        radius_roll = math.sqrt((roll_positions[0][0] - roll_center_y)**2 +
                                (roll_positions[0][1] - roll_center_z)**2)

        # Save analysis
        analysis_file = self.output_dir / "fennec_com_multiaxis_analysis.txt"
        with open(analysis_file, 'w') as f:
            f.write("FENNEC CENTER OF MASS MULTI-AXIS ANALYSIS\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Test duration per axis: {self.test_duration}s\n")
            f.write(f"Pitch data points: {len(pitch_data)}\n")
            f.write(f"Yaw data points: {len(yaw_data)}\n")
            f.write(f"Roll data points: {len(roll_data)}\n")
            f.write(f"Hitbox: Octane ({self.car_length:.2f} uu length)\n\n")

            f.write("GEOMETRIC CENTER (car hitbox center):\n")
            f.write(f"  X: {car_center_x:.2f} uu\n")
            f.write(f"  Y: {car_center_y:.2f} uu\n")
            f.write(f"  Z: {car_center_z:.2f} uu\n\n")

            f.write("ROTATION CENTER FROM PITCH (X-Z plane):\n")
            f.write(f"  X: {pitch_center_x:.2f} uu (offset: {offset_x_pitch:.2f} uu)\n")
            f.write(f"  Z: {pitch_center_z:.2f} uu (offset: {offset_z_pitch:.2f} uu)\n")
            f.write(f"  Radius: {radius_pitch:.2f} uu\n\n")

            f.write("ROTATION CENTER FROM YAW (X-Y plane):\n")
            f.write(f"  X: {yaw_center_x:.2f} uu (offset: {offset_x_yaw:.2f} uu)\n")
            f.write(f"  Y: {yaw_center_y:.2f} uu (offset: {offset_y_yaw:.2f} uu)\n")
            f.write(f"  Radius: {radius_yaw:.2f} uu\n\n")

            f.write("ROTATION CENTER FROM ROLL (Y-Z plane):\n")
            f.write(f"  Y: {roll_center_y:.2f} uu (offset: {offset_y_roll:.2f} uu)\n")
            f.write(f"  Z: {roll_center_z:.2f} uu (offset: {offset_z_roll:.2f} uu)\n")
            f.write(f"  Radius: {radius_roll:.2f} uu\n\n")

            f.write("FINAL CENTER OF MASS OFFSET (averaged from all axes):\n")
            f.write(f"  Forward (X): {offset_x:.2f} uu\n")
            f.write(f"  Lateral (Y): {offset_y:.2f} uu (should be ~0 for symmetric car)\n")
            f.write(f"  Vertical (Z): {offset_z:.2f} uu\n\n")

            f.write("VERIFICATION:\n")
            f.write(f"  X offset consistency: pitch={offset_x_pitch:.2f}, yaw={offset_x_yaw:.2f}, diff={abs(offset_x_pitch - offset_x_yaw):.2f}\n")
            f.write(f"  Y offset consistency: yaw={offset_y_yaw:.2f}, roll={offset_y_roll:.2f}, diff={abs(offset_y_yaw - offset_y_roll):.2f}\n")
            f.write(f"  Z offset consistency: pitch={offset_z_pitch:.2f}, roll={offset_z_roll:.2f}, diff={abs(offset_z_pitch - offset_z_roll):.2f}\n\n")

            f.write("ROTATION CHARACTERISTICS:\n")
            f.write(f"  Lever length (pitch): {radius_pitch:.2f} uu\n")
            f.write(f"  Lever length (yaw): {radius_yaw:.2f} uu\n")
            f.write(f"  Lever length (roll): {radius_roll:.2f} uu\n\n")

            f.write("COMPARISON TO OCTANE:\n")
            f.write(f"  Expected Octane lever: ~73 uu\n")
            f.write(f"  Fennec measured lever (avg): {(radius_pitch + radius_yaw + radius_roll) / 3:.2f} uu\n")
            f.write(f"  Note: Fennec uses Octane hitbox but may have different COM\n\n")

            # Provide L4 implementation values
            f.write("=" * 60 + "\n")
            f.write("L4 DAR PROTOTYPE IMPLEMENTATION VALUES\n")
            f.write("=" * 60 + "\n\n")
            f.write("Add to car.js loadCarModel() function:\n\n")
            f.write("} else if (presetName === 'fennec') {\n")
            f.write(f"  xOffset = {-offset_x:.1f};  // Forward bias (negative moves model backward)\n")
            f.write(f"  yOffset = -BOX.hy + {offset_z:.1f};  // Vertical offset (positive raises model)\n")
            f.write(f"  zOffset = {-offset_y:.1f};  // Lateral offset (should be ~0)\n")
            f.write("}\n")

        self.logger.info(f"Multi-axis analysis saved to {analysis_file}")

        # Print to console
        print("\n" + "=" * 60)
        print("FENNEC CENTER OF MASS MULTI-AXIS MEASUREMENT COMPLETE")
        print("=" * 60)
        print(f"\nFinal Center of Mass Offset (averaged from all axes):")
        print(f"  Forward (X): {offset_x:.2f} uu")
        print(f"  Lateral (Y): {offset_y:.2f} uu (should be ~0)")
        print(f"  Vertical (Z): {offset_z:.2f} uu")
        print(f"\nVerification (consistency check):")
        print(f"  X consistency: {abs(offset_x_pitch - offset_x_yaw):.2f} uu difference")
        print(f"  Y consistency: {abs(offset_y_yaw - offset_y_roll):.2f} uu difference")
        print(f"  Z consistency: {abs(offset_z_pitch - offset_z_roll):.2f} uu difference")
        print(f"\nLever length: {(radius_pitch + radius_yaw + radius_roll) / 3:.2f} uu (expected ~73 uu)")
        print(f"Comparison to Octane: Will help determine if Fennec COM differs from Octane")
        print(f"\nL4 Implementation:")
        print(f"  xOffset = {-offset_x:.1f};")
        print(f"  yOffset = -BOX.hy + {offset_z:.1f};")
        print(f"  zOffset = {-offset_y:.1f};")
        print(f"\nResults saved to: {self.output_dir}")
        print("=" * 60 + "\n")

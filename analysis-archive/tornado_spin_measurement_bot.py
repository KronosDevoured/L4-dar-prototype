"""
Tornado Spin Comprehensive Measurement Bot
Measures nose travel distance during DAR tornado spins across multiple stick directions and magnitudes
"""

import math
import time
from pathlib import Path

from rlbot.agents.base_agent import BaseAgent, SimpleControllerState
from rlbot.utils.structures.game_data_struct import GameTickPacket
from rlbot.utils.game_state_util import GameState, CarState, Physics, Vector3, Rotator


class TornadoSpinMeasurementBot(BaseAgent):
    def __init__(self, name, team, index):
        super().__init__(name, team, index)

        # Test configuration
        self.stick_angles = []  # Will be populated with angles from 0° (up) to 90° (right) in 22.5° increments
        self.stick_magnitudes = [0.10, 1.0]  # Min and max stick input
        self.dar_direction = 1  # 1 for right, -1 for left

        # Generate stick angles: 0°, 22.5°, 45°, 67.5°, 90°
        for i in range(5):
            self.stick_angles.append(i * 22.5)

        # Test state
        self.game_started = False
        self.current_angle_index = 0
        self.current_mag_index = 0
        self.setup_complete = False
        self.leveling = False
        self.level_start_time = None
        self.spinning_up = False
        self.spinup_start_time = None
        self.spinup_duration = 1.5  # Seconds to accelerate to steady state before measuring
        self.measuring = False
        self.measurement_start_time = None
        self.measurement_duration = 3.0  # Seconds to measure (enough for multiple rotations)

        # Measurement data
        self.start_nose_pos = None
        self.found_opposite = False
        self.opposite_nose_pos = None
        self.all_measurements = []  # List of {angle, magnitude, radius, centerWorld, axisWorld}

        # Octane hitbox specs
        self.car_length = 118.01  # Octane hitbox length in uu
        self.nose_offset = self.car_length / 2

        # Output directory
        self.output_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/tornado_measurements")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_agent(self):
        """Called once when bot starts"""
        self.logger.info("Tornado Spin Measurement Bot initialized")
        self.logger.info(f"Will measure {len(self.stick_angles)} angles × {len(self.stick_magnitudes)} magnitudes = {len(self.stick_angles) * len(self.stick_magnitudes)} total measurements")

    def get_output(self, packet: GameTickPacket) -> SimpleControllerState:
        """Main bot logic"""
        controller = SimpleControllerState()

        # Wait for game to start
        if not self.game_started:
            if packet.game_info.is_round_active:
                self.game_started = True
                self.logger.info("Game started - Beginning tornado measurements")
            else:
                return controller

        # Check if all measurements complete
        if self.current_angle_index >= len(self.stick_angles):
            if not hasattr(self, 'analysis_complete'):
                self.analyze_and_save()
                self.analysis_complete = True
            return controller

        car = packet.game_cars[self.index]

        # Phase 1: Setup - Teleport to center position
        if not self.setup_complete:
            self.teleport_to_center()
            self.setup_complete = True
            self.leveling = True
            self.level_start_time = time.time()
            angle = self.stick_angles[self.current_angle_index]
            mag = self.stick_magnitudes[self.current_mag_index]
            self.logger.info(f"Starting angle {angle}° magnitude {mag}")
            return controller

        # Phase 2: Auto-level the car
        if self.leveling:
            if time.time() - self.level_start_time > 2.0:
                # Check if level
                pitch = car.physics.rotation.pitch
                roll = car.physics.rotation.roll

                if abs(pitch) < 0.05 and abs(roll) < 0.05:
                    self.leveling = False
                    self.spinning_up = True
                    self.spinup_start_time = time.time()
                    angle = self.stick_angles[self.current_angle_index]
                    mag = self.stick_magnitudes[self.current_mag_index]
                    self.logger.info(f"Leveled - Starting spin-up: {angle}° @ {mag} magnitude")
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

        # Phase 3: Spin-up phase - let car accelerate to steady state
        if self.spinning_up:
            elapsed = time.time() - self.spinup_start_time

            if elapsed < self.spinup_duration:
                # Apply DAR + stick input to accelerate
                angle_deg = self.stick_angles[self.current_angle_index]
                magnitude = self.stick_magnitudes[self.current_mag_index]

                # Convert angle to radians (0° = up, 90° = right)
                angle_rad = math.radians(angle_deg)

                # Calculate stick X and Y
                stick_x = math.sin(angle_rad) * magnitude  # Right is positive
                stick_y = math.cos(angle_rad) * magnitude  # Up is positive

                controller.pitch = stick_y
                controller.yaw = stick_x
                controller.roll = self.dar_direction  # Air Roll Right
            else:
                # Spin-up complete, start measuring
                self.spinning_up = False
                self.measuring = True
                self.measurement_start_time = time.time()
                self.start_nose_pos = None
                self.found_opposite = False
                self.opposite_nose_pos = None
                angle = self.stick_angles[self.current_angle_index]
                mag = self.stick_magnitudes[self.current_mag_index]
                self.logger.info(f"Spin-up complete - Starting measurement: {angle}° @ {mag} magnitude")

            return controller

        # Phase 4: Measure tornado spin
        if self.measuring:
            elapsed = time.time() - self.measurement_start_time

            if elapsed < self.measurement_duration:
                # Apply DAR + stick input
                angle_deg = self.stick_angles[self.current_angle_index]
                magnitude = self.stick_magnitudes[self.current_mag_index]

                # Convert angle to radians (0° = up, 90° = right)
                angle_rad = math.radians(angle_deg)

                # Calculate stick X and Y
                # In RL: up = (0, 1), right = (1, 0)
                stick_x = math.sin(angle_rad) * magnitude  # Right is positive
                stick_y = math.cos(angle_rad) * magnitude  # Up is positive

                controller.pitch = stick_y
                controller.yaw = stick_x
                controller.roll = self.dar_direction  # Air Roll Right

                # Track nose position during rotation
                self.track_nose_position(car)
            else:
                # Measurement complete
                self.measuring = False

                # Calculate and store result
                if self.start_nose_pos and self.opposite_nose_pos:
                    radius = self.start_nose_pos.flat_dist(self.opposite_nose_pos) * 0.5

                    # Calculate center and axis
                    center_world = Vector3(
                        (self.start_nose_pos.x + self.opposite_nose_pos.x) * 0.5,
                        (self.start_nose_pos.y + self.opposite_nose_pos.y) * 0.5,
                        (self.start_nose_pos.z + self.opposite_nose_pos.z) * 0.5
                    )

                    axis_world = Vector3(
                        self.opposite_nose_pos.x - self.start_nose_pos.x,
                        self.opposite_nose_pos.y - self.start_nose_pos.y,
                        self.opposite_nose_pos.z - self.start_nose_pos.z
                    )
                    axis_length = math.sqrt(axis_world.x**2 + axis_world.y**2 + axis_world.z**2)
                    if axis_length > 0:
                        axis_world.x /= axis_length
                        axis_world.y /= axis_length
                        axis_world.z /= axis_length

                    angle = self.stick_angles[self.current_angle_index]
                    mag = self.stick_magnitudes[self.current_mag_index]

                    self.all_measurements.append({
                        'angle': angle,
                        'magnitude': mag,
                        'radius': radius,
                        'center': center_world,
                        'axis': axis_world
                    })

                    self.logger.info(f"Measured: {angle}° @ {mag} mag → radius = {radius:.2f} uu")
                else:
                    self.logger.warning(f"Failed to capture both nose positions for {angle}° @ {mag}")

                # Move to next measurement
                self.current_mag_index += 1
                if self.current_mag_index >= len(self.stick_magnitudes):
                    self.current_mag_index = 0
                    self.current_angle_index += 1

                # Reset for next measurement
                self.setup_complete = False

        return controller

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

    def track_nose_position(self, car):
        """Track nose position and detect when car rotates 180°"""
        pos = car.physics.location
        rot = car.physics.rotation

        # Calculate current nose position in world space
        nose_x = pos.x + self.nose_offset * math.cos(rot.pitch) * math.cos(rot.yaw)
        nose_y = pos.y + self.nose_offset * math.cos(rot.pitch) * math.sin(rot.yaw)
        nose_z = pos.z + self.nose_offset * math.sin(rot.pitch)

        nose_pos = Vector3(nose_x, nose_y, nose_z)

        # Capture starting nose position
        if self.start_nose_pos is None:
            self.start_nose_pos = nose_pos
            return

        # Check if we've rotated ~180° in roll
        if not self.found_opposite:
            # Normalize roll to [-π, π]
            roll = rot.roll
            while roll > math.pi:
                roll -= 2 * math.pi
            while roll < -math.pi:
                roll += 2 * math.pi

            # Check if we're near ±180° (within 5° tolerance)
            if abs(abs(roll) - math.pi) < 0.087:  # 5° in radians
                self.opposite_nose_pos = nose_pos
                self.found_opposite = True

    def analyze_and_save(self):
        """Analyze all measurements and save results"""
        if len(self.all_measurements) == 0:
            self.logger.error("No measurements to analyze")
            return

        # Save raw data to CSV
        csv_file = self.output_dir / "tornado_measurements.csv"
        with open(csv_file, 'w') as f:
            f.write("angle_deg,magnitude,radius_uu,center_x,center_y,center_z,axis_x,axis_y,axis_z\n")

            for m in self.all_measurements:
                f.write(f"{m['angle']:.1f},{m['magnitude']:.2f},{m['radius']:.3f},")
                f.write(f"{m['center'].x:.3f},{m['center'].y:.3f},{m['center'].z:.3f},")
                f.write(f"{m['axis'].x:.4f},{m['axis'].y:.4f},{m['axis'].z:.4f}\n")

        self.logger.info(f"Raw data saved to {csv_file}")

        # Analyze patterns
        analysis_file = self.output_dir / "tornado_analysis.txt"
        with open(analysis_file, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("TORNADO SPIN COMPREHENSIVE MEASUREMENT ANALYSIS\n")
            f.write("=" * 80 + "\n\n")

            f.write(f"Total measurements: {len(self.all_measurements)}\n")
            f.write(f"Angles tested: {self.stick_angles}\n")
            f.write(f"Magnitudes tested: {self.stick_magnitudes}\n")
            f.write(f"DAR direction: {'Right' if self.dar_direction == 1 else 'Left'}\n\n")

            # Group by magnitude
            for mag in self.stick_magnitudes:
                mag_measurements = [m for m in self.all_measurements if m['magnitude'] == mag]

                f.write("-" * 80 + "\n")
                f.write(f"MAGNITUDE: {mag}\n")
                f.write("-" * 80 + "\n\n")

                if len(mag_measurements) == 0:
                    f.write("No measurements for this magnitude\n\n")
                    continue

                # Calculate statistics
                radii = [m['radius'] for m in mag_measurements]
                avg_radius = sum(radii) / len(radii)
                min_radius = min(radii)
                max_radius = max(radii)
                radius_range = max_radius - min_radius

                f.write(f"Average radius: {avg_radius:.2f} uu\n")
                f.write(f"Min radius: {min_radius:.2f} uu\n")
                f.write(f"Max radius: {max_radius:.2f} uu\n")
                f.write(f"Range: {radius_range:.2f} uu ({radius_range/avg_radius*100:.1f}% of average)\n\n")

                # List individual measurements
                f.write("Individual measurements:\n")
                for m in sorted(mag_measurements, key=lambda x: x['angle']):
                    deviation = m['radius'] - avg_radius
                    f.write(f"  {m['angle']:5.1f}° → {m['radius']:6.2f} uu (deviation: {deviation:+6.2f} uu)\n")
                f.write("\n")

                # Check if pattern is consistent (low variance)
                variance = sum((r - avg_radius)**2 for r in radii) / len(radii)
                std_dev = math.sqrt(variance)
                coefficient_of_variation = std_dev / avg_radius if avg_radius > 0 else 0

                f.write(f"Standard deviation: {std_dev:.2f} uu\n")
                f.write(f"Coefficient of variation: {coefficient_of_variation:.3f}\n")

                if coefficient_of_variation < 0.05:
                    f.write("✓ PATTERN: Highly consistent (< 5% variation) → Use fixed circle radius\n")
                elif coefficient_of_variation < 0.15:
                    f.write("✓ PATTERN: Moderately consistent (< 15% variation) → Use fixed circle radius with tolerance\n")
                else:
                    f.write("✗ PATTERN: High variation (> 15%) → May need direction-dependent radius\n")
                f.write("\n")

            # Compare min vs max magnitude
            f.write("=" * 80 + "\n")
            f.write("MIN vs MAX COMPARISON\n")
            f.write("=" * 80 + "\n\n")

            min_mag = min(self.stick_magnitudes)
            max_mag = max(self.stick_magnitudes)

            min_measurements = [m for m in self.all_measurements if m['magnitude'] == min_mag]
            max_measurements = [m for m in self.all_measurements if m['magnitude'] == max_mag]

            if len(min_measurements) > 0 and len(max_measurements) > 0:
                min_avg = sum(m['radius'] for m in min_measurements) / len(min_measurements)
                max_avg = sum(m['radius'] for m in max_measurements) / len(max_measurements)

                f.write(f"Min magnitude ({min_mag}) average radius: {min_avg:.2f} uu\n")
                f.write(f"Max magnitude ({max_mag}) average radius: {max_avg:.2f} uu\n")
                f.write(f"Ratio (max/min): {max_avg/min_avg:.3f}\n\n")

                f.write("This ratio can be used for interpolating radii at intermediate stick magnitudes.\n")

            f.write("\n")
            f.write("=" * 80 + "\n")
            f.write("IMPLEMENTATION RECOMMENDATIONS\n")
            f.write("=" * 80 + "\n\n")

            # Provide implementation guidance
            f.write("For L4 DAR prototype:\n\n")

            min_meas = [m for m in self.all_measurements if m['magnitude'] == min(self.stick_magnitudes)]
            max_meas = [m for m in self.all_measurements if m['magnitude'] == max(self.stick_magnitudes)]

            if len(min_meas) > 0:
                min_radius_avg = sum(m['radius'] for m in min_meas) / len(min_meas)
                f.write(f"AXIS_MIN_DATA radius: {min_radius_avg:.2f} uu\n")

            if len(max_meas) > 0:
                max_radius_avg = sum(m['radius'] for m in max_meas) / len(max_meas)
                f.write(f"AXIS_MAX_DATA radius: {max_radius_avg:.2f} uu\n")

            f.write("\n")
            f.write("If patterns are consistent across directions:\n")
            f.write("  → Use a single interpolated radius based on stick magnitude\n")
            f.write("  → Formula: radius = lerp(min_radius, max_radius, stickMag)\n\n")

            f.write("If patterns vary by direction:\n")
            f.write("  → Store direction-dependent radius values\n")
            f.write("  → Interpolate based on both stick magnitude AND angle\n")

        self.logger.info(f"Analysis saved to {analysis_file}")

        # Print summary to console
        print("\n" + "=" * 80)
        print("TORNADO SPIN MEASUREMENT COMPLETE")
        print("=" * 80)
        print(f"\nTotal measurements: {len(self.all_measurements)}")
        print(f"Results saved to: {self.output_dir}")
        print("\nSummary by magnitude:")

        for mag in self.stick_magnitudes:
            mag_meas = [m for m in self.all_measurements if m['magnitude'] == mag]
            if len(mag_meas) > 0:
                avg_r = sum(m['radius'] for m in mag_meas) / len(mag_meas)
                print(f"  Magnitude {mag}: {avg_r:.2f} uu average radius")

        print("\n" + "=" * 80 + "\n")

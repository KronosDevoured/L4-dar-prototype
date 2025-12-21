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

        # Test configuration - AIR ROLL LEFT ONLY
        self.stick_angles = []  # Will be populated with angles from 0° (up) to 90° (right) in 22.5° increments
        self.stick_magnitudes = [0.10, 0.25, 0.50, 0.75, 1.0]  # Multiple magnitudes to verify protocol values
        self.dar_direction = -1  # -1 for AIR ROLL LEFT (NOT free air roll!)

        # Generate stick angles: 0°, 22.5°, 45°, 67.5°, 90°
        for i in range(5):
            self.stick_angles.append(i * 22.5)

        # Test state
        self.game_started = False
        self.waiting_for_game_start = True
        self.game_start_wait_time = None
        self.game_start_wait_duration = 2.0
        self.current_angle_index = 0
        self.current_mag_index = 0

        # Phase flags
        self.setup_complete = False
        self.post_teleport_wait = False
        self.post_teleport_wait_start = None
        self.post_teleport_wait_duration = 0.5  # Wait 0.5s after teleport for physics to settle
        self.stabilizing = False
        self.stabilization_start_time = None
        self.stabilization_min_duration = 5.0  # Check stability after 5 seconds
        self.stability_check_interval = 0.5  # Check every 0.5 seconds after min duration
        self.last_stability_check = None
        self.spinning_up = False
        self.spinup_start_time = None
        self.spinup_duration = 1.5  # Seconds to accelerate to steady state before measuring
        self.measuring = False
        self.measurement_start_time = None
        self.measurement_duration = 3.0  # Seconds to measure (enough for multiple rotations)
        self.post_measurement_stabilizing = False
        self.post_measurement_stabilization_start = None

        # Measurement data
        self.start_nose_pos = None
        self.found_opposite = False
        self.opposite_nose_pos = None
        self.all_measurements = []  # List of {angle, magnitude, radius, centerWorld, axisWorld}

        # Octane hitbox specs
        self.car_length = 118.01  # Octane hitbox length in uu
        self.nose_offset = self.car_length / 2

        # Debug
        self.debug_frame_count = 0

        # Output directory
        self.output_dir = Path("C:/Users/itsju/AppData/Roaming/bakkesmod/bakkesmod/data/tornado_measurements")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_agent(self):
        """Called once when bot starts"""
        self.logger.info("Tornado Spin Measurement Bot initialized")
        self.logger.info(f"Testing: AIR ROLL LEFT only (roll = -1)")
        self.logger.info(f"Will measure {len(self.stick_angles)} angles × {len(self.stick_magnitudes)} magnitudes = {len(self.stick_angles) * len(self.stick_magnitudes)} total measurements")
        self.logger.info(f"Angles: {self.stick_angles}")
        self.logger.info(f"Magnitudes: {self.stick_magnitudes}")

    def get_output(self, packet: GameTickPacket) -> SimpleControllerState:
        """Main bot logic with comprehensive stabilization phases"""
        controller = SimpleControllerState()

        # Phase 0: Wait for game to start
        if self.waiting_for_game_start:
            if packet.game_info.is_round_active:
                if self.game_start_wait_time is None:
                    self.game_start_wait_time = time.time()
                    self.logger.info("Game is active - Waiting 2 seconds before starting measurements...")

                elapsed = time.time() - self.game_start_wait_time
                if elapsed >= self.game_start_wait_duration:
                    self.waiting_for_game_start = False
                    self.game_started = True
                    self.logger.info("Beginning tornado spin measurements")
            return controller

        # Check if all measurements complete
        if self.current_angle_index >= len(self.stick_angles):
            if not hasattr(self, 'analysis_complete'):
                self.logger.info(f"All measurements complete! Analyzing {len(self.all_measurements)} measurements...")
                self.analyze_and_save()
                self.analysis_complete = True
            return controller

        car = packet.game_cars[self.index]

        # Debug: Log current state every 60 frames (~1 second)
        self.debug_frame_count += 1
        if self.debug_frame_count % 60 == 0:
            phase = self.get_current_phase_name()
            self.logger.info(f"DEBUG: [{self.current_angle_index}/{len(self.stick_angles)}][{self.current_mag_index}/{len(self.stick_magnitudes)}] Phase: {phase}")

        # Phase 1: Setup - Teleport to center position
        if not self.setup_complete:
            angle = self.stick_angles[self.current_angle_index]
            mag = self.stick_magnitudes[self.current_mag_index]
            measurement_num = self.current_angle_index * len(self.stick_magnitudes) + self.current_mag_index + 1
            total_measurements = len(self.stick_angles) * len(self.stick_magnitudes)

            self.logger.info(f"[{measurement_num}/{total_measurements}] SETUP: Teleporting for {angle}° @ {mag} magnitude")
            self.teleport_to_center()

            self.setup_complete = True
            self.post_teleport_wait = True
            self.post_teleport_wait_start = time.time()
            return controller

        # Phase 2: Post-teleport wait (let physics settle)
        elif self.post_teleport_wait:
            elapsed = time.time() - self.post_teleport_wait_start

            if elapsed >= self.post_teleport_wait_duration:
                self.post_teleport_wait = False
                self.stabilizing = True
                self.stabilization_start_time = time.time()
                self.last_stability_check = None
                angle = self.stick_angles[self.current_angle_index]
                mag = self.stick_magnitudes[self.current_mag_index]
                self.logger.info(f"POST_TELEPORT_WAIT complete - Beginning stabilization for {angle}° @ {mag}")

            # Apply minimal leveling during wait
            controller.pitch = -car.physics.rotation.pitch * 2.0
            controller.roll = -car.physics.rotation.roll * 2.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))
            return controller

        # Phase 3: Pre-measurement stabilization (with continuous checking)
        elif self.stabilizing:
            elapsed = time.time() - self.stabilization_start_time
            current_time = time.time()

            # Apply active stabilization input
            controller.pitch = -car.physics.rotation.pitch * 5.0
            controller.roll = -car.physics.rotation.roll * 5.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))

            # After minimum duration, check stability periodically
            if elapsed >= self.stabilization_min_duration:
                # Check every stability_check_interval
                if self.last_stability_check is None or (current_time - self.last_stability_check) >= self.stability_check_interval:
                    self.last_stability_check = current_time

                    if self.is_car_stable(car):
                        # Car is stable! Proceed to spin-up
                        self.stabilizing = False
                        self.spinning_up = True
                        self.spinup_start_time = time.time()
                        angle = self.stick_angles[self.current_angle_index]
                        mag = self.stick_magnitudes[self.current_mag_index]
                        self.logger.info(f"STABILIZED after {elapsed:.2f}s - Starting spin-up: {angle}° @ {mag}")
                        return controller
                    else:
                        # Not stable yet, log status every few checks
                        if int(elapsed) % 2 == 0 and elapsed - int(elapsed) < self.stability_check_interval:
                            ang_vel = car.physics.angular_velocity
                            ang_vel_mag = math.sqrt(ang_vel.x**2 + ang_vel.y**2 + ang_vel.z**2)
                            self.logger.info(f"STABILIZING... ({elapsed:.1f}s) ang_vel={ang_vel_mag:.3f}")

            # Timeout after 15 seconds
            if elapsed > 15.0:
                self.stabilizing = False
                self.spinning_up = True
                self.spinup_start_time = time.time()
                angle = self.stick_angles[self.current_angle_index]
                mag = self.stick_magnitudes[self.current_mag_index]
                self.logger.warning(f"STABILIZATION TIMEOUT after {elapsed:.2f}s - Proceeding anyway: {angle}° @ {mag}")

            return controller

        # Phase 4: Spin-up phase - let car accelerate to steady state
        elif self.spinning_up:
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
                controller.roll = self.dar_direction  # -1 = Air Roll Left (constant roll input)
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

        # Phase 5: Measure tornado spin
        elif self.measuring:
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
                controller.roll = self.dar_direction  # -1 = Air Roll Left (constant roll input)

                # Track nose position during rotation
                self.track_nose_position(car)
            else:
                # Measurement complete
                self.measuring = False

                # Calculate and store result
                if self.start_nose_pos and self.opposite_nose_pos:
                    # Calculate distance manually (flat_dist doesn't exist in RLBot Vector3)
                    dx = self.opposite_nose_pos.x - self.start_nose_pos.x
                    dy = self.opposite_nose_pos.y - self.start_nose_pos.y
                    dz = self.opposite_nose_pos.z - self.start_nose_pos.z
                    distance = math.sqrt(dx**2 + dy**2 + dz**2)
                    radius = distance * 0.5

                    # Calculate center and axis
                    center_world = Vector3(
                        (self.start_nose_pos.x + self.opposite_nose_pos.x) * 0.5,
                        (self.start_nose_pos.y + self.opposite_nose_pos.y) * 0.5,
                        (self.start_nose_pos.z + self.opposite_nose_pos.z) * 0.5
                    )

                    # Calculate axis vector (unnormalized)
                    axis_x = self.opposite_nose_pos.x - self.start_nose_pos.x
                    axis_y = self.opposite_nose_pos.y - self.start_nose_pos.y
                    axis_z = self.opposite_nose_pos.z - self.start_nose_pos.z

                    # Normalize axis
                    axis_length = math.sqrt(axis_x**2 + axis_y**2 + axis_z**2)
                    if axis_length > 0:
                        axis_x /= axis_length
                        axis_y /= axis_length
                        axis_z /= axis_length

                    # Create normalized axis vector
                    axis_world = Vector3(axis_x, axis_y, axis_z)

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

                # Start post-measurement stabilization
                self.measuring = False
                self.post_measurement_stabilizing = True
                self.post_measurement_stabilization_start = time.time()
                self.last_stability_check = None
                angle = self.stick_angles[self.current_angle_index]
                mag = self.stick_magnitudes[self.current_mag_index]
                self.logger.info(f"Measurement complete for {angle}° @ {mag} - Beginning post-measurement stabilization")

            return controller

        # Phase 6: Post-measurement stabilization
        elif self.post_measurement_stabilizing:
            elapsed = time.time() - self.post_measurement_stabilization_start
            current_time = time.time()

            # Apply active stabilization input
            controller.pitch = -car.physics.rotation.pitch * 5.0
            controller.roll = -car.physics.rotation.roll * 5.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))

            # After minimum duration, check stability periodically
            if elapsed >= self.stabilization_min_duration:
                # Check every stability_check_interval
                if self.last_stability_check is None or (current_time - self.last_stability_check) >= self.stability_check_interval:
                    self.last_stability_check = current_time

                    if self.is_car_stable(car):
                        # Car is stable! Move to next measurement
                        self.post_measurement_stabilizing = False

                        # Move to next measurement
                        self.current_mag_index += 1
                        if self.current_mag_index >= len(self.stick_magnitudes):
                            self.current_mag_index = 0
                            self.current_angle_index += 1

                        # Check if more measurements remain
                        if self.current_angle_index < len(self.stick_angles):
                            next_angle = self.stick_angles[self.current_angle_index]
                            next_mag = self.stick_magnitudes[self.current_mag_index]
                            measurement_num = self.current_angle_index * len(self.stick_magnitudes) + self.current_mag_index + 1
                            total = len(self.stick_angles) * len(self.stick_magnitudes)
                            self.logger.info(f"POST_MEASUREMENT_STABILIZED after {elapsed:.2f}s - Moving to [{measurement_num}/{total}]: {next_angle}° @ {next_mag}")

                        # Reset all state flags for next measurement
                        self.setup_complete = False
                        self.post_teleport_wait = False
                        self.post_teleport_wait_start = None
                        self.stabilizing = False
                        self.stabilization_start_time = None
                        self.last_stability_check = None
                        self.spinning_up = False
                        self.spinup_start_time = None
                        self.measuring = False
                        self.measurement_start_time = None
                        self.start_nose_pos = None
                        self.found_opposite = False
                        self.opposite_nose_pos = None
                        self.post_measurement_stabilizing = False
                        self.post_measurement_stabilization_start = None

                        return controller
                    else:
                        # Not stable yet, log status every few checks
                        if int(elapsed) % 2 == 0 and elapsed - int(elapsed) < self.stability_check_interval:
                            ang_vel = car.physics.angular_velocity
                            ang_vel_mag = math.sqrt(ang_vel.x**2 + ang_vel.y**2 + ang_vel.z**2)
                            self.logger.info(f"POST_MEASUREMENT_STABILIZING... ({elapsed:.1f}s) ang_vel={ang_vel_mag:.3f}")

            # Timeout after 15 seconds
            if elapsed > 15.0:
                self.logger.warning(f"POST_MEASUREMENT_STABILIZATION TIMEOUT after {elapsed:.2f}s - Moving to next measurement anyway")
                self.post_measurement_stabilizing = False

                # Move to next measurement
                self.current_mag_index += 1
                if self.current_mag_index >= len(self.stick_magnitudes):
                    self.current_mag_index = 0
                    self.current_angle_index += 1

                # Reset all state flags
                self.setup_complete = False
                self.post_teleport_wait = False
                self.stabilizing = False
                self.spinning_up = False
                self.measuring = False
                self.start_nose_pos = None
                self.found_opposite = False
                self.opposite_nose_pos = None

            return controller

        # If we reach here, no phase is active - this should NOT happen
        else:
            if self.current_angle_index < len(self.stick_angles):
                phase = self.get_current_phase_name()
                self.logger.warning(f"WARNING: Fell through all phases! Current phase: {phase}")
                self.logger.warning(f"Indices: angle={self.current_angle_index}/{len(self.stick_angles)}, mag={self.current_mag_index}/{len(self.stick_magnitudes)}")

        return controller

    def get_current_phase_name(self):
        """Get human-readable current phase name for debugging"""
        if not self.setup_complete:
            return "SETUP"
        elif self.post_teleport_wait:
            return "POST_TELEPORT_WAIT"
        elif self.stabilizing:
            return "STABILIZING"
        elif self.spinning_up:
            return "SPINNING_UP"
        elif self.measuring:
            return "MEASURING"
        elif self.post_measurement_stabilizing:
            return "POST_MEASUREMENT_STABILIZING"
        else:
            return "UNKNOWN"

    def is_car_stable(self, car):
        """Check if car is stable (level, minimal velocity)"""
        pitch = car.physics.rotation.pitch
        roll = car.physics.rotation.roll

        # Check angular velocity
        ang_vel = car.physics.angular_velocity
        ang_vel_mag = math.sqrt(ang_vel.x**2 + ang_vel.y**2 + ang_vel.z**2)

        # Check linear velocity
        vel = car.physics.velocity
        vel_mag = math.sqrt(vel.x**2 + vel.y**2 + vel.z**2)

        # Stability criteria
        is_level = abs(pitch) < 0.05 and abs(roll) < 0.05  # Within ~3 degrees
        is_ang_stable = ang_vel_mag < 0.1  # Minimal angular velocity
        is_vel_stable = vel_mag < 10.0  # Minimal linear velocity

        return is_level and is_ang_stable and is_vel_stable

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

        # Save raw data to CSV with enhanced documentation
        csv_file = self.output_dir / "tornado_measurements.csv"
        with open(csv_file, 'w') as f:
            # Header with metadata
            f.write("# Tornado Spin Measurement Data - Air Roll Left\n")
            f.write(f"# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Total Measurements: {len(self.all_measurements)}\n")
            f.write(f"# Air Roll: LEFT (controller.roll = -1)\n")
            f.write(f"# Stabilization: {self.stabilization_min_duration}s minimum\n")
            f.write("#\n")
            f.write("measurement_num,angle_deg,magnitude,radius_uu,center_x,center_y,center_z,axis_x,axis_y,axis_z,axis_tilt_deg\n")

            for idx, m in enumerate(self.all_measurements, 1):
                # Calculate axis tilt angle
                axis_horizontal = math.sqrt(m['axis'].x**2 + m['axis'].y**2)
                axis_tilt_rad = math.atan2(axis_horizontal, abs(m['axis'].z))
                axis_tilt_deg = math.degrees(axis_tilt_rad)

                f.write(f"{idx},{m['angle']:.1f},{m['magnitude']:.2f},{m['radius']:.3f},")
                f.write(f"{m['center'].x:.3f},{m['center'].y:.3f},{m['center'].z:.3f},")
                f.write(f"{m['axis'].x:.4f},{m['axis'].y:.4f},{m['axis'].z:.4f},")
                f.write(f"{axis_tilt_deg:.2f}\n")

        self.logger.info(f"Raw data saved to {csv_file}")

        # Analyze patterns
        analysis_file = self.output_dir / "tornado_analysis.txt"
        with open(analysis_file, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("TORNADO SPIN COMPREHENSIVE MEASUREMENT ANALYSIS\n")
            f.write("Air Roll Left (ARL) Tornado Spin Measurements\n")
            f.write("=" * 80 + "\n\n")

            f.write("TEST CONFIGURATION:\n")
            f.write(f"  Generation Time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"  Total Measurements: {len(self.all_measurements)}\n")
            f.write(f"  Angles Tested: {self.stick_angles}\n")
            f.write(f"  Magnitudes Tested: {self.stick_magnitudes}\n")
            f.write(f"  Air Roll: AIR ROLL LEFT (controller.roll = -1)\n")
            f.write(f"  DAR Mode: Simulated via constant roll input\n")
            f.write(f"  Stabilization Duration: {self.stabilization_min_duration}s minimum\n")
            f.write(f"  Stability Check Interval: {self.stability_check_interval}s\n")
            f.write(f"  Spin-up Duration: {self.spinup_duration}s\n")
            f.write(f"  Measurement Duration: {self.measurement_duration}s\n\n")

            f.write("TESTING PROCEDURE:\n")
            f.write("  Phase 1: SETUP - Teleport car to (0, 0, 500) level position\n")
            f.write("  Phase 2: POST_TELEPORT_WAIT - Wait 0.5s for physics to settle\n")
            f.write("  Phase 3: STABILIZING - Active stabilization for 5+ seconds\n")
            f.write("           * Continuously check stability every 0.5s after minimum duration\n")
            f.write("           * Proceed only when: level (<3°), ang_vel<0.1, vel<10.0\n")
            f.write("  Phase 4: SPINNING_UP - Apply tornado inputs for 1.5s\n")
            f.write("  Phase 5: MEASURING - Measure for 3.0s, track nose positions\n")
            f.write("  Phase 6: POST_MEASUREMENT_STABILIZING - Restabilize for 5+ seconds\n")
            f.write("           * Same stability criteria as Phase 3\n")
            f.write("           * Ensures clean state before next measurement\n\n")

            f.write("=" * 80 + "\n")
            f.write("L4 PHYSICS TEST PROTOCOL VALIDATION\n")
            f.write("=" * 80 + "\n\n")

            f.write("Protocol Reference Values:\n")
            f.write("- Circle Tilt Angle: 34°\n")
            f.write("- Max Angular Velocity: 5.5 rad/s (315°/s)\n")
            f.write("- Roll Accel (DAR): 1437°/s² (25.08 rad/s²)\n")
            f.write("- Damping (DAR): 4.35\n\n")

            f.write("Measurements will help verify:\n")
            f.write("1. Tornado radius consistency across stick directions\n")
            f.write("2. Magnitude-dependent radius scaling\n")
            f.write("3. Circle tilt angle (via axis orientation)\n\n")

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
            f.write("  → Interpolate based on both stick magnitude AND angle\n\n")

            # Add protocol validation section
            f.write("=" * 80 + "\n")
            f.write("PROTOCOL VALIDATION RESULTS\n")
            f.write("=" * 80 + "\n\n")

            # Calculate axis tilt angles from measurements
            f.write("Circle Axis Orientation Analysis:\n")
            f.write("(Verifies 34° tilt angle from protocol)\n\n")

            # For each stick angle, analyze the axis orientation
            for angle in self.stick_angles:
                angle_meas = [m for m in self.all_measurements if m['angle'] == angle]
                if len(angle_meas) > 0:
                    # Average axis vector for this angle
                    avg_axis_x = sum(m['axis'].x for m in angle_meas) / len(angle_meas)
                    avg_axis_y = sum(m['axis'].y for m in angle_meas) / len(angle_meas)
                    avg_axis_z = sum(m['axis'].z for m in angle_meas) / len(angle_meas)

                    # Calculate tilt angle from vertical (Z-axis)
                    axis_horizontal = math.sqrt(avg_axis_x**2 + avg_axis_y**2)
                    tilt_angle_rad = math.atan2(axis_horizontal, abs(avg_axis_z))
                    tilt_angle_deg = math.degrees(tilt_angle_rad)

                    protocol_tilt = 34.0
                    deviation = tilt_angle_deg - protocol_tilt

                    f.write(f"  Stick {angle:5.1f}°: Axis tilt = {tilt_angle_deg:5.2f}° ")
                    f.write(f"(deviation from protocol: {deviation:+.2f}°)\n")

            f.write("\n")
            f.write("Radius Validation:\n")
            f.write("Expected behavior: Radius should scale with stick magnitude\n")
            f.write("Protocol suggests consistent radius at each magnitude level\n\n")

            # Check if radius is consistent for each magnitude
            for mag in sorted(self.stick_magnitudes):
                mag_meas = [m for m in self.all_measurements if m['magnitude'] == mag]
                if len(mag_meas) > 0:
                    radii = [m['radius'] for m in mag_meas]
                    avg_r = sum(radii) / len(radii)
                    std_r = math.sqrt(sum((r - avg_r)**2 for r in radii) / len(radii))
                    cv = std_r / avg_r if avg_r > 0 else 0

                    status = "✓ PASS" if cv < 0.10 else "✗ FAIL"
                    f.write(f"  Magnitude {mag:.2f}: avg radius = {avg_r:6.2f} uu, ")
                    f.write(f"CV = {cv:.3f} {status}\n")

            f.write("\n")
            f.write("CONCLUSION:\n")
            f.write("Compare the measured tilt angles and radius patterns against the protocol.\n")
            f.write("Deviations > 5° in tilt or > 10% CV in radius indicate physics discrepancies.\n")

        self.logger.info(f"Analysis saved to {analysis_file}")

        # Print summary to console
        print("\n" + "=" * 80)
        print("TORNADO SPIN MEASUREMENT COMPLETE - AIR ROLL LEFT")
        print("=" * 80)
        print(f"\nTotal measurements: {len(self.all_measurements)}")
        print(f"Tested: {len(self.stick_angles)} angles × {len(self.stick_magnitudes)} magnitudes")
        print(f"Air Roll: LEFT (controller.roll = -1)")
        print(f"Results saved to: {self.output_dir}")
        print("\nSummary by magnitude:")

        for mag in sorted(self.stick_magnitudes):
            mag_meas = [m for m in self.all_measurements if m['magnitude'] == mag]
            if len(mag_meas) > 0:
                avg_r = sum(m['radius'] for m in mag_meas) / len(mag_meas)
                radii = [m['radius'] for m in mag_meas]
                std_r = math.sqrt(sum((r - avg_r)**2 for r in radii) / len(radii))
                cv = std_r / avg_r if avg_r > 0 else 0
                print(f"  Magnitude {mag:.2f}: avg = {avg_r:6.2f} uu, CV = {cv:.3f}")

        print("\nProtocol validation complete - check tornado_analysis.txt for details")
        print("=" * 80 + "\n")

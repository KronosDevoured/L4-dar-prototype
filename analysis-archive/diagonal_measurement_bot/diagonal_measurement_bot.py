"""
Diagonal Input Physics Measurement Bot
Measures angular velocity components with diagonal stick inputs (pitch+yaw) and DAR active
Logs: time, wx, wy, wz, magnitude, input_pitch, input_yaw, dar_active
"""

import math
import csv
import time
from pathlib import Path

from rlbot.agents.base_agent import BaseAgent, SimpleControllerState
from rlbot.utils.structures.game_data_struct import GameTickPacket
from rlbot.utils.game_state_util import GameState, CarState, Physics, Vector3, Rotator


class Diagonal_Measurement_Bot(BaseAgent):
    def __init__(self, name, team, index):
        super().__init__(name, team, index)

        # Test configurations: diagonal angles (stick input proportions)
        # 0° = full pitch (up)
        # 90° = full yaw (right)
        # 45° = equal pitch+yaw
        self.test_angles = [0.0, 22.5, 45.0, 67.5, 90.0]  # degrees
        self.test_magnitudes = [1.0]  # Always full stick magnitude
        self.current_angle_idx = 0
        self.current_mag_idx = 0

        # Test phases
        self.game_started = False
        self.waiting_for_game = True
        self.game_start_wait_time = None
        self.setup_complete = False
        self.post_teleport_wait = False
        self.post_teleport_start = None
        self.stabilizing = False
        self.stabilization_start = None
        self.measuring = False
        self.measurement_start = None

        # Timing
        self.stabilization_duration = 3.0
        self.measurement_duration = 5.0

        # Data collection
        self.measurement_data = []
        self.current_test_data = []

        # Output
        self.output_dir = Path("C:/Users/itsju/Documents/L4-dar-prototype/automated_tests")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_agent(self):
        """Called once when bot starts"""
        self.logger.info("Diagonal Input Measurement Bot initialized")
        self.logger.info(f"Testing {len(self.test_angles)} angles × {len(self.test_magnitudes)} magnitudes")
        self.logger.info(f"Angles (stick input direction): {self.test_angles}")
        self.logger.info("Will measure pitch+yaw components with DAR active")

    def get_output(self, packet: GameTickPacket) -> SimpleControllerState:
        """Main bot logic"""
        controller = SimpleControllerState()
        car = packet.game_cars[self.index]

        # Phase: Wait for game to start
        if self.waiting_for_game:
            if packet.game_info.is_round_active:
                if self.game_start_wait_time is None:
                    self.game_start_wait_time = time.time()
                    self.logger.info("Game active - waiting 2s before measurements")
                
                if time.time() - self.game_start_wait_time > 2.0:
                    self.waiting_for_game = False
                    self.logger.info("Starting measurements")
            return controller

        # Check if all tests complete
        if self.current_angle_idx >= len(self.test_angles):
            if not hasattr(self, 'save_complete'):
                self.logger.info(f"All measurements complete! Saving {len(self.measurement_data)} rows")
                self.save_data()
                self.save_complete = True
            return controller

        # Phase: Setup - teleport to arena center
        if not self.setup_complete:
            angle_deg = self.test_angles[self.current_angle_idx]
            mag = self.test_magnitudes[self.current_mag_idx]
            test_num = self.current_angle_idx * len(self.test_magnitudes) + self.current_mag_idx + 1
            total = len(self.test_angles) * len(self.test_magnitudes)
            
            self.logger.info(f"[{test_num}/{total}] SETUP: Angle={angle_deg}° Magnitude={mag}")
            self.teleport_to_center()
            
            self.setup_complete = True
            self.post_teleport_wait = True
            self.post_teleport_start = time.time()
            self.current_test_data = []
            return controller

        # Phase: Wait for physics to settle after teleport
        if self.post_teleport_wait:
            if time.time() - self.post_teleport_start > 0.5:
                self.post_teleport_wait = False
                self.stabilizing = True
                self.stabilization_start = time.time()
                self.logger.info(f"Post-teleport settle complete - Stabilizing for {self.stabilization_duration}s")
            
            # Apply minimal leveling
            controller.pitch = -car.physics.rotation.pitch * 2.0
            controller.roll = -car.physics.rotation.roll * 2.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))
            return controller

        # Phase: Stabilization - let car settle before measurement
        if self.stabilizing:
            elapsed = time.time() - self.stabilization_start
            
            # Active leveling
            controller.pitch = -car.physics.rotation.pitch * 5.0
            controller.roll = -car.physics.rotation.roll * 5.0
            controller.pitch = max(-1.0, min(1.0, controller.pitch))
            controller.roll = max(-1.0, min(1.0, controller.roll))
            
            if elapsed > self.stabilization_duration:
                self.stabilizing = False
                self.measuring = True
                self.measurement_start = time.time()
                angle_deg = self.test_angles[self.current_angle_idx]
                self.logger.info(f"Stabilized - Starting measurement for {angle_deg}° @ {self.test_magnitudes[self.current_mag_idx]}")
            
            return controller

        # Phase: Measurement - apply diagonal input and record data
        if self.measuring:
            elapsed = time.time() - self.measurement_start
            
            # Convert angle to stick input (pitch + yaw), while holding air roll left
            # 0° = full pitch (1.0, 0.0)
            # 90° = full yaw (0.0, 1.0)
            angle_rad = math.radians(self.test_angles[self.current_angle_idx])
            mag = self.test_magnitudes[self.current_mag_idx]
            
            joy_pitch = mag * math.cos(angle_rad)
            joy_yaw = mag * math.sin(angle_rad)
            
            controller.pitch = joy_pitch
            controller.yaw = joy_yaw
            controller.roll = -1.0  # hold air roll left
            controller.handbrake = False  # no ground powerslide during aerials
            
            # Record data
            ang_vel = car.physics.angular_velocity
            ang_vel_mag = math.sqrt(ang_vel.x**2 + ang_vel.y**2 + ang_vel.z**2)

            # Transform world angular velocity into car local frame
            rot = car.physics.rotation
            cp, sp = math.cos(rot.pitch), math.sin(rot.pitch)
            cy, sy = math.cos(rot.yaw), math.sin(rot.yaw)
            cr, sr = math.cos(rot.roll), math.sin(rot.roll)

            forward = (cp * cy, cp * sy, sp)
            left = (cy * sp * sr - cr * sy, sy * sp * sr + cr * cy, -cp * sr)
            up = (-cr * cy * sp - sr * sy, -cr * sy * sp + sr * cy, cp * cr)

            world_w = (ang_vel.x, ang_vel.y, ang_vel.z)
            local_roll = sum(a*b for a, b in zip(world_w, forward))   # about nose (forward)
            local_pitch = sum(a*b for a, b in zip(world_w, left))     # about left wing
            local_yaw = sum(a*b for a, b in zip(world_w, up))         # about up axis
            
            self.current_test_data.append({
                'time': elapsed,
                'wx': ang_vel.x,
                'wy': ang_vel.y,
                'wz': ang_vel.z,
                'magnitude': ang_vel_mag,
                'input_pitch': joy_pitch,
                'input_yaw': joy_yaw,
                'input_roll': -1.0,
                'dar_active': True,  # we are intentionally holding air roll
                'local_roll': local_roll,
                'local_pitch': local_pitch,
                'local_yaw': local_yaw
            })
            
            if elapsed > self.measurement_duration:
                # Measurement complete - save this test and move to next
                self.measurement_data.extend(self.current_test_data)
                
                angle_deg = self.test_angles[self.current_angle_idx]
                max_mag = max(d['magnitude'] for d in self.current_test_data)
                self.logger.info(f"Measurement complete: {angle_deg}° - Max mag={max_mag:.3f} rad/s, {len(self.current_test_data)} samples")
                
                # Advance to next test
                self.current_mag_idx += 1
                if self.current_mag_idx >= len(self.test_magnitudes):
                    self.current_mag_idx = 0
                    self.current_angle_idx += 1
                
                self.setup_complete = False
                self.measuring = False
            
            return controller

        return controller

    def teleport_to_center(self):
        """Teleport car to arena center with level orientation"""
        game_state = GameState(
            cars={
                self.index: CarState(
                    physics=Physics(
                        location=Vector3(0, 0, 600),
                        velocity=Vector3(0, 0, 0),
                        angular_velocity=Vector3(0, 0, 0),
                        rotation=Rotator(0, 0, 0)
                    )
                )
            }
        )
        self.set_game_state(game_state)

    def save_data(self):
        """Save measurement data to CSV"""
        if not self.measurement_data:
            self.logger.warning("No measurement data to save")
            return
        
        output_file = self.output_dir / "RL_diagonal_measurement.csv"
        
        with open(output_file, 'w', newline='') as f:
            fieldnames = [
                'time', 'wx', 'wy', 'wz', 'magnitude',
                'input_pitch', 'input_yaw', 'input_roll', 'dar_active',
                'local_roll', 'local_pitch', 'local_yaw'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in self.measurement_data:
                writer.writerow(row)
        
        self.logger.info(f"Saved {len(self.measurement_data)} rows to {output_file}")

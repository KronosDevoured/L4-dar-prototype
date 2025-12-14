/**
 * gameState.js
 * Central game state management for the L4 DAR prototype
 * Breaks circular dependency between Physics and RingMode modules
 *
 * This module serves as a single source of truth for shared game state,
 * allowing Physics and RingMode to communicate without directly importing each other.
 */

import * as THREE from 'three';

// ============================================================================
// GAME STATE CLASS
// ============================================================================

export class GameState {
  constructor() {
    // Ring Mode state (minimal - only what physics.js needs)
    this.ringMode = {
      active: false,
      paused: false
    };

    // Rhythm Mode state
    this.rhythmMode = {
      active: false
    };

    // Physics state
    this.physics = {
      angularVelocity: new THREE.Vector3(0, 0, 0)
    };
  }

  // ============================================================================
  // RING MODE STATE MANAGEMENT
  // ============================================================================

  getRingModeActive() {
    return this.ringMode.active;
  }

  setRingModeActive(active) {
    this.ringMode.active = active;
  }

  getRingModePaused() {
    return this.ringMode.paused;
  }

  setRingModePaused(paused) {
    this.ringMode.paused = paused;
  }

  /**
   * Check if Ring Mode is currently paused
   */
  isRingModePaused() {
    return this.ringMode.active && this.ringMode.paused;
  }

  // ============================================================================
  // RHYTHM MODE STATE MANAGEMENT
  // ============================================================================

  getRhythmModeActive() {
    return this.rhythmMode.active;
  }

  setRhythmModeActive(active) {
    this.rhythmMode.active = active;
  }

  // ============================================================================
  // PHYSICS STATE MANAGEMENT
  // ============================================================================

  /**
   * Get a copy of the angular velocity vector
   */
  getAngularVelocity() {
    return this.physics.angularVelocity.clone();
  }

  /**
   * Set the angular velocity
   */
  setAngularVelocity(x, y, z) {
    this.physics.angularVelocity.set(x, y, z);
  }

  /**
   * Reset angular velocity to zero
   */
  resetAngularVelocity() {
    this.physics.angularVelocity.set(0, 0, 0);
  }

  /**
   * Get direct reference to angular velocity (use with caution)
   */
  getAngularVelocityRef() {
    return this.physics.angularVelocity;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Reset all game state to initial values
   */
  reset() {
    this.resetAngularVelocity();
    this.ringMode.active = false;
    this.ringMode.paused = false;
    this.rhythmMode.active = false;
  }

  /**
   * Reset only Ring Mode state (keep physics)
   */
  resetRingMode() {
    this.ringMode.paused = false;
    this.resetAngularVelocity();
  }

  /**
   * Reset only Rhythm Mode state (keep physics)
   */
  resetRhythmMode() {
    this.resetAngularVelocity();
  }
}

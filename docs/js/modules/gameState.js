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
    // Ring Mode state
    this.ringMode = {
      active: false,
      paused: false,
      started: false,
      lives: 0,
      score: 0,
      highScore: 0,
      ringCount: 0,
      position: new THREE.Vector2(0, 0),
      velocity: new THREE.Vector2(0, 0)
    };

    // Physics state
    this.physics = {
      angularVelocity: new THREE.Vector3(0, 0, 0)
    };

    // Camera state
    this.camera = {
      orbitOn: false,
      zoom: 1.0
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

  getRingModeStarted() {
    return this.ringMode.started;
  }

  setRingModeStarted(started) {
    this.ringMode.started = started;
  }

  getRingModeLives() {
    return this.ringMode.lives;
  }

  setRingModeLives(lives) {
    this.ringMode.lives = lives;
  }

  getRingModeScore() {
    return this.ringMode.score;
  }

  setRingModeScore(score) {
    this.ringMode.score = score;
  }

  getRingModeHighScore() {
    return this.ringMode.highScore;
  }

  setRingModeHighScore(highScore) {
    this.ringMode.highScore = highScore;
  }

  getRingModeRingCount() {
    return this.ringMode.ringCount;
  }

  setRingModeRingCount(ringCount) {
    this.ringMode.ringCount = ringCount;
  }

  getRingModePosition() {
    return this.ringMode.position.clone();
  }

  setRingModePosition(x, y) {
    this.ringMode.position.set(x, y);
  }

  getRingModeVelocity() {
    return this.ringMode.velocity.clone();
  }

  setRingModeVelocity(x, y) {
    this.ringMode.velocity.set(x, y);
  }

  /**
   * Check if Ring Mode is currently paused
   */
  isRingModePaused() {
    return this.ringMode.active && this.ringMode.paused;
  }

  /**
   * Check if game is over (no lives left)
   */
  isRingModeGameOver() {
    return this.ringMode.active && this.ringMode.lives <= 0;
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
  // CAMERA STATE MANAGEMENT
  // ============================================================================

  getOrbitOn() {
    return this.camera.orbitOn;
  }

  setOrbitOn(orbitOn) {
    this.camera.orbitOn = orbitOn;
  }

  getZoom() {
    return this.camera.zoom;
  }

  setZoom(zoom) {
    this.camera.zoom = zoom;
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
    this.ringMode.started = false;
    this.ringMode.lives = 0;
    this.ringMode.score = 0;
    this.ringMode.ringCount = 0;
    this.ringMode.position.set(0, 0);
    this.ringMode.velocity.set(0, 0);
    this.camera.orbitOn = false;
    this.camera.zoom = 1.0;
  }

  /**
   * Reset only Ring Mode state (keep physics/camera)
   */
  resetRingMode() {
    this.ringMode.score = 0;
    this.ringMode.ringCount = 0;
    this.ringMode.started = false;
    this.ringMode.paused = false;
    this.ringMode.position.set(0, 0);
    this.ringMode.velocity.set(0, 0);
    this.resetAngularVelocity();
  }
}

/**
 * cameraController.js
 * Camera management for L4 DAR prototype
 * Handles camera zoom and orbital rotation
 */

import * as CONST from './constants.js';

// ============================================================================
// CAMERA CONTROLLER CLASS
// ============================================================================

export class CameraController {
  constructor(camera, carRef) {
    this.camera = camera;
    this.carRef = carRef; // Reference to Car module for car.position

    // Orbit state
    this.orbitOn = false;
    this.orbitDir = 1; // 1 = clockwise, -1 = counter-clockwise
    this.orbitPhase = 0;

    // Zoom state
    this.zoom = 1.0;
  }

  /**
   * Apply zoom to camera position
   * Works in both static and orbit modes
   */
  applyZoom() {
    const f = Math.max(0.7, Math.min(1.6, this.zoom || 1));
    const dist = CONST.CAM_BASE.z / f;
    const h = CONST.CAM_BASE.y / f;
    if (this.orbitOn) {
      // Update orbit camera immediately to reflect new zoom
      this.orbitStep(this.orbitPhase);
    } else {
      // Update static camera position
      this.camera.position.set(0, h, dist);
      const carY = this.carRef.car ? this.carRef.car.position.y : 0;
      this.camera.lookAt(0, carY, 0);
    }
  }

  /**
   * Step the orbital camera rotation
   * @param {number} t - Current time/phase
   */
  orbitStep(t) {
    const f = Math.max(0.7, Math.min(1.6, this.zoom || 1));
    const R = CONST.CAM_BASE.z / f;
    const h = CONST.CAM_BASE.y / f;
    const sp = 0.35 * this.orbitDir;
    const x = Math.sin(t * sp) * R;
    const z = Math.cos(t * sp) * R;
    this.camera.position.set(x, h, z);
    const carY = this.carRef.car ? this.carRef.car.position.y : 0;
    this.camera.lookAt(0, carY, 0);
  }

  /**
   * Update camera for current frame
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (this.orbitOn) {
      this.orbitPhase += dt;
      this.orbitStep(this.orbitPhase);
    }
  }

  /**
   * Set zoom level
   * @param {number} zoom - Zoom multiplier (0.2 - 4.0)
   */
  setZoom(zoom) {
    this.zoom = Math.max(0.2, Math.min(4.0, zoom));
    this.applyZoom();
  }

  /**
   * Reset camera to default position
   */
  resetCamera() {
    this.orbitOn = false;
    this.orbitDir = 1;
    this.orbitPhase = 0;
    this.camera.position.set(0, 220, 650);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Toggle clockwise orbit
   * @returns {boolean} New orbit state
   */
  toggleOrbitCW() {
    if (this.orbitOn && this.orbitDir === 1) {
      // Turn off if already orbiting CW
      // Calculate current angle to preserve camera position
      const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
      this.orbitPhase = currentAngle / (0.35 * this.orbitDir);
      this.orbitOn = false;
      return false;
    } else {
      // If switching from CCW to CW, maintain camera position
      if (this.orbitOn && this.orbitDir === -1) {
        this.orbitPhase = -this.orbitPhase;
      } else if (!this.orbitOn) {
        // If turning on from stopped, calculate phase from current camera position
        const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
        this.orbitPhase = currentAngle / 0.35;
      }
      // Turn on CW orbit
      this.orbitOn = true;
      this.orbitDir = 1;
      return true;
    }
  }

  /**
   * Toggle counter-clockwise orbit
   * @returns {boolean} New orbit state
   */
  toggleOrbitCCW() {
    if (this.orbitOn && this.orbitDir === -1) {
      // Turn off if already orbiting CCW
      // Calculate current angle to preserve camera position
      const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
      this.orbitPhase = currentAngle / (0.35 * this.orbitDir);
      this.orbitOn = false;
      return false;
    } else {
      // If switching from CW to CCW, maintain camera position
      if (this.orbitOn && this.orbitDir === 1) {
        this.orbitPhase = -this.orbitPhase;
      } else if (!this.orbitOn) {
        // If turning on from stopped, calculate phase from current camera position
        const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
        this.orbitPhase = currentAngle / -0.35;
      }
      // Turn on CCW orbit
      this.orbitOn = true;
      this.orbitDir = -1;
      return true;
    }
  }

  /**
   * Set orbit direction
   * @param {number} direction - 1 for CW, -1 for CCW
   */
  setOrbitDirection(direction) {
    if (this.orbitOn && this.orbitDir !== direction) {
      // If switching direction while orbiting, maintain camera position
      this.orbitPhase = -this.orbitPhase;
    }
    this.orbitDir = direction;
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getOrbitOn() {
    return this.orbitOn;
  }

  getOrbitDir() {
    return this.orbitDir;
  }

  getOrbitPhase() {
    return this.orbitPhase;
  }

  getZoom() {
    return this.zoom;
  }
}

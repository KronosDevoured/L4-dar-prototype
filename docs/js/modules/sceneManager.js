/**
 * sceneManager.js
 * Scene, camera, and renderer setup for L4 DAR prototype
 * Manages Three.js scene initialization and window resize handling
 */

import * as THREE from 'three';
import * as CONST from './constants.js';

// ============================================================================
// SCENE MANAGER CLASS
// ============================================================================

export class SceneManager {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.ambientLight = null;
    this.directionalLight = null;
    this.grid = null;
    this.gridMain = null;
    this.tornadoCircle = null;
  }

  /**
   * Initialize the Three.js scene, camera, and renderer
   * @returns {HTMLCanvasElement} HUD canvas element
   */
  init() {
    const gl = document.getElementById('gl');
    const hud = document.getElementById('hud');

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xeef1f6, 900, 2200);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
    this.camera.position.set(0, CONST.CAM_BASE.y, CONST.CAM_BASE.z);
    this.scene.add(this.camera);

    // Lights
    this.initLights();

    // Grid
    this.initGrid();

    // Tornado circle (world-space, not parented to car)
    this.initTornadoCircle();

    return hud;
  }

  /**
   * Initialize scene lighting
   */
  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
    this.directionalLight.position.set(-350, 700, 900);
    this.directionalLight.castShadow = false;
    this.scene.add(this.directionalLight);
  }

  /**
   * Initialize the grid floor
   */
  initGrid() {
    // Grid - expanded to look infinite
    this.grid = new THREE.Group();
    this.gridMain = new THREE.GridHelper(10000, 100, 0xd7dde6, 0xE5E9F1);
    this.gridMain.material.opacity = 0.65;
    this.gridMain.material.transparent = true;
    this.gridMain.material.depthWrite = false; // Prevent z-fighting
    this.grid.add(this.gridMain);
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = -160;
    this.scene.add(this.grid);

    // Add reference dot at grid intersection
    const gridDotGeom = new THREE.SphereGeometry(3, 16, 16);
    const gridDotMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff, // Cyan
      depthTest: false,
      depthWrite: false
    });
    this.gridReferenceDot = new THREE.Mesh(gridDotGeom, gridDotMat);
    this.gridReferenceDot.position.set(0, -160, 0); // At grid intersection
    this.gridReferenceDot.renderOrder = 999;
    this.gridReferenceDot.visible = false; // Hidden
    this.scene.add(this.gridReferenceDot);
  }

  /**
   * Handle window resize
   */
  resize() {
    if (!this.renderer || !this.camera) return;

    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /**
   * Render the scene
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getRenderer() {
    return this.renderer;
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getAmbientLight() {
    return this.ambientLight;
  }

  getDirectionalLight() {
    return this.directionalLight;
  }

  getGrid() {
    return this.grid;
  }

  getGridMain() {
    return this.gridMain;
  }

  getTornadoCircle() {
    return this.tornadoCircle;
  }

  /**
   * Initialize the tornado circle visualization
   * Circle is in world space, not parented to car
   */
  initTornadoCircle() {
    const geom = new THREE.CircleGeometry(1, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      depthWrite: false
    });
    this.tornadoCircle = new THREE.Mesh(geom, mat);
    this.tornadoCircle.renderOrder = 998;
    this.tornadoCircle.visible = false;
    this.scene.add(this.tornadoCircle);
  }
}

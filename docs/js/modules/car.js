/**
 * car.js
 * Car building, rendering, and model loading functionality
 * Includes materials, helper functions, and car presets (placeholder, octane, dominus)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import * as CONST from './constants.js';

// ============================================================================
// SHARED STATE
// ============================================================================

export let car = null;
export let BOX = null;
export let faceArrow = null;
export let faceTip = null;
export let tornadoPivotPoint = null;
export let carCenterPoint = null;
export let carNosePoint = null;
export let carBackPoint = null;
export let carRollAxisLine = null;
export let bodyMesh = null;
export let yellowTornadoLine = null;
export let magentaLinePoint = null;
export let magentaCircle = null;
export let debugLine1 = null; // Nose to magenta
export let debugLine2 = null; // Perpendicular 1
export let debugLine3 = null; // Perpendicular 2
export let debugLine4 = null; // Perpendicular to both
let carScene = null; // Store reference to scene

// ============================================================================
// MATERIALS
// ============================================================================

export const MAT_BODY = new THREE.MeshPhongMaterial({ color: 0xdfe5ef, shininess: 50, specular: 0x666666 });
export const MAT_GLASS = new THREE.MeshPhongMaterial({ color: 0x9aa6b7, shininess: 40, specular: 0x222222, transparent: true, opacity: 0.65 });
export const MAT_ACCENT = new THREE.MeshPhongMaterial({ color: 0xcbd3df, shininess: 35, specular: 0x222222 });
export const MAT_DARK = new THREE.MeshPhongMaterial({ color: 0xaeb7c4, shininess: 28, specular: 0x222222 });
export const MAT_EDGE = (hex) => new THREE.LineBasicMaterial({ color: hex });
export const MAT_TIRE_F = new THREE.MeshLambertMaterial({ color: 0x8a93a0 });
export const MAT_TIRE_B = new THREE.MeshLambertMaterial({ color: 0x808896 });
export const MAT_HUB = new THREE.MeshBasicMaterial({ color: 0x5a6270 });

// ============================================================================
// GLB MODEL LOADER
// ============================================================================

const gltfLoader = new GLTFLoader();

/**
 * Load a car model from a GLB file
 * @param {string} presetName - Name of the preset (octane, dominus)
 * @param {THREE.Scene} scene - The Three.js scene (not used directly, car is added to car group)
 */
export function loadCarModel(presetName, scene) {
  const url = `models/${presetName}.glb`;
  console.log("Loading GLB:", url);

  gltfLoader.load(
    url,
    (gltf) => {
      const model = gltf.scene;

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });

      // Center / height
      model.position.set(0, -BOX.hy, 0);

      // Scale the GLB
      const CAR_SCALE = 1.6;
      model.scale.set(CAR_SCALE, CAR_SCALE, CAR_SCALE);

      // Rotate so nose points along +Z (toward camera)
      // Dominus needs different rotation than Octane
      if (presetName === 'dominus') {
        model.rotation.y = 0; // No rotation - try straight
      } else {
        model.rotation.y = -Math.PI / 2; // -90 degrees (octane)
      }

      car.add(model);
    },
    undefined,
    (err) => {
      console.error("Failed to load", url, err);
    }
  );
}

// ============================================================================
// CAR MANAGEMENT
// ============================================================================

/**
 * Clear the current car from the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function clearCar(scene) {
  if (!car) return;
  scene.remove(car);
  car.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) {
        o.material.forEach(m => m.dispose && m.dispose());
      } else {
        o.material.dispose && o.material.dispose();
      }
    }
  });
  car = null;

  // Also remove tornado circle from scene (it's not a car child)
  if (tornadoCircle && scene) {
    scene.remove(tornadoCircle);
    if (tornadoCircle.geometry) tornadoCircle.geometry.dispose();
    if (tornadoCircle.material) tornadoCircle.material.dispose();
    tornadoCircle = null;
  }
}

/**
 * Build a car with the specified preset
 * @param {Object} boxDims - Hitbox dimensions {hx, hy, hz}
 * @param {string} presetName - Name of the preset (placeholder, octane, dominus)
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function buildCar(boxDims, presetName = "placeholder", scene) {
  console.log("buildCar preset:", presetName);

  clearCar(scene);
  BOX = boxDims;
  carScene = scene; // Store scene reference
  car = new THREE.Group();
  car.position.set(0, -160, 0); // At grid intersection

  // No initial rotation - let physics handle orientation
  // car.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  scene.add(car);

  if (presetName === "placeholder") {
    // Hitbox body + fancy fake car
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BOX.hx * 2, BOX.hy * 2, BOX.hz * 2),
      MAT_BODY
    );
    car.add(body);
    buildPlaceholderFancy();

    // colored face edges ONLY for placeholder
    const vFL = new THREE.Vector3(-BOX.hx, +BOX.hy, +BOX.hz);
    const vFR = new THREE.Vector3(+BOX.hx, +BOX.hy, +BOX.hz);
    const vBR = new THREE.Vector3(+BOX.hx, -BOX.hy, +BOX.hz);
    const vBL = new THREE.Vector3(-BOX.hx, -BOX.hy, +BOX.hz);
    addEdge(vFL, vFR, CONST.COL_UP);
    addEdge(vBR, vFR, CONST.COL_LEFT);
    addEdge(vBL, vBR, CONST.COL_DOWN);
    addEdge(vFL, vBL, CONST.COL_RIGHT);
  }

  // GLB for octane/dominus (no hitbox body, no edges)
  if (presetName === "octane" || presetName === "dominus") {
    loadCarModel(presetName, scene);
  }

  // arrow setup stays the same
  const zFace = BOX.hz + 0.6;
  const faceGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, zFace),
    new THREE.Vector3(0, 0, zFace)
  ]);
  faceArrow = new THREE.Line(faceGeom, new THREE.LineBasicMaterial({ color: 0x333333 }));
  car.add(faceArrow);

  faceTip = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 12), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  faceTip.position.set(0, 0, zFace);
  car.add(faceTip);
  faceArrow.visible = false;
  faceTip.visible = false;


  // Tornado pivot point visualizer - shows the center point of rotation for tornado spin
  const pivotGeom = new THREE.SphereGeometry(3, 16, 16);
  const pivotMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  tornadoPivotPoint = new THREE.Mesh(pivotGeom, pivotMat);
  tornadoPivotPoint.position.set(0, -160, 225);

  if (carScene) {
    carScene.add(tornadoPivotPoint);
    console.log('[Car] Tornado pivot point added to scene');
  }
  tornadoPivotPoint.visible = false;

  // Car center of mass visualizer - shows where the car itself rotates around
  const carCenterGeom = new THREE.SphereGeometry(2, 16, 16);
  const carCenterMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff, // Cyan
    depthTest: false, // Render on top of everything
    depthWrite: false
  });
  carCenterPoint = new THREE.Mesh(carCenterGeom, carCenterMat);
  carCenterPoint.renderOrder = 999; // Render last (on top)

  // Add as child of car so it moves with the car
  if (car) {
    car.add(carCenterPoint);
    carCenterPoint.position.set(0, 0, 0); // At car's origin (center of mass)
    console.log('[Car] Car center point added to car');
  }
  carCenterPoint.visible = false; // Hidden

  // Nose position visualizer - shows the point we track for tornado measurements
  const noseGeom = new THREE.SphereGeometry(3, 16, 16);
  const noseMat = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Red (will be dynamic)
    depthTest: false, // Render on top of everything
    depthWrite: false
  });
  carNosePoint = new THREE.Mesh(noseGeom, noseMat);
  carNosePoint.renderOrder = 999; // Render last (on top)

  // Add as child of car so it moves with the car
  if (car) {
    car.add(carNosePoint);
    carNosePoint.position.set(0, 0, BOX.hz); // At the nose tip (front of car)
    console.log('[Car] Car nose point added to car');
  }
  carNosePoint.visible = false; // Hidden

  // Back position visualizer - opposite end of the car from nose
  const backGeom = new THREE.SphereGeometry(3, 16, 16);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Green
    depthTest: false,
    depthWrite: false
  });
  carBackPoint = new THREE.Mesh(backGeom, backMat);
  carBackPoint.renderOrder = 999;

  // Add as child of car at opposite end from nose
  if (car) {
    car.add(carBackPoint);
    carBackPoint.position.set(0, 0, -BOX.hz); // At the back (opposite of nose)
    console.log('[Car] Car back point added to car');
  }
  carBackPoint.visible = false; // Hidden

  // Roll axis line visualizer - connects car's roll axis to the grid cyan dot
  const rollAxisGeom = new THREE.BufferGeometry();
  const rollAxisPositions = new Float32Array([
    0, -160, 0,    // Grid cyan dot position
    0, -160, 225   // Car position (will be updated dynamically in physics)
  ]);
  rollAxisGeom.setAttribute('position', new THREE.BufferAttribute(rollAxisPositions, 3));
  const rollAxisMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 }); // Green
  carRollAxisLine = new THREE.Line(rollAxisGeom, rollAxisMat);

  // Add to scene (not car child) so we can use world coordinates
  if (carScene) {
    carScene.add(carRollAxisLine);
    console.log('[Car] Car roll axis line added to scene');
  }
  carRollAxisLine.visible = false; // Hidden

  // Yellow tornado line - 300 units long, centered at car cyan dot
  // Positioned along Z-axis (0, 0, 1 direction), childed to car
  const yellowLineGeom = new THREE.BufferGeometry();
  const yellowLinePositions = new Float32Array([
    0, 0, -150,  // 150 units behind center along Z-axis
    0, 0, 150    // 150 units ahead of center along Z-axis
  ]);
  yellowLineGeom.setAttribute('position', new THREE.BufferAttribute(yellowLinePositions, 3));
  const yellowLineMat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 }); // Yellow
  yellowTornadoLine = new THREE.Line(yellowLineGeom, yellowLineMat);

  // Add as child of car (not scene) so it moves with the car
  if (car) {
    car.add(yellowTornadoLine);
    console.log('[Car] Yellow tornado line added as car child');
  }
  yellowTornadoLine.visible = false; // Hidden until stick is moved

  // Magenta dot on yellow line - 120 units along the line in yellow line's local space
  const magentaGeom = new THREE.SphereGeometry(3, 16, 16);
  const magentaMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff, // Magenta
    depthTest: false, // Render on top of everything
    depthWrite: false
  });
  magentaLinePoint = new THREE.Mesh(magentaGeom, magentaMat);
  magentaLinePoint.renderOrder = 999; // Render last (on top)

  // Add as child of YELLOW LINE (not car) so it rotates with the line
  yellowTornadoLine.add(magentaLinePoint);
  magentaLinePoint.position.set(0, 0, 120); // 120 units along yellow line
  console.log('[Car] Magenta line point added as yellow line child');
  magentaLinePoint.visible = false; // Hidden

  // Circle centered at magenta dot - perpendicular to yellow line (now a torus/ring)
  const circleGeom = new THREE.TorusGeometry(1, 0.08, 16, 64); // Radius 1 (scaled dynamically), tube 0.08 (thin)
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff, // Magenta
    depthTest: true, // Enable depth testing so it doesn't draw over the car
    depthWrite: true
  });
  magentaCircle = new THREE.Mesh(circleGeom, circleMat);
  magentaCircle.renderOrder = 0; // Normal render order

  // Add as child of YELLOW LINE (not car) at the magenta dot position
  // Circle default faces Z direction in line's local space
  yellowTornadoLine.add(magentaCircle);
  magentaCircle.position.set(0, 0, 120); // Same position as magenta dot on the line
  console.log('[Car] Magenta circle added as yellow line child');
  magentaCircle.visible = true; // Always visible

  // Debug lines - will be updated in physics.js
  // Line 1: Nose to Magenta (RED)
  const line1Geom = new THREE.BufferGeometry();
  line1Geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  debugLine1 = new THREE.Line(line1Geom, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 }));
  if (carScene) carScene.add(debugLine1);
  debugLine1.visible = false;

  // Line 2: Perpendicular 1 (GREEN)
  const line2Geom = new THREE.BufferGeometry();
  line2Geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  debugLine2 = new THREE.Line(line2Geom, new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }));
  if (carScene) carScene.add(debugLine2);
  debugLine2.visible = false;

  // Line 3: Perpendicular 2 (BLUE)
  const line3Geom = new THREE.BufferGeometry();
  line3Geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  debugLine3 = new THREE.Line(line3Geom, new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 }));
  if (carScene) carScene.add(debugLine3);
  debugLine3.visible = false;

  // Line 4: Perpendicular to both (CYAN)
  const line4Geom = new THREE.BufferGeometry();
  line4Geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  debugLine4 = new THREE.Line(line4Geom, new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 }));
  if (carScene) carScene.add(debugLine4);
  debugLine4.visible = false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add an edge line to the car
 * @param {THREE.Vector3} a - Start point
 * @param {THREE.Vector3} b - End point
 * @param {number} color - Hex color
 */
function addEdge(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, MAT_EDGE(color));
  car.add(line);
}

/**
 * Add a wheel to the car
 * @param {number} x - X position
 * @param {number} z - Z position
 * @param {number} r - Radius
 * @param {number} w - Width
 */
function addWheel(x, z, r = 18, w = 12) {
  const g = new THREE.CylinderGeometry(r, r, w, 16);
  const front = new THREE.Mesh(g, MAT_TIRE_F);
  const back = new THREE.Mesh(g, MAT_TIRE_B);
  front.rotation.z = Math.PI / 2; back.rotation.z = Math.PI / 2;
  const y = -BOX.hy - r * 0.55;
  front.position.set(x, y, z + w / 2);
  back.position.set(x, y, z - w / 2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, w * 0.6, 10), MAT_HUB);
  hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z);
  const grp = new THREE.Group(); grp.add(back, front, hub); car.add(grp);
}

/**
 * Add a cabin to the car
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} length - Length
 * @param {number} yOffset - Y position offset
 * @param {number} zOffset - Z position offset
 */
function addCabin(width, height, length, yOffset, zOffset) {
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), MAT_GLASS);
  cabin.position.set(0, yOffset, zOffset);
  car.add(cabin);
}

/**
 * Add a spoiler to the car
 * @param {number} width - Width
 * @param {number} thickness - Thickness
 * @param {number} depth - Depth
 * @param {number} yOffset - Y position offset
 * @param {number} zOffset - Z position offset
 */
function addSpoiler(width, thickness, depth, yOffset, zOffset) {
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), MAT_ACCENT);
  spoiler.position.set(0, yOffset, zOffset);
  const st1 = new THREE.Mesh(new THREE.BoxGeometry(thickness, yOffset * 0.5, thickness), MAT_ACCENT);
  const st2 = st1.clone();
  st1.position.set(-width * 0.35, yOffset * 0.25, zOffset - depth * 0.2);
  st2.position.set(+width * 0.35, yOffset * 0.25, zOffset - depth * 0.2);
  car.add(spoiler, st1, st2);
}

/**
 * Add a bumper to the car
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} depth - Depth
 * @param {number} yOffset - Y position offset
 * @param {number} zOffset - Z position offset
 */
function addBumper(width, height, depth, yOffset, zOffset) {
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), MAT_DARK);
  bumper.position.set(0, yOffset, zOffset);
  car.add(bumper);
}

/**
 * Add wheel flares to the car
 * @param {number} xw - X width offset
 * @param {number} zw - Z width offset
 * @param {number} r - Radius
 * @param {number} w - Width
 */
function addFlares(xw, zw, r = 10, w = 6) {
  const hemi = new THREE.CylinderGeometry(r, r, w, 10, 1, false, 0, Math.PI);
  const mat = MAT_ACCENT;
  const y = -BOX.hy + r * 0.2;
  function flare(px, pz, flip) {
    const f = new THREE.Mesh(hemi, mat);
    f.rotation.z = Math.PI / 2;
    f.rotation.y = flip ? Math.PI : 0;
    f.position.set(px, y, pz);
    car.add(f);
  }
  flare(+xw + 6, +zw, false);
  flare(-xw - 6, +zw, true);
  flare(+xw + 6, -zw, true);
  flare(-xw - 6, -zw, false);
}

// ============================================================================
// CAR PRESETS
// ============================================================================

/**
 * Build the placeholder fancy car
 */
function buildPlaceholderFancy() {
  const xOff = BOX.hx - 10, zOff = BOX.hz * 0.68;
  addWheel(+xOff, -zOff);
  addWheel(-xOff, -zOff);
  addWheel(+xOff, +zOff);
  addWheel(-xOff, +zOff);

  addFlares(xOff, zOff, 10, 6);
  addCabin(BOX.hx * 1.0, BOX.hy * 0.9, BOX.hz * 0.55, BOX.hy * 0.65, -BOX.hz * 0.1);
  addSpoiler(BOX.hx * 1.0, 6, 24, BOX.hy * 0.8, -BOX.hz * 0.95);
  addBumper(BOX.hx * 0.9, 10, 18, -BOX.hy * 0.7, +BOX.hz * 0.98);
}

/**
 * Build the Octane car
 */
function buildOctane() {
  const xOff = BOX.hx - 6, zOff = BOX.hz * 0.64;
  addWheel(+xOff, -zOff, 19, 12); addWheel(-xOff, -zOff, 19, 12);
  addWheel(+xOff, +zOff, 18, 12); addWheel(-xOff, +zOff, 18, 12);
  addFlares(xOff, zOff, 12, 7);
  addCabin(BOX.hx * 0.95, BOX.hy * 1.1, BOX.hz * 0.60, BOX.hy * 0.85, -BOX.hz * 0.05);
  addSpoiler(BOX.hx * 1.2, 6, 30, BOX.hy * 0.9, -BOX.hz * 1.02);
  addBumper(BOX.hx * 0.85, 12, 20, -BOX.hy * 0.6, +BOX.hz * 1.02);
}

/**
 * Build the Dominus car
 */
function buildDominus() {
  const xOff = BOX.hx - 8, zOff = BOX.hz * 0.70;
  addWheel(+xOff, -zOff, 18, 12); addWheel(-xOff, -zOff, 18, 12);
  addWheel(+xOff, +zOff, 18, 12); addWheel(-xOff, +zOff, 18, 12);
  addFlares(xOff, zOff, 11, 6);
  addCabin(BOX.hx * 1.05, BOX.hy * 0.75, BOX.hz * 0.75, BOX.hy * 0.6, -BOX.hz * 0.05);
  addSpoiler(BOX.hx * 0.9, 5, 18, BOX.hy * 0.72, -BOX.hz * 1.0);
  addBumper(BOX.hx * 1.05, 10, 30, -BOX.hy * 0.55, +BOX.hz * 1.05);
}

// ============================================================================
// THEME SUPPORT
// ============================================================================

/**
 * Update car material colors for theme changes
 * @param {boolean} dark - True for dark mode, false for light mode
 */
export function updateCarTheme(dark) {
  if (!dark) {
    // Day mode - brighten the car
    MAT_BODY.color.setHex(0xf5f7fa);
    MAT_GLASS.color.setHex(0xc5d0df);
    MAT_ACCENT.color.setHex(0xe0e6ef);
    MAT_DARK.color.setHex(0xd0d8e2);
    MAT_TIRE_F.color.setHex(0xb0b8c5);
    MAT_TIRE_B.color.setHex(0xa8b0be);
    MAT_HUB.color.setHex(0x8a92a0);
  } else {
    // Night mode - brighter than original
    MAT_BODY.color.setHex(0xecf0f5);
    MAT_GLASS.color.setHex(0xb5c0d0);
    MAT_ACCENT.color.setHex(0xdae0e8);
    MAT_DARK.color.setHex(0xc5cdd8);
    MAT_TIRE_F.color.setHex(0xa0a8b5);
    MAT_TIRE_B.color.setHex(0x98a0ad);
    MAT_HUB.color.setHex(0x7a8290);
  }
}

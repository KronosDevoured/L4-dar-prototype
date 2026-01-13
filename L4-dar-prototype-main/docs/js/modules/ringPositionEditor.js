/**
 * ringPositionEditor.js
 * Visual grid editor for positioning rings in 2D space
 * Shows side view of playable area with ring positioning
 */

import * as RhythmMode from './rhythmMode.js';
import * as CONST from './constants.js';

// ============================================================================
// STATE
// ============================================================================

let canvas = null;
let ctx = null;
let beatPositions = []; // Array of {time: number, x: number, y: number}
let currentBeatIndex = 0;
let isPreviewPlaying = false;
let previewStartTime = 0;
let currentPreviewTime = 0;
let snapToGrid = false;
let animationFrameId = null;

// Grid configuration (matches ring mode boundaries)
const GRID_SIZE = 20; // Grid cell size in world units
const PLAY_AREA_WIDTH = 3000; // World units (±1500 from center = RING_GRID_BOUNDS)
const PLAY_AREA_HEIGHT = 3000; // World units (±1500 from center = RING_GRID_BOUNDS)

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');


  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Mouse events for ring dragging
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);

  // Touch events for mobile
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMoveEvent, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Initial render
  render();

}

function resizeCanvas() {
  if (!canvas) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 400; // Fixed height for grid view


  render();
}

// ============================================================================
// BEAT POSITION MANAGEMENT
// ============================================================================

/**
 * Load beats from beat map (time only, positions default to center)
 * @param {Array<number>} beatTimes - Array of beat times in seconds
 */
export function loadBeats(beatTimes) {
  beatPositions = beatTimes.map(time => ({
    time,
    x: 0, // Center X
    y: 0  // Center Y
  }));

  currentBeatIndex = 0;
  render();

}

/**
 * Load beats with existing positions
 * @param {Array<{time, x, y}>} beats
 */
export function loadBeatPositions(beats) {
  beatPositions = beats.map(b => ({...b})); // Copy
  currentBeatIndex = 0;
  render();

}

/**
 * Get all beat positions
 * @returns {Array<{time, x, y}>}
 */
export function getBeatPositions() {
  return beatPositions.map(b => ({...b})); // Return copy
}

/**
 * Update current beat position
 */
export function updateCurrentBeatPosition(x, y) {
  if (currentBeatIndex >= 0 && currentBeatIndex < beatPositions.length) {
    beatPositions[currentBeatIndex].x = x;
    beatPositions[currentBeatIndex].y = y;
    render();
  }
}

// ============================================================================
// NAVIGATION
// ============================================================================

export function nextBeat() {
  if (currentBeatIndex < beatPositions.length - 1) {
    currentBeatIndex++;
    render();
  }
}

export function previousBeat() {
  if (currentBeatIndex > 0) {
    currentBeatIndex--;
    render();
  }
}

export function setCurrentBeat(index) {
  if (index >= 0 && index < beatPositions.length) {
    currentBeatIndex = index;
    render();
  }
}

export function getCurrentBeatIndex() {
  return currentBeatIndex;
}

export function getTotalBeats() {
  return beatPositions.length;
}

// ============================================================================
// SETTINGS
// ============================================================================

export function setSnapToGrid(enabled) {
  snapToGrid = enabled;
}

export function getSnapToGrid() {
  return snapToGrid;
}

export function forceRender() {
  resizeCanvas();
}

// ============================================================================
// PREVIEW MODE
// ============================================================================

export function startPreview() {
  if (beatPositions.length === 0) {
    console.warn('[Ring Position Editor] No beats to preview');
    return;
  }

  isPreviewPlaying = true;
  previewStartTime = performance.now();
  currentPreviewTime = 0;

  updatePreview();
}

export function stopPreview() {
  isPreviewPlaying = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  render(); // Re-render to show current beat only
}

export function isPreviewActive() {
  return isPreviewPlaying;
}

function updatePreview() {
  if (!isPreviewPlaying) return;

  // Calculate current time in preview
  const elapsed = (performance.now() - previewStartTime) / 1000; // Convert to seconds
  currentPreviewTime = elapsed;

  render(); // Render will show all rings up to current time

  // Continue animation
  animationFrameId = requestAnimationFrame(updatePreview);

  // Stop preview when we've passed the last beat
  const lastBeat = beatPositions[beatPositions.length - 1];
  if (lastBeat && currentPreviewTime > lastBeat.time + 2.0) {
    stopPreview();
  }
}

// ============================================================================
// INTERACTION
// ============================================================================

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Check if clicking on current ring
  const currentBeat = beatPositions[currentBeatIndex];
  if (!currentBeat) return;

  const ringScreenPos = worldToScreen(currentBeat.x, currentBeat.y);
  const distance = Math.sqrt(
    Math.pow(mouseX - ringScreenPos.x, 2) +
    Math.pow(mouseY - ringScreenPos.y, 2)
  );

  if (distance < 30) { // 30px click tolerance (ring radius is ~20px)
    isDragging = true;
    dragStartX = mouseX;
    dragStartY = mouseY;
    canvas.style.cursor = 'grabbing';
  }
}

function handleMouseMove(e) {
  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();

  // Clamp mouse position to canvas bounds
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;

  mouseX = Math.max(0, Math.min(canvas.width, mouseX));
  mouseY = Math.max(0, Math.min(canvas.height, mouseY));

  // Convert to world coordinates
  const worldPos = screenToWorld(mouseX, mouseY);

  // Apply snap to grid
  let x = worldPos.x;
  let y = worldPos.y;

  if (snapToGrid) {
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;
  }

  // Clamp to play area
  x = Math.max(-PLAY_AREA_WIDTH / 2, Math.min(PLAY_AREA_WIDTH / 2, x));
  y = Math.max(-PLAY_AREA_HEIGHT / 2, Math.min(PLAY_AREA_HEIGHT / 2, y));

  updateCurrentBeatPosition(x, y);
}

function handleMouseUp(e) {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'default';

    // Prevent the click from bubbling to parent elements (like modal backdrop)
    e.preventDefault();
    e.stopPropagation();
  }
}

function handleMouseLeave(e) {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'default';
  }
}

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    e.preventDefault(); // Prevent scrolling and other default behaviors

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    // Check if touching current ring
    const currentBeat = beatPositions[currentBeatIndex];
    if (!currentBeat) return;

    const ringScreenPos = worldToScreen(currentBeat.x, currentBeat.y);
    const distance = Math.sqrt(
      Math.pow(touchX - ringScreenPos.x, 2) +
      Math.pow(touchY - ringScreenPos.y, 2)
    );

    if (distance < 40) { // Larger touch tolerance
      isDragging = true;
    }
  }
}

function handleTouchMoveEvent(e) {
  if (!isDragging || e.touches.length !== 1) return;

  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  const touchY = touch.clientY - rect.top;

  // Convert to world coordinates
  const worldPos = screenToWorld(touchX, touchY);

  // Apply snap to grid
  let x = worldPos.x;
  let y = worldPos.y;

  if (snapToGrid) {
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;
  }

  // Clamp to play area
  x = Math.max(-PLAY_AREA_WIDTH / 2, Math.min(PLAY_AREA_WIDTH / 2, x));
  y = Math.max(-PLAY_AREA_HEIGHT / 2, Math.min(PLAY_AREA_HEIGHT / 2, y));

  updateCurrentBeatPosition(x, y);
  e.preventDefault();
}

function handleTouchEnd(e) {
  isDragging = false;
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

function worldToScreen(worldX, worldY) {
  const scale = Math.min(
    canvas.width / (PLAY_AREA_WIDTH * 1.1),
    canvas.height / (PLAY_AREA_HEIGHT * 1.1)
  );

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  return {
    x: centerX + worldX * scale,
    y: centerY - worldY * scale // Flip Y (screen Y goes down, world Y goes up)
  };
}

function screenToWorld(screenX, screenY) {
  const scale = Math.min(
    canvas.width / (PLAY_AREA_WIDTH * 1.1),
    canvas.height / (PLAY_AREA_HEIGHT * 1.1)
  );

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  return {
    x: (screenX - centerX) / scale,
    y: -(screenY - centerY) / scale // Flip Y
  };
}

// ============================================================================
// RENDERING
// ============================================================================

function render() {
  if (!ctx || !canvas) {
    console.warn('[Ring Position Editor] Cannot render - no context or canvas');
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  // Clear
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, width, height);

  if (beatPositions.length === 0) {
    // Show placeholder
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Load a beat map to position rings', width / 2, height / 2);
    return;
  }

  // Draw grid and boundaries
  drawGrid();
  drawBoundaries();

  // Draw rings (preview mode shows all, edit mode shows current only)
  if (isPreviewPlaying) {
    drawPreviewRings();
  } else {
    drawCurrentRing();
  }

  // Draw info overlay
  drawInfoOverlay();
}

function drawGrid() {
  const scale = Math.min(
    canvas.width / (PLAY_AREA_WIDTH * 1.1),
    canvas.height / (PLAY_AREA_HEIGHT * 1.1)
  );

  ctx.strokeStyle = '#1a1d25';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = -PLAY_AREA_WIDTH / 2; x <= PLAY_AREA_WIDTH / 2; x += GRID_SIZE) {
    const screenPos = worldToScreen(x, 0);
    ctx.beginPath();
    ctx.moveTo(screenPos.x, 0);
    ctx.lineTo(screenPos.x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = -PLAY_AREA_HEIGHT / 2; y <= PLAY_AREA_HEIGHT / 2; y += GRID_SIZE) {
    const screenPos = worldToScreen(0, y);
    ctx.beginPath();
    ctx.moveTo(0, screenPos.y);
    ctx.lineTo(canvas.width, screenPos.y);
    ctx.stroke();
  }

  // Draw center crosshair
  const center = worldToScreen(0, 0);
  ctx.strokeStyle = '#4c8dff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(center.x - 10, center.y);
  ctx.lineTo(center.x + 10, center.y);
  ctx.moveTo(center.x, center.y - 10);
  ctx.lineTo(center.x, center.y + 10);
  ctx.stroke();
}

function drawBoundaries() {
  const topLeft = worldToScreen(-PLAY_AREA_WIDTH / 2, PLAY_AREA_HEIGHT / 2);
  const bottomRight = worldToScreen(PLAY_AREA_WIDTH / 2, -PLAY_AREA_HEIGHT / 2);

  ctx.strokeStyle = '#ff3333';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y
  );
  ctx.setLineDash([]);

  // Label
  ctx.fillStyle = '#ff3333';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DANGER ZONE', canvas.width / 2, topLeft.y - 5);
}

function drawCurrentRing() {
  const currentBeat = beatPositions[currentBeatIndex];
  if (!currentBeat) return;

  // Draw previous ring as faint outline (if exists)
  if (currentBeatIndex > 0) {
    const prevBeat = beatPositions[currentBeatIndex - 1];
    const prevRingPos = worldToScreen(prevBeat.x, prevBeat.y);

    ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
    ctx.fillStyle = 'rgba(100, 100, 100, 0.1)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(prevRingPos.x, prevRingPos.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(prevRingPos.x, prevRingPos.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Previous', prevRingPos.x, prevRingPos.y - 30);
  }

  const ringPos = worldToScreen(currentBeat.x, currentBeat.y);

  // Draw current ring (bright green)
  ctx.strokeStyle = '#00ff00';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(ringPos.x, ringPos.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(ringPos.x, ringPos.y, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Draw drag handle
  if (!isDragging) {
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◎ DRAG TO MOVE', ringPos.x, ringPos.y - 30);
  }

  // Show coordinates
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`(${currentBeat.x.toFixed(1)}, ${currentBeat.y.toFixed(1)})`, ringPos.x, ringPos.y + 40);
}

function drawPreviewRings() {
  // Draw all rings whose time is <= currentPreviewTime
  for (let i = 0; i < beatPositions.length; i++) {
    const beat = beatPositions[i];

    // Only show rings that have appeared by now
    if (beat.time > currentPreviewTime) continue;

    const ringPos = worldToScreen(beat.x, beat.y);

    // Calculate fade based on how long ago this ring appeared
    const timeSinceAppear = currentPreviewTime - beat.time;
    const fadeAmount = Math.max(0, 1 - (timeSinceAppear / 2.0)); // Fade over 2 seconds

    // Ring color (green with fade)
    ctx.strokeStyle = `rgba(0, 255, 0, ${fadeAmount})`;
    ctx.fillStyle = `rgba(0, 255, 0, ${fadeAmount * 0.2})`;
    ctx.lineWidth = 4;

    // Outer ring
    ctx.beginPath();
    ctx.arc(ringPos.x, ringPos.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(ringPos.x, ringPos.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Show beat number
    ctx.fillStyle = `rgba(255, 255, 255, ${fadeAmount})`;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, ringPos.x, ringPos.y + 5);
  }
}

function drawInfoOverlay() {
  // Top-left info
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 200, 80);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';

  if (isPreviewPlaying) {
    ctx.fillText(`Preview Mode`, 20, 30);
    ctx.fillText(`Time: ${currentPreviewTime.toFixed(2)}s`, 20, 50);
    ctx.fillText(`Rings: ${beatPositions.filter(b => b.time <= currentPreviewTime).length}/${beatPositions.length}`, 20, 70);
  } else {
    ctx.fillText(`Beat: ${currentBeatIndex + 1}/${beatPositions.length}`, 20, 30);
    ctx.fillText(`Time: ${beatPositions[currentBeatIndex]?.time.toFixed(2)}s`, 20, 50);
    ctx.fillText(`Snap: ${snapToGrid ? 'ON' : 'OFF'}`, 20, 70);
  }
}

// ============================================================================
// AUTO-GENERATE PATTERNS
// ============================================================================

/**
 * Calculate minimum time to reach a ring position (from ringMode.js physics)
 * @param {number} targetX - Target X position
 * @param {number} targetY - Target Y position
 * @param {number} currentX - Current X position
 * @param {number} currentY - Current Y position
 * @param {number} currentVelX - Current X velocity
 * @param {number} currentVelY - Current Y velocity
 * @param {number} ringCount - Current ring index for skill scaling
 * @param {string} difficulty - Difficulty level (normal, hard, expert)
 * @returns {number} Minimum time in seconds to reach the ring
 */
function calculateMinimumTimeToReach(targetX, targetY, currentX, currentY, currentVelX, currentVelY, ringCount, difficulty) {
  const REACTION_TIME = CONST.RING_PLAYER_REACTION_TIME;
  const ORIENTATION_TIME = CONST.RING_PLAYER_ORIENTATION_TIME;
  const STABILIZATION_TIME = CONST.RING_PLAYER_STABILIZATION_TIME;

  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < CONST.RING_CLOSE_DISTANCE_THRESHOLD) {
    return REACTION_TIME + ORIENTATION_TIME + CONST.RING_CLOSE_RING_SIMPLIFIED_TIME + STABILIZATION_TIME;
  }

  const BOOST_ACCEL = CONST.RING_BOOST_ACCEL;
  const GRAVITY = Math.abs(CONST.RING_GRAVITY);

  // Skill scaling based on difficulty
  const SKILL_START_RING = CONST.RING_SKILL_START_COUNT;
  const SKILL_END_RING = CONST.RING_SKILL_END_COUNT;
  let skillFactor = CONST.RING_SKILL_HUMAN_EFFICIENCY;

  if (difficulty === 'expert') {
    if (ringCount >= SKILL_END_RING) {
      skillFactor = CONST.RING_SKILL_EXPERT_MAX_EFFICIENCY;
    } else {
      const progress = Math.min(ringCount / SKILL_END_RING, 1.0);
      const efficiencyRange = CONST.RING_SKILL_EXPERT_MAX_EFFICIENCY - CONST.RING_SKILL_EXPERT_START_EFFICIENCY;
      skillFactor = CONST.RING_SKILL_EXPERT_START_EFFICIENCY + (progress * efficiencyRange);
    }
  } else {
    if (ringCount >= SKILL_END_RING) {
      skillFactor = CONST.RING_SKILL_SKILLED_EFFICIENCY;
    } else if (ringCount > SKILL_START_RING) {
      const progress = (ringCount - SKILL_START_RING) / (SKILL_END_RING - SKILL_START_RING);
      const efficiencyRange = CONST.RING_SKILL_SKILLED_EFFICIENCY - CONST.RING_SKILL_HUMAN_EFFICIENCY;
      skillFactor = CONST.RING_SKILL_HUMAN_EFFICIENCY + (progress * efficiencyRange);
    }
  }

  // Calculate X axis time
  const absX = Math.abs(dx);
  let timeX = 0;
  if (absX > 10) {
    const accelX = Math.max(100, BOOST_ACCEL * skillFactor);
    const velTowardX = dx > 0 ? currentVelX : -currentVelX;

    if (velTowardX < 0) {
      const timeToStop = Math.abs(velTowardX) / accelX;
      const distanceWhileStopping = 0.5 * accelX * timeToStop * timeToStop;
      const remainingX = absX + distanceWhileStopping;
      const timeAfterStop = Math.sqrt(2 * remainingX / accelX);
      timeX = timeToStop + timeAfterStop;
    } else {
      const a = 0.5 * accelX;
      const b = velTowardX;
      const c = -absX;
      const discriminant = b * b - 4 * a * c;
      timeX = (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a);
    }
  }

  // Calculate Y axis time (with gravity)
  const absY = Math.abs(dy);
  let timeY = 0;
  if (absY > 10) {
    const isGoingUp = dy > 0;
    const effectiveAccelY = isGoingUp
      ? (BOOST_ACCEL - GRAVITY) * skillFactor
      : (BOOST_ACCEL + GRAVITY) * skillFactor;

    const velTowardY = dy > 0 ? currentVelY : -currentVelY;

    if (velTowardY < 0) {
      const decelY = isGoingUp ? (BOOST_ACCEL + GRAVITY) : (BOOST_ACCEL - GRAVITY);
      const timeToStop = Math.abs(velTowardY) / Math.max(100, decelY);
      const distanceWhileStopping = 0.5 * decelY * timeToStop * timeToStop;
      const remainingY = absY + distanceWhileStopping;
      const timeAfterStop = Math.sqrt(2 * remainingY / Math.max(100, effectiveAccelY));
      timeY = timeToStop + timeAfterStop;
    } else {
      const a = 0.5 * Math.max(100, effectiveAccelY);
      const b = velTowardY;
      const c = -absY;
      const discriminant = b * b - 4 * a * c;
      timeY = (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a);
    }

    if (isGoingUp) {
      timeY *= 1.25;
    }
  }

  // Progressive buffer scaling
  let bufferMultiplier = 1.5;
  if (ringCount >= SKILL_END_RING) {
    bufferMultiplier = 1.2;
  } else if (ringCount > SKILL_START_RING) {
    const progress = (ringCount - SKILL_START_RING) / (SKILL_END_RING - SKILL_START_RING);
    bufferMultiplier = 1.5 - (progress * 0.3);
  }
  const travelTime = Math.max(timeX, timeY) * bufferMultiplier;

  return REACTION_TIME + ORIENTATION_TIME + travelTime + STABILIZATION_TIME;
}

/**
 * Auto-generate ring positions based on difficulty using ring mode physics
 * @param {string} difficulty - Difficulty level (normal, hard, expert)
 * @param {object} beatmap - Beatmap object with bpm property (optional)
 */
export function autoGeneratePositions(difficulty = 'normal', beatmap = null) {
  if (beatPositions.length === 0) return;

  // Get difficulty settings from constants
  const difficultySettings = CONST.DIFFICULTY_SETTINGS[difficulty];
  const maxRadius = CONST.RING_GRID_BOUNDS;
  const patternAmplitudeMultiplier = difficultySettings.patternAmplitudeMultiplier || 1.0;

  // Flight path state - continuous movement
  let posX = 0;
  let posY = 0;
  let velX = 0;
  let velY = 0;
  
  // Target velocity for smooth flight (not stopping)
  const TARGET_FLIGHT_SPEED = 800; // Units/s - maintain momentum
  const BOOST_ACCEL = CONST.RING_BOOST_ACCEL; // 1200 units/s²
  const BOOST_DECEL = BOOST_ACCEL * 0.6; // Can reduce speed if needed

  // Get BPM from beatmap or use default
  const bpm = (beatmap && beatmap.bpm) ? beatmap.bpm : 120;

  // Pattern parameters for flowing path
  let pathAngle = Math.random() * Math.PI * 2; // Initial direction
  const patternType = Math.floor(Math.random() * 4); // Choose one pattern type for whole sequence
  
  // Generate random parameters for this pattern
  const pathParams = generatePathParameters(patternType, maxRadius, patternAmplitudeMultiplier);

  beatPositions.forEach((beat, i) => {
    // Calculate time delta to this beat
    let timeDelta;
    if (i === 0) {
      timeDelta = beat.time;
    } else {
      timeDelta = beat.time - beatPositions[i - 1].time;
    }

    // Apply difficulty multiplier
    const effectiveTime = timeDelta * difficultySettings.spawnIntervalMultiplier;

    // Calculate where the player will be if maintaining current trajectory
    // d = v*t for constant velocity flight
    const projectedX = posX + velX * effectiveTime;
    const projectedY = posY + velY * effectiveTime;

    // Generate target position based on flowing pattern around play area
    let targetX, targetY;

    switch (patternType) {
      case 0: // Circular orbit with parametric variation
        pathAngle += pathParams.rotationSpeed + (Math.random() - 0.5) * pathParams.wobble;
        const orbitRadius = pathParams.baseRadius * (0.8 + Math.random() * pathParams.radiusVariation);
        targetX = Math.cos(pathAngle) * orbitRadius;
        targetY = Math.sin(pathAngle) * orbitRadius;
        break;

      case 1: // Figure-8 / infinity pattern with parametric variation
        const t = (i / beatPositions.length) * Math.PI * pathParams.loopCount;
        targetX = Math.sin(t) * pathParams.sizeX * (1 + Math.random() * pathParams.asymmetry);
        targetY = Math.sin(t * pathParams.asymmetryFactor) * pathParams.sizeY;
        break;

      case 2: // Spiral with parametric variation
        const spiralProgress = i / beatPositions.length;
        pathAngle += pathParams.rotationSpeed;
        const spiralRadius = Math.sin(spiralProgress * Math.PI) * pathParams.maxSpiralRadius * (1 + Math.sin(spiralProgress * Math.PI * pathParams.tightness) * 0.3);
        targetX = Math.cos(pathAngle) * spiralRadius;
        targetY = Math.sin(pathAngle) * spiralRadius;
        break;

      case 3: // Weaving pattern with parametric variation
        pathAngle += pathParams.forwardSpeed + (Math.random() - 0.5) * pathParams.driftAmount;
        const waveRadius = pathParams.baseWaveRadius * (0.6 + Math.sin(i * pathParams.waveFrequency) * pathParams.waveAmplitude);
        targetX = Math.cos(pathAngle) * waveRadius;
        targetY = Math.sin(pathAngle) * waveRadius;
        break;
    }

    // Clamp to play area boundaries
    const halfWidth = PLAY_AREA_WIDTH / 2 - 30;
    const halfHeight = PLAY_AREA_HEIGHT / 2 - 30;
    targetX = Math.max(-halfWidth, Math.min(halfWidth, targetX));
    targetY = Math.max(-halfHeight, Math.min(halfHeight, targetY));

    // Calculate velocity needed to reach target from current position
    const dx = targetX - posX;
    const dy = targetY - posY;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distanceToTarget > 10) {
      // Calculate required average velocity to reach target
      const requiredVelX = dx / effectiveTime;
      const requiredVelY = dy / effectiveTime;
      const requiredSpeed = Math.sqrt(requiredVelX * requiredVelX + requiredVelY * requiredVelY);

      // Check if acceleration is physically possible
      const currentSpeed = Math.sqrt(velX * velX + velY * velY);
      const speedDiff = requiredSpeed - currentSpeed;
      const maxSpeedChange = BOOST_ACCEL * effectiveTime;

      if (Math.abs(speedDiff) > maxSpeedChange) {
        // Target is unreachable with current physics - adjust it
        // Scale target position to be reachable
        const reachableFactor = maxSpeedChange / Math.abs(speedDiff) * 0.9; // 90% safety
        targetX = posX + dx * reachableFactor;
        targetY = posY + dy * reachableFactor;
      }

      // Update velocity to aim toward target (smooth steering)
      velX = (targetX - posX) / effectiveTime;
      velY = (targetY - posY) / effectiveTime;
    }

    // Apply position
    beat.x = targetX;
    beat.y = targetY;

    // Update position (player flies through this ring)
    posX = targetX;
    posY = targetY;
  });

  render();
}

/**
 * Generate random parameters for the selected pattern type
 * @param {number} patternType - Type of pattern (0-3)
 * @param {number} maxRadius - Maximum radius (RING_GRID_BOUNDS)
 * @param {number} amplitudeMultiplier - Difficulty amplitude modifier
 * @returns {object} Random parameters for the pattern
 */
function generatePathParameters(patternType, maxRadius, amplitudeMultiplier) {
  const params = {};

  switch (patternType) {
    case 0: // Circular orbit
      params.baseRadius = maxRadius * (0.5 + Math.random() * 0.4) * amplitudeMultiplier;
      params.rotationSpeed = (Math.random() - 0.5) * 0.8; // ±0.4 per beat
      params.wobble = 0.2 + Math.random() * 0.4; // 0.2-0.6 wobble
      params.radiusVariation = 0.1 + Math.random() * 0.4; // 0.1-0.5 variation
      break;

    case 1: // Figure-8
      params.sizeX = maxRadius * (0.5 + Math.random() * 0.4) * amplitudeMultiplier;
      params.sizeY = maxRadius * (0.4 + Math.random() * 0.5) * amplitudeMultiplier;
      params.loopCount = 2 + Math.random() * 3; // 2-5 loops across sequence
      params.asymmetry = 0.1 + Math.random() * 0.3; // Slight asymmetry
      params.asymmetryFactor = 1.5 + Math.random() * 1.5; // 1.5-3x for Y multiplier
      break;

    case 2: // Spiral
      params.maxSpiralRadius = maxRadius * (0.6 + Math.random() * 0.3) * amplitudeMultiplier;
      params.rotationSpeed = (0.2 + Math.random() * 0.3); // Consistent forward rotation
      params.tightness = 1 + Math.random() * 2; // 1-3 tightness factor
      break;

    case 3: // Weaving
      params.baseWaveRadius = maxRadius * (0.5 + Math.random() * 0.35) * amplitudeMultiplier;
      params.forwardSpeed = 0.1 + Math.random() * 0.3; // Consistent forward progress
      params.driftAmount = 0.2 + Math.random() * 0.6; // 0.2-0.8 drift per beat
      params.waveFrequency = 0.3 + Math.random() * 0.4; // 0.3-0.7 wave frequency
      params.waveAmplitude = 0.3 + Math.random() * 0.4; // 0.3-0.7 amplitude
      break;
  }

  return params;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  init,
  loadBeats,
  loadBeatPositions,
  getBeatPositions,
  updateCurrentBeatPosition,
  nextBeat,
  previousBeat,
  setCurrentBeat,
  getCurrentBeatIndex,
  getTotalBeats,
  setSnapToGrid,
  getSnapToGrid,
  forceRender,
  startPreview,
  stopPreview,
  isPreviewActive,
  autoGeneratePositions
};

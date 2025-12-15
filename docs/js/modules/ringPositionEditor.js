/**
 * ringPositionEditor.js
 * Visual grid editor for positioning rings in 2D space
 * Shows side view of playable area with ring positioning
 */

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
const PLAY_AREA_WIDTH = 200; // World units
const PLAY_AREA_HEIGHT = 200; // World units

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
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMoveEvent);
  canvas.addEventListener('touchend', handleTouchEnd);

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
  isPreviewActive
};

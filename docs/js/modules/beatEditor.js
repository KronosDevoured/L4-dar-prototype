/**
 * beatEditor.js
 * Visual waveform editor for creating beat maps
 * Displays audio waveform with click-to-place beat markers
 */

import * as THREE from 'three';
import * as RhythmMode from './rhythmMode.js';

// ============================================================================
// STATE
// ============================================================================

let canvas = null;
let ctx = null;
let audioBuffer = null;
let beats = []; // Array of beat times in seconds
let playheadTime = 0; // Current playback time
let isPlaying = false;
let pixelsPerSecond = 100; // How many pixels = 1 second of audio (base zoom level)
let zoomLevel = 1.0; // Zoom multiplier (1.0 = 100%, 2.0 = 200%, etc.)
let scrollOffset = 0; // How far we've scrolled (in pixels)

// Waveform data
let waveformData = null;
let samplesPerPixel = 0;

// Drag state
let isDragging = false;
let isDraggingPlayhead = false;
let isDraggingBeat = false;
let draggedBeatIndex = -1;
let dragStartX = 0;
let dragStartOffset = 0;
let hasDragged = false; // Track if we actually dragged (not just clicked)
let beatHoldTimeout = null; // Timeout for hold-to-drag
let isHoldingBeat = false; // Whether we're holding on a beat

// Pinch zoom state
let isPinching = false;
let lastPinchDistance = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');


  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Click to place beat marker
  canvas.addEventListener('click', handleCanvasClick);

  // Drag to scroll
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseUp);

  // Scroll wheel to scroll horizontally
  canvas.addEventListener('wheel', handleWheel);

  // Touch events for mobile pinch-to-zoom
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleTouchEnd);

  // Initial render
  render();

}

function resizeCanvas() {
  if (!canvas) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 200; // Fixed height for waveform


  render();
}

// ============================================================================
// AUDIO LOADING
// ============================================================================

export function loadAudio(buffer, onReady) {
  audioBuffer = buffer;
  beats = [];
  playheadTime = 0;
  scrollOffset = 0;
  waveformData = null; // Clear old waveform

  // Reset audio pause time to beginning
  RhythmMode.setAudioPauseTime(0);

  // Show loading state
  render(); // Shows "Generating waveform..."

  // Generate waveform data asynchronously

  // Use setTimeout to allow UI to update
  setTimeout(() => {
    generateWaveform();

    // Force canvas resize to ensure proper dimensions
    resizeCanvas();

    // Render multiple times to ensure it takes
    render();
    requestAnimationFrame(() => {
      render();

      // Notify that waveform is ready
      if (onReady) onReady();
    });
  }, 10);
}

function generateWaveform() {
  if (!audioBuffer) return;

  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;
  const totalWidth = duration * pixelsPerSecond * zoomLevel;

  // One sample per pixel
  samplesPerPixel = Math.floor(channelData.length / totalWidth);
  waveformData = [];

  for (let i = 0; i < totalWidth; i++) {
    const start = i * samplesPerPixel;
    const end = start + samplesPerPixel;

    // Get min/max for this pixel
    let min = 1;
    let max = -1;

    for (let j = start; j < end && j < channelData.length; j++) {
      const sample = channelData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    waveformData.push({ min, max });
  }

}

// ============================================================================
// PLAYBACK
// ============================================================================

export function setPlayheadTime(time) {
  playheadTime = time;

  // Auto-scroll to keep playhead visible (but only if song hasn't ended)
  if (audioBuffer && playheadTime < audioBuffer.duration) {
    const playheadX = playheadTime * pixelsPerSecond * zoomLevel;
    const centerX = canvas.width / 2;

    if (playheadX > centerX) {
      scrollOffset = playheadX - centerX;
    }

    // Clamp scroll offset to waveform bounds
    if (waveformData) {
      const maxOffset = Math.max(0, waveformData.length - canvas.width);
      scrollOffset = Math.max(0, Math.min(maxOffset, scrollOffset));
    }
  }

  render();
}

export function setPlaying(playing) {
  isPlaying = playing;
  render(); // Re-render to update playhead color
}

export function getPlayheadTime() {
  return playheadTime;
}

export function isWaveformReady() {
  return waveformData !== null && waveformData.length > 0;
}

export function setZoom(newZoom) {
  // Clamp zoom between 0.5x and 10x
  zoomLevel = Math.max(0.5, Math.min(10.0, newZoom));

  // Regenerate waveform at new zoom level
  if (audioBuffer) {
    generateWaveform();
    render();
  }

}

export function getZoom() {
  return zoomLevel;
}

// ============================================================================
// BEAT MANAGEMENT
// ============================================================================

export function addBeat(time) {
  // Avoid duplicates (within 0.05s tolerance)
  const exists = beats.some(t => Math.abs(t - time) < 0.05);
  if (exists) return;

  beats.push(time);
  beats.sort((a, b) => a - b);

  render();

  return beats.length;
}

export function removeBeat(time) {
  // Remove beat within 0.05s tolerance
  const index = beats.findIndex(t => Math.abs(t - time) < 0.05);
  if (index !== -1) {
    beats.splice(index, 1);
    render();
  }
}

export function clearBeats() {
  beats = [];
  render();
}

export function getBeats() {
  return [...beats]; // Return copy
}

export function setBeats(newBeats) {
  beats = [...newBeats];
  beats.sort((a, b) => a - b);
  render();
}

// ============================================================================
// INTERACTION
// ============================================================================

function handleCanvasClick(e) {
  if (!audioBuffer) return;

  // Don't place beat if we just dragged
  if (hasDragged) {
    hasDragged = false; // Reset flag
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;

  // Convert click position to time
  const time = (clickX + scrollOffset) / (pixelsPerSecond * zoomLevel);

  if (time < 0 || time > audioBuffer.duration) return;

  // Check if clicking on existing beat (to remove it)
  const existingBeat = beats.find(t => {
    const beatX = t * pixelsPerSecond * zoomLevel - scrollOffset;
    return Math.abs(beatX - clickX) < 10; // 10px tolerance
  });

  if (existingBeat !== undefined) {
    removeBeat(existingBeat);
  } else {
    addBeat(time);
  }
}

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Check if clicking near the playhead line or its handle
  const playheadX = playheadTime * pixelsPerSecond * zoomLevel - scrollOffset;
  const distanceToPlayhead = Math.abs(mouseX - playheadX);

  // Larger hit area for the handle at the top (triangle is 16px wide, 16px tall)
  const isNearHandle = (mouseY < 32 && distanceToPlayhead < 12);
  const isNearLine = (distanceToPlayhead < 10);

  if ((isNearHandle || isNearLine) && playheadX >= 0 && playheadX <= canvas.width) {
    // Clicking on playhead - drag the playhead
    isDraggingPlayhead = true;
    isDragging = false;
    isDraggingBeat = false;
    canvas.style.cursor = 'ew-resize';
    return;
  }

  // Check if clicking on a beat marker
  for (let i = 0; i < beats.length; i++) {
    const beatX = beats[i] * pixelsPerSecond * zoomLevel - scrollOffset;
    if (Math.abs(mouseX - beatX) < 10) {
      // Holding on a beat - start timeout (500ms hold to drag)
      isHoldingBeat = true;
      draggedBeatIndex = i;
      dragStartX = e.clientX; // Store initial position
      isDragging = false;
      isDraggingPlayhead = false;
      isDraggingBeat = false;

      // Clear any existing timeout
      if (beatHoldTimeout) clearTimeout(beatHoldTimeout);

      // Start hold timer
      beatHoldTimeout = setTimeout(() => {
        if (isHoldingBeat) {
          isDraggingBeat = true;
          canvas.style.cursor = 'ew-resize';
        }
      }, 500); // 500ms hold time

      return;
    }
  }

  // Clicking elsewhere - drag the waveform
  isDragging = true;
  isDraggingPlayhead = false;
  isDraggingBeat = false;
  hasDragged = false;
  dragStartX = e.clientX;
  dragStartOffset = scrollOffset;
  canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;

  // If holding a beat but moving too much, cancel the hold (user is scrolling)
  if (isHoldingBeat && !isDraggingBeat) {
    const dx = Math.abs(mouseX - dragStartX);
    if (dx > 5) {
      // Movement detected - cancel hold and start waveform drag instead
      if (beatHoldTimeout) clearTimeout(beatHoldTimeout);
      isHoldingBeat = false;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartOffset = scrollOffset;
      canvas.style.cursor = 'grabbing';
    }
  }

  if (!isDragging && !isDraggingPlayhead && !isDraggingBeat) return;

  if (isDraggingPlayhead) {
    // Dragging the playhead
    if (!audioBuffer) return;

    // Mark as dragged to prevent click event from placing beat
    hasDragged = true;

    // Convert mouse X to time
    const time = (mouseX + scrollOffset) / (pixelsPerSecond * zoomLevel);
    const clampedTime = Math.max(0, Math.min(audioBuffer.duration, time));

    playheadTime = clampedTime;
    RhythmMode.setAudioPauseTime(clampedTime);

    render();
  } else if (isDraggingBeat) {
    // Dragging a beat marker
    if (!audioBuffer || draggedBeatIndex < 0) return;

    // Mark as dragged to prevent click event from placing beat
    hasDragged = true;

    // Convert mouse X to time
    const time = (mouseX + scrollOffset) / (pixelsPerSecond * zoomLevel);
    const clampedTime = Math.max(0, Math.min(audioBuffer.duration, time));

    beats[draggedBeatIndex] = clampedTime;
    beats.sort((a, b) => a - b); // Keep beats in order

    // Update the dragged index after sorting
    draggedBeatIndex = beats.indexOf(clampedTime);

    render();
  } else if (isDragging) {
    // Dragging the waveform
    if (!waveformData) return;

    const dx = e.clientX - dragStartX;

    // If we've moved more than 3px, consider it a drag (not a click)
    if (Math.abs(dx) > 3) {
      hasDragged = true;
    }

    const newOffset = dragStartOffset - dx; // Subtract because dragging right should scroll left

    // Clamp scroll offset
    const maxOffset = Math.max(0, waveformData.length - canvas.width);
    scrollOffset = Math.max(0, Math.min(maxOffset, newOffset));

    // Don't update playhead during drag - only render the scroll
    // (playhead will update when drag ends)

    render();
  }
}

function handleMouseUp(e) {
  // Clear beat hold timeout
  if (beatHoldTimeout) {
    clearTimeout(beatHoldTimeout);
    beatHoldTimeout = null;
  }

  // If we were dragging the waveform, update playhead position now that drag is done
  if (isDragging && hasDragged) {
    updateScrollPosition();
  }

  if (isDragging || isDraggingPlayhead || isDraggingBeat || isHoldingBeat) {
    isDragging = false;
    isDraggingPlayhead = false;
    isDraggingBeat = false;
    isHoldingBeat = false;
    draggedBeatIndex = -1;
    canvas.style.cursor = 'crosshair';
  }
}

function handleWheel(e) {
  if (!waveformData) return;

  e.preventDefault();

  // Scroll horizontally
  const scrollAmount = e.deltaY * 0.5; // Adjust sensitivity
  const newOffset = scrollOffset + scrollAmount;

  // Clamp scroll offset
  const maxOffset = Math.max(0, waveformData.length - canvas.width);
  scrollOffset = Math.max(0, Math.min(maxOffset, newOffset));

  // Update audio pause time to match scroll position
  updateScrollPosition();

  render();
}

// Helper function to update audio pause time based on scroll position
function updateScrollPosition() {
  if (!audioBuffer || isPlaying) return;

  // When user manually scrolls, update the playhead time to match scroll position
  // Calculate the time at the start of the viewport (left edge)
  const timeAtLeft = scrollOffset / (pixelsPerSecond * zoomLevel);

  // Update the playhead position
  playheadTime = timeAtLeft;

  // Update the audio pause time so next playback starts from here
  RhythmMode.setAudioPauseTime(timeAtLeft);
}

// ============================================================================
// RENDERING
// ============================================================================

function render() {
  if (!ctx || !canvas) {
    console.warn('[Beat Editor] Cannot render - no context or canvas');
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  // Clear
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, width, height);

  if (!waveformData) {
    // Show placeholder or loading text
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';

    if (audioBuffer) {
      ctx.fillText('⏳ Generating waveform...', width / 2, height / 2);
    } else {
      ctx.fillText('Load an audio file to see waveform', width / 2, height / 2);
    }
    return;
  }

  // Draw waveform
  drawWaveform();

  // Draw beat markers
  drawBeatMarkers();

  // Draw playhead
  drawPlayhead();

  // Draw time labels
  drawTimeLabels();
}

function drawWaveform() {
  const height = canvas.height;
  const centerY = height / 2;
  const amplitude = height * 0.4;

  ctx.strokeStyle = '#4c8dff';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i < waveformData.length; i++) {
    const x = i - scrollOffset;

    if (x < 0 || x > canvas.width) continue;

    const { min, max } = waveformData[i];
    const y1 = centerY + min * amplitude;
    const y2 = centerY + max * amplitude;

    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }

  ctx.stroke();
}

function drawBeatMarkers() {
  const height = canvas.height;

  ctx.fillStyle = '#00ff00';
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;

  for (const beatTime of beats) {
    const x = beatTime * pixelsPerSecond * zoomLevel - scrollOffset;

    if (x < 0 || x > canvas.width) continue;

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Draw circle at top
    ctx.beginPath();
    ctx.arc(x, 10, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayhead() {
  const x = playheadTime * pixelsPerSecond * zoomLevel - scrollOffset;

  if (x < 0 || x > canvas.width) return;

  const height = canvas.height;
  const color = isPlaying ? '#ff0000' : '#ffaa00';

  // Draw vertical line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();

  // Draw draggable handle at the top (triangle pointing down)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, 16); // Bottom point
  ctx.lineTo(x - 8, 0); // Top left
  ctx.lineTo(x + 8, 0); // Top right
  ctx.closePath();
  ctx.fill();

  // Add a subtle border to the handle for better visibility
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTimeLabels() {
  if (!audioBuffer) return;

  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';

  // Draw time markers every second
  const startTime = Math.floor(scrollOffset / (pixelsPerSecond * zoomLevel));
  const endTime = Math.ceil((scrollOffset + canvas.width) / (pixelsPerSecond * zoomLevel));

  for (let t = startTime; t <= endTime; t++) {
    const x = t * pixelsPerSecond * zoomLevel - scrollOffset;

    if (x < 0 || x > canvas.width) continue;

    ctx.fillText(`${t}s`, x + 2, 15);
  }
}

function handleTouchStart(e) {
  if (e.touches.length === 2) {
    // Two-finger pinch gesture
    isPinching = true;
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
    e.preventDefault();
  }
}

function handleTouchMove(e) {
  if (isPinching && e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    // Calculate zoom delta
    const zoomDelta = (currentDistance - lastPinchDistance) * 0.01;
    setZoom(zoomLevel + zoomDelta);

    lastPinchDistance = currentDistance;
    e.preventDefault();
  }
}

function handleTouchEnd(e) {
  if (e.touches.length < 2) {
    isPinching = false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  init,
  loadAudio,
  setPlayheadTime,
  getPlayheadTime,
  setPlaying,
  isWaveformReady,
  setZoom,
  getZoom,
  addBeat,
  removeBeat,
  clearBeats,
  getBeats,
  setBeats
};

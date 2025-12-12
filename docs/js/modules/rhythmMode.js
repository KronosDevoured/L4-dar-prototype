/**
 * rhythmMode.js
 * Rhythm game mode for L4 DAR prototype
 * Handles music-synced ring spawning, beat detection, and timing-based scoring
 */

import * as THREE from 'three';
import * as CONST from './constants.js';
import * as Car from './car.js';
import * as Audio from './audio.js';
import { getSetting, saveSettings } from './settings.js';

// ============================================================================
// MODULE DEPENDENCIES (injected via init())
// ============================================================================

let gameState = null;

// ============================================================================
// PRIVATE STATE VARIABLES
// ============================================================================

// Rhythm Mode state
let rhythmModeActive = false;
let rhythmModeScore = 0;
let rhythmModeHighScore = getSetting('rhythmModeHighScore') ?? 0;
let rhythmModeCombo = 0;
let rhythmModePerfectHits = 0;
let rhythmModeGoodHits = 0;
let rhythmModeMisses = 0;

// Audio and beat detection
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let audioStartTime = 0;
let audioAnalyser = null;
let audioData = null;

// Beat map data
let currentBeatMap = null; // { bpm: 120, beats: [{time: 1.5, lane: 'center'}, ...] }
let beatMapName = '';

// Ring spawning
let rings = [];
let ringSpawnIndex = 0;
let ringGeometryCache = null;
let ringMaterialCache = new Map();

// Timing windows (in seconds)
const TIMING_PERFECT = 0.05; // ±50ms
const TIMING_GOOD = 0.10;    // ±100ms
const TIMING_MISS = 0.15;    // ±150ms

// Ring lanes configuration
const RING_LANES = {
  'center': { x: 0, y: 0 },
  'left': { x: -150, y: 0 },
  'right': { x: 150, y: 0 },
  'top': { x: 0, y: 100 },
  'bottom': { x: 0, y: -100 },
  'top-left': { x: -150, y: 100 },
  'top-right': { x: 150, y: 100 },
  'bottom-left': { x: -150, y: -100 },
  'bottom-right': { x: 150, y: -100 }
};

// Scene references
let scene = null;
let camera = null;
let renderer = null;

// Beat map editor state
let editorMode = false;
let editorBeats = [];
let editorBPM = 120;
let lastTapTime = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the RhythmMode module
 * @param {GameState} state - Central game state instance
 */
export function init(state) {
  gameState = state;

  // Initialize Web Audio API context
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  console.log('[Rhythm Mode] Initialized');
}

// ============================================================================
// EXPORTED GETTERS
// ============================================================================

export function getRhythmModeActive() { return rhythmModeActive; }
export function getRhythmModeScore() { return rhythmModeScore; }
export function getRhythmModeHighScore() { return rhythmModeHighScore; }
export function getRhythmModeCombo() { return rhythmModeCombo; }
export function getEditorMode() { return editorMode; }

// ============================================================================
// AUDIO LOADING AND PLAYBACK
// ============================================================================

/**
 * Load audio file for rhythm mode
 * @param {File} file - Audio file to load
 * @returns {Promise<void>}
 */
export async function loadAudioFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log(`[Rhythm Mode] Audio loaded: ${file.name}, duration: ${audioBuffer.duration}s`);
    return audioBuffer;
  } catch (error) {
    console.error('[Rhythm Mode] Error loading audio:', error);
    throw error;
  }
}

/**
 * Start playing the loaded audio
 */
export function playAudio() {
  if (!audioBuffer) {
    console.warn('[Rhythm Mode] No audio loaded');
    return;
  }

  // Stop existing audio if playing
  if (audioSource) {
    audioSource.stop();
  }

  // Create new audio source
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;

  // Create analyser for beat detection
  audioAnalyser = audioContext.createAnalyser();
  audioAnalyser.fftSize = 2048;
  audioData = new Uint8Array(audioAnalyser.frequencyBinCount);

  // Connect audio graph: source -> analyser -> destination
  audioSource.connect(audioAnalyser);
  audioAnalyser.connect(audioContext.destination);

  // Start playback
  audioSource.start(0);
  audioStartTime = audioContext.currentTime;

  console.log('[Rhythm Mode] Audio playback started');
}

/**
 * Stop audio playback
 */
export function stopAudio() {
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
  }
}

/**
 * Get current audio playback time
 * @returns {number} Current time in seconds
 */
export function getAudioTime() {
  if (!audioSource || !audioStartTime) return 0;
  return audioContext.currentTime - audioStartTime;
}

// ============================================================================
// BEAT DETECTION
// ============================================================================

/**
 * Analyze audio buffer to detect beats automatically
 * Uses energy-based onset detection on low frequencies
 * @returns {Array<number>} Array of beat timestamps in seconds
 */
export function detectBeats() {
  if (!audioBuffer) {
    console.warn('[Rhythm Mode] No audio loaded for beat detection');
    return [];
  }

  console.log('[Rhythm Mode] Starting beat detection...');

  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = 2048;
  const hopSize = 512;
  const threshold = 1.5; // Energy threshold multiplier

  const beats = [];
  const energyHistory = [];
  const historySize = 43; // ~1 second of history at 44.1kHz with hopSize 512

  // Calculate energy for each window
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;

    // Calculate RMS energy for this window (focus on low frequencies for beats)
    for (let j = 0; j < windowSize; j++) {
      const sample = channelData[i + j];
      energy += sample * sample;
    }
    energy = Math.sqrt(energy / windowSize);

    // Calculate average energy from history
    const avgEnergy = energyHistory.length > 0
      ? energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length
      : energy;

    // Detect onset if energy exceeds threshold
    if (energy > avgEnergy * threshold && energyHistory.length >= historySize) {
      const time = i / sampleRate;

      // Avoid duplicate detections (min 0.1s between beats)
      if (beats.length === 0 || time - beats[beats.length - 1] > 0.1) {
        beats.push(time);
      }
    }

    // Update energy history
    energyHistory.push(energy);
    if (energyHistory.length > historySize) {
      energyHistory.shift();
    }
  }

  console.log(`[Rhythm Mode] Detected ${beats.length} beats`);
  return beats;
}

/**
 * Generate beat map from detected beats
 * Assigns random lanes to each beat
 * @param {Array<number>} beatTimes - Array of beat timestamps
 * @returns {Object} Beat map object
 */
export function generateBeatMap(beatTimes) {
  const laneNames = Object.keys(RING_LANES);

  const beats = beatTimes.map((time, index) => {
    // Assign random lane (could be improved with pattern generation)
    const lane = laneNames[Math.floor(Math.random() * laneNames.length)];

    return {
      time: time,
      lane: lane,
      hit: false
    };
  });

  // Estimate BPM from beat intervals
  let bpm = 120; // default
  if (beatTimes.length > 1) {
    const intervals = [];
    for (let i = 1; i < beatTimes.length; i++) {
      intervals.push(beatTimes[i] - beatTimes[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    bpm = Math.round(60 / avgInterval);
  }

  return {
    bpm: bpm,
    beats: beats,
    name: beatMapName || 'Unnamed Song'
  };
}

// ============================================================================
// BEAT MAP EDITOR
// ============================================================================

/**
 * Enable beat map editor mode
 */
export function enterEditorMode() {
  editorMode = true;
  editorBeats = [];
  editorBPM = 120;
  console.log('[Rhythm Mode] Entered editor mode');
}

/**
 * Exit beat map editor mode
 */
export function exitEditorMode() {
  editorMode = false;
  console.log('[Rhythm Mode] Exited editor mode');
}

/**
 * Record a beat tap in editor mode
 * @param {string} lane - Lane to assign to this beat
 */
export function recordBeatTap(lane = 'center') {
  if (!editorMode) return;

  const currentTime = getAudioTime();

  // Calculate BPM from last tap
  if (lastTapTime > 0) {
    const interval = currentTime - lastTapTime;
    editorBPM = Math.round(60 / interval);
  }

  editorBeats.push({
    time: currentTime,
    lane: lane,
    hit: false
  });

  lastTapTime = currentTime;

  console.log(`[Rhythm Mode] Beat recorded at ${currentTime.toFixed(2)}s, lane: ${lane}, BPM: ${editorBPM}`);
}

/**
 * Get current editor beat map
 * @returns {Object} Beat map object
 */
export function getEditorBeatMap() {
  return {
    bpm: editorBPM,
    beats: editorBeats.sort((a, b) => a.time - b.time),
    name: beatMapName || 'Custom Map'
  };
}

/**
 * Load a beat map from JSON
 * @param {Object} beatMap - Beat map object
 */
export function loadBeatMap(beatMap) {
  currentBeatMap = beatMap;
  beatMapName = beatMap.name || 'Unnamed';
  console.log(`[Rhythm Mode] Loaded beat map: ${beatMapName}, ${beatMap.beats.length} beats`);
}

/**
 * Export current beat map as JSON string
 * @returns {string} JSON string of beat map
 */
export function exportBeatMap() {
  const beatMap = editorMode ? getEditorBeatMap() : currentBeatMap;
  return JSON.stringify(beatMap, null, 2);
}

// ============================================================================
// RING SPAWNING AND MANAGEMENT
// ============================================================================

/**
 * Preload ring resources (geometry and materials)
 */
function preloadRingResources() {
  if (ringGeometryCache) return; // Already loaded

  // Create shared ring geometry (torus)
  ringGeometryCache = new THREE.TorusGeometry(50, 5, 16, 32);

  // Create materials for different states
  ringMaterialCache.set('default', new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8
  }));

  ringMaterialCache.set('perfect', new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8
  }));

  ringMaterialCache.set('good', new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8
  }));

  ringMaterialCache.set('miss', new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8
  }));

  console.log('[Rhythm Mode] Ring resources preloaded');
}

/**
 * Spawn a ring at specified position
 * @param {number} time - Beat time
 * @param {string} lane - Lane name
 */
function spawnRing(time, lane) {
  if (!scene) return;

  preloadRingResources();

  const lanePos = RING_LANES[lane] || RING_LANES['center'];
  const spawnDistance = 1000; // Distance ahead to spawn

  const ring = new THREE.Mesh(ringGeometryCache, ringMaterialCache.get('default').clone());
  ring.position.set(lanePos.x, lanePos.y, spawnDistance);
  ring.rotation.y = Math.PI / 2; // Face the car

  // Store metadata
  ring.userData = {
    beatTime: time,
    lane: lane,
    hit: false,
    spawned: true
  };

  scene.add(ring);
  rings.push(ring);
}

/**
 * Update ring positions and check for hits/misses
 * @param {number} dt - Delta time
 */
function updateRings(dt) {
  const currentTime = getAudioTime();
  const carZ = 0; // Car is at origin
  const ringSpeed = 500; // Units per second

  // Remove rings that are behind the car
  rings = rings.filter(ring => {
    if (ring.position.z < carZ - 100) {
      scene.remove(ring);

      // Mark as miss if not hit
      if (!ring.userData.hit) {
        rhythmModeMisses++;
        rhythmModeCombo = 0;
        console.log('[Rhythm Mode] Miss!');
      }

      return false;
    }
    return true;
  });

  // Move rings toward the car
  rings.forEach(ring => {
    ring.position.z -= ringSpeed * dt;

    // Check for collision
    if (!ring.userData.hit && Math.abs(ring.position.z - carZ) < 50) {
      checkRingHit(ring, currentTime);
    }
  });

  // Spawn upcoming rings
  if (currentBeatMap) {
    while (ringSpawnIndex < currentBeatMap.beats.length) {
      const beat = currentBeatMap.beats[ringSpawnIndex];
      const timeUntilBeat = beat.time - currentTime;
      const spawnLeadTime = 2.0; // Spawn 2 seconds before beat

      if (timeUntilBeat <= spawnLeadTime) {
        spawnRing(beat.time, beat.lane);
        ringSpawnIndex++;
      } else {
        break;
      }
    }
  }
}

/**
 * Check if car hit a ring and calculate timing accuracy
 * @param {THREE.Mesh} ring - Ring object
 * @param {number} currentTime - Current audio time
 */
function checkRingHit(ring, currentTime) {
  const timingError = Math.abs(currentTime - ring.userData.beatTime);

  ring.userData.hit = true;

  if (timingError <= TIMING_PERFECT) {
    // Perfect hit
    rhythmModePerfectHits++;
    rhythmModeCombo++;
    rhythmModeScore += 100 * rhythmModeCombo;
    ring.material = ringMaterialCache.get('perfect');
    console.log('[Rhythm Mode] Perfect!');
  } else if (timingError <= TIMING_GOOD) {
    // Good hit
    rhythmModeGoodHits++;
    rhythmModeCombo++;
    rhythmModeScore += 50 * rhythmModeCombo;
    ring.material = ringMaterialCache.get('good');
    console.log('[Rhythm Mode] Good!');
  } else if (timingError <= TIMING_MISS) {
    // Late/early but still counts
    rhythmModeCombo = 0;
    rhythmModeScore += 10;
    ring.material = ringMaterialCache.get('miss');
    console.log('[Rhythm Mode] Late!');
  }
}

// ============================================================================
// GAME MODE CONTROL
// ============================================================================

/**
 * Start rhythm mode with loaded beat map
 * @param {Object} sceneRef - THREE.js scene
 * @param {Object} cameraRef - THREE.js camera
 */
export function startRhythmMode(sceneRef, cameraRef) {
  if (!currentBeatMap) {
    console.warn('[Rhythm Mode] No beat map loaded');
    return;
  }

  scene = sceneRef;
  camera = cameraRef;

  rhythmModeActive = true;
  rhythmModeScore = 0;
  rhythmModeCombo = 0;
  rhythmModePerfectHits = 0;
  rhythmModeGoodHits = 0;
  rhythmModeMisses = 0;
  ringSpawnIndex = 0;
  rings = [];

  // Start audio
  playAudio();

  console.log('[Rhythm Mode] Started');
}

/**
 * Stop rhythm mode
 */
export function stopRhythmMode() {
  rhythmModeActive = false;

  // Stop audio
  stopAudio();

  // Clear rings
  rings.forEach(ring => scene.remove(ring));
  rings = [];

  // Update high score
  if (rhythmModeScore > rhythmModeHighScore) {
    rhythmModeHighScore = rhythmModeScore;
    saveSettings({ rhythmModeHighScore });
  }

  console.log('[Rhythm Mode] Stopped');
}

/**
 * Update rhythm mode (called every frame)
 * @param {number} dt - Delta time in seconds
 */
export function updateRhythmMode(dt) {
  if (!rhythmModeActive) return;

  updateRings(dt);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  init,
  getRhythmModeActive,
  getRhythmModeScore,
  getRhythmModeHighScore,
  getRhythmModeCombo,
  getEditorMode,
  loadAudioFile,
  playAudio,
  stopAudio,
  getAudioTime,
  detectBeats,
  generateBeatMap,
  enterEditorMode,
  exitEditorMode,
  recordBeatTap,
  getEditorBeatMap,
  loadBeatMap,
  exportBeatMap,
  startRhythmMode,
  stopRhythmMode,
  updateRhythmMode
};

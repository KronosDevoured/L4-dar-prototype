/**
 * rhythmMode.js
 * Rhythm game mode for L4 DAR prototype
 * Handles music-synced ring spawning, beat detection, and timing-based scoring
 */

import * as THREE from 'three';
import * as CONST from './constants.js';
import * as Car from './car.js';
import * as Audio from './audio.js';
import * as RingMode from './ringMode.js';
import { getSetting, saveSettings } from './settings.js';
import { SONG_LIBRARY, getSongById } from '../../songs/library.js';

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
let audioPauseTime = 0; // Track where we paused
let audioAnalyser = null;
let audioData = null;
let currentPlaybackRate = 1.0; // Playback speed (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
let isAudioPlaying = false;
let audioStartDelay = 0; // Time to wait before starting audio (for ring travel time)
let audioDelayTimer = null;

// Beat map data
let currentBeatMap = null; // { bpm: 120, beats: [{time: 1.5, lane: 'center'}, ...] }
let beatMapName = '';

// Ring spawning
let rings = [];
let ringSpawnIndex = 0;
let lastRingSpawnTime = -999; // Track when we last spawned a ring
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

// Re-export song library for UI access
export { SONG_LIBRARY } from '../../songs/library.js';

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

}

// ============================================================================
// EXPORTED GETTERS
// ============================================================================

export function getRhythmModeActive() { return rhythmModeActive; }
export function getRhythmModeScore() { return rhythmModeScore; }
export function getRhythmModeHighScore() { return rhythmModeHighScore; }
export function getRhythmModeCombo() { return rhythmModeCombo; }
export function getRhythmModePerfectHits() { return rhythmModePerfectHits; }
export function getRhythmModeGoodHits() { return rhythmModeGoodHits; }
export function getRhythmModeMisses() { return rhythmModeMisses; }
export function getEditorMode() { return editorMode; }
export function getAudioStartDelay() { return audioStartDelay; }

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
    return audioBuffer;
  } catch (error) {
    console.error('[Rhythm Mode] Error loading audio:', error);
    throw error;
  }
}

/**
 * Start playing the loaded audio
 */
export async function playAudio() {
  if (!audioBuffer) {
    console.warn('[Rhythm Mode] No audio loaded');
    return;
  }

  // Stop existing audio if playing
  if (audioSource && isAudioPlaying) {
    audioSource.stop();
  }

  // Create new audio source
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.playbackRate.value = currentPlaybackRate; // Apply current playback rate

  // Create analyser for beat detection
  audioAnalyser = audioContext.createAnalyser();
  audioAnalyser.fftSize = 2048;
  audioData = new Uint8Array(audioAnalyser.frequencyBinCount);

  // Connect audio graph: source -> analyser -> destination
  audioSource.connect(audioAnalyser);
  audioAnalyser.connect(audioContext.destination);

  // Resume audio context if suspended (required by browsers)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  // Start playback from pause time (or beginning if never paused)
  audioSource.start(0, audioPauseTime);
  audioStartTime = audioContext.currentTime - (audioPauseTime / currentPlaybackRate);
  isAudioPlaying = true;

}

/**
 * Pause audio playback (remembers position)
 */
export function pauseAudio() {
  if (audioSource && isAudioPlaying) {
    // Calculate current playback position
    audioPauseTime = getAudioTime();

    audioSource.stop();
    audioSource = null;
    isAudioPlaying = false;

  }
}

/**
 * Stop audio playback (resets to beginning)
 */
export function stopAudio() {
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
  }

  audioPauseTime = 0; // Reset to beginning
  isAudioPlaying = false;

}

/**
 * Set playback speed
 * @param {number} rate - Playback rate (0.25 to 2.0)
 */
export function setPlaybackRate(rate) {
  currentPlaybackRate = Math.max(0.25, Math.min(2.0, rate));

  // Update existing audio source if playing
  if (audioSource && audioSource.playbackRate) {
    audioSource.playbackRate.value = currentPlaybackRate;
  }

}

/**
 * Get current audio playback time
 * @returns {number} Current time in seconds
 */
export function getAudioTime() {
  if (isAudioPlaying && audioSource && audioStartTime) {
    // Multiply by playback rate to get actual audio time
    return (audioContext.currentTime - audioStartTime) * currentPlaybackRate;
  }
  // When paused, return the pause time
  return audioPauseTime;
}

/**
 * Get audio duration
 * @returns {number} Duration in seconds, or 0 if no audio loaded
 */
export function getAudioDuration() {
  return audioBuffer ? audioBuffer.duration : 0;
}

/**
 * Check if audio is currently playing
 * @returns {boolean} True if audio is playing
 */
export function getIsAudioPlaying() {
  return isAudioPlaying;
}

/**
 * Set the pause time (used when user scrolls to a specific position)
 * @param {number} time - Time in seconds to set as the new pause position
 */
export function setAudioPauseTime(time) {
  audioPauseTime = Math.max(0, time);
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


  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = 2048;
  const hopSize = 512;
  const threshold = 1.5; // Energy threshold multiplier

  const rawBeats = [];
  const energyHistory = [];
  const historySize = 43; // ~1 second of history at 44.1kHz with hopSize 512

  // PASS 1: Detect all potential beats
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
      if (rawBeats.length === 0 || time - rawBeats[rawBeats.length - 1] > 0.1) {
        rawBeats.push(time);
      }
    }

    // Update energy history
    energyHistory.push(energy);
    if (energyHistory.length > historySize) {
      energyHistory.shift();
    }
  }


  // PASS 2: Estimate BPM from raw beats
  let estimatedBPM = 120; // default
  if (rawBeats.length > 1) {
    const intervals = [];
    for (let i = 1; i < rawBeats.length; i++) {
      intervals.push(rawBeats[i] - rawBeats[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    estimatedBPM = Math.round(60 / avgInterval);
  }

  // Calculate minimum time between beats based on BPM
  const minBeatInterval = 60 / estimatedBPM;

  // PASS 3: Filter beats to respect BPM timing
  const beats = [];
  for (const time of rawBeats) {
    if (beats.length === 0 || time - beats[beats.length - 1] >= minBeatInterval * 0.9) {
      // Allow 10% tolerance (0.9x) to catch slightly early beats
      beats.push(time);
    }
  }

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
  // Don't clear editorBeats - preserve them if re-entering editor mode
}

/**
 * Exit beat map editor mode
 */
export function exitEditorMode() {
  editorMode = false;
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
 * Load beats into editor
 * @param {Object} beatMap - Beat map to load into editor
 */
export function loadBeatsIntoEditor(beatMap) {
  editorBeats = [...beatMap.beats];
  editorBPM = beatMap.bpm;
  beatMapName = beatMap.name;
}

/**
 * Load a beat map from JSON
 * @param {Object} beatMap - Beat map object
 */
export function loadBeatMap(beatMap) {
  currentBeatMap = beatMap;
  beatMapName = beatMap.name || 'Unnamed';
}

/**
 * Load a song from the library by ID
 * @param {string} songId - Song ID from library
 * @returns {Promise<boolean>} Success status
 */
export async function loadSongFromLibrary(songId) {
  const song = getSongById(songId);
  if (!song) {
    console.error(`[Rhythm Mode] Song not found in library: ${songId}`);
    return false;
  }

  try {

    // Load audio file
    const audioResponse = await fetch(song.audioPath);
    const audioBlob = await audioResponse.blob();
    const audioFile = new File([audioBlob], song.audioPath.split('/').pop(), { type: audioBlob.type });
    await loadAudioFile(audioFile);

    // Load beat map JSON
    const beatMapResponse = await fetch(song.beatMapPath);
    const beatMap = await beatMapResponse.json();
    loadBeatMap(beatMap);

    return true;
  } catch (error) {
    console.error(`[Rhythm Mode] Failed to load song from library:`, error);
    return false;
  }
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

}

/**
 * Spawn a ring at specified position
 * @param {number} time - Beat time
 * @param {number} x - X position (0 = center)
 * @param {number} y - Y position (0 = center)
 * @param {string} lane - Lane name (deprecated, kept for compatibility)
 */
function spawnRing(time, x = 0, y = 0, lane = 'center') {
  if (!scene || !camera) return;

  preloadRingResources();

  // Use provided x/y positions from beat map
  const spawnX = x;
  const spawnY = y;

  // Calculate spawn position and speed based on beat timing
  // Rings spawn far away and move TOWARD the car (like ring mode)
  // Car stays at Z=0, rings approach from negative Z
  const currentTime = getAudioTime();
  const timeUntilBeat = time - currentTime;

  // Safety check: don't spawn if beat already passed or too close
  if (timeUntilBeat <= 0.1) {
    console.warn(`[Rhythm Mode] Skipping ring spawn - beat too close or already passed (${timeUntilBeat.toFixed(2)}s)`);
    return;
  }

  // Spawn distance: how far away to spawn the ring
  // We want the ring to reach Z=0 exactly when the beat plays
  // Match ring mode spawn distance for consistency
  const spawnDistance = CONST.RING_SPAWN_DISTANCE; // Usually -1100

  // Calculate speed: distance / time
  // The ring needs to travel from spawnDistance to 0 in timeUntilBeat seconds
  const ringSpeed = Math.abs(spawnDistance) / timeUntilBeat;

  const ring = new THREE.Mesh(ringGeometryCache, ringMaterialCache.get('default').clone());
  ring.position.set(spawnX, spawnY, spawnDistance);
  // No rotation needed - torus geometry already faces correct direction (XY plane)

  // Make rings bigger - scale to match ring mode initial size
  const ringScale = 3.5; // 3.5x size for easier navigation (midpoint of 3-4x request)
  ring.scale.set(ringScale, ringScale, ringScale);

  // Store metadata including speed
  ring.userData = {
    beatTime: time,
    lane: lane,
    hit: false,
    spawned: true,
    speed: ringSpeed // Store the calculated speed
  };

  scene.add(ring);
  rings.push(ring);

    Position: (${ring.position.x.toFixed(1)}, ${ring.position.y.toFixed(1)}, ${ring.position.z.toFixed(1)})
    Speed: ${ringSpeed.toFixed(1)} u/s (moving toward +Z)
    Will reach car (Z=0) at t=${time.toFixed(2)}s
    Current time: ${currentTime.toFixed(2)}s, time until beat: ${timeUntilBeat.toFixed(2)}s`);
}

/**
 * Update ring positions and check for hits/misses
 * @param {number} dt - Delta time
 */
function updateRings(dt) {
  if (!camera) {
    console.warn('[Rhythm Mode] updateRings called but camera is null');
    return;
  }

  const currentTime = getAudioTime();
  const carPos = Car.car.position; // Car position (should be at Z=0)

  // Move rings TOWARD the car (like ring mode)
  // Rings increment their Z position each frame
  rings.forEach(ring => {
    // Move ring toward car using its calculated speed
    ring.position.z += ring.userData.speed * dt;
  });

  // Debug logging disabled - only log on demand
  // if (Math.random() < 0.01) {
  // }

  // Remove rings that have passed the car (Z > 100)
  rings = rings.filter(ring => {
    // Remove if ring has passed the car
    if (ring.position.z > 100) {
      scene.remove(ring);

      // Mark as miss if not hit
      if (!ring.userData.hit) {
        ring.material = ringMaterialCache.get('miss');
        rhythmModeMisses++;
        rhythmModeCombo = 0;
      }

      return false;
    }
    return true;
  });

  // Check for collisions (car at Z=0, rings moving toward it)
  rings.forEach(ring => {
    if (!ring.userData.hit) {
      // Check if ring is passing through the car's Z plane (Z ≈ 0)
      const ringZ = ring.position.z;
      const carZ = carPos.z;
      const zDistance = Math.abs(ringZ - carZ);

      // Ring collision window: check when ring is within ±100 units of car's Z position
      if (zDistance < 100) {
        // Check XY distance to see if car is within the ring
        const dx = ring.position.x - carPos.x;
        const dy = ring.position.y - carPos.y;
        const xyDistance = Math.sqrt(dx * dx + dy * dy);

        // Ring inner radius (scaled): default torus inner radius is ~40, scaled by 3.5 = 140
        const ringRadius = 140;

        // Debug: log collision checks
        if (Math.random() < 0.3) { // Log 30% of checks to debug
        }

        // Car is through the ring if XY distance is less than ring radius
        if (xyDistance < ringRadius) {
          checkRingHit(ring, currentTime);
        }
      }
    }
  });

  // Spawn upcoming rings (only if player has boosted to start the game)
  if (currentBeatMap && RingMode.getRingModeStarted()) {
    const spawnLeadTime = 3.0; // Spawn 3 seconds before beat

    // Spawn all rings that are ready (within lead time window)
    while (ringSpawnIndex < currentBeatMap.beats.length) {
      const beat = currentBeatMap.beats[ringSpawnIndex];
      const timeUntilBeat = beat.time - currentTime;

      // If this beat is ready to spawn
      if (timeUntilBeat <= spawnLeadTime && timeUntilBeat > 0) {
        const x = beat.x !== undefined ? beat.x : 0;
        const y = beat.y !== undefined ? beat.y : 0;
        spawnRing(beat.time, x, y, beat.lane);
        ringSpawnIndex++;
      } else if (timeUntilBeat <= 0) {
        // Beat already passed - skip it
        console.warn(`[Rhythm Mode] Skipped beat ${ringSpawnIndex} (already passed at t=${beat.time.toFixed(2)}s)`);
        ringSpawnIndex++;
      } else {
        // Future beat - stop checking
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
  } else if (timingError <= TIMING_GOOD) {
    // Good hit
    rhythmModeGoodHits++;
    rhythmModeCombo++;
    rhythmModeScore += 50 * rhythmModeCombo;
    ring.material = ringMaterialCache.get('good');
  } else if (timingError <= TIMING_MISS) {
    // Late/early but still counts
    rhythmModeCombo = 0;
    rhythmModeScore += 10;
    ring.material = ringMaterialCache.get('miss');
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
    alert('⚠️ Please load a beat map first!');
    return;
  }

  if (!audioBuffer) {
    console.warn('[Rhythm Mode] No audio loaded');
    alert('⚠️ Please load an audio file first!');
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
  lastRingSpawnTime = -999; // Reset spawn timer
  rings = [];

  // Update game state
  if (gameState) {
    gameState.setRhythmModeActive(true);
  } else {
    console.warn('[Rhythm Mode] gameState is null!');
  }

  // Initialize ring mode physics state for rhythm mode
  // This resets position, velocity, and allows boost to work
  // Use physics-only reset to avoid starting ring mode music/game
  RingMode.resetRingModePhysicsOnly();

  // Make absolutely sure ring mode is NOT active
  RingMode.stopRingMode();

  // DON'T start audio yet - wait for player to boost
  // Audio will start in updateRhythmMode when RingMode.getRingModeStarted() becomes true

}

/**
 * Stop rhythm mode
 */
export function stopRhythmMode() {
  rhythmModeActive = false;

  // Update game state
  if (gameState) {
    gameState.setRhythmModeActive(false);
  }

  // Stop audio
  stopAudio();

  // Clear countdown timer if active
  if (audioDelayTimer) {
    clearInterval(audioDelayTimer);
    audioDelayTimer = null;
    audioStartDelay = 0;
  }

  // Clear rings
  rings.forEach(ring => scene.remove(ring));
  rings = [];

  // Update high score
  if (rhythmModeScore > rhythmModeHighScore) {
    rhythmModeHighScore = rhythmModeScore;
    saveSettings({ rhythmModeHighScore });
  }

}

/**
 * Update rhythm mode (called every frame)
 * @param {number} dt - Delta time in seconds
 */
export function updateRhythmMode(dt) {
  if (!rhythmModeActive) return;

  // Rhythm mode works EXACTLY like ring mode:
  // - Car stays at Z=0 (locked to 2D grid plane)
  // - Rings spawn far away (negative Z) and move TOWARD the car
  // - X and Y position controlled by ring mode physics (player flies around grid)
  // - Ring positions and speeds are based on music beat timing

  // Start audio countdown when player first boosts (only once)
  if (RingMode.getRingModeStarted() && !isAudioPlaying && audioBuffer && !audioSource && !audioDelayTimer) {
    // Set countdown delay - use spawn lead time so rings have time to reach correct positions
    audioStartDelay = 3.0; // 3 second countdown

    audioDelayTimer = setInterval(() => {
      audioStartDelay -= 0.016; // ~60fps countdown

      if (audioStartDelay <= 0) {
        clearInterval(audioDelayTimer);
        audioDelayTimer = null;
        playAudio().then(() => {
        }).catch(err => {
          console.error('[Rhythm Mode] Error starting audio:', err);
        });
      }
    }, 16);
  }

  // Check if song has ended
  if (audioBuffer && audioSource) {
    const currentTime = getAudioTime();
    const songDuration = audioBuffer.duration;

    if (currentTime >= songDuration) {
      stopRhythmMode();
      return;
    }
  }

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
  pauseAudio,
  stopAudio,
  setPlaybackRate,
  getAudioTime,
  setAudioPauseTime,
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

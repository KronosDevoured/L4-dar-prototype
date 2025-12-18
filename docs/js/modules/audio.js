/**
 * audio.js
 * Sound effects and background music system
 * Includes ring pass/miss sounds, boost rumble, and 8-bit style background music
 */

// ============================================================================
// AUDIO STATE
// ============================================================================

let audioContext = null;
let gameSoundsEnabled = true;
let gameMusicEnabled = true;

// Boost rumble
let boostRumbleOscillator = null;
let boostRumbleGain = null;

// Background music file playback
let musicAudioElement = null;
let musicSourceNode = null;
let musicGain = null;

// ============================================================================
// AUDIO INITIALIZATION
// ============================================================================

/**
 * Initialize audio context (call on first user interaction)
 */
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// ============================================================================
// SOUND EFFECTS
// ============================================================================

/**
 * Play ring pass sound (dull thunk)
 */
export function playRingPassSound() {
  if (!gameSoundsEnabled) return;

  try {
    initAudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Lower frequency for dull thunk (C3 note = 130.8 Hz)
    oscillator.frequency.setValueAtTime(130.8, audioContext.currentTime);
    oscillator.type = 'triangle'; // Warmer, less harsh than sine

    // Quick attack and decay for "thunk" effect
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

/**
 * Play ring miss sound (high-pitched ding)
 */
export function playRingMissSound() {
  if (!gameSoundsEnabled) return;

  try {
    initAudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // High frequency for bright ding (E6 note = 1318.5 Hz)
    oscillator.frequency.setValueAtTime(1318.5, audioContext.currentTime);
    oscillator.type = 'sine'; // Bright, sharp tone

    // Sharp attack and longer decay for "ding" effect
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

// ============================================================================
// BOOST RUMBLE
// ============================================================================

/**
 * Start boost rumble sound (continuous while boosting)
 */
export function startBoostRumble() {
  if (!gameSoundsEnabled) return;
  if (boostRumbleOscillator) return; // Already playing

  try {
    initAudioContext();

    boostRumbleOscillator = audioContext.createOscillator();
    boostRumbleGain = audioContext.createGain();

    boostRumbleOscillator.connect(boostRumbleGain);
    boostRumbleGain.connect(audioContext.destination);

    // Very low frequency for deep rumble (30 Hz - sub-bass)
    boostRumbleOscillator.frequency.setValueAtTime(30, audioContext.currentTime);
    boostRumbleOscillator.type = 'sawtooth'; // Rough, engine-like sound

    // Low volume so it doesn't drown out ring sounds
    boostRumbleGain.gain.setValueAtTime(0.03, audioContext.currentTime);

    boostRumbleOscillator.start(audioContext.currentTime);
  } catch (e) {
    console.warn('Boost rumble failed:', e);
  }
}

/**
 * Stop boost rumble sound
 */
export function stopBoostRumble() {
  if (!boostRumbleOscillator || !audioContext) return;

  try {
    // Check audio context state before attempting to ramp
    if (audioContext.state === 'running' && boostRumbleGain) {
      boostRumbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      boostRumbleOscillator.stop(audioContext.currentTime + 0.05);
    } else {
      // Audio context not running, just stop immediately
      if (boostRumbleOscillator) {
        boostRumbleOscillator.stop();
      }
    }
    boostRumbleOscillator = null;
    boostRumbleGain = null;
  } catch (e) {
    console.warn('Stop boost rumble failed:', e);
    boostRumbleOscillator = null;
    boostRumbleGain = null;
  }
}

// ============================================================================
// BACKGROUND MUSIC
// ============================================================================

/**
 * Start background music from file
 */
export function startBackgroundMusic() {
  if (!gameMusicEnabled) return;
  if (musicAudioElement) return; // Already playing

  try {
    initAudioContext();

    // Create audio element to load the music file
    // Path is relative to index.html location (docs/), not this JS file
    musicAudioElement = new Audio('songs/Video%20Game%20Synthwave%20Rock%20Full%20Version.wav');
    musicAudioElement.loop = true; // Loop the music
    musicAudioElement.volume = 0.3; // Set volume (0.0 to 1.0)

    // Create MediaElementSource to connect to Web Audio API (for volume control)
    musicSourceNode = audioContext.createMediaElementSource(musicAudioElement);
    musicGain = audioContext.createGain();
    musicGain.gain.setValueAtTime(1.0, audioContext.currentTime);
    musicSourceNode.connect(musicGain);
    musicGain.connect(audioContext.destination);

    // Play the music
    musicAudioElement.play();
  } catch (e) {
    console.warn('Music playback failed:', e);
  }
}

/**
 * Pause background music (can be resumed)
 */
export function pauseBackgroundMusic() {
  if (!musicAudioElement) return;

  try {
    musicAudioElement.pause();
  } catch (e) {
    console.warn('Pause music failed:', e);
  }
}

/**
 * Resume background music
 */
export function resumeBackgroundMusic() {
  if (!musicAudioElement) return;

  try {
    musicAudioElement.play();
  } catch (e) {
    console.warn('Resume music failed:', e);
  }
}

/**
 * Stop background music (stops and cleans up)
 */
export function stopBackgroundMusic() {
  if (!musicAudioElement) return;

  try {
    // Fade out the music only if audio context is running
    if (musicGain && audioContext && audioContext.state === 'running') {
      musicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    }

    // Stop and clean up after fade
    setTimeout(() => {
      if (musicAudioElement) {
        musicAudioElement.pause();
        musicAudioElement.currentTime = 0;
        musicAudioElement = null;
      }
      if (musicSourceNode) {
        musicSourceNode.disconnect();
        musicSourceNode = null;
      }
      musicGain = null;
    }, 300);
  } catch (e) {
    console.warn('Stop music failed:', e);
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Enable or disable game sounds
 */
export function setGameSoundsEnabled(enabled) {
  gameSoundsEnabled = enabled;
  if (!enabled) {
    stopBoostRumble();
  }
}

/**
 * Enable or disable background music
 */
export function setGameMusicEnabled(enabled) {
  gameMusicEnabled = enabled;
  if (!enabled) {
    stopBackgroundMusic();
  }
}

/**
 * Get current game sounds enabled state
 */
export function isGameSoundsEnabled() {
  return gameSoundsEnabled;
}

/**
 * Get current game music enabled state
 */
export function isGameMusicEnabled() {
  return gameMusicEnabled;
}

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
let gameMusicVolume = 0.3;
let gameSfxVolume = 1.0;

// Boost rumble
let boostRumbleOscillator = null;
let boostRumbleGain = null;
let boostRumbleStopping = false; // Flag to prevent rapid restart during cleanup

// Background music file playback
let musicAudioElement = null;
let musicSourceNode = null;
let musicGain = null;
let musicStopTimeout = null; // Pending stop timer when fading out
let pendingMusicStart = false; // True when autoplay blocked; waits for user gesture

function clamp01(value) {
  if (typeof value !== 'number' || !isFinite(value)) return 1.0;
  return Math.min(1, Math.max(0, value));
}
/**
 * Initialize audio context (call on first user interaction)
 */
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Ensure audio context resumes on next user gesture if suspended
 */
function resumeContextOnGesture() {
  if (!audioContext || audioContext.state === 'running') return;
  const resume = async () => {
    try {
      await audioContext.resume();
    } catch (e) {
      // ignore
    }
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}

/**
 * Schedule music start on next user gesture (autoplay fallback)
 */
function requestMusicStartOnGesture() {
  if (pendingMusicStart) return;
  pendingMusicStart = true;

  const trigger = () => {
    if (!pendingMusicStart) return;
    pendingMusicStart = false;
    startBackgroundMusic();
  };

  window.addEventListener('pointerdown', trigger, { once: true });
  window.addEventListener('keydown', trigger, { once: true });
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
    gainNode.gain.setValueAtTime(0.25 * gameSfxVolume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01 * gameSfxVolume, audioContext.currentTime + 0.15);

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
    gainNode.gain.setValueAtTime(0.3 * gameSfxVolume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01 * gameSfxVolume, audioContext.currentTime + 0.3);

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
  if (boostRumbleStopping) return; // Currently stopping, wait for completion

  let oscillator = null;
  let gain = null;

  try {
    initAudioContext();

    oscillator = audioContext.createOscillator();
    gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    // Very low frequency for deep rumble (30 Hz - sub-bass)
    oscillator.frequency.setValueAtTime(30, audioContext.currentTime);
    oscillator.type = 'sawtooth'; // Rough, engine-like sound

    // Low volume so it doesn't drown out ring sounds
    gain.gain.setValueAtTime(0.03 * gameSfxVolume, audioContext.currentTime);

    oscillator.start(audioContext.currentTime);

    // Only assign to module variables if everything succeeded
    boostRumbleOscillator = oscillator;
    boostRumbleGain = gain;
  } catch (e) {
    console.warn('Boost rumble failed:', e);
    // Cleanup orphaned nodes if error occurred
    try {
      if (oscillator) {
        oscillator.disconnect();
        oscillator.stop();
      }
      if (gain) gain.disconnect();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Stop boost rumble sound
 */
export function stopBoostRumble() {
  if (!boostRumbleOscillator || !audioContext) return;
  if (boostRumbleStopping) return; // Already stopping

  // Set stopping flag to prevent restart during ramp-down
  boostRumbleStopping = true;

  const oscillator = boostRumbleOscillator;
  const gain = boostRumbleGain;

  // Clear references immediately to prevent re-entry
  boostRumbleOscillator = null;
  boostRumbleGain = null;

  try {
    // Check audio context state before attempting to ramp
    if (audioContext.state === 'running' && gain) {
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      oscillator.stop(audioContext.currentTime + 0.05);

      // Clear stopping flag after ramp completes
      setTimeout(() => { boostRumbleStopping = false; }, 60);
    } else {
      // Audio context not running, just stop immediately
      oscillator.stop();
      boostRumbleStopping = false;
    }

    // Disconnect nodes to free resources
    oscillator.disconnect();
    if (gain) gain.disconnect();
  } catch (e) {
    console.warn('Stop boost rumble failed:', e);
    boostRumbleStopping = false; // Clear flag on error
    // Ensure cleanup even if error occurs
    try {
      oscillator.disconnect();
      if (gain) gain.disconnect();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// BACKGROUND MUSIC
// ============================================================================

/**
 * Start background music from file
 */
export async function startBackgroundMusic() {
  if (!gameMusicEnabled) return;
  // Cancel any pending stop so we can restart cleanly
  if (musicStopTimeout) {
    clearTimeout(musicStopTimeout);
    musicStopTimeout = null;
  }

  // Ensure audio context exists and is running (within user gesture if possible)
  initAudioContext();
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {
      // If resume is blocked, fallback will trigger on next gesture
    }
  }

  // If the element already exists, force a restart from the beginning
  if (musicAudioElement) {
    try {
      musicAudioElement.loop = true;
      musicAudioElement.pause();
      musicAudioElement.currentTime = 0;
      if (musicGain) {
        try { musicGain.gain.cancelScheduledValues(0); } catch {}
        if (audioContext && audioContext.state === 'running') {
          musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
        } else {
          try { musicGain.gain.value = gameMusicVolume; } catch {}
        }
      }
      try {
        await musicAudioElement.play();
      } catch (err) {
        console.warn('Music restart prevented (user interaction required):', err);
        requestMusicStartOnGesture();
      }
    } catch (e) {
      console.warn('Music restart failed:', e);
    }
    return;
  }

  try {
    initAudioContext();

    // Create audio element to load the music file
    // Path is relative to index.html location (docs/), not this JS file
    musicAudioElement = new Audio('songs/Video%20Game%20Synthwave%20Rock%20Full%20Version.wav');
    musicAudioElement.loop = true; // Loop the music
    musicAudioElement.volume = 1.0; // Use gain node for volume control

    // Create MediaElementSource to connect to Web Audio API (for volume control)
    musicSourceNode = audioContext.createMediaElementSource(musicAudioElement);
    musicGain = audioContext.createGain();
    musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
    musicSourceNode.connect(musicGain);
    musicGain.connect(audioContext.destination);

    // Play the music - handle Promise rejection (autoplay policy)
    const playPromise = musicAudioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Music autoplay prevented (user interaction required):', err);
        requestMusicStartOnGesture();
      });
    }
  } catch (e) {
    console.warn('Music playback failed:', e);
  }
}

/**
 * Force start background music synchronously in a user gesture handler.
 */
export function forceStartBackgroundMusic() {
  if (!gameMusicEnabled) return;
  if (musicStopTimeout) {
    clearTimeout(musicStopTimeout);
    musicStopTimeout = null;
  }
  initAudioContext();
  try { if (audioContext && audioContext.state === 'suspended') audioContext.resume(); } catch {}
  try {
    if (!musicAudioElement) {
      musicAudioElement = new Audio('songs/Video%20Game%20Synthwave%20Rock%20Full%20Version.wav');
      musicAudioElement.loop = true;
      musicAudioElement.volume = 1.0;
      musicSourceNode = audioContext.createMediaElementSource(musicAudioElement);
      musicGain = audioContext.createGain();
      musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
      musicSourceNode.connect(musicGain);
      musicGain.connect(audioContext.destination);
    } else {
      // Ensure gain is audible immediately, cancel any fade-out
      if (!musicGain) {
        // Recreate gain chain if it was cleaned up
        musicSourceNode = audioContext.createMediaElementSource(musicAudioElement);
        musicGain = audioContext.createGain();
        musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
        musicSourceNode.connect(musicGain);
        musicGain.connect(audioContext.destination);
      } else {
        try { musicGain.gain.cancelScheduledValues(0); } catch {}
        musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
      }
    }
    musicAudioElement.pause();
    musicAudioElement.currentTime = 0;
    const playPromise = musicAudioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Music play prevented (user interaction required):', err);
      });
    }
  } catch (e) {
    console.warn('Force start music failed:', e);
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
    const playPromise = musicAudioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Resume music failed (user interaction required):', err);
      });
    }
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
    musicStopTimeout = setTimeout(() => {
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
      musicStopTimeout = null;
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
    // For toggle-off, just pause so re-enabling is fast and avoids reloading
    pauseBackgroundMusic();
  }
}

/**
 * Set background music volume (0.0 to 1.0)
 */
export function setGameMusicVolume(volume) {
  gameMusicVolume = clamp01(volume);
  if (musicGain) {
    if (audioContext && audioContext.state === 'running') {
      musicGain.gain.setValueAtTime(gameMusicVolume, audioContext.currentTime);
    } else {
      try { musicGain.gain.value = gameMusicVolume; } catch {}
    }
  }
}

/**
 * Set sound effects volume (0.0 to 1.0)
 */
export function setGameSfxVolume(volume) {
  gameSfxVolume = clamp01(volume);
  if (boostRumbleGain && audioContext && audioContext.state === 'running') {
    boostRumbleGain.gain.setValueAtTime(0.03 * gameSfxVolume, audioContext.currentTime);
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

// Internal: expose audio context for gesture-based resume in UI handlers
export function __getAudioContext() {
  return audioContext;
}

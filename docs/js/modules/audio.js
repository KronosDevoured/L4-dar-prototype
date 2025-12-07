/**
 * audio.js
 * Sound effects and background music system
 * Includes ring pass/miss sounds, boost rumble, and 8-bit style background music
 */

import { CHORD_PROGRESSION } from './constants.js';

// ============================================================================
// AUDIO STATE
// ============================================================================

let audioContext = null;
let gameSoundsEnabled = true;
let gameMusicEnabled = true;

// Boost rumble
let boostRumbleOscillator = null;
let boostRumbleGain = null;

// Background music
let musicBassOsc = null;
let musicChordOsc = null;
let musicGain = null;
let musicIntervalId = null;
let musicBeatIndex = 0;

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
  if (!boostRumbleOscillator) return;

  try {
    // Fade out quickly
    boostRumbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    boostRumbleOscillator.stop(audioContext.currentTime + 0.05);
    boostRumbleOscillator = null;
    boostRumbleGain = null;
  } catch (e) {
    console.warn('Stop boost rumble failed:', e);
  }
}

// ============================================================================
// BACKGROUND MUSIC
// ============================================================================

/**
 * Start 8-bit style background music with drums
 */
export function startBackgroundMusic() {
  if (!gameMusicEnabled) return;
  if (musicIntervalId) return; // Already playing

  try {
    initAudioContext();

    // Create main gain for all music
    musicGain = audioContext.createGain();
    musicGain.connect(audioContext.destination);
    musicGain.gain.setValueAtTime(0.15, audioContext.currentTime); // Overall volume

    // Bass oscillator (sine wave for smooth bass)
    musicBassOsc = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    musicBassOsc.connect(bassGain);
    bassGain.connect(musicGain);
    musicBassOsc.type = 'sine';
    musicBassOsc.frequency.setValueAtTime(110, audioContext.currentTime); // A2
    bassGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    musicBassOsc.start();

    // Chord pad (triangle wave for softer tone)
    musicChordOsc = audioContext.createOscillator();
    const chordGain = audioContext.createGain();
    musicChordOsc.connect(chordGain);
    chordGain.connect(musicGain);
    musicChordOsc.type = 'triangle';
    musicChordOsc.frequency.setValueAtTime(220, audioContext.currentTime); // A3
    chordGain.gain.setValueAtTime(0.15, audioContext.currentTime);
    musicChordOsc.start();

    // Drum pattern function
    function playBeat() {
      const beat = musicBeatIndex % 16; // 16 beat pattern
      const now = audioContext.currentTime;

      // Kick drum (beats 0, 4, 8, 12)
      if (beat % 4 === 0) {
        const kickOsc = audioContext.createOscillator();
        const kickGain = audioContext.createGain();
        kickOsc.connect(kickGain);
        kickGain.connect(musicGain);
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        kickGain.gain.setValueAtTime(0.5, now);
        kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        kickOsc.start(now);
        kickOsc.stop(now + 0.15);
      }

      // Hi-hat (beats 2, 6, 10, 14)
      if (beat % 4 === 2) {
        const noise = audioContext.createBufferSource();
        const noiseBuffer = audioContext.createBuffer(1, 4410, 44100); // 0.1s
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }
        noise.buffer = noiseBuffer;
        const hihatGain = audioContext.createGain();
        const hihatFilter = audioContext.createBiquadFilter();
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 7000;
        noise.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(musicGain);
        hihatGain.gain.setValueAtTime(0.1, now);
        hihatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        noise.start(now);
        noise.stop(now + 0.05);
      }

      // Change chord every 4 beats
      if (beat % 4 === 0) {
        const chordIndex = Math.floor(beat / 4) % CHORD_PROGRESSION.length;
        const rootNote = CHORD_PROGRESSION[chordIndex];
        musicBassOsc.frequency.setValueAtTime(rootNote / 2, now); // Bass (octave below)
        musicChordOsc.frequency.setValueAtTime(rootNote, now); // Chord root
      }

      musicBeatIndex++;
    }

    playBeat();
    musicIntervalId = setInterval(playBeat, 300); // 100 BPM 16th notes
  } catch (e) {
    console.warn('Music playback failed:', e);
  }
}

/**
 * Stop background music
 */
export function stopBackgroundMusic() {
  if (!musicIntervalId) return;

  try {
    clearInterval(musicIntervalId);
    musicIntervalId = null;

    if (musicGain) {
      musicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    }
    if (musicBassOsc) {
      musicBassOsc.stop(audioContext.currentTime + 0.1);
      musicBassOsc = null;
    }
    if (musicChordOsc) {
      musicChordOsc.stop(audioContext.currentTime + 0.1);
      musicChordOsc = null;
    }
    musicGain = null;
    musicBeatIndex = 0;
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

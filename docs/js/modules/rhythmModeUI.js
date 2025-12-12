/**
 * rhythmModeUI.js
 * UI event handlers for Rhythm Mode
 */

import * as RhythmMode from './rhythmMode.js';

// ============================================================================
// STATE
// ============================================================================

let currentBeatMap = null;
let currentAudioFile = null;
let beatMapStorage = {}; // Store loaded beat maps {filename: beatMapData}
let isManualTapMode = false;

// Scene references (injected from main.js)
let scene = null;
let camera = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initRhythmModeUI(sceneRef, cameraRef) {
  scene = sceneRef;
  camera = cameraRef;
  console.log('[Rhythm Mode UI] Initializing...');

  // Modal open/close
  const rhythmModeBtn = document.getElementById('rhythmMode');
  const rhythmModeModal = document.getElementById('rhythmModeModal');
  const rhythmModeClose = document.getElementById('rhythmModeClose');

  rhythmModeBtn.addEventListener('click', () => {
    rhythmModeModal.style.display = 'block';
  });

  rhythmModeClose.addEventListener('click', () => {
    rhythmModeModal.style.display = 'none';
    // Stop any playing audio
    RhythmMode.stopAudio();
  });

  // Close on backdrop click
  rhythmModeModal.addEventListener('click', (e) => {
    if (e.target === rhythmModeModal) {
      rhythmModeModal.style.display = 'none';
      RhythmMode.stopAudio();
    }
  });

  // Tab switching
  const playTab = document.getElementById('rhythmTabPlay');
  const editorTab = document.getElementById('rhythmTabEditor');
  const playPanel = document.getElementById('rhythmPlayPanel');
  const editorPanel = document.getElementById('rhythmEditorPanel');

  playTab.addEventListener('click', () => {
    switchTab('play');
  });

  editorTab.addEventListener('click', () => {
    switchTab('editor');
  });

  function switchTab(tab) {
    if (tab === 'play') {
      playPanel.style.display = 'block';
      editorPanel.style.display = 'none';
      playTab.style.border = '1px solid #4c8dff';
      playTab.style.background = 'rgba(76,141,255,0.2)';
      playTab.style.color = '#4c8dff';
      editorTab.style.border = '1px solid #3a3d45';
      editorTab.style.background = '#15171d';
      editorTab.style.color = '#e8e8ea';
      RhythmMode.exitEditorMode();
    } else {
      playPanel.style.display = 'none';
      editorPanel.style.display = 'block';
      editorTab.style.border = '1px solid #4c8dff';
      editorTab.style.background = 'rgba(76,141,255,0.2)';
      editorTab.style.color = '#4c8dff';
      playTab.style.border = '1px solid #3a3d45';
      playTab.style.background = '#15171d';
      playTab.style.color = '#e8e8ea';
      RhythmMode.enterEditorMode();
    }
  }

  // ========== PLAY MODE ==========

  // Load beat map
  const loadBeatMapBtn = document.getElementById('rhythmLoadBeatMap');
  const beatMapFileInput = document.getElementById('rhythmBeatMapFile');

  loadBeatMapBtn.addEventListener('click', () => {
    beatMapFileInput.click();
  });

  beatMapFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const beatMap = JSON.parse(text);

      // Validate beat map
      if (!beatMap.beats || !Array.isArray(beatMap.beats)) {
        throw new Error('Invalid beat map format');
      }

      // Store beat map
      beatMapStorage[file.name] = beatMap;
      currentBeatMap = beatMap;

      // Update dropdown
      updateBeatMapSelect();

      // Load into rhythm mode
      RhythmMode.loadBeatMap(beatMap);

      console.log(`[Rhythm Mode UI] Loaded beat map: ${file.name}`);
      alert(`✅ Beat map loaded: ${beatMap.name || file.name}\n${beatMap.beats.length} beats`);

      // Enable controls if audio is also loaded
      updatePlayControls();
    } catch (error) {
      console.error('[Rhythm Mode UI] Error loading beat map:', error);
      alert(`❌ Error loading beat map: ${error.message}`);
    }
  });

  // Load audio (play mode)
  const loadAudioBtn = document.getElementById('rhythmLoadAudio');
  const audioFileInput = document.getElementById('rhythmAudioFile');

  loadAudioBtn.addEventListener('click', () => {
    audioFileInput.click();
  });

  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await RhythmMode.loadAudioFile(file);
      currentAudioFile = file;

      console.log(`[Rhythm Mode UI] Loaded audio: ${file.name}`);
      alert(`✅ Audio loaded: ${file.name}`);

      // Enable controls if beat map is also loaded
      updatePlayControls();
    } catch (error) {
      console.error('[Rhythm Mode UI] Error loading audio:', error);
      alert(`❌ Error loading audio: ${error.message}`);
    }
  });

  // Start/stop game
  const startBtn = document.getElementById('rhythmStart');
  const stopBtn = document.getElementById('rhythmStop');

  startBtn.addEventListener('click', () => {
    console.log('[Rhythm Mode UI] Starting rhythm mode...');
    RhythmMode.startRhythmMode(scene, camera);

    // Show stats
    document.getElementById('rhythmStats').style.display = 'block';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  });

  stopBtn.addEventListener('click', () => {
    RhythmMode.stopRhythmMode();

    // Hide stats
    document.getElementById('rhythmStats').style.display = 'none';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });

  // ========== EDITOR MODE ==========

  // Load audio (editor mode)
  const editorLoadAudioBtn = document.getElementById('editorLoadAudio');
  const editorAudioFileInput = document.getElementById('editorAudioFile');

  editorLoadAudioBtn.addEventListener('click', () => {
    editorAudioFileInput.click();
  });

  editorAudioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const audioBuffer = await RhythmMode.loadAudioFile(file);

      // Update UI
      document.getElementById('editorFileName').textContent = file.name;
      document.getElementById('editorDuration').textContent = `${audioBuffer.duration.toFixed(1)}s`;
      document.getElementById('editorAudioInfo').style.display = 'block';

      // Enable buttons
      document.getElementById('editorAutoDetect').disabled = false;
      document.getElementById('editorManualMode').disabled = false;

      console.log(`[Rhythm Mode UI] Editor: Loaded audio ${file.name}`);
    } catch (error) {
      console.error('[Rhythm Mode UI] Error loading audio in editor:', error);
      alert(`❌ Error loading audio: ${error.message}`);
    }
  });

  // Auto-detect beats
  const autoDetectBtn = document.getElementById('editorAutoDetect');

  autoDetectBtn.addEventListener('click', () => {
    console.log('[Rhythm Mode UI] Auto-detecting beats...');
    autoDetectBtn.textContent = '⏳ Analyzing...';
    autoDetectBtn.disabled = true;

    // Run beat detection (async)
    setTimeout(() => {
      try {
        const beatTimes = RhythmMode.detectBeats();
        const beatMap = RhythmMode.generateBeatMap(beatTimes);

        // Load into editor
        RhythmMode.loadBeatMap(beatMap);
        currentBeatMap = beatMap;

        // Update UI
        document.getElementById('editorBeatCountNum').textContent = beatTimes.length;
        document.getElementById('editorExport').disabled = false;

        autoDetectBtn.textContent = '🤖 Auto-Detect Beats';
        autoDetectBtn.disabled = false;

        alert(`✅ Detected ${beatTimes.length} beats!\nEstimated BPM: ${beatMap.bpm}`);
      } catch (error) {
        console.error('[Rhythm Mode UI] Error detecting beats:', error);
        alert(`❌ Error detecting beats: ${error.message}`);
        autoDetectBtn.textContent = '🤖 Auto-Detect Beats';
        autoDetectBtn.disabled = false;
      }
    }, 100);
  });

  // Manual tap mode
  const manualModeBtn = document.getElementById('editorManualMode');

  manualModeBtn.addEventListener('click', () => {
    if (!isManualTapMode) {
      // Start manual tap mode
      isManualTapMode = true;
      manualModeBtn.textContent = '⏹ Stop Tapping';
      manualModeBtn.style.background = '#cc0000';
      manualModeBtn.style.borderColor = '#ff3333';
      manualModeBtn.style.color = '#fff';

      // Start audio playback
      RhythmMode.playAudio();

      alert('🎵 Manual tap mode started!\n\nPress SPACE on each beat.\nClick "Stop Tapping" when done.');
    } else {
      // Stop manual tap mode
      isManualTapMode = false;
      manualModeBtn.textContent = '👆 Manual Tap Mode';
      manualModeBtn.style.background = '#15171d';
      manualModeBtn.style.borderColor = '#4c8dff';
      manualModeBtn.style.color = '#4c8dff';

      // Stop audio
      RhythmMode.stopAudio();

      // Get beat map
      const beatMap = RhythmMode.getEditorBeatMap();
      currentBeatMap = beatMap;

      // Update UI
      document.getElementById('editorBeatCountNum').textContent = beatMap.beats.length;
      document.getElementById('editorExport').disabled = false;

      alert(`✅ Recorded ${beatMap.beats.length} beats!\nEstimated BPM: ${beatMap.bpm}`);
    }
  });

  // Listen for spacebar in manual tap mode
  document.addEventListener('keydown', (e) => {
    if (isManualTapMode && e.code === 'Space') {
      e.preventDefault();
      RhythmMode.recordBeatTap('center'); // Default to center lane

      // Update count
      const beatMap = RhythmMode.getEditorBeatMap();
      document.getElementById('editorBeatCountNum').textContent = beatMap.beats.length;
    }
  });

  // Export beat map
  const exportBtn = document.getElementById('editorExport');

  exportBtn.addEventListener('click', () => {
    const beatMapName = document.getElementById('editorBeatMapName').value || 'Unnamed Song';

    // Update beat map name
    if (currentBeatMap) {
      currentBeatMap.name = beatMapName;
    }

    const json = RhythmMode.exportBeatMap();

    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${beatMapName.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[Rhythm Mode UI] Exported beat map:', beatMapName);
    alert(`✅ Beat map exported: ${beatMapName}.json`);
  });

  // Clear beats
  const clearBtn = document.getElementById('editorClear');

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all recorded beats?')) {
      RhythmMode.enterEditorMode(); // Reset editor
      document.getElementById('editorBeatCountNum').textContent = '0';
      document.getElementById('editorExport').disabled = true;
      console.log('[Rhythm Mode UI] Cleared beats');
    }
  });

  console.log('[Rhythm Mode UI] Initialized successfully');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function updateBeatMapSelect() {
  const select = document.getElementById('rhythmSongSelect');
  select.innerHTML = '';

  if (Object.keys(beatMapStorage).length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '-- No beat maps loaded --';
    select.appendChild(option);
  } else {
    for (const [filename, beatMap] of Object.entries(beatMapStorage)) {
      const option = document.createElement('option');
      option.value = filename;
      option.textContent = `${beatMap.name || filename} (${beatMap.beats.length} beats)`;
      select.appendChild(option);
    }
  }
}

function updatePlayControls() {
  const startBtn = document.getElementById('rhythmStart');

  // Enable start if both beat map and audio are loaded
  if (currentBeatMap && currentAudioFile) {
    startBtn.disabled = false;
  }
}

// ============================================================================
// UPDATE LOOP (called from main.js)
// ============================================================================

export function updateRhythmModeUI() {
  // Update stats if rhythm mode is active
  if (RhythmMode.getRhythmModeActive()) {
    document.getElementById('rhythmScoreDisplay').textContent = RhythmMode.getRhythmModeScore();
    document.getElementById('rhythmComboDisplay').textContent = `${RhythmMode.getRhythmModeCombo()}x`;
    // TODO: Add perfect/good/miss getters to rhythmMode.js
  }
}

export default {
  initRhythmModeUI,
  updateRhythmModeUI
};

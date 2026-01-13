/**
 * rhythmModeUI.js
 * UI event handlers for Rhythm Mode
 */

import * as RhythmMode from './rhythmMode.js';
import { SONG_LIBRARY } from './rhythmMode.js';
import * as BeatEditor from './beatEditor.js';
import * as RingPositionEditor from './ringPositionEditor.js';
import * as Input from './input.js';
import * as RingMode from './ringMode.js';

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

// Editor playback state
let isEditorPlaying = false;
let editorPlayPauseBtn = null;

// UI Manager instance (to control chrome state) - injected from main.js
let uiManager = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initRhythmModeUI(sceneRef, cameraRef, uiManagerRef) {
  scene = sceneRef;
  camera = cameraRef;
  uiManager = uiManagerRef;

  // Initialize beat editor canvas
  const beatEditorCanvas = document.getElementById('beatEditorCanvas');
  if (beatEditorCanvas) {
    BeatEditor.init(beatEditorCanvas);
  }

  // Initialize ring position editor canvas
  const ringPositionCanvas = document.getElementById('ringPositionCanvas');
  if (ringPositionCanvas) {
    RingPositionEditor.init(ringPositionCanvas);
  }

  // Try to restore last loaded beat map and audio from localStorage
  restoreLastSession();

  // Modal open/close
  const rhythmModeBtn = document.getElementById('rhythmMode');
  const rhythmModeModal = document.getElementById('rhythmModeModal');
  const rhythmModeClose = document.getElementById('rhythmModeClose');

  rhythmModeBtn.addEventListener('click', () => {
    rhythmModeModal.style.display = 'block';
  });

  rhythmModeClose.addEventListener('click', () => {
    rhythmModeModal.style.display = 'none';
    // Stop rhythm mode (hides boost, stops audio, clears state)
    RhythmMode.stopRhythmMode();
  });

  // Track active tab
  let activeTab = 'play';

  // Close on backdrop click (only in play mode to prevent accidental editor loss)
  rhythmModeModal.addEventListener('click', (e) => {
    if (e.target === rhythmModeModal && activeTab === 'play') {
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
    activeTab = tab; // Track which tab is active

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

  // Song selection dropdown
  const songSelect = document.getElementById('rhythmSongSelect');
  if (!songSelect) {
    console.error('[Rhythm Mode UI] rhythmSongSelect element not found!');
    return;
  }


  songSelect.addEventListener('change', async (e) => {
    const value = e.target.value;

    if (!value) {
      return;
    }


    // Check if it's a library song or manual beat map
    if (value.startsWith('library:')) {
      const songId = value.replace('library:', '');

      try {
        const success = await RhythmMode.loadSongFromLibrary(songId);
        if (success) {
          currentBeatMap = true; // Mark as loaded
          currentAudioFile = true; // Mark as loaded
          updatePlayControls();
          alert(`✅ Song loaded from library! Click "Start Game" to play.`);
        } else {
          console.error('[Rhythm Mode UI] loadSongFromLibrary returned false');
          alert(`❌ Failed to load song from library. Check console for details.`);
        }
      } catch (error) {
        console.error('[Rhythm Mode UI] Error loading song:', error);
        alert(`❌ Error loading song: ${error.message}`);
      }
    } else if (value.startsWith('manual:')) {
      const filename = value.replace('manual:', '');
      const beatMap = beatMapStorage[filename];
      if (beatMap) {
        RhythmMode.loadBeatMap(beatMap);
        currentBeatMap = beatMap;
        updatePlayControls();
      }
    }
  });

  // Populate the dropdown initially
  updateBeatMapSelect();

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

      // Save to localStorage for next session
      saveSessionToLocalStorage();

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
    RhythmMode.startRhythmMode(scene, camera);

    // Close the rhythm mode modal
    rhythmModeModal.style.display = 'none';

    // Close the main menu overlay
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
      menuOverlay.style.display = 'none';
    }
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
      menuBtn.classList.remove('active');
    }

    // Tell BOTH input systems that chrome is hidden (activates input)

    // Set Input's chromeShown to false (enables input handling)
    Input.setChromeShown(false);

    // Close menu using uiManager (this sets uiManager's chromeShown to false, which enables physics)
    uiManager.closeMenu();


    // Show stats and boost prompt
    document.getElementById('rhythmStats').style.display = 'block';
    document.getElementById('rhythmBoostToStart').style.display = 'block';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  });

  stopBtn.addEventListener('click', () => {
    RhythmMode.stopRhythmMode();

    // Hide stats and boost prompt
    document.getElementById('rhythmStats').style.display = 'none';
    document.getElementById('rhythmBoostToStart').style.display = 'none';
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

      // Disable buttons while loading
      document.getElementById('editorAutoDetect').disabled = true;
      document.getElementById('editorPlayPause').disabled = true;
      document.getElementById('editorAddBeatAtPlayhead').disabled = true;
      document.getElementById('editorResetToStart').disabled = true;
      document.getElementById('editorPlayPause').textContent = '⏳ Loading...';

      // Load into beat editor for visualization
      BeatEditor.loadAudio(audioBuffer, () => {
        // Called when waveform is ready
        // Double-check that waveform is actually ready before enabling controls
        const checkWaveformReady = () => {
          if (BeatEditor.isWaveformReady()) {
            document.getElementById('editorAutoDetect').disabled = false;
            document.getElementById('editorPlayPause').disabled = false;
            document.getElementById('editorAddBeatAtPlayhead').disabled = false;
            document.getElementById('editorResetToStart').disabled = false;
            document.getElementById('editorPlayPause').textContent = '▶ Play';
          } else {
            console.warn(`[Rhythm Mode UI] Editor: Waveform not ready yet, retrying...`);
            setTimeout(checkWaveformReady, 100); // Retry after 100ms
          }
        };

        // Small delay to ensure waveform is rendered, then verify
        setTimeout(checkWaveformReady, 50);
      });

    } catch (error) {
      console.error('[Rhythm Mode UI] Error loading audio in editor:', error);
      alert(`❌ Error loading audio: ${error.message}`);
    }
  });

  // Load existing beat map
  const editorLoadBeatMapBtn = document.getElementById('editorLoadBeatMap');
  const beatMapFileLoadInput = document.getElementById('editorBeatMapFileLoad');

  editorLoadBeatMapBtn.addEventListener('click', () => {
    beatMapFileLoadInput.click();
  });

  beatMapFileLoadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const beatMap = JSON.parse(text);

      // Validate beat map structure
      if (!beatMap.beats || !Array.isArray(beatMap.beats)) {
        throw new Error('Invalid beat map format');
      }

      // Extract beat times and positions
      const beatTimes = beatMap.beats.map(b => b.time);
      const beatPositions = beatMap.beats.map(b => ({
        time: b.time,
        x: b.x || 0,
        y: b.y || 0
      }));

      // Load into beat editor
      BeatEditor.setBeats(beatTimes);

      // Load into ring position editor
      RingPositionEditor.loadBeatPositions(beatPositions);

      // Update UI
      document.getElementById('editorLoadedBeatMapName').textContent = beatMap.name || file.name;
      document.getElementById('editorLoadedBeatCount').textContent = beatMap.beats.length;
      document.getElementById('editorLoadedBeatMapInfo').style.display = 'block';
      document.getElementById('editorBeatCountNum').textContent = beatMap.beats.length;
      document.getElementById('editorExport').disabled = false;

      // Enable Ring Positions tab
      document.getElementById('editorTabPositions').disabled = false;

      currentBeatMap = beatMap;

      alert(`✅ Loaded beat map with ${beatMap.beats.length} beats!`);
    } catch (error) {
      console.error('[Rhythm Mode UI] Error loading beat map:', error);
      alert(`❌ Error loading beat map: ${error.message}`);
    }

    // Reset file input
    e.target.value = '';
  });

  // Auto-detect beats
  const autoDetectBtn = document.getElementById('editorAutoDetect');

  autoDetectBtn.addEventListener('click', () => {
    autoDetectBtn.textContent = '⏳ Analyzing...';
    autoDetectBtn.disabled = true;

    // Run beat detection (async)
    setTimeout(() => {
      try {
        const beatTimes = RhythmMode.detectBeats();

        // Load beats into visual editor
        BeatEditor.setBeats(beatTimes);

        // Load beat positions (all at center by default)
        RingPositionEditor.loadBeats(beatTimes);

        // Enable Ring Positions tab
        document.getElementById('editorTabPositions').disabled = false;

        // Update UI
        document.getElementById('editorBeatCountNum').textContent = beatTimes.length;
        document.getElementById('editorExport').disabled = false;

        autoDetectBtn.textContent = '🤖 Auto-Detect Beats';
        autoDetectBtn.disabled = false;

        // Calculate estimated BPM for display
        let estimatedBPM = 120;
        if (beatTimes.length > 1) {
          const intervals = [];
          for (let i = 1; i < beatTimes.length; i++) {
            intervals.push(beatTimes[i] - beatTimes[i - 1]);
          }
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          estimatedBPM = Math.round(60 / avgInterval);
        }

        alert(`✅ Detected ${beatTimes.length} beats!\nEstimated BPM: ${estimatedBPM}`);
      } catch (error) {
        console.error('[Rhythm Mode UI] Error detecting beats:', error);
        alert(`❌ Error detecting beats: ${error.message}`);
        autoDetectBtn.textContent = '🤖 Auto-Detect Beats';
        autoDetectBtn.disabled = false;
      }
    }, 100);
  });

  // Play/Pause button
  editorPlayPauseBtn = document.getElementById('editorPlayPause');

  editorPlayPauseBtn.addEventListener('click', () => {
    if (!isEditorPlaying) {
      // Start playback
      RhythmMode.playAudio();
      BeatEditor.setPlaying(true);
      editorPlayPauseBtn.textContent = '⏸ Pause';
      editorPlayPauseBtn.style.background = '#cc0000';
      editorPlayPauseBtn.style.borderColor = '#ff3333';
      editorPlayPauseBtn.style.color = '#fff';
      isEditorPlaying = true;
    } else {
      // Pause playback (keeps position)
      const currentTime = RhythmMode.getAudioTime();
      RhythmMode.pauseAudio();
      BeatEditor.setPlaying(false);
      BeatEditor.setPlayheadTime(currentTime); // Update playhead to current position
      editorPlayPauseBtn.textContent = '▶ Play';
      editorPlayPauseBtn.style.background = '#15171d';
      editorPlayPauseBtn.style.borderColor = '#4c8dff';
      editorPlayPauseBtn.style.color = '#4c8dff';
      isEditorPlaying = false;
    }
  });

  // Add Beat at Playhead button
  const addBeatAtPlayheadBtn = document.getElementById('editorAddBeatAtPlayhead');
  addBeatAtPlayheadBtn.addEventListener('click', () => {
    const playheadTime = BeatEditor.getPlayheadTime();
    BeatEditor.addBeat(playheadTime);

    const beatCount = BeatEditor.getBeats().length;
    document.getElementById('editorBeatCountNum').textContent = beatCount;
    document.getElementById('editorExport').disabled = beatCount === 0;

  });

  // Reset to Start button
  const resetToStartBtn = document.getElementById('editorResetToStart');
  resetToStartBtn.addEventListener('click', () => {
    // Pause if playing
    if (isEditorPlaying) {
      RhythmMode.pauseAudio();
      BeatEditor.setPlaying(false);
      editorPlayPauseBtn.textContent = '▶ Play';
      editorPlayPauseBtn.style.background = '#15171d';
      editorPlayPauseBtn.style.borderColor = '#4c8dff';
      editorPlayPauseBtn.style.color = '#4c8dff';
      isEditorPlaying = false;
    }

    // Reset to beginning
    RhythmMode.setAudioPauseTime(0);
    BeatEditor.setPlayheadTime(0);

  });

  // Zoom controls
  const zoomSlider = document.getElementById('editorZoomSlider');
  const zoomInBtn = document.getElementById('editorZoomIn');
  const zoomOutBtn = document.getElementById('editorZoomOut');
  const zoomLabel = document.getElementById('editorZoomLabel');

  zoomSlider.addEventListener('input', (e) => {
    const zoom = parseFloat(e.target.value);
    BeatEditor.setZoom(zoom);
    zoomLabel.textContent = `${(zoom * 100).toFixed(0)}%`;
  });

  zoomInBtn.addEventListener('click', () => {
    const currentZoom = BeatEditor.getZoom();
    const newZoom = Math.min(10.0, currentZoom + 0.5);
    zoomSlider.value = newZoom;
    BeatEditor.setZoom(newZoom);
    zoomLabel.textContent = `${(newZoom * 100).toFixed(0)}%`;
  });

  zoomOutBtn.addEventListener('click', () => {
    const currentZoom = BeatEditor.getZoom();
    const newZoom = Math.max(0.5, currentZoom - 0.5);
    zoomSlider.value = newZoom;
    BeatEditor.setZoom(newZoom);
    zoomLabel.textContent = `${(newZoom * 100).toFixed(0)}%`;
  });

  // Playback speed controls
  const speedSlider = document.getElementById('editorSpeedSlider');
  const speedUpBtn = document.getElementById('editorSpeedUp');
  const speedDownBtn = document.getElementById('editorSpeedDown');
  const speedLabel = document.getElementById('editorSpeedLabel');

  speedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    RhythmMode.setPlaybackRate(speed);
    speedLabel.textContent = `${speed.toFixed(2)}x`;
  });

  speedUpBtn.addEventListener('click', () => {
    const currentSpeed = parseFloat(speedSlider.value);
    const newSpeed = Math.min(2.0, currentSpeed + 0.25);
    speedSlider.value = newSpeed;
    RhythmMode.setPlaybackRate(newSpeed);
    speedLabel.textContent = `${newSpeed.toFixed(2)}x`;
  });

  speedDownBtn.addEventListener('click', () => {
    const currentSpeed = parseFloat(speedSlider.value);
    const newSpeed = Math.max(0.25, currentSpeed - 0.25);
    speedSlider.value = newSpeed;
    RhythmMode.setPlaybackRate(newSpeed);
    speedLabel.textContent = `${newSpeed.toFixed(2)}x`;
  });

  // Manual tap mode (optional - removed from UI, but keep for backwards compatibility)
  const manualModeBtn = document.getElementById('editorManualMode');

  if (manualModeBtn) {
    manualModeBtn.addEventListener('click', () => {
    if (!isManualTapMode) {
      // Start manual tap mode
      isManualTapMode = true;
      manualModeBtn.textContent = '⏹ Stop Tapping';
      manualModeBtn.style.background = '#cc0000';
      manualModeBtn.style.borderColor = '#ff3333';
      manualModeBtn.style.color = '#fff';

      // Clear any existing beats and reset editor
      RhythmMode.enterEditorMode(); // This clears all beats
      document.getElementById('editorBeatCountNum').textContent = '0';

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
  }

  // Update beat count from visual editor
  setInterval(() => {
    if (RhythmMode.getEditorMode()) {
      const beatCount = BeatEditor.getBeats().length;
      const currentDisplayCount = parseInt(document.getElementById('editorBeatCountNum').textContent) || 0;

      if (beatCount !== currentDisplayCount) {
        document.getElementById('editorBeatCountNum').textContent = beatCount;
        document.getElementById('editorExport').disabled = beatCount === 0;
      }
    }
  }, 200);

  // Export beat map
  const exportBtn = document.getElementById('editorExport');

  exportBtn.addEventListener('click', () => {
    const beatMapName = document.getElementById('editorBeatMapName').value || 'Unnamed Song';

    // Get beats from visual editor
    const beatTimes = BeatEditor.getBeats();

    // Get ring positions from position editor
    const beatPositions = RingPositionEditor.getBeatPositions();

    // Build beat map with positions (not random lanes)
    const beats = beatTimes.map((time) => {
      // Find matching position data by time
      const posData = beatPositions.find(b => Math.abs(b.time - time) < 0.01);

      return {
        time: time,
        x: posData ? posData.x : 0,
        y: posData ? posData.y : 0,
        lane: 'center', // Deprecated - using x/y instead
        hit: false
      };
    });

    // Calculate estimated BPM
    let estimatedBPM = 120;
    if (beatTimes.length > 1) {
      const intervals = [];
      for (let i = 1; i < beatTimes.length; i++) {
        intervals.push(beatTimes[i] - beatTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      estimatedBPM = Math.round(60 / avgInterval);
    }

    const beatMap = {
      name: beatMapName,
      bpm: estimatedBPM,
      beats: beats
    };

    // Update currentBeatMap
    currentBeatMap = beatMap;

    const json = JSON.stringify(beatMap, null, 2);

    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${beatMapName.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`✅ Beat map exported: ${beatMapName}.json\n${beatTimes.length} beats with custom positions`);
  });

  // Clear beats
  const clearBtn = document.getElementById('editorClear');

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all recorded beats?')) {
      BeatEditor.clearBeats();
      document.getElementById('editorBeatCountNum').textContent = '0';
      document.getElementById('editorExport').disabled = true;
    }
  });

  // Editor Mode Tabs
  const tabTiming = document.getElementById('editorTabTiming');
  const tabPositions = document.getElementById('editorTabPositions');
  const viewTiming = document.getElementById('editorTimingView');
  const viewPositions = document.getElementById('editorPositionsView');

  tabTiming.addEventListener('click', () => {
    // Switch to timing view
    tabTiming.style.background = '#4c8dff';
    tabTiming.style.borderColor = '#4c8dff';
    tabTiming.style.color = '#fff';
    tabPositions.style.background = '#15171d';
    tabPositions.style.borderColor = '#3a3d45';
    tabPositions.style.color = '#888';

    viewTiming.style.display = 'block';
    viewPositions.style.display = 'none';

  });

  tabPositions.addEventListener('click', () => {
    // Switch to positions view
    tabPositions.style.background = '#4c8dff';
    tabPositions.style.borderColor = '#4c8dff';
    tabPositions.style.color = '#fff';
    tabTiming.style.background = '#15171d';
    tabTiming.style.borderColor = '#3a3d45';
    tabTiming.style.color = '#888';

    viewTiming.style.display = 'none';
    viewPositions.style.display = 'block';

    // Load beats into position editor (only if not already loaded or beats changed)
    const beatTimes = BeatEditor.getBeats();
    const currentPositions = RingPositionEditor.getBeatPositions();

    if (beatTimes.length > 0) {
      // Only reload if beat count changed (new beats added/removed)
      if (currentPositions.length !== beatTimes.length) {
        RingPositionEditor.loadBeats(beatTimes);
      }
      updatePositionBeatInfo();
    }

    // Force canvas to resize and render after becoming visible
    setTimeout(() => {
      RingPositionEditor.forceRender();
    }, 10);

  });

  // Enable positions tab when beats exist
  setInterval(() => {
    const beatCount = BeatEditor.getBeats().length;
    tabPositions.disabled = beatCount === 0;
    if (beatCount > 0) {
      tabPositions.style.cursor = 'pointer';
      tabPositions.style.color = '#e8e8ea';
    } else {
      tabPositions.style.cursor = 'not-allowed';
      tabPositions.style.color = '#888';
    }
  }, 200);

  // Ring Position Editor Controls
  const prevBeatBtn = document.getElementById('positionPrevBeat');
  const nextBeatBtn = document.getElementById('positionNextBeat');
  const snapGridCheckbox = document.getElementById('positionSnapGrid');

  prevBeatBtn.addEventListener('click', () => {
    RingPositionEditor.previousBeat();
    updatePositionBeatInfo();
  });

  nextBeatBtn.addEventListener('click', () => {
    RingPositionEditor.nextBeat();
    updatePositionBeatInfo();
  });

  snapGridCheckbox.addEventListener('change', (e) => {
    RingPositionEditor.setSnapToGrid(e.target.checked);
  });

  // Auto-generate positions
  const autoGenerateBtn = document.getElementById('positionAutoGenerate');
  const patternSelect = document.getElementById('positionPatternType');
  if (autoGenerateBtn && patternSelect) {
    autoGenerateBtn.addEventListener('click', () => {
      const difficulty = patternSelect.value; // Now selects difficulty level (normal/hard/expert)
      RingPositionEditor.autoGeneratePositions(difficulty, currentBeatMap);
      updatePositionBeatInfo();
    });
  }

  // Play Preview button
  const playPreviewBtn = document.getElementById('positionPlayPreview');
  if (playPreviewBtn) {
    playPreviewBtn.addEventListener('click', () => {
      const isPlaying = RingPositionEditor.isPreviewActive();

      if (isPlaying) {
        // Stop preview
        RingPositionEditor.stopPreview();
        RhythmMode.stopAudio(); // Reset audio to beginning
        playPreviewBtn.textContent = '▶ Play Preview';
        playPreviewBtn.style.background = '#00cc44';
        playPreviewBtn.style.borderColor = '#00ff55';

        // Re-enable navigation controls
        prevBeatBtn.disabled = false;
        nextBeatBtn.disabled = false;

      } else {
        // Start preview
        RhythmMode.stopAudio(); // Reset to beginning first
        RhythmMode.setPlaybackRate(1.0); // Force 1.0x speed for preview
        RingPositionEditor.startPreview();
        RhythmMode.playAudio();
        playPreviewBtn.textContent = '⏸ Stop Preview';
        playPreviewBtn.style.background = '#ff3333';
        playPreviewBtn.style.borderColor = '#ff6666';

        // Disable navigation during preview
        prevBeatBtn.disabled = true;
        nextBeatBtn.disabled = true;

      }
    });
  }

  function updatePositionBeatInfo() {
    const currentIndex = RingPositionEditor.getCurrentBeatIndex();
    const totalBeats = RingPositionEditor.getTotalBeats();
    const beatInfo = document.getElementById('positionBeatInfo');
    beatInfo.textContent = `Beat ${currentIndex + 1}/${totalBeats}`;
  }

}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function restoreLastSession() {
  try {
    // Restore beat map from localStorage
    const savedBeatMap = localStorage.getItem('rhythmMode_lastBeatMap');
    if (savedBeatMap) {
      const beatMap = JSON.parse(savedBeatMap);
      currentBeatMap = beatMap;
      RhythmMode.loadBeatMap(beatMap);
      beatMapStorage['last_session.json'] = beatMap;
    }

    // Note: We can't restore the audio file from localStorage (too large)
    // User will need to load it again
  } catch (error) {
    console.error('[Rhythm Mode UI] Error restoring last session:', error);
  }
}

function saveSessionToLocalStorage() {
  try {
    if (currentBeatMap) {
      localStorage.setItem('rhythmMode_lastBeatMap', JSON.stringify(currentBeatMap));
    }
  } catch (error) {
    console.error('[Rhythm Mode UI] Error saving to localStorage:', error);
  }
}

function updateBeatMapSelect() {
  const select = document.getElementById('rhythmSongSelect');
  select.innerHTML = '';

  // Add default placeholder option
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select a song --';
  placeholder.selected = true;
  select.appendChild(placeholder);

  // Add library songs first
  if (SONG_LIBRARY && SONG_LIBRARY.length > 0) {
    const libraryGroup = document.createElement('optgroup');
    libraryGroup.label = '📚 Song Library';

    for (const song of SONG_LIBRARY) {
      const option = document.createElement('option');
      option.value = `library:${song.id}`;
      option.textContent = song.artist ? `${song.name} - ${song.artist}` : song.name;
      libraryGroup.appendChild(option);
    }

    select.appendChild(libraryGroup);
  }

  // Add manually loaded beat maps
  if (Object.keys(beatMapStorage).length > 0) {
    const manualGroup = document.createElement('optgroup');
    manualGroup.label = '📁 Loaded Beat Maps';

    for (const [filename, beatMap] of Object.entries(beatMapStorage)) {
      const option = document.createElement('option');
      option.value = `manual:${filename}`;
      option.textContent = `${beatMap.name || filename} (${beatMap.beats.length} beats)`;
      manualGroup.appendChild(option);
    }

    select.appendChild(manualGroup);
  }

  // If nothing is available
  if ((!SONG_LIBRARY || SONG_LIBRARY.length === 0) && Object.keys(beatMapStorage).length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '-- No songs available --';
    select.appendChild(option);
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
    document.getElementById('rhythmPerfectDisplay').textContent = RhythmMode.getRhythmModePerfectHits();
    document.getElementById('rhythmGoodDisplay').textContent = RhythmMode.getRhythmModeGoodHits();
    document.getElementById('rhythmMissDisplay').textContent = RhythmMode.getRhythmModeMisses();
    // Hide "Boost to Start" message once player has boosted
    const boostPrompt = document.getElementById('rhythmBoostToStart');
    if (RingMode.getRingModeStarted()) {
      if (boostPrompt) {
        boostPrompt.style.display = 'none';
      }
    }
  }

  // Update beat editor playhead when in editor mode
  if (RhythmMode.getEditorMode()) {
    const currentTime = RhythmMode.getAudioTime();
    const duration = RhythmMode.getAudioDuration();

    // Check if song has ended
    if (isEditorPlaying && duration > 0 && currentTime >= duration) {
      // Stop playback and reset button
      RhythmMode.pauseAudio();
      BeatEditor.setPlaying(false);
      BeatEditor.setPlayheadTime(duration); // Set to end
      if (editorPlayPauseBtn) {
        editorPlayPauseBtn.textContent = '▶ Play';
        editorPlayPauseBtn.style.background = '#15171d';
        editorPlayPauseBtn.style.borderColor = '#4c8dff';
        editorPlayPauseBtn.style.color = '#4c8dff';
      }
      isEditorPlaying = false;
    } else {
      BeatEditor.setPlayheadTime(currentTime);
    }
  }
}

export default {
  initRhythmModeUI,
  updateRhythmModeUI
};

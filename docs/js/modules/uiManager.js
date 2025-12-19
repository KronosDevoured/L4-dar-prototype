/**
 * uiManager.js
 * UI and menu management for L4 DAR prototype
 * Handles menu opening/closing, collapsible cards, editable tags, and settings sliders
 */

// ============================================================================
// UI MANAGER CLASS
// ============================================================================

export class UIManager {
  constructor() {
    this.chromeShown = false;
    this.cardsInitialized = false;

    // Color scheme for directional inputs
    this.COLS = {
      UP: '#ff5c5c',
      RIGHT: '#4c8dff',
      DOWN: '#53d769',
      LEFT: '#ffd166'
    };
  }

  /**
   * Initialize collapsible card functionality
   */
  initCollapsibleCards() {
    // Only initialize once to avoid duplicate event listeners
    if (this.cardsInitialized) return;
    this.cardsInitialized = true;

    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
      const h3 = card.querySelector('h3');
      if (!h3) return;

      // Wrap all content after h3 in a card-content div
      if (!card.querySelector('.card-content')) {
        const content = document.createElement('div');
        content.className = 'card-content';

        // Move all children after h3 into content div
        const children = Array.from(card.children);
        children.forEach(child => {
          if (child !== h3) {
            content.appendChild(child);
          }
        });
        card.appendChild(content);

        // Collapse all cards except the first one (Rotation)
        const isRotationCard = h3.textContent.trim() === 'Rotation';
        if (!isRotationCard) {
          card.classList.add('collapsed');
          content.style.maxHeight = '0';
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      }

      // Add click handler to h3
      h3.addEventListener('click', (e) => {
        e.stopPropagation();
        const content = card.querySelector('.card-content');
        const isCollapsed = card.classList.contains('collapsed');

        if (isCollapsed) {
          card.classList.remove('collapsed');
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          card.classList.add('collapsed');
          content.style.maxHeight = '0';
        }
      });
    });
  }

  /**
   * Open the settings menu
   * @param {Function} onOpen - Callback to execute after menu opens (for Input module initialization)
   */
  openMenu(onOpen) {
    this.chromeShown = true;
    const menuBtn = document.getElementById('menuBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    menuBtn.classList.add('active');
    menuOverlay.style.display = 'block';

    // Initialize collapsible cards on first open
    this.initCollapsibleCards();

    // Execute callback after DOM is visible
    if (onOpen) {
      setTimeout(onOpen, 10);
    }
  }

  /**
   * Close the settings menu
   * @param {Function} onClose - Callback to execute when menu closes (for Input module cleanup)
   */
  closeMenu(onClose) {
    this.chromeShown = false;
    if (onClose) {
      onClose();
    }
    const menuBtn = document.getElementById('menuBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    menuBtn.classList.remove('active');
    menuOverlay.style.display = 'none';
  }

  /**
   * Sync all tag displays with current values
   * @param {Object} settings - Current settings values
   * @param {Object} getters - Functions to get dynamic values
   */
  syncTags(settings, getters) {
    const accelPitchTag = document.getElementById('accelPitchTag');
    const accelYawTag = document.getElementById('accelYawTag');
    const accelRollTag = document.getElementById('accelRollTag');
    const curveTag = document.getElementById('curveTag');
    const stickRangeTag = document.getElementById('stickRangeTag');
    const dampTag = document.getElementById('dampTag');
    const dampDARTag = document.getElementById('dampDARTag');
    const brakeTag = document.getElementById('brakeTag');
    const wmaxTag = document.getElementById('wmaxTag');
    const wmaxPitchTag = document.getElementById('wmaxPitchTag');
    const wmaxYawTag = document.getElementById('wmaxYawTag');
    const wmaxRollTag = document.getElementById('wmaxRollTag');
    const stickVal = document.getElementById('stickVal');
    const zoomVal = document.getElementById('zoomVal');
    const arrowVal = document.getElementById('arrowVal');

    accelPitchTag.textContent = settings.maxAccelPitch.toFixed(0);
    accelYawTag.textContent = settings.maxAccelYaw.toFixed(0);
    accelRollTag.textContent = settings.maxAccelRoll.toFixed(0);
    curveTag.textContent = settings.inputPow.toFixed(2);
    stickRangeTag.textContent = settings.stickRange.toFixed(2);
    dampTag.textContent = settings.damp.toFixed(2);
    dampDARTag.textContent = settings.dampDAR.toFixed(2);
    brakeTag.textContent = settings.brakeOnRelease.toFixed(1);
    wmaxTag.textContent = settings.wMax.toFixed(1);
    wmaxPitchTag.textContent = settings.wMaxPitch.toFixed(1);
    wmaxYawTag.textContent = settings.wMaxYaw.toFixed(1);
    wmaxRollTag.textContent = settings.wMaxRoll.toFixed(1);
    stickVal.textContent = String(Math.round(getters.getJoyBaseR()));
    zoomVal.textContent = `${(settings.zoom || 1).toFixed(2)}×`;
    arrowVal.textContent = `${(settings.arrowScale || 1).toFixed(2)}×`;
  }

  /**
   * Setup editable tag functionality (click to edit values)
   * @param {Object} settings - Settings object reference
   * @param {Function} applyZoom - Callback to apply zoom changes
   * @param {Function} applyTheme - Callback to apply theme changes
   * @param {Function} syncTags - Callback to sync all tag displays
   * @param {Function} saveSettings - Callback to save settings
   */
  setupEditableTags(settings, applyZoom, applyTheme, syncTags, saveSettings) {
    const accelPitch = document.getElementById('accelPitch');
    const accelYaw = document.getElementById('accelYaw');
    const accelRoll = document.getElementById('accelRoll');
    const curveRange = document.getElementById('curveRange');
    const stickRangeSlider = document.getElementById('stickRangeSlider');
    const dampRange = document.getElementById('dampRange');
    const dampDARRange = document.getElementById('dampDARRange');
    const brakeRange = document.getElementById('brakeRange');
    const wmaxRange = document.getElementById('wmaxRange');
    const wmaxPitchRange = document.getElementById('wmaxPitch');
    const wmaxYawRange = document.getElementById('wmaxYaw');
    const wmaxRollRange = document.getElementById('wmaxRoll');
    const zoomSlider = document.getElementById('zoomSlider');
    const arrowSlider = document.getElementById('arrowSlider');

    const accelPitchTag = document.getElementById('accelPitchTag');
    const accelYawTag = document.getElementById('accelYawTag');
    const accelRollTag = document.getElementById('accelRollTag');
    const curveTag = document.getElementById('curveTag');
    const stickRangeTag = document.getElementById('stickRangeTag');
    const dampTag = document.getElementById('dampTag');
    const dampDARTag = document.getElementById('dampDARTag');
    const brakeTag = document.getElementById('brakeTag');
    const wmaxTag = document.getElementById('wmaxTag');
    const wmaxPitchTag = document.getElementById('wmaxPitchTag');
    const wmaxYawTag = document.getElementById('wmaxYawTag');
    const wmaxRollTag = document.getElementById('wmaxRollTag');
    const zoomVal = document.getElementById('zoomVal');
    const arrowVal = document.getElementById('arrowVal');

    const tagMappings = [
      {tag: accelPitchTag, slider: accelPitch, setter: (v) => settings.maxAccelPitch = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
      {tag: accelYawTag, slider: accelYaw, setter: (v) => settings.maxAccelYaw = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
      {tag: accelRollTag, slider: accelRoll, setter: (v) => settings.maxAccelRoll = Math.max(0, Math.min(1200, parseFloat(v) || 400))},
      {tag: curveTag, slider: curveRange, setter: (v) => settings.inputPow = Math.max(0.01, Math.min(4, parseFloat(v) || 1.0))},
      {tag: stickRangeTag, slider: stickRangeSlider, setter: (v) => settings.stickRange = Math.max(0.01, Math.min(1.0, parseFloat(v) || 1.0))},
      {tag: dampTag, slider: dampRange, setter: (v) => settings.damp = Math.max(0, Math.min(6, parseFloat(v) || 2.96))},
      {tag: dampDARTag, slider: dampDARRange, setter: (v) => settings.dampDAR = Math.max(0, Math.min(6, parseFloat(v) || 4.35))},
      {tag: brakeTag, slider: brakeRange, setter: (v) => settings.brakeOnRelease = Math.max(0, Math.min(6, parseFloat(v) || 0))},
      {tag: wmaxTag, slider: wmaxRange, setter: (v) => settings.wMax = Math.max(6, Math.min(24, parseFloat(v) || 6))},
      {tag: wmaxPitchTag, slider: wmaxPitchRange, setter: (v) => settings.wMaxPitch = Math.max(6, Math.min(24, parseFloat(v) || 8.5))},
      {tag: wmaxYawTag, slider: wmaxYawRange, setter: (v) => settings.wMaxYaw = Math.max(6, Math.min(24, parseFloat(v) || 9))},
      {tag: wmaxRollTag, slider: wmaxRollRange, setter: (v) => settings.wMaxRoll = Math.max(4, Math.min(24, parseFloat(v) || 6))},
      {tag: zoomVal, slider: zoomSlider, setter: (v) => { settings.zoom = Math.max(0.2, Math.min(4.0, parseFloat(v) || 1)); applyZoom(); }},
      {tag: arrowVal, slider: arrowSlider, setter: (v) => settings.arrowScale = Math.max(0.6, Math.min(4, parseFloat(v) || 4))}
    ];

    tagMappings.forEach(mapping => {
      mapping.tag.contentEditable = true;
      mapping.tag.style.cursor = 'text';

      mapping.tag.addEventListener('click', (e) => {
        e.target.select?.() || document.execCommand('selectAll', false, null);
      });

      mapping.tag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });

      mapping.tag.addEventListener('blur', (e) => {
        const rawValue = e.target.textContent.replace(/[^\d.-]/g, '');
        mapping.setter(rawValue);
        mapping.slider.value = parseFloat(rawValue) || 0;
        syncTags();
        saveSettings();
      });
    });
  }

  /**
   * Initialize all settings sliders with event listeners
   * @param {Object} settings - Settings object reference
   * @param {Object} callbacks - Object containing callback functions
   */
  initSettingsSliders(settings, callbacks) {
    const {
      applyZoom,
      applyTheme,
      syncTags,
      saveSettings,
      buildCar,
      resetAngularVelocity,
      setJoyBaseR,
      setJoyKnobR,
      getJoyBaseR,
      clampJoyCenter,
      positionHints
    } = callbacks;

    const accelPitch = document.getElementById('accelPitch');
    const accelYaw = document.getElementById('accelYaw');
    const accelRoll = document.getElementById('accelRoll');
    const curveRange = document.getElementById('curveRange');
    const stickRangeSlider = document.getElementById('stickRangeSlider');
    const dampRange = document.getElementById('dampRange');
    const dampDARRange = document.getElementById('dampDARRange');
    const brakeRange = document.getElementById('brakeRange');
    const wmaxRange = document.getElementById('wmaxRange');
    const wmaxPitchRange = document.getElementById('wmaxPitch');
    const wmaxYawRange = document.getElementById('wmaxYaw');
    const wmaxRollRange = document.getElementById('wmaxRoll');
    const sizeSlider = document.getElementById('stickSizeSlider');
    const zoomSlider = document.getElementById('zoomSlider');
    const arrowSlider = document.getElementById('arrowSlider');
    const presetSel = document.getElementById('presetSel');

    accelPitch.addEventListener('input', () => { settings.maxAccelPitch = parseFloat(accelPitch.value) || 400; syncTags(); saveSettings(); });
    accelYaw.addEventListener('input', () => { settings.maxAccelYaw = parseFloat(accelYaw.value) || 400; syncTags(); saveSettings(); });
    accelRoll.addEventListener('input', () => { settings.maxAccelRoll = parseFloat(accelRoll.value) || 400; syncTags(); saveSettings(); });
    curveRange.addEventListener('input', () => { settings.inputPow = parseFloat(curveRange.value) || 1.0; syncTags(); saveSettings(); });
    stickRangeSlider.addEventListener('input', () => { settings.stickRange = parseFloat(stickRangeSlider.value) || 1.0; syncTags(); saveSettings(); });
    dampRange.addEventListener('input', () => { settings.damp = parseFloat(dampRange.value) || 2.96; syncTags(); saveSettings(); });
    dampDARRange.addEventListener('input', () => { settings.dampDAR = parseFloat(dampDARRange.value) || 4.35; syncTags(); saveSettings(); });
    brakeRange.addEventListener('input', () => { settings.brakeOnRelease = parseFloat(brakeRange.value) || 0.0; syncTags(); saveSettings(); });
    wmaxRange.addEventListener('input', () => { settings.wMax = parseFloat(wmaxRange.value) || 6.0; syncTags(); saveSettings(); });
    wmaxPitchRange.addEventListener('input', () => { settings.wMaxPitch = parseFloat(wmaxPitchRange.value) || 8.5; syncTags(); saveSettings(); });
    wmaxYawRange.addEventListener('input', () => { settings.wMaxYaw = parseFloat(wmaxYawRange.value) || 9.0; syncTags(); saveSettings(); });
    wmaxRollRange.addEventListener('input', () => { settings.wMaxRoll = parseFloat(wmaxRollRange.value) || 6.0; syncTags(); saveSettings(); });
    sizeSlider.addEventListener('input', () => { setJoyBaseR(parseInt(sizeSlider.value, 10) || 100); setJoyKnobR(Math.round(getJoyBaseR() * 0.32)); clampJoyCenter(); positionHints(); syncTags(); });
    zoomSlider.addEventListener('input', () => { settings.zoom = parseFloat(zoomSlider.value) || 1.0; applyZoom(); syncTags(); saveSettings(); });
    arrowSlider.addEventListener('input', () => { settings.arrowScale = parseFloat(arrowSlider.value) || 4.0; syncTags(); saveSettings(); });
    presetSel.addEventListener('change', () => {
      buildCar(presetSel.value);
      resetAngularVelocity();
      saveSettings();
    });
  }

  /**
   * Update menu button styling based on active air roll mode
   * @param {number} lastActive - Last active air roll mode (-1=left, 1=right, 2=free)
   */
  updateMenuButtonStyling(lastActive) {
    document.getElementById('rollL').classList.toggle('active', lastActive === -1);
    document.getElementById('rollR').classList.toggle('active', lastActive === 1);
    document.getElementById('rollFree').classList.toggle('active', lastActive === 2);
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getChromeShown() {
    return this.chromeShown;
  }

  getCOLS() {
    return this.COLS;
  }
}

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

      // Add listeners to nested <details> elements to recalculate card height
      const detailsElements = card.querySelectorAll('details');
      detailsElements.forEach(details => {
        details.addEventListener('toggle', () => {
          const content = card.querySelector('.card-content');
          const isCollapsed = card.classList.contains('collapsed');
          
          // Only recalculate if card is expanded
          if (!isCollapsed && content) {
            // Use setTimeout to allow the details animation to complete
            setTimeout(() => {
              content.style.maxHeight = content.scrollHeight + 'px';
            }, 10);
          }
        });
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
    const gpDeadzoneTag = document.getElementById('gpDeadzoneTag');

    accelPitchTag.textContent = settings.maxAccelPitch.toFixed(2);
    accelYawTag.textContent = settings.maxAccelYaw.toFixed(2);
    accelRollTag.textContent = settings.maxAccelRoll.toFixed(2);
    curveTag.textContent = settings.inputPow.toFixed(2);
    stickRangeTag.textContent = settings.stickRange.toFixed(2);
    dampTag.textContent = settings.damp.toFixed(2);
    dampDARTag.textContent = settings.dampDAR.toFixed(2);
    brakeTag.textContent = settings.brakeOnRelease.toFixed(2);
    wmaxTag.textContent = settings.wMax.toFixed(2);
    wmaxPitchTag.textContent = settings.wMaxPitch.toFixed(2);
    wmaxYawTag.textContent = settings.wMaxYaw.toFixed(2);
    wmaxRollTag.textContent = settings.wMaxRoll.toFixed(2);
    stickVal.textContent = String(Math.round(getters.getJoyBaseR()));
    zoomVal.textContent = `${(settings.zoom || 1).toFixed(2)}×`;
    arrowVal.textContent = `${(settings.arrowScale || 1).toFixed(2)}×`;
    
    // Sync gamepad deadzone tag
    if (gpDeadzoneTag) {
      gpDeadzoneTag.textContent = (settings.gpDeadzone ?? 0.15).toFixed(2);
    }
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
      {tag: accelPitchTag, slider: accelPitch, setter: (v) => settings.maxAccelPitch = Math.max(0, Math.min(2400, parseFloat(v) || 400))},
      {tag: accelYawTag, slider: accelYaw, setter: (v) => settings.maxAccelYaw = Math.max(0, Math.min(2400, parseFloat(v) || 400))},
      {tag: accelRollTag, slider: accelRoll, setter: (v) => settings.maxAccelRoll = Math.max(0, Math.min(2400, parseFloat(v) || 400))},
      {tag: curveTag, slider: curveRange, setter: (v) => settings.inputPow = Math.max(0, Math.min(5, parseFloat(v) || 1.0))},
      {tag: stickRangeTag, slider: stickRangeSlider, setter: (v) => settings.stickRange = Math.max(0, Math.min(1.0, parseFloat(v) || 1.0))},
      {tag: dampTag, slider: dampRange, setter: (v) => settings.damp = Math.max(0, Math.min(20, parseFloat(v) || 2.96))},
      {tag: dampDARTag, slider: dampDARRange, setter: (v) => settings.dampDAR = Math.max(0, Math.min(20, parseFloat(v) || 4.35))},
      {tag: brakeTag, slider: brakeRange, setter: (v) => settings.brakeOnRelease = Math.max(0, Math.min(20, parseFloat(v) || 0))},
      {tag: wmaxTag, slider: wmaxRange, setter: (v) => settings.wMax = Math.max(0, Math.min(50, parseFloat(v) || 6))},
      {tag: wmaxPitchTag, slider: wmaxPitchRange, setter: (v) => settings.wMaxPitch = Math.max(0, Math.min(50, parseFloat(v) || 8.5))},
      {tag: wmaxYawTag, slider: wmaxYawRange, setter: (v) => settings.wMaxYaw = Math.max(0, Math.min(50, parseFloat(v) || 9))},
      {tag: wmaxRollTag, slider: wmaxRollRange, setter: (v) => settings.wMaxRoll = Math.max(0, Math.min(50, parseFloat(v) || 6))},
      {tag: zoomVal, slider: zoomSlider, setter: (v) => { settings.zoom = Math.max(0.67, Math.min(1.78, parseFloat(v) || 1)); applyZoom(); }},
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
    const gpDeadzone = document.getElementById('gpDeadzone');
    const gpDeadzoneTag = document.getElementById('gpDeadzoneTag');

    accelPitch.addEventListener('input', () => { const v = parseFloat(accelPitch.value); settings.maxAccelPitch = Number.isFinite(v) ? v : 400; syncTags(); saveSettings(); });
    accelYaw.addEventListener('input', () => { const v = parseFloat(accelYaw.value); settings.maxAccelYaw = Number.isFinite(v) ? v : 400; syncTags(); saveSettings(); });
    accelRoll.addEventListener('input', () => { const v = parseFloat(accelRoll.value); settings.maxAccelRoll = Number.isFinite(v) ? v : 400; syncTags(); saveSettings(); });
    curveRange.addEventListener('input', () => { const v = parseFloat(curveRange.value); settings.inputPow = Number.isFinite(v) ? v : 1.0; syncTags(); saveSettings(); });
    stickRangeSlider.addEventListener('input', () => { const v = parseFloat(stickRangeSlider.value); settings.stickRange = Number.isFinite(v) ? v : 1.0; syncTags(); saveSettings(); });
    dampRange.addEventListener('input', () => { const v = parseFloat(dampRange.value); settings.damp = Number.isFinite(v) ? v : 2.96; syncTags(); saveSettings(); });
    dampDARRange.addEventListener('input', () => { const v = parseFloat(dampDARRange.value); settings.dampDAR = Number.isFinite(v) ? v : 4.35; syncTags(); saveSettings(); });
    brakeRange.addEventListener('input', () => { const v = parseFloat(brakeRange.value); settings.brakeOnRelease = Number.isFinite(v) ? v : 0.0; syncTags(); saveSettings(); });
    wmaxRange.addEventListener('input', () => { const v = parseFloat(wmaxRange.value); settings.wMax = Number.isFinite(v) ? v : 6.0; syncTags(); saveSettings(); });
    wmaxPitchRange.addEventListener('input', () => { const v = parseFloat(wmaxPitchRange.value); settings.wMaxPitch = Number.isFinite(v) ? v : 8.5; syncTags(); saveSettings(); });
    wmaxYawRange.addEventListener('input', () => { const v = parseFloat(wmaxYawRange.value); settings.wMaxYaw = Number.isFinite(v) ? v : 9.0; syncTags(); saveSettings(); });
    wmaxRollRange.addEventListener('input', () => { const v = parseFloat(wmaxRollRange.value); settings.wMaxRoll = Number.isFinite(v) ? v : 6.0; syncTags(); saveSettings(); });
    
    // Gamepad deadzone slider
    if (gpDeadzone && gpDeadzoneTag) {
      gpDeadzone.addEventListener('input', () => {
        const v = parseFloat(gpDeadzone.value);
        settings.gpDeadzone = Number.isFinite(v) ? v : 0.15;
        gpDeadzoneTag.textContent = settings.gpDeadzone.toFixed(2);
        saveSettings();
      });
    }
    
    sizeSlider.addEventListener('input', () => {
      const size = parseInt(sizeSlider.value, 10) || 100;
      settings.stickSize = size;
      setJoyBaseR(size);
      setJoyKnobR(Math.round(getJoyBaseR() * 0.32));
      clampJoyCenter();
      positionHints();
      syncTags();
      saveSettings();
    });
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

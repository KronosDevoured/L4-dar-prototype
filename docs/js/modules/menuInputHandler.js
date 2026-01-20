/**
 * menuInputHandler.js - Menu input handling for the new MenuSystem
 * 
 * Coordinates keyboard and gamepad input for menu navigation
 * Works with the MenuSystem class
 */

import { MenuSystem } from './menuSystem.js';

export class MenuInputHandler {
  constructor(menuPanelSelector = '#menuPanel') {
    this.menuSystem = new MenuSystem(menuPanelSelector);
    this.isMenuOpen = false;
    this.isChromeShown = false;

    // Track previous key/button states for edge detection
    this.prevKeyState = {};
    this.prevGamepadState = {};
  }

  /**
   * Initialize the input handler
   */
  init() {
    this.menuSystem.init();
    this.setupKeyboardListeners();
    this.setupGamepadListeners();
  }

  /**
   * Setup keyboard event listeners
   * @private
   */
  setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      if (!this.isChromeShown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.menuSystem.navigate('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.menuSystem.navigate('up');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const currentEl = this.menuSystem.getCurrentElement();
          if (currentEl?.tagName === 'INPUT' && currentEl.type === 'range') {
            this.menuSystem.adjustSlider('left');
          } else if (currentEl?.tagName === 'SELECT') {
            this.menuSystem.adjustSelect('left');
          } else {
            this.menuSystem.navigate('left');
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          const currentEl2 = this.menuSystem.getCurrentElement();
          if (currentEl2?.tagName === 'INPUT' && currentEl2.type === 'range') {
            this.menuSystem.adjustSlider('right');
          } else if (currentEl2?.tagName === 'SELECT') {
            this.menuSystem.adjustSelect('right');
          } else {
            this.menuSystem.navigate('right');
          }
          break;
        case 'Enter':
          e.preventDefault();
          this.menuSystem.activateElement();
          break;
        case 'Escape':
          e.preventDefault();
          this.closeMenu();
          break;
      }
    });
  }

  /**
   * Setup gamepad listeners
   * Call this from your gamepad input module
   * @private
   */
  setupGamepadListeners() {
    // This will be called from the gamepad module
    // to integrate with MenuSystem
  }

  /**
   * Handle gamepad navigation
   * Call this from your gamepad update loop when menu is open
   */
  handleGamepadNavigation(gamepadIndex) {
    if (!this.isChromeShown) return;

    const pad = navigator.getGamepads()[gamepadIndex];
    if (!pad) return;

    const ly = pad.axes[1] || 0;
    const lx = pad.axes[0] || 0;

    const stickUp = ly < -0.5;
    const stickDown = ly > 0.5;
    const stickLeft = lx < -0.5;
    const stickRight = lx > 0.5;

    const dpadUp = pad.buttons[12]?.pressed || false;
    const dpadDown = pad.buttons[13]?.pressed || false;
    const dpadLeft = pad.buttons[14]?.pressed || false;
    const dpadRight = pad.buttons[15]?.pressed || false;

    // Edge detection - only trigger on state change
    const key = `pad_${gamepadIndex}`;
    const prevState = this.prevGamepadState[key] || {};

    if ((stickUp && !prevState.stickUp) || (dpadUp && !prevState.dpadUp)) {
      this.menuSystem.navigate('up');
    } else if ((stickDown && !prevState.stickDown) || (dpadDown && !prevState.dpadDown)) {
      this.menuSystem.navigate('down');
    } else if ((stickLeft && !prevState.stickLeft) || (dpadLeft && !prevState.dpadLeft)) {
      this.handleLeftPress();
    } else if ((stickRight && !prevState.stickRight) || (dpadRight && !prevState.dpadRight)) {
      this.handleRightPress();
    }

    // X button (cross/A) to activate
    const xPressed = pad.buttons[0]?.pressed || false;
    if (xPressed && !prevState.xPressed) {
      this.menuSystem.activateElement();
    }

    // Circle button (O/B) to close menu
    const circlePressed = pad.buttons[1]?.pressed || false;
    if (circlePressed && !prevState.circlePressed) {
      this.closeMenu();
    }

    // Save current state
    this.prevGamepadState[key] = {
      stickUp, stickDown, stickLeft, stickRight,
      dpadUp, dpadDown, dpadLeft, dpadRight,
      xPressed, circlePressed
    };
  }

  /**
   * Handle left press - special logic for sliders/selects
   * @private
   */
  handleLeftPress() {
    const currentEl = this.menuSystem.getCurrentElement();
    if (currentEl?.tagName === 'INPUT' && currentEl.type === 'range') {
      this.menuSystem.adjustSlider('left');
    } else if (currentEl?.tagName === 'SELECT') {
      this.menuSystem.adjustSelect('left');
    } else {
      this.menuSystem.navigate('left');
    }
  }

  /**
   * Handle right press - special logic for sliders/selects
   * @private
   */
  handleRightPress() {
    const currentEl = this.menuSystem.getCurrentElement();
    if (currentEl?.tagName === 'INPUT' && currentEl.type === 'range') {
      this.menuSystem.adjustSlider('right');
    } else if (currentEl?.tagName === 'SELECT') {
      this.menuSystem.adjustSelect('right');
    } else {
      this.menuSystem.navigate('right');
    }
  }

  /**
   * Open menu
   */
  openMenu() {
    this.isChromeShown = true;
    this.isMenuOpen = true;
    this.menuSystem.updateFocusableElements();
    this.menuSystem.reset();
  }

  /**
   * Close menu
   */
  closeMenu() {
    this.isChromeShown = false;
    this.isMenuOpen = false;
  }

  /**
   * Update menu (call this from your main loop if needed)
   */
  update() {
    if (this.isChromeShown) {
      // Update focusable elements in case menu structure changed
      this.menuSystem.updateFocusableElements();
    }
  }

  /**
   * Get the underlying MenuSystem instance
   */
  getMenuSystem() {
    return this.menuSystem;
  }
}

export function createMenuInputHandler(selector) {
  return new MenuInputHandler(selector);
}

/**
 * menuSystem.js - Clean menu navigation system
 * 
 * Designed for sequential card-based navigation
 * - UP/DOWN flow through cards sequentially
 * - LEFT/RIGHT navigate within rows
 * - Each card is a logical grouping
 * - Simple, predictable behavior
 */

export class MenuSystem {
  constructor(menuPanelSelector = '#menuPanel') {
    this.menuPanel = document.querySelector(menuPanelSelector);
    this.focusableElements = [];
    this.currentIndex = 0;
    this.navigationCooldown = 0;
    this.cooldownDuration = 150; // ms between navigation inputs
    this.activeCard = null;
  }

  /**
   * Initialize the menu system
   * Call this after the menu is added to the DOM
   */
  init() {
    this.updateFocusableElements();
    if (this.focusableElements.length > 0) {
      this.setFocus(0);
    }
  }

  /**
   * Update the list of focusable elements from the DOM
   * Includes card headers, buttons, inputs, and selects
   * Excludes elements that are not in the layout (collapsed/hidden)
   */
  updateFocusableElements() {
    if (!this.menuPanel) return;

    this.focusableElements = Array.from(
      this.menuPanel.querySelectorAll('.card h3, button, input[type="range"], select')
    ).filter(el => {
      // Always skip if no layout box
      if (el.offsetParent === null) {
        return false;
      }

      // Skip elements inside collapsed cards (except card headers themselves)
      if (el.tagName !== 'H3') {
        const card = el.closest('.card');
        if (card?.classList.contains('collapsed')) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Navigate in a direction
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @returns {boolean} - True if navigation occurred
   */
  navigate(direction) {
    const now = performance.now();
    if (this.navigationCooldown > now) {
      return false; // Still in cooldown
    }

    let newIndex = this.currentIndex;

    if (direction === 'down') {
      newIndex = this.findNextElement();
    } else if (direction === 'up') {
      newIndex = this.findPreviousElement();
    } else if (direction === 'left' || direction === 'right') {
      newIndex = this.findHorizontalElement(direction);
    }

    if (newIndex !== this.currentIndex) {
      this.setFocus(newIndex);
      this.navigationCooldown = now + this.cooldownDuration;
      return true;
    }

    return false;
  }

  /**
   * Find the next element in the menu (DOWN direction)
   * @private
   */
  findNextElement() {
    if (this.focusableElements.length === 0) return this.currentIndex;

    // Simple: just go to next in list
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.focusableElements.length) {
      return nextIndex;
    }

    // Wrap to start
    return 0;
  }

  /**
   * Find the previous element in the menu (UP direction)
   * @private
   */
  findPreviousElement() {
    if (this.focusableElements.length === 0) return this.currentIndex;

    // Simple: just go to previous in list
    const prevIndex = this.currentIndex - 1;
    if (prevIndex >= 0) {
      return prevIndex;
    }

    // Wrap to end
    return this.focusableElements.length - 1;
  }

  /**
   * Find horizontal element (LEFT/RIGHT direction)
   * Navigates between elements in the same row
   * @private
   */
  findHorizontalElement(direction) {
    if (this.focusableElements.length === 0) return this.currentIndex;

    const currentEl = this.focusableElements[this.currentIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const currentY = currentRect.top + currentRect.height / 2;
    const rowThreshold = currentRect.height * 1.5; // Tolerance for same row

    // Find all elements in the same row (any row, not restricted to card)
    const rowElements = [];
    for (let i = 0; i < this.focusableElements.length; i++) {
      const el = this.focusableElements[i];
      const rect = el.getBoundingClientRect();
      const elY = rect.top + rect.height / 2;

      // Check if in same row
      if (Math.abs(elY - currentY) < rowThreshold) {
        rowElements.push(i);
      }
    }

    if (rowElements.length <= 1) {
      return this.currentIndex; // Only one element in row, don't navigate left/right
    }

    // Sort by X position (left to right)
    rowElements.sort((a, b) => {
      const rectA = this.focusableElements[a].getBoundingClientRect();
      const rectB = this.focusableElements[b].getBoundingClientRect();
      return rectA.left - rectB.left;
    });

    // Find current position in row
    const currentPos = rowElements.indexOf(this.currentIndex);
    if (currentPos === -1) return this.currentIndex;

    if (direction === 'right') {
      if (currentPos < rowElements.length - 1) {
        return rowElements[currentPos + 1];
      }
    } else if (direction === 'left') {
      if (currentPos > 0) {
        return rowElements[currentPos - 1];
      }
    }

    return this.currentIndex;
  }

  /**
   * Set focus to a specific element by index
   * @private
   */
  setFocus(index) {
    if (index < 0 || index >= this.focusableElements.length) {
      return;
    }

    // Remove previous focus styling
    this.focusableElements.forEach(el => {
      el.style.outline = '';
      el.style.boxShadow = '';
    });

    this.currentIndex = index;
    const el = this.focusableElements[index];

    // Add focus styling
    el.style.outline = '3px solid #4c8dff';
    el.style.boxShadow = '0 0 12px rgba(76, 141, 255, 0.6)';
    el.focus();

    // Scroll into view
    setTimeout(() => {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }, 10);

    // Update active card visual
    const card = el.closest('.card');
    this.setActiveCard(card);
  }

  /**
   * Highlight the active card
   * @private
   */
  setActiveCard(card) {
    if (!this.menuPanel) return;

    // Remove active class from all cards
    this.menuPanel.querySelectorAll('.card').forEach(c => {
      c.classList.remove('active-card');
    });

    // Add active class to current card
    if (card) {
      card.classList.add('active-card');
      this.activeCard = card;
    }
  }

  /**
   * Activate the currently focused element (press Enter/X button)
   */
  activateElement() {
    if (this.currentIndex >= 0 && this.currentIndex < this.focusableElements.length) {
      const el = this.focusableElements[this.currentIndex];
      el.click();

      // If we just activated a card header, refresh focusable elements to include the expanded content
      if (el.tagName === 'H3') {
        setTimeout(() => {
          this.updateFocusableElements();
        }, 30);
      }
    }
  }

  /**
   * Adjust a slider value (LEFT/RIGHT on sliders when selected)
   */
  adjustSlider(direction) {
    if (this.currentIndex >= 0 && this.currentIndex < this.focusableElements.length) {
      const el = this.focusableElements[this.currentIndex];
      if (el.tagName === 'INPUT' && el.type === 'range') {
        const step = el.step || 1;
        const delta = direction === 'right' ? step : -step;
        const newValue = parseFloat(el.value) + parseFloat(delta);
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 100;

        if (newValue >= min && newValue <= max) {
          el.value = newValue;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }

  /**
   * Adjust select value (LEFT/RIGHT on selects when selected)
   */
  adjustSelect(direction) {
    if (this.currentIndex >= 0 && this.currentIndex < this.focusableElements.length) {
      const el = this.focusableElements[this.currentIndex];
      if (el.tagName === 'SELECT') {
        const delta = direction === 'right' ? 1 : -1;
        const newIndex = el.selectedIndex + delta;

        if (newIndex >= 0 && newIndex < el.options.length) {
          el.selectedIndex = newIndex;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }

  /**
   * Reset to first element
   */
  reset() {
    this.currentIndex = 0;
    this.navigationCooldown = 0;
    this.activeCard = null;
    this.setFocus(0);
  }

  /**
   * Get current focused element
   */
  getCurrentElement() {
    return this.focusableElements[this.currentIndex] || null;
  }

  /**
   * Get current index
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get all focusable elements
   */
  getElements() {
    return [...this.focusableElements];
  }

  /**
   * Clear focus and active card visuals (used when closing menu)
   */
  clearFocus() {
    this.focusableElements.forEach(el => {
      el.style.outline = '';
      el.style.boxShadow = '';
    });
    this.currentIndex = -1;
    this.setActiveCard(null);
  }
}

export function createMenuSystem(selector) {
  return new MenuSystem(selector);
}

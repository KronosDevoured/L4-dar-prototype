/**
 * menuNavigator.js
 * Menu navigation logic extracted from input.js for better maintainability
 * Handles keyboard-based menu navigation (arrow keys, enter, esc)
 */

// ============================================================================
// MENU NAVIGATOR CLASS
// ============================================================================

export class MenuNavigator {
  constructor() {
    this.focusIndex = 0;
    this.focusableElements = [];
    this.navigationCooldown = 0;
    this.cooldownDuration = 200; // ms between navigation inputs
  }

  /**
   * Update focusable elements based on current DOM state
   * Only includes visible elements
   */
  updateFocusableElements() {
    this.focusableElements = Array.from(document.querySelectorAll(
      '#menuPanel .card h3, #menuPanel button, #menuPanel input[type="range"], #menuPanel select'
    )).filter(el => {
      // Only include visible elements
      const card = el.closest('.card');
      if (card && card.classList.contains('collapsed') && el.tagName !== 'H3') {
        return false; // Don't include elements in collapsed cards
      }
      return el.offsetParent !== null;
    });
  }

  /**
   * Navigate in a direction (up, down, left, right)
   * @param {string} direction - Direction to navigate ('up', 'down', 'left', 'right')
   * @param {boolean} ignoreReduced - If true, navigate regardless of cooldown
   * @returns {boolean} - Whether navigation was successful
   */
  navigate(direction, ignoreReduced = false) {
    if (this.focusableElements.length === 0) return false;

    const now = performance.now();
    if (!ignoreReduced && this.navigationCooldown > now) {
      return false;
    }

    const currentEl = this.focusableElements[this.focusIndex];
    const isHeader = currentEl.tagName === 'H3';

    let newIndex = this.focusIndex;

    if (direction === 'down' || direction === 'up') {
      newIndex = this.findVerticalElement(direction, isHeader);
    } else if (direction === 'left' || direction === 'right') {
      newIndex = this.findHorizontalElement(direction);
    }

    if (newIndex !== this.focusIndex) {
      this.focusIndex = newIndex;
      this.setFocus(this.focusableElements[this.focusIndex]);
      this.navigationCooldown = now + this.cooldownDuration;
      return true;
    }

    return false;
  }

  /**
   * Find next/previous element vertically (up/down)
   * @private
   */
  findVerticalElement(direction, isHeader) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentCard = currentEl.closest('.card');

    if (isHeader) {
      if (direction === 'down') {
        return this.findNextCardElement(currentCard, true);
      } else {
        return this.findPreviousCardHeader();
      }
    } else {
      // Currently on a control element
      if (direction === 'down') {
        return this.findNextControlOrHeader(currentCard);
      } else {
        return this.findPreviousControlOrHeader(currentCard);
      }
    }
  }

  /**
   * Find next element inside current card or next card header
   * @private
   */
  findNextCardElement(currentCard, enterCard) {
    const isCardExpanded = currentCard && !currentCard.classList.contains('collapsed');

    if (enterCard && isCardExpanded) {
      // Try to enter card (find first non-header element)
      for (let i = 1; i < this.focusableElements.length; i++) {
        const checkIndex = (this.focusIndex + i) % this.focusableElements.length;
        const checkEl = this.focusableElements[checkIndex];
        const checkCard = checkEl.closest('.card');

        if (checkCard === currentCard && checkEl.tagName !== 'H3') {
          return checkIndex;
        }
        if (checkCard !== currentCard) break;
      }
    }

    // Jump to next card header
    for (let i = 1; i < this.focusableElements.length; i++) {
      const checkIndex = (this.focusIndex + i) % this.focusableElements.length;
      const checkEl = this.focusableElements[checkIndex];
      if (checkEl.tagName === 'H3') {
        return checkIndex;
      }
    }

    return this.focusIndex;
  }

  /**
   * Find previous card header
   * @private
   */
  findPreviousCardHeader() {
    for (let i = 1; i < this.focusableElements.length; i++) {
      const checkIndex = (this.focusIndex - i + this.focusableElements.length) % this.focusableElements.length;
      const checkEl = this.focusableElements[checkIndex];
      if (checkEl.tagName === 'H3') {
        return checkIndex;
      }
    }
    return this.focusIndex;
  }

  /**
   * Find next control element in card or next card header
   * @private
   */
  findNextControlOrHeader(currentCard) {
    for (let i = 1; i < this.focusableElements.length; i++) {
      const checkIndex = (this.focusIndex + i) % this.focusableElements.length;
      const checkEl = this.focusableElements[checkIndex];
      const checkCard = checkEl.closest('.card');

      if (checkCard === currentCard && checkEl.tagName !== 'H3') {
        return checkIndex;
      }
      if (checkCard !== currentCard && checkEl.tagName === 'H3') {
        return checkIndex;
      }
    }
    return this.focusIndex;
  }

  /**
   * Find previous control element in card or card header
   * @private
   */
  findPreviousControlOrHeader(currentCard) {
    for (let i = 1; i < this.focusableElements.length; i++) {
      const checkIndex = (this.focusIndex - i + this.focusableElements.length) % this.focusableElements.length;
      const checkEl = this.focusableElements[checkIndex];
      const checkCard = checkEl.closest('.card');

      if (checkCard === currentCard) {
        return checkIndex;
      }
    }
    return this.focusIndex;
  }

  /**
   * Find next/previous element horizontally (left/right)
   * @private
   */
  findHorizontalElement(direction) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentCard = currentEl.closest('.card');
    const step = direction === 'right' ? 1 : -1;

    for (let i = 1; i < this.focusableElements.length; i++) {
      const checkIndex = (this.focusIndex + (i * step) + this.focusableElements.length) % this.focusableElements.length;
      const checkEl = this.focusableElements[checkIndex];
      const checkCard = checkEl.closest('.card');

      if (checkCard === currentCard && checkEl.tagName !== 'H3') {
        return checkIndex;
      }
    }
    return this.focusIndex;
  }

  /**
   * Set focus to an element (scroll into view and highlight)
   * @private
   */
  setFocus(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.focus();
  }

  /**
   * Set cooldown duration
   * @param {number} ms - Milliseconds between navigation inputs
   */
  setCooldownDuration(ms) {
    this.cooldownDuration = ms;
  }

  /**
   * Reset navigator state
   */
  reset() {
    this.focusIndex = 0;
    this.focusableElements = [];
    this.navigationCooldown = 0;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createMenuNavigator() {
  return new MenuNavigator();
}

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
   * Only includes visible elements (excluding card headers)
   */
  updateFocusableElements() {
    this.focusableElements = Array.from(document.querySelectorAll(
      '#menuPanel button, #menuPanel input[type="range"], #menuPanel select'
    )).filter(el => {
      // Only include visible elements
      const card = el.closest('.card');
      if (card && card.classList.contains('collapsed')) {
        return false; // Don't include elements in collapsed cards
      }
      return el.offsetParent !== null;
    });
  }

  /**
   * Navigate in a direction (up, down, left, right)
   * Sequential card-based navigation
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

    let newIndex = this.focusIndex;

    if (direction === 'down' || direction === 'up') {
      newIndex = this.findVerticalElement(direction);
    } else if (direction === 'left' || direction === 'right') {
      newIndex = this.findHorizontalElement(direction);
    }

    if (newIndex !== this.focusIndex) {
      this.focusIndex = newIndex;
      this.setFocus(this.focusableElements[this.focusIndex]);
      this.navigationCooldown = now + this.cooldownDuration;
      
      // Update active card visual
      const card = this.focusableElements[this.focusIndex].closest('.card');
      this.updateActiveCard(card);
      
      return true;
    }

    return false;
  }

  /**
   * Find next/previous element vertically (up/down) with sequential card flow
   * @private
   */
  findVerticalElement(direction) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentCard = currentEl.closest('.card');

    if (direction === 'down') {
      // Find next element in current card
      for (let i = this.focusIndex + 1; i < this.focusableElements.length; i++) {
        const el = this.focusableElements[i];
        if (el.closest('.card') === currentCard) {
          return i; // Found next element in same card
        }
      }
      // Reached end of current card, try next card
      for (let i = this.focusIndex + 1; i < this.focusableElements.length; i++) {
        const el = this.focusableElements[i];
        const elCard = el.closest('.card');
        if (elCard !== currentCard) {
          return i; // First element of next card
        }
      }
    } else if (direction === 'up') {
      // Find previous element in current card
      for (let i = this.focusIndex - 1; i >= 0; i--) {
        const el = this.focusableElements[i];
        if (el.closest('.card') === currentCard) {
          return i; // Found previous element in same card
        }
      }
      // Reached start of current card, try previous card
      for (let i = this.focusIndex - 1; i >= 0; i--) {
        const el = this.focusableElements[i];
        const elCard = el.closest('.card');
        if (elCard !== currentCard) {
          return i; // Last element of previous card
        }
      }
    }

    return this.focusIndex;
  }

  /**
   * Find next/previous element horizontally (left/right) within same row
   * @private
   */
  findHorizontalElement(direction) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const currentY = currentRect.top + currentRect.height / 2;
    const rowThreshold = currentRect.height * 0.5;
    const currentCard = currentEl.closest('.card');

    // Find all elements in same row (same Y position) and same card
    let rowElements = [];
    for (let i = 0; i < this.focusableElements.length; i++) {
      const el = this.focusableElements[i];
      const rect = el.getBoundingClientRect();
      const elY = rect.top + rect.height / 2;

      if (Math.abs(elY - currentY) < rowThreshold && el.closest('.card') === currentCard) {
        rowElements.push(i);
      }
    }

    // Sort by X position (left to right)
    rowElements.sort((a, b) => {
      const rectA = this.focusableElements[a].getBoundingClientRect();
      const rectB = this.focusableElements[b].getBoundingClientRect();
      return rectA.left - rectB.left;
    });

    // Find current position in row
    const currentPosInRow = rowElements.indexOf(this.focusIndex);
    if (currentPosInRow !== -1) {
      if (direction === 'right' && currentPosInRow < rowElements.length - 1) {
        return rowElements[currentPosInRow + 1];
      } else if (direction === 'left' && currentPosInRow > 0) {
        return rowElements[currentPosInRow - 1];
      }
    }

    return this.focusIndex;
  }

  /**
   * Update visual active card indicator
   * @private
   */
  updateActiveCard(card) {
    // Remove active class from all cards
    document.querySelectorAll('#menuPanel .card').forEach(c => {
      c.classList.remove('active-card');
    });
    // Add active class to current card
    if (card) {
      card.classList.add('active-card');
    }
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

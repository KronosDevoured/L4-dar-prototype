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
      return true;
    }

    return false;
  }

  /**
   * Find next/previous element vertically (up/down) using grid-based logic with card awareness
   * @private
   */
  findVerticalElement(direction) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    const currentHeight = currentRect.height;
    const currentCard = currentEl.closest('.card');

    let candidates = [];
    let sameCardCandidates = [];

    // Find all elements in the target direction
    for (let i = 0; i < this.focusableElements.length; i++) {
      if (i === this.focusIndex) continue; // Skip self

      const el = this.focusableElements[i];
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elCard = el.closest('.card');

      let isValid = false;
      let score = Infinity;
      const isSameCard = elCard === currentCard;

      if (direction === 'down') {
        // Element must be below current element
        if (centerY > currentCenterY) {
          const horizontalDist = Math.abs(centerX - currentCenterX);
          const verticalDist = centerY - currentCenterY;
          
          // Only consider if it's clearly more vertical than horizontal
          if (verticalDist > Math.max(currentHeight * 0.1, 10)) {
            isValid = true;
            // Strong penalty for horizontal misalignment
            score = horizontalDist * 3 + verticalDist * 0.5;
          }
        }
      } else if (direction === 'up') {
        // Element must be above current element
        if (centerY < currentCenterY) {
          const horizontalDist = Math.abs(centerX - currentCenterX);
          const verticalDist = currentCenterY - centerY;
          
          // Only consider if it's clearly more vertical than horizontal
          if (verticalDist > Math.max(currentHeight * 0.1, 10)) {
            isValid = true;
            // Strong penalty for horizontal misalignment
            score = horizontalDist * 3 + verticalDist * 0.5;
          }
        }
      }

      if (isValid) {
        candidates.push({ index: i, score });
        if (isSameCard && el.tagName !== 'H3') {
          sameCardCandidates.push({ index: i, score });
        }
      }
    }

    // Prefer elements in the same card
    if (sameCardCandidates.length > 0) {
      sameCardCandidates.sort((a, b) => a.score - b.score);
      return sameCardCandidates[0].index;
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      return candidates[0].index;
    }

    return this.focusIndex;
  }

  /**
   * Find next/previous element horizontally (left/right) using grid-based logic
   * @private
   */
  findHorizontalElement(direction) {
    const currentEl = this.focusableElements[this.focusIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    const currentWidth = currentRect.width;

    let candidates = [];

    // Find all elements in the target direction
    for (let i = 0; i < this.focusableElements.length; i++) {
      if (i === this.focusIndex) continue; // Skip self

      const el = this.focusableElements[i];
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let isValid = false;
      let score = Infinity;

      if (direction === 'right') {
        // Element must be to the right of current element
        if (centerX > currentCenterX) {
          const verticalDist = Math.abs(centerY - currentCenterY);
          const horizontalDist = centerX - currentCenterX;
          
          // Only consider if it's clearly more horizontal than vertical
          if (horizontalDist > Math.max(currentWidth * 0.1, 10)) {
            isValid = true;
            // Strong penalty for vertical misalignment
            score = verticalDist * 3 + horizontalDist * 0.5;
          }
        }
      } else if (direction === 'left') {
        // Element must be to the left of current element
        if (centerX < currentCenterX) {
          const verticalDist = Math.abs(centerY - currentCenterY);
          const horizontalDist = currentCenterX - centerX;
          
          // Only consider if it's clearly more horizontal than vertical
          if (horizontalDist > Math.max(currentWidth * 0.1, 10)) {
            isValid = true;
            // Strong penalty for vertical misalignment
            score = verticalDist * 3 + horizontalDist * 0.5;
          }
        }
      }

      if (isValid) {
        candidates.push({ index: i, score });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      return candidates[0].index;
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

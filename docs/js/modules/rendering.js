/**
 * rendering.js - HUD Rendering Module
 *
 * Handles all HUD canvas rendering:
 * - HUD canvas utilities
 * - Joystick drawing
 * - DAR button drawing
 * - Boost button drawing
 * - Ring Mode HUD (score, lives, compass, trail, target orb)
 * - Main HUD renderer
 */

import * as THREE from 'three';

// HUD canvas context
let hud, hctx;

/**
 * Initialize HUD canvas and context
 * @param {HTMLCanvasElement} hudElement - The HUD canvas element
 */
export function initHUD(hudElement) {
  hud = hudElement;
  hctx = hud.getContext('2d');
  sizeHud();
}

/**
 * Resize HUD canvas to match window size
 */
export function sizeHud() {
  hud.width = innerWidth;
  hud.height = innerHeight;
}

// ============================================================================
// HUD Drawing Utilities
// ============================================================================

export function Hclear() {
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, hud.width, hud.height);
}

export function Hcircle(x, y, r, strokeStyle, width) {
  hctx.beginPath();
  hctx.lineWidth = width;
  hctx.strokeStyle = strokeStyle;
  hctx.arc(x, y, r, 0, Math.PI * 2);
  hctx.stroke();
}

export function HfillCircle(x, y, r, fillStyle) {
  hctx.beginPath();
  hctx.fillStyle = fillStyle;
  hctx.arc(x, y, r, 0, Math.PI * 2);
  hctx.fill();
}

export function Harc(x, y, r, a1, a2, strokeStyle, width) {
  hctx.beginPath();
  hctx.lineWidth = width;
  hctx.strokeStyle = strokeStyle;
  hctx.arc(x, y, r, a1, a2);
  hctx.stroke();
}

export function Hline(x1, y1, x2, y2, strokeStyle, width) {
  hctx.beginPath();
  hctx.lineWidth = width;
  hctx.strokeStyle = strokeStyle;
  hctx.moveTo(x1, y1);
  hctx.lineTo(x2, y2);
  hctx.stroke();
}

export function Htri(x, y, a, r, fillStyle) {
  hctx.save();
  hctx.translate(x, y);
  hctx.rotate(a);
  hctx.beginPath();
  hctx.moveTo(0, -r);
  hctx.lineTo(r * 0.9, r * 0.9);
  hctx.lineTo(-r * 0.9, r * 0.9);
  hctx.closePath();
  hctx.fillStyle = fillStyle;
  hctx.fill();
  hctx.restore();
}

// ============================================================================
// Control Button Drawing
// ============================================================================

const COLS = { UP: '#ff5c5c', RIGHT: '#4c8dff', DOWN: '#53d769', LEFT: '#ffd166' };

/**
 * Draw joystick on HUD
 * @param {object} state - Joystick state { JOY_CENTER, JOY_BASE_R, JOY_KNOB_R, joyVec }
 */
export function drawJoystick(state) {
  const { JOY_CENTER, JOY_BASE_R, JOY_KNOB_R, joyVec } = state;
  const cx = JOY_CENTER.x, cy = JOY_CENTER.y, r = JOY_BASE_R;
  const t = performance.now();
  // Pulse synced to car 360° roll: 2π / (2π / DAR_ROLL_SPEED) = DAR_ROLL_SPEED / 1000
  // With DAR_ROLL_SPEED = 5.5 rad/s, one full roll takes ~1.14 seconds
  const pulse = 1 + 0.06 * Math.sin(t * 0.0055), halo = r * pulse + 10;

  Hcircle(cx, cy, halo, 'rgba(76,141,255,0.28)', 8);
  Harc(cx, cy, r, -Math.PI / 4, Math.PI / 4, COLS.RIGHT, 12);
  Harc(cx, cy, r, Math.PI / 4, 3 * Math.PI / 4, COLS.UP, 12);
  Harc(cx, cy, r, 3 * Math.PI / 4, 5 * Math.PI / 4, COLS.LEFT, 12);
  Harc(cx, cy, r, 5 * Math.PI / 4, 7 * Math.PI / 4, COLS.DOWN, 12);
  Hcircle(cx, cy, r - 18, '#b9c1cd', 2);
  Hline(cx - r + 12, cy, cx + r - 12, cy, '#cfd6e2', 1.5);
  Hline(cx, cy - r + 12, cx, cy + r - 12, '#cfd6e2', 1.5);

  const kx = cx + joyVec.x, ky = cy + joyVec.y;
  Hcircle(kx, ky, JOY_KNOB_R, '#4c8dff', 4);
  HfillCircle(kx, ky, JOY_KNOB_R, '#0f1116');
  hctx.fillStyle = '#222';
  hctx.beginPath();
  hctx.arc(cx, cy, 3, 0, Math.PI * 2);
  hctx.fill();
}

/**
 * Draw DAR (directional air roll) button on HUD
 * @param {object} state - DAR state { DAR_CENTER, DAR_R, darOn, airRoll, selectedAirRoll, airRollIsToggle }
 */
export function drawDAR(state) {
  const { DAR_CENTER, DAR_R, darOn, airRoll, selectedAirRoll, airRollIsToggle } = state;
  const cx = DAR_CENTER.x, cy = DAR_CENTER.y, r = DAR_R;

  // Determine background color based on toggle mode and activation state
  let bgColor;
  if (airRollIsToggle) {
    // Toggle mode is active - use solid blue background (matches .btn.active: #0066ff)
    bgColor = darOn ? '#0066ff' : '#0066ff';
  } else {
    // Hold mode - show dark background, blue only when active
    bgColor = darOn ? 'rgba(0,102,255,0.18)' : 'rgba(24,26,32,0.75)';
  }

  HfillCircle(cx, cy, r, bgColor);

  Hcircle(cx, cy, r, darOn ? '#4c8dff' : '#3a3d45', darOn ? 5 : 3);
  const a = (airRoll > 0) ? Math.PI / 2 : -Math.PI / 2;
  Htri(cx, cy, a, r * 0.55, darOn ? '#0e0f12' : '#e8e8ea');
  Hcircle(cx, cy, r - 12, '#bdbdbd', 1.5);

  // Display selected air roll direction as text
  let dirText = '';
  if (selectedAirRoll === -1) dirText = 'L';
  else if (selectedAirRoll === 1) dirText = 'R';
  else if (selectedAirRoll === 2) dirText = 'F';

  if (dirText) {
    hctx.fillStyle = darOn ? '#0e0f12' : '#e8e8ea';
    hctx.font = 'bold 18px system-ui';
    hctx.textAlign = 'center';
    hctx.textBaseline = 'middle';
    hctx.fillText(dirText, cx, cy + r - 6);
  }
}

/**
 * Draw Boost button on HUD
 * @param {object} state - Boost state { BOOST_CENTER, BOOST_R, ringModeBoostActive }
 */
export function drawBoost(state) {
  const { BOOST_CENTER, BOOST_R, ringModeBoostActive } = state;
  const cx = BOOST_CENTER.x, cy = BOOST_CENTER.y, r = BOOST_R;

  HfillCircle(cx, cy, r, ringModeBoostActive ? 'rgba(255,92,92,0.25)' : 'rgba(24,26,32,0.75)');
  Hcircle(cx, cy, r, ringModeBoostActive ? '#ff5c5c' : '#3a3d45', ringModeBoostActive ? 5 : 3);

  // Draw "B" text
  hctx.fillStyle = ringModeBoostActive ? '#0e0f12' : '#e8e8ea';
  hctx.font = 'bold 24px system-ui';
  hctx.textAlign = 'center';
  hctx.textBaseline = 'middle';
  hctx.fillText('B', cx, cy);
}

// ============================================================================
// Ring Mode HUD
// ============================================================================

/**
 * Draw Ring Mode HUD (score, lives, ring count, compass, trail, target orb)
 * @param {object} state - Ring Mode state
 */
export function drawRingModeHUD(state) {
  const {
    ringModeScore,
    ringModeHighScore,
    ringModeRingCount,
    ringModeLives,
    ringModeStarted,
    ringModePaused,
    ringModePosition,
    rings,
    isMobile,
    currentDifficulty
  } = state;

  const ctx = hctx;

  // Scale text down on mobile/tablet for less distraction
  const textScale = isMobile ? 0.65 : 1.0;

  // Ring count - top center (just the number, no label)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(32 * textScale)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Buttons are 44px + padding, give extra room on mobile (textScale reduces size)
  const hudTop = isMobile ? 95 : 72; 
  ctx.fillText(`${ringModeRingCount}`, innerWidth / 2, hudTop);

  // Lives - top left with heart symbols (below fullscreen button)
  // Fullscreen button is 44px tall, add extra clearance on mobile
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.floor(28 * textScale)}px system-ui`;
  const heartSpacing = 35 * textScale;
  const heartStartY = isMobile ? 110 : 88; // More space on mobile
  for (let i = 0; i < Math.min(ringModeLives, 10); i++) {
    ctx.fillStyle = '#ff5c5c';
    ctx.fillText('♥', 20, heartStartY + i * heartSpacing);
  }

  // Ring landing indicator - NOW RENDERED AS 3D OBJECT IN ringMode.js
  // (Disabled 2D canvas version - see updateLandingIndicator() in ringMode.js)
  // The 3D version is properly attached to the grid and doesn't warp when the camera moves

  // Directional arrow compass for distant rings
  if (ringModeStarted && !ringModePaused && ringModeLives > 0 && rings.length > 0) {
    // Find the target ring (oldest unpassed ring)
    const targetRing = rings.find(r => !r.passed && !r.missed);

    if (targetRing) {
      // Calculate 2D distance from car to ring (on grid plane)
      const dx = targetRing.mesh.position.x - ringModePosition.x;
      const dy = targetRing.mesh.position.y - ringModePosition.y;
      const distance2D = Math.sqrt(dx * dx + dy * dy);

      // Convert grid positions to screen positions
      // Player is always at screen center
      const playerScreenX = innerWidth / 2;
      const playerScreenY = innerHeight / 2;

      // Ring position relative to player (offset from center)
      // Screen Y is inverted (positive = down), so negate dy
      const ringScreenX = playerScreenX + dx;
      const ringScreenY = playerScreenY - dy;

      // Show arrow and distance for rings that started 1000+ units away
      // Keep showing until car reaches the dashed circle (landing zone)
      const wasInitiallyDistant = targetRing.initialDistance2D && targetRing.initialDistance2D >= 1000;
      const ringRadius = targetRing.size / 2;

      // Determine if the ring is offscreen in HUD coordinates.
      // Player is always at screen center; ringScreenX/Y are relative to that.
      const isOffscreen = (ringScreenX < 0 || ringScreenX > innerWidth || ringScreenY < 0 || ringScreenY > innerHeight);

      // Distance-based rule (legacy behavior) and offscreen rule: show indicator if either applies
      const distanceBased = wasInitiallyDistant ? distance2D > ringRadius : distance2D > 800;
      const showIndicator = isOffscreen || distanceBased;

      // Calculate arrow position (will be used for dashed line start point)
      let arrowX, arrowY;

      if (showIndicator) {
        // Calculate direction angle (in 2D, looking down from above)
        // Negate dy because screen Y is inverted (increases downward, grid Y increases upward)
        const angle = Math.atan2(-dy, dx);

        // Convert player grid position to screen position (centered on screen)
        // The car is always at screen center, so the compass is also at screen center
        const compassCenterX = innerWidth / 2;
        const compassCenterY = innerHeight / 2;

        // Draw compass circle - large enough to not overlap the car
        const compassRadius = 150;
        const innerCutoutRadius = 130; // Larger cutout so car is fully visible

        ctx.save();

        // Draw compass circle with transparent center (donut shape) so car shows through
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(compassCenterX, compassCenterY, compassRadius, 0, Math.PI * 2);
        ctx.arc(compassCenterX, compassCenterY, innerCutoutRadius, 0, Math.PI * 2, true); // Inner cutout
        ctx.fill();

        // Draw circle outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(compassCenterX, compassCenterY, compassRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // Calculate arrow position on circle perimeter
        arrowX = compassCenterX + Math.cos(angle) * compassRadius;
        arrowY = compassCenterY + Math.sin(angle) * compassRadius;

        // Draw arrow at edge of circle pointing toward ring
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);

        // Draw prominent arrow shape
        const arrowSize = 30;
        ctx.fillStyle = '#ff5c5c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(arrowSize, 0); // Arrow tip (pointing right = direction of rotation)
        ctx.lineTo(-arrowSize / 2, -arrowSize / 2); // Top back
        ctx.lineTo(-arrowSize / 2, arrowSize / 2); // Bottom back
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Distance text next to arrow (offset outward from circle)
        const distText = `${Math.round(distance2D)}u`;
        // Position text outside the arrow with extra spacing so it doesn't overlap
        const textOffsetDistance = 65; // Increased from 45 to give arrow more space
        const textX = arrowX + Math.cos(angle) * textOffsetDistance;
        const textY = arrowY + Math.sin(angle) * textOffsetDistance;

        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(distText, textX, textY);
        ctx.fillText(distText, textX, textY);
      }

      // Draw dashed trail from arrow to ring position on grid
      // Only show when arrow/compass is showing
      if (showIndicator && arrowX && arrowY) {
        const startX = arrowX;
        const startY = arrowY;

        // Draw dashed line (starting from arrow or car edge)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 92, 92, 0.6)'; // Semi-transparent red
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 10]); // Dashed pattern: 15px dash, 10px gap
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(ringScreenX, ringScreenY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash pattern
        ctx.restore();

        // Draw target orb at ring position
        ctx.save();
        // Outer glow
        const gradient = ctx.createRadialGradient(ringScreenX, ringScreenY, 0, ringScreenX, ringScreenY, 25);
        gradient.addColorStop(0, 'rgba(255, 92, 92, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 92, 92, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 92, 92, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ringScreenX, ringScreenY, 25, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid orb
        ctx.fillStyle = '#ff5c5c';
        ctx.beginPath();
        ctx.arc(ringScreenX, ringScreenY, 12, 0, Math.PI * 2);
        ctx.fill();

        // White center highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(ringScreenX - 4, ringScreenY - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Game over or paused text
  if (ringModeLives <= 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, innerHeight / 2 - 140, innerWidth, 160);
    ctx.fillStyle = '#ff5c5c';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', innerWidth / 2, innerHeight / 2 - 80);
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(`Final Score: ${ringModeScore}`, innerWidth / 2, innerHeight / 2 - 30);
    ctx.fillText(`High Score: ${ringModeHighScore}`, innerWidth / 2, innerHeight / 2);

    // Draw retry button
    const retryButtonWidth = 200;
    const retryButtonHeight = 50;
    const retryButtonX = innerWidth / 2 - retryButtonWidth / 2;
    const retryButtonY = innerHeight / 2 + 30;

    ctx.fillStyle = '#4c8dff';
    ctx.fillRect(retryButtonX, retryButtonY, retryButtonWidth, retryButtonHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(retryButtonX, retryButtonY, retryButtonWidth, retryButtonHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText('RETRY', innerWidth / 2, retryButtonY + retryButtonHeight / 2);
  } else if (ringModePaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, innerHeight / 2 - 40, innerWidth, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', innerWidth / 2, innerHeight / 2);
  } else if (!ringModeStarted) {
    const messageY = innerHeight - 100;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, messageY - 40, innerWidth, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press Boost to Start!', innerWidth / 2, messageY);
  }
}

// ============================================================================
// Main HUD Renderer
// ============================================================================

/**
 * Render the complete HUD
 * @param {object} state - Complete rendering state
 */
export function renderHUD(state) {
  Hclear();

  // Draw joystick
  drawJoystick({
    JOY_CENTER: state.JOY_CENTER,
    JOY_BASE_R: state.JOY_BASE_R,
    JOY_KNOB_R: state.JOY_KNOB_R,
    joyVec: state.joyVec
  });

  // Draw DAR button
  drawDAR({
    DAR_CENTER: state.DAR_CENTER,
    DAR_R: state.DAR_R,
    darOn: state.darOn,
    airRoll: state.airRoll,
    selectedAirRoll: state.selectedAirRoll,
    airRollIsToggle: state.airRollIsToggle
  });

  // Draw Ring Mode HUD if active
  if (state.ringModeActive) {
    if (state.showBoostButton) {
      drawBoost({
        BOOST_CENTER: state.BOOST_CENTER,
        BOOST_R: state.BOOST_R,
        ringModeBoostActive: state.ringModeBoostActive
      });
    }

    drawRingModeHUD({
      ringModeScore: state.ringModeScore,
      ringModeHighScore: state.ringModeHighScore,
      ringModeRingCount: state.ringModeRingCount,
      ringModeLives: state.ringModeLives,
      ringModeStarted: state.ringModeStarted,
      ringModePaused: state.ringModePaused,
      ringModePosition: state.ringModePosition,
      rings: state.rings,
      isMobile: state.isMobile,
      currentDifficulty: state.currentDifficulty
    });
  }
}

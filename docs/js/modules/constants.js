/**
 * constants.js
 * All configuration constants for the L4 DAR prototype
 * Includes colors, themes, physics parameters, Ring Mode settings, and presets
 */

// ============================================================================
// DEVICE DETECTION
// ============================================================================

export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
export const isDesktop = !isMobile;

// ============================================================================
// CAMERA CONFIGURATION
// ============================================================================

export const CAM_BASE = { y: 280, z: 760 };

// ============================================================================
// COLORS
// ============================================================================

export const COL_UP = 0xff5c5c;
export const COL_RIGHT = 0x4c8dff;
export const COL_DOWN = 0x53d769;
export const COL_LEFT = 0xffd166;

export const COLS = {
  UP: '#ff5c5c',
  RIGHT: '#4c8dff',
  DOWN: '#53d769',
  LEFT: '#ffd166'
};

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export const THEMES = {
  dark: {
    body: '#000000',
    fog: 0x000000,
    fogNear: 1000,
    fogFar: 2500,
    ambient: 0xffffff,
    ambientIntensity: 1.5,
    directional: 0xffffff,
    directionalIntensity: 1.2,
    gridMain: 0x4a5060,
    gridSub: 0x353945,
    gridOpacity: 0.7,
    gridY: -160
  },
  light: {
    body: '#ffffff',
    fog: 0xeef1f6,
    fogNear: 900,
    fogFar: 2200,
    ambient: 0xffffff,
    ambientIntensity: 0.8,
    directional: 0xffffff,
    directionalIntensity: 1.15,
    gridMain: 0x8a95a5,
    gridSub: 0xb5bec8,
    gridOpacity: 0.85,
    gridY: -160
  }
};

// ============================================================================
// CAR PRESETS
// ============================================================================

export const CAR_PRESETS = {
  placeholder: { hx: 70, hy: 28, hz: 120 },
  octane: { hx: 85.65, hy: 36.8, hz: 120 },
  dominus: { hx: 77.9, hy: 29.3, hz: 120 }
};

// Car dimensions for Ring Mode
export const CAR_WIDTH = 30;
export const CAR_HEIGHT = 20;
export const CAR_SCALE = 1.6;

// ============================================================================
// JOYSTICK / INPUT CONSTANTS
// ============================================================================

export const STICK_TAU_MS = 8;
export const RELOCATE_HOLD_MS = 250;
export const STICK_MIN = 0.02;

// ============================================================================
// PHYSICS DEFAULT VALUES
// ============================================================================

export const PHYSICS_DEFAULTS = {
  accelPitch: 714,
  accelYaw: 521,
  accelRoll: 2153,
  curve: 1.0,
  damp: 2.96,
  dampDAR: 4.35,
  brake: 0.0,
  wmax: 5.5,
  wmaxPitch: 24.0,
  wmaxYaw: 24.0,
  wmaxRoll: 24.0
};

// ============================================================================
// RING MODE CONFIGURATION
// ============================================================================

// Physics
export const RING_MAX_SPEED = 1400; // Max speed cap (~60 mph equivalent)
export const RING_BOOST_ACCEL = 1200; // Boost acceleration
export const RING_GRAVITY = -600; // Constant downward gravity
export const RING_GRID_BOUNDS = 1500; // Movement boundary

// Ring sizing
export const INITIAL_RING_SIZE = CAR_WIDTH * 20; // Start at 20x car width (600 units diameter)
export const RING_TUBE_RADIUS = 8; // Thickness of the ring torus

// Ring movement and spawning
export const RING_SPAWN_DISTANCE = -1100; // Spawn rings far behind camera
export const RING_DESPAWN_DISTANCE = 1000; // Remove rings well past camera
export const RING_BASE_SPEED = 200; // Base units per second toward camera
export const RING_BASE_SPAWN_INTERVAL = 3.0; // Base seconds between ring spawns

// Ring colors (neon 80s aesthetic)
export const RING_COLORS = [
  0xff00ff, // Magenta
  0x00ffff, // Cyan
  0xff0080, // Hot pink
  0x00ff00, // Green
  0xffff00, // Yellow
  0xff6600  // Orange
];

// ============================================================================
// DIFFICULTY SETTINGS
// ============================================================================

export const DIFFICULTY_SETTINGS = {
  easy: {
    // Ring properties
    sizeMultiplier: 1.5,        // 50% larger rings
    speedMultiplier: 0.7,        // 30% slower
    spawnIntervalMultiplier: 1.3, // More time between rings

    // Progression
    progressionRate: 0,          // No difficulty increase

    // Patterns
    allowedPatterns: ['horizontal_line', 'vertical_line'], // Only straight lines
    patternAmplitudeMultiplier: 1.0,

    // Other
    initialLives: 7              // More forgiving
  },
  normal: {
    // Ring properties
    sizeMultiplier: 1.0,         // Default size
    speedMultiplier: 0.85,       // 15% slower for more reaction time
    spawnIntervalMultiplier: 1.5, // 50% more time between rings

    // Progression
    progressionRate: 1.0,        // Normal progression

    // Patterns
    allowedPatterns: null,       // All patterns (progressive unlock)
    patternAmplitudeMultiplier: 0.55, // Tighter patterns for easier tracking
    excludeRandomPattern: true,  // No harsh cross-map teleports in Normal

    // Other
    initialLives: 5              // Default
  },
  hard: {
    // Ring properties
    sizeMultiplier: 0.7,         // 30% smaller rings
    speedMultiplier: 1.3,        // 30% faster
    spawnIntervalMultiplier: 0.75, // Less time between rings

    // Progression
    progressionRate: 1.5,        // Faster progression

    // Patterns
    allowedPatterns: null,       // All patterns (immediate unlock)
    patternAmplitudeMultiplier: 1.4, // Wider patterns

    // Other
    initialLives: 3              // Less forgiving
  }
};

// ============================================================================
// RING MODE PATTERNS
// ============================================================================

export const RING_PATTERNS = {
  single: {
    name: 'Single Ring',
    generate: (x, y) => [{ x, y }]
  },
  horizontal_line: {
    name: 'Horizontal Line',
    generate: (x, y, amplitude) => [
      { x: x - amplitude * 0.5, y },
      { x, y },
      { x: x + amplitude * 0.5, y }
    ]
  },
  vertical_line: {
    name: 'Vertical Line',
    generate: (x, y, amplitude) => [
      { x, y: y - amplitude * 0.5 },
      { x, y },
      { x, y: y + amplitude * 0.5 }
    ]
  },
  zigzag: {
    name: 'Zigzag',
    generate: (x, y, amplitude) => [
      { x: x - amplitude * 0.3, y: y + amplitude * 0.2 },
      { x, y },
      { x: x + amplitude * 0.3, y: y - amplitude * 0.2 }
    ]
  },
  spiral: {
    name: 'Spiral',
    generate: (x, y, amplitude) => {
      const positions = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const radius = amplitude * 0.3 * (i / 5);
        positions.push({
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius
        });
      }
      return positions;
    }
  },
  cross: {
    name: 'Cross',
    generate: (x, y, amplitude) => [
      { x, y: y + amplitude * 0.3 },
      { x: x - amplitude * 0.3, y },
      { x, y },
      { x: x + amplitude * 0.3, y },
      { x, y: y - amplitude * 0.3 }
    ]
  },
  wave: {
    name: 'Wave',
    generate: (x, y, amplitude) => {
      const positions = [];
      for (let i = 0; i < 5; i++) {
        const xOffset = (i - 2) * amplitude * 0.15;
        const yOffset = Math.sin((i / 4) * Math.PI) * amplitude * 0.3;
        positions.push({ x: x + xOffset, y: y + yOffset });
      }
      return positions;
    }
  },
  random: {
    name: 'Random Scatter',
    generate: (x, y, amplitude) => {
      const positions = [];
      for (let i = 0; i < 4; i++) {
        positions.push({
          x: x + (Math.random() - 0.5) * amplitude * 0.6,
          y: y + (Math.random() - 0.5) * amplitude * 0.6
        });
      }
      return positions;
    }
  }
};

// Pattern unlock progression
export const PATTERN_UNLOCK_THRESHOLDS = {
  single: 0,
  horizontal_line: 0,
  vertical_line: 0,
  zigzag: 5,
  spiral: 10,
  cross: 15,
  wave: 20,
  random: 25
};

// ============================================================================
// AUDIO CHORD PROGRESSION
// ============================================================================

// Chill chord progression (Am - F - C - G in Hz)
export const CHORD_PROGRESSION = [
  220,   // A (Am)
  174.6, // F
  261.6, // C
  196    // G
];

// ============================================================================
// MENU NAVIGATION
// ============================================================================

export const MENU_NAV_COOLDOWN = 200; // ms between navigation inputs

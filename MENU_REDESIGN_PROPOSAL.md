# Menu Navigation Redesign Proposal

## Current Problems

1. **Mixed Navigation Models**: Cards collapse/expand, but grid navigation ignores card boundaries
2. **Complex Nesting**: Labels + controls in rows makes it hard to predict what pressing down will do
3. **No Clear Grid**: Elements wrap in unpredictable ways (buttons in same row, selects, sliders with labels)
4. **Card Headers as Focusable**: Headers take focus but behave differently than controls
5. **Spacer/Tag Elements**: Non-interactive elements (spans, tags) complicate navigation logic

## Proposed Solution: Two-Column Menu Layout

### Design Principles

1. **Clear Visual Grid**: 
   - Left column: Labels/headers
   - Right column: Controls (buttons, selects, sliders)
   - No wrapping, no mixed layouts

2. **Logical Navigation**:
   - DOWN: Next row
   - UP: Previous row
   - LEFT: Move between columns
   - RIGHT: Move between columns
   - No card collapsing needed (sections always visible or grouped logically)

3. **Card as Visual Group, Not Navigation Gate**:
   - Cards are just visual containers
   - Navigation flows through all elements in order
   - Card expansion/collapse is optional visual enhancement, not navigation blocker

### New Menu Structure

```
┌─────────────────────────────────────┐
│ ROTATION                            │
├──────────────────┬──────────────────┤
│                  │ [Air Roll Left]  │
│                  │ [Air Roll Right] │  ← These don't wrap
│                  │ [Air Roll Free]  │
│                  │ [Restart]        │
├──────────────────┼──────────────────┤
│ Air Roll Mode:   │ [Toggle/Hold]    │
├──────────────────┼──────────────────┤
│ Lock Axes:       │ [Pitch] [Yaw]    │ ← Buttons in row navigation
├──────────────────┼──────────────────┤
│ GAMEPAD          │                  │
├──────────────────┼──────────────────┤
│ Status:          │ [Enable/Disable] │
│ Preset:          │ [PS5 / XInput]   │
│ Remap:           │ [Remap...] [Act] │
│ Defaults:        │ [Reset]          │
├──────────────────┼──────────────────┤
│ VIEW & HUD       │                  │
├──────────────────┼──────────────────┤
│ Display:         │ [Arrow] [Circle] │
│ Zoom:            │ [======●======]  │
│ Stick Size:      │ [======●======]  │
│ Arrow Size:      │ [======●======]  │
└──────────────────┴──────────────────┘
```

### Navigation Rules (Simplified)

1. **Linear Top-to-Bottom Focus**:
   - All interactive elements form a single logical sequence
   - DOWN: Next element
   - UP: Previous element

2. **Left/Right: Lateral Navigation**:
   - Within a row: move between adjacent controls
   - Buttons in same row: left/right moves between them
   - If no control to left/right: stay in place

3. **No Card Boundaries**:
   - Card headers become visual-only (don't take focus)
   - Cards don't gate navigation
   - Collapsing is purely visual

### Implementation Strategy

**Option A: Simple Linear Navigation** (Easiest)
```javascript
// Single flat array of focusable elements
focusableElements = [btn1, btn2, btn3, select1, slider1, ...]

// Navigation:
// DOWN: index++
// UP: index--
// LEFT/RIGHT: find sibling in same row (by Y position)
```

**Option B: Row-Based Navigation** (Balanced)
```javascript
// Group elements by rows
rows = [
  { elements: [btn1, btn2, btn3] },      // Row 0
  { elements: [select1] },                // Row 1
  { elements: [slider1] },                // Row 2
  ...
]

// Navigation:
// DOWN: next row
// UP: previous row
// LEFT/RIGHT: move within row
```

**Option C: Keep Current but Simplify** (Less Change)
- Remove card headers from focus
- Make navigation always linear through all controls
- Cards stay visual only

## Questions to Answer

1. **Should card headers (h3) be focusable?**
   - Current: Yes, but confusing
   - Option A: No, they're just labels
   - Option B: Maybe, but only as section markers

2. **Should cards collapse/expand?**
   - Current: Yes (interactive headers)
   - Option A: No, always show all content
   - Option B: Yes, but don't affect navigation

3. **How many columns?**
   - Current: 1 (everything wraps)
   - Option A: 2 (labels | controls)
   - Option B: 3 (icons | labels | controls)

4. **Multi-button rows (like "Pitch", "Yaw", "Roll" buttons)?**
   - Current: Awkward wrapping
   - Option A: Keep in single row, navigate with left/right
   - Option B: Break into separate rows

## Recommended Approach: Option B (Row-Based)

**Why:**
- Makes navigation predictable and grid-like
- Minimal HTML changes needed
- Keeps card visual structure
- Works well with gamepad and keyboard

**Implementation:**
1. Convert menu to 2-column layout (label | control)
2. Each row is one focusable element (or multiple if buttons side-by-side)
3. Navigation: UP/DOWN between rows, LEFT/RIGHT between controls in same row
4. Remove card headers from focus
5. Cards are visual groups only, don't gate navigation

## Next Steps

1. **Design**: Agree on the layout approach
2. **HTML**: Restructure menu to support chosen layout
3. **CSS**: Update styling for 2-column or chosen layout
4. **Navigation**: Rewrite to use row-based model
5. **Test**: Verify UP/DOWN/LEFT/RIGHT work intuitively

---

Should we go with **Option B (Row-Based Navigation)** or explore a different approach?

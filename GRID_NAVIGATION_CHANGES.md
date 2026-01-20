# Grid-Based Menu Navigation System

## Overview
The menu navigation has been completely redesigned from a linear, sequential system to a **2D grid-based spatial navigation system**. This makes menu navigation more intuitive and predictable, similar to how game menus typically work.

## What Changed

### Before (Linear/Sequential Navigation)
- **Down**: Cycle to next element in order (within card, then to next card)
- **Up**: Cycle to previous element in order
- **Left/Right**: Navigate within current card only, wrapping at edges
- Elements in different cards but visually on the same row would not be reachable via left/right

### After (Grid-Based Navigation)
- **Down**: Navigate to the element directly below the currently focused element
- **Up**: Navigate to the element directly above the currently focused element
- **Left**: Navigate to the element directly to the left
- **Right**: Navigate to the element directly to the right
- Navigation is based on **visual position**, not document order
- No wrapping to opposite edges when no element exists in that direction

## How It Works

### Spatial Calculation
The system uses element bounding boxes to determine spatial relationships:

1. Get the current element's center point: `(centerX, centerY)`
2. For each potential target direction (up, down, left, right):
   - Filter elements that are in that direction from the current element
   - Calculate a **score** for each candidate based on:
     - **Alignment distance**: How well-aligned the element is with the current element
     - **Direction distance**: How far away the element is in that direction
   - **Weighting formula**: 
     - For vertical navigation (up/down): `horizontalDistance * 2 + verticalDistance`
     - For horizontal navigation (left/right): `verticalDistance * 2 + horizontalDistance`
   - This weighting prioritizes **alignment** (2x weight) over raw distance

3. Select the element with the best (lowest) score as the target

### Example
```
Current position: [Button A]

Layout:
[Button A]  [Button B]   [Button C]
[Button D]  [Button E]   [Button F]

Pressing DOWN from A:
- D is directly below A (horizontal alignment perfect)
- E and F are also below, but not aligned
- D is selected (lowest score)

Pressing RIGHT from A:
- B is to the right and mostly aligned vertically
- C is also to the right but further away
- B is selected (lowest score)
```

## Technical Implementation

### Files Modified
1. **`docs/js/modules/input.js`**
   - Updated `findClosestElementInDirection()` function
   - Replaced card-based navigation logic with spatial grid logic

2. **`docs/js/modules/menuNavigator.js`**
   - Updated `navigate()` method to remove `isHeader` parameter
   - Replaced `findVerticalElement()` method with grid-based spatial calculation
   - Replaced `findHorizontalElement()` method with grid-based spatial calculation
   - Removed helper methods that are no longer needed:
     - `findNextCardElement()`
     - `findPreviousCardHeader()`
     - `findNextControlOrHeader()`
     - `findPreviousControlOrHeader()`

### Code Algorithm
```javascript
// For each direction:
// 1. Get current element center
const currentRect = element.getBoundingClientRect();
const centerX = currentRect.left + currentRect.width / 2;
const centerY = currentRect.top + currentRect.height / 2;

// 2. Filter candidates in that direction
for (each element) {
  if (direction === 'down' && centerY > currentCenterY) {
    // Calculate alignment-weighted score
    const horizontalDist = Math.abs(centerX - currentCenterX);
    const verticalDist = centerY - currentCenterY;
    const score = horizontalDist * 2 + verticalDist;
    candidates.push({ element, score });
  }
  // Same logic for up, left, right
}

// 3. Select best candidate
return candidates.sort((a,b) => a.score - b.score)[0];
```

## Testing Instructions

### 1. Open the Menu
- Click the hamburger menu (top-right)
- Or press Escape to toggle menu

### 2. Test Navigation with Keyboard
Open the browser console to see which element has focus:

**Test DOWN navigation:**
- Press Arrow Down
- Verify the highlight moves to the element directly below
- Try from different starting positions

**Test UP navigation:**
- Press Arrow Up
- Verify the highlight moves to the element directly above

**Test LEFT navigation:**
- Press Arrow Left
- Verify the highlight moves to the element directly to the left

**Test RIGHT navigation:**
- Press Arrow Right
- Verify the highlight moves to the element directly to the right

### 3. Test Navigation with Gamepad
- Connect a gamepad
- Use left stick or D-pad for the same tests as keyboard

### 4. Edge Cases to Test

**When pressing a direction with no element:**
- Example: Press UP from the topmost element
- Expected: No navigation (stays in place)
- This prevents "wrapping" which would feel unnatural in a grid

**Multiple buttons in a row:**
```
[Button A] [Button B] [Button C]
[Button D]
```
- From A, pressing RIGHT should select B
- From B, pressing RIGHT should select C
- From B, pressing DOWN should select D (the element most aligned below)

**Row elements with different vertical alignments:**
```
[Button A]
           [Button B]  (slightly lower)
[Button C]
```
- From A, pressing RIGHT should still select B (best alignment score)
- From A, pressing DOWN should consider B and C, selecting based on scores

**Cards collapsing/expanding:**
- When a card expands, new elements appear in the grid
- Navigation automatically includes/excludes these elements
- The grid recalculates on each navigation action

## Benefits

1. **Intuitive**: Navigation behaves like a spatial grid, not a list
2. **Predictable**: Users know where pressing down will take them
3. **Flexible**: Works with any number of columns/rows
4. **Accessible**: Better keyboard navigation for users with mobility issues
5. **Consistent**: Same logic for keyboard and gamepad input

## Backwards Compatibility

This is a **breaking change** from the old navigation system. 

**Implications:**
- Any user feedback or muscle memory about the old navigation pattern will no longer apply
- The new system should feel more natural and game-like
- No code compatibility issues (internal change only)

## Future Enhancements

Possible improvements:
1. **Configurable weights**: Allow users to adjust how much alignment matters vs distance
2. **Tab ordering**: Use tab-key for sequential traversal if users want the old behavior
3. **Snap-to-grid**: Optional feature to only allow navigation to elements in aligned rows/columns
4. **Diagonal navigation**: Support diagonal movement (though currently not mapped to controls)
5. **Wrapping modes**: Optional setting to wrap around edges like a true grid

## Commit Information

**Commit Hash**: d68d5da  
**Date**: 2026-01-20  
**Branch**: main  
**Message**: "feat: implement 2D grid-based menu navigation instead of linear cycling"

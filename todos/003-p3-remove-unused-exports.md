# Remove Unused Exports from ThumbnailGrid

**Priority:** P3 (Nice-to-Have)
**Category:** Code Cleanup
**Source:** Code Review PR #4

## Problem

ThumbnailGrid.tsx exports two items that are never used:
- `SimpleThumbnail` component (lines 355-400)
- `useThumbnailGridKeyboard` hook (lines 402-511)

This is ~150 lines of dead code that increases bundle size.

## Proposed Solution

1. Search codebase to confirm these are unused
2. Delete the unused exports
3. If keyboard navigation is desired later, it can be re-implemented

## Files to Modify

- `src/renderer/components/ThumbnailGrid.tsx` - Remove lines 355-511

## Estimated Effort

Small (~10 minutes)

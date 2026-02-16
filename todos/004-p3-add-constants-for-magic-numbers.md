# Add Constants for Magic Numbers

**Priority:** P3 (Nice-to-Have)
**Category:** Code Quality
**Source:** Code Review PR #4

## Problem

Magic number `3` used in ThumbnailGrid.tsx line 262:
```typescript
{tags.slice(0, 3).map(tag => (
```

## Proposed Solution

```typescript
const MAX_VISIBLE_TAG_BADGES = 3;
// ...
{tags.slice(0, MAX_VISIBLE_TAG_BADGES).map(tag => (
```

## Files to Modify

- `src/renderer/components/ThumbnailGrid.tsx`

## Estimated Effort

Trivial (~5 minutes)

# Extract filterByName Utility

**Priority:** P3 (Nice-to-Have)
**Category:** Code Quality / DRY
**Source:** Code Review PR #4

## Problem

The same search/filter logic is duplicated in 5 components:
- `TagManager.tsx` (lines 164-166)
- `AlbumManager.tsx` (lines 144-147)
- `BatchActions.tsx` (lines 153-158)
- `TagPanel.tsx` (lines 121-124)
- `QuickTagMenu.tsx` (lines 151-153)

Pattern: `items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()))`

## Proposed Solution

Create a shared utility:

```typescript
// src/renderer/utils/filterByName.ts
export function filterByName<T extends { name: string }>(
  items: T[],
  query: string
): T[] {
  if (!query.trim()) return items;
  const lowerQuery = query.toLowerCase();
  return items.filter(item => item.name.toLowerCase().includes(lowerQuery));
}
```

## Files to Modify

- Create: `src/renderer/utils/filterByName.ts`
- Modify: All 5 components listed above

## Estimated Effort

Small (~20 minutes)

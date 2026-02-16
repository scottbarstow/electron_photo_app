# Extract useClickOutside Hook

**Priority:** P3 (Nice-to-Have)
**Category:** Code Quality / DRY
**Source:** Code Review PR #4

## Problem

The same click-outside detection pattern is duplicated in 3 components:
- `BatchActions.tsx` (lines 40-54)
- `QuickTagMenu.tsx` (lines 63-72)
- `TagPanel.tsx` (lines 30-42)

Each has ~10 lines of identical useEffect logic.

## Proposed Solution

Create a reusable hook:

```typescript
// src/renderer/hooks/useClickOutside.ts
import { useEffect, RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement>,
  handler: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler, enabled]);
}
```

## Files to Modify

- Create: `src/renderer/hooks/useClickOutside.ts`
- Modify: `BatchActions.tsx`, `QuickTagMenu.tsx`, `TagPanel.tsx`

## Estimated Effort

Small (~30 minutes)

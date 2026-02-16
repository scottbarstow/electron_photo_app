# Standardize Error Handling Pattern

**Priority:** P3 (Nice-to-Have)
**Category:** UX / Code Quality
**Source:** Code Review PR #4

## Problem

Inconsistent error handling across components:
- **TagManager.tsx**: Has `error` state and shows errors to user (good)
- **AlbumManager.tsx**: Only `console.error`, no user feedback
- **TagPanel.tsx**: Only `console.error`
- **BatchActions.tsx**: Only `console.error`
- **QuickTagMenu.tsx**: Only `console.error`

## Proposed Solution

Option A: Add error state to all components (more work)
Option B: Create a toast/notification system for errors (better UX)
Option C: Create error boundary + context for centralized error handling

Recommended: Start with Option A for consistency, plan Option B for future.

## Pattern to Follow (from TagManager.tsx)

```typescript
const [error, setError] = useState<string | null>(null);

// In API calls:
if (!response.success) {
  setError(response.error || 'Operation failed');
}

// In JSX:
{error && (
  <div className="bg-red-50 text-red-600 px-4 py-2 text-sm flex justify-between">
    <span>{error}</span>
    <button onClick={() => setError(null)}>×</button>
  </div>
)}
```

## Files to Modify

- `src/renderer/components/AlbumManager.tsx`
- `src/renderer/components/TagPanel.tsx`
- `src/renderer/components/BatchActions.tsx`
- `src/renderer/components/QuickTagMenu.tsx`

## Estimated Effort

Medium (~1-2 hours)

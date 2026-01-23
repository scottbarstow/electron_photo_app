---
title: setRootDirectory validation fails when checking against non-existent root
date: 2026-01-23
category: logic-errors
severity: high
module: directory-service
component: DirectoryService
file: src/main/directory-service.ts

tags:
  - electron
  - validation
  - directory-service
  - circular-dependency
  - initialization
  - path-safety

symptoms:
  - "Selected directory is not valid or accessible" error on root selection
  - Root directory selection always fails
  - Persisted directories fail to restore on app restart
  - isValidDirectory returns false for valid paths when no root exists

root_cause: |
  isValidDirectory called isPathSafe which validates paths against the current
  root directory. When setting a NEW root (or restoring on startup), no current
  root exists, causing all validation to fail.

solution: |
  Created separate isValidRootCandidate() method that validates directory
  accessibility without checking containment within current root. Updated
  setRootDirectory and loadPersistedDirectory to use this method.

affected_methods:
  - setRootDirectory
  - loadPersistedDirectory
  - isValidDirectory
  - isPathSafe

pattern: initialization-order-dependency
---

# setRootDirectory Validation Bug

## Problem Statement

Users could not select a root directory in the Electron photo app. The error message "Selected directory is not valid or accessible" appeared for any directory selection, even valid, accessible directories.

The same issue prevented the app from restoring a previously saved root directory on restart.

## Symptoms

- Error: "Selected directory is not valid or accessible" when selecting any directory
- Root directory selection always fails on first use
- Previously saved root directories fail to load on app restart
- `isValidDirectory()` returns `false` for valid paths when no root exists

## Root Cause Analysis

The bug was a **circular dependency in validation logic**:

1. `setRootDirectory()` called `isValidDirectory()` to validate the new root
2. `isValidDirectory()` called `isPathSafe()` as part of its validation chain
3. `isPathSafe()` checks if a path is **within** the current root directory
4. When `currentRootPath` is `null`, `isPathSafe()` returns `false` for ALL paths

**The Catch-22:**
- To set a root, you need to pass validation
- Validation requires an existing root
- No root exists until you set one

```typescript
// THE BUG: isPathSafe assumes a root exists
private isPathSafe(targetPath: string): boolean {
  if (!this.currentRootPath) {
    return false; // Denies ALL paths when no root is configured
  }
  // Checks if targetPath is within currentRootPath
  return resolvedTarget.startsWith(resolvedRoot + path.sep);
}

// setRootDirectory incorrectly used isValidDirectory
setRootDirectory(dirPath: string): boolean {
  if (!this.isValidDirectory(dirPath)) {  // This calls isPathSafe!
    return false;
  }
  // ...
}
```

## Solution

### Step 1: Create a New Validation Method for Root Candidates

Added `isValidRootCandidate()` that validates a directory for use as a root WITHOUT checking if it falls within the current root:

```typescript
// Validate a directory for use as root (doesn't check against current root)
private isValidRootCandidate(dirPath: string): boolean {
  try {
    const stats = fs.statSync(dirPath);
    const isDir = stats.isDirectory();
    const hasAccess = this.hasReadAccess(dirPath);

    if (!isDir || !hasAccess) {
      console.log('isValidRootCandidate failed for:', dirPath, { isDir, hasAccess });
    }

    return isDir && hasAccess;
  } catch (err) {
    console.log('isValidRootCandidate error for:', dirPath, err);
    return false;
  }
}
```

### Step 2: Update setRootDirectory

Changed `setRootDirectory()` to use `isValidRootCandidate()`:

```typescript
setRootDirectory(dirPath: string): boolean {
  // Use isValidRootCandidate instead of isValidDirectory since we're setting
  // a NEW root, not accessing a path within the existing root
  if (!this.isValidRootCandidate(dirPath)) {
    return false;
  }
  // ... rest unchanged
}
```

### Step 3: Update loadPersistedDirectory

Applied the same fix to the directory restoration logic:

```typescript
private loadPersistedDirectory(): void {
  const savedPath = this.store.get('rootDirectory') as string | null;
  // Use isValidRootCandidate since we're restoring the root, not accessing within it
  if (savedPath && this.isValidRootCandidate(savedPath)) {
    this.currentRootPath = savedPath;
    this.startWatching();
  }
}
```

### Step 4: Remove Redundant Pre-Check in Renderer

Removed the redundant `isValid()` pre-check in `App.tsx` that had the same issue:

```typescript
// BEFORE (buggy)
const validResponse = await window.electronAPI.directory.isValid(dirPath);
if (!validResponse.success || !validResponse.data) {
  throw new Error('Selected directory is not valid or accessible');
}
const setResponse = await window.electronAPI.directory.setRoot(dirPath);

// AFTER (fixed)
const setResponse = await window.electronAPI.directory.setRoot(dirPath);
if (!setResponse.success) {
  throw new Error(setResponse.error || 'Failed to set root directory');
}
```

## Why This Works

The solution separates two distinct validation concerns:

1. **Root candidate validation** (`isValidRootCandidate`): "Is this a valid directory I could use as a root?" - Only needs to verify the directory exists and is readable.

2. **Path safety validation** (`isPathSafe`): "Is this path safely within my current root?" - Requires an existing root to check against.

Security is preserved because `isPathSafe()` remains in `isValidDirectory()` for all normal file/directory access operations.

## Files Changed

| File | Changes |
|------|---------|
| `src/main/directory-service.ts` | Added `isValidRootCandidate()`, updated `setRootDirectory()` and `loadPersistedDirectory()` |
| `src/renderer/App.tsx` | Removed redundant `isValid()` pre-check |

## Prevention Strategies

### 1. Design Validation Functions with Clear Separation of Concerns

Each validation function should have exactly ONE responsibility and ONE context:

```typescript
// GOOD: Clear separation
isValidRootCandidate(path)    // For SETTING the root
isPathWithinRoot(path)        // For ACCESSING within established root

// BAD: Conflated concerns
isValidPath(path)             // What context? Ambiguous
```

### 2. Make Preconditions Explicit

If a function requires certain state, make it obvious:

```typescript
// Better: Type system enforces precondition
private isPathWithinRoot(
  targetPath: string,
  rootPath: string  // Caller must provide - can't be null
): boolean
```

### 3. Test State Transitions

Always test the "first use" scenario where no prior configuration exists:

```typescript
it('can set root directory on fresh service with no prior root', () => {
  const service = new DirectoryService();
  expect(service.setRootDirectory('/valid/directory')).toBe(true);
});
```

### 4. Code Review Checklist

When reviewing validation functions, ask:
- What state does this function assume?
- Do all callers meet the preconditions?
- What happens with null/unset state?
- Are there tests for the "first use" scenario?

## Related Documentation

- `docs/TODO-security-review.md` - Security review items including path validation testing
- PR #2 - Phase 1A implementation where the bug was introduced
- Commit `9801ba4` - The fix commit

## Key Lesson

> Validation functions that depend on application state must handle the bootstrapping case where that state doesn't yet exist. Separate "candidate" validation from "operational" validation when the validation context differs.

This pattern appears frequently in applications with configurable base paths, sandboxed file access, or security boundaries that must be established before they can be enforced.

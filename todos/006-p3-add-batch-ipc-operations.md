# Add Batch IPC Operations

**Priority:** P3 (Nice-to-Have)
**Category:** Performance / Agent Integration
**Source:** Code Review PR #4

## Problem

Currently, batch operations loop through items making individual IPC calls:
```typescript
// BatchActions.tsx lines 78-84
for (const imageId of selectedIds) {
  await window.electronAPI.tags.addToImage(imageId, tag.id);
}
```

This is inefficient for:
- Large batch selections (50+ images)
- Agent integrations that may work with many images

## Proposed Solution

Add batch IPC handlers:

```typescript
// In ipc-handlers.ts
ipcMain.handle('tags:addToImages', async (event, imageIds: number[], tagId: number) => {
  return handleAsyncIpc(async () => {
    const db = getDatabase();
    for (const imageId of imageIds) {
      db.addTagToImage(imageId, tagId);
    }
  });
});

ipcMain.handle('albums:addImages', async (event, albumId: number, imageIds: number[]) => {
  return handleAsyncIpc(async () => {
    const db = getDatabase();
    for (const imageId of imageIds) {
      db.addImageToAlbum(albumId, imageId);
    }
  });
});
```

## Files to Modify

- `src/main/ipc-handlers.ts` - Add batch handlers
- `src/preload.ts` - Expose batch methods
- `src/renderer/App.tsx` - Update ElectronAPI interface
- `src/renderer/components/BatchActions.tsx` - Use batch methods

## Estimated Effort

Medium (~1-2 hours)

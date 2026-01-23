---
title: "feat: Phase 5 - Tags & Albums UI"
type: feat
date: 2026-01-23
parent_plan: ./2026-01-22-feat-phase-1a-core-photo-management-plan.md
---

# Phase 5: Tags & Albums UI

## Overview

Implement the user interface for manual photo organization using tags and albums. The backend infrastructure (database, IPC handlers, preload APIs) is already complete - this phase focuses on React components and user workflows.

## Current State

**Already implemented (backend):**
- Database tables: `tags`, `image_tags`, `albums`, `album_images`
- All CRUD operations in `src/main/database.ts`
- All IPC handlers in `src/main/ipc-handlers.ts`:
  - `tags:create`, `tags:get`, `tags:getAll`, `tags:update`, `tags:delete`
  - `tags:addToImage`, `tags:removeFromImage`, `tags:getForImage`, `tags:getImages`
  - `albums:create`, `albums:get`, `albums:getAll`, `albums:update`, `albums:delete`
  - `albums:addImage`, `albums:removeImage`, `albums:getImages`, `albums:getForImage`, `albums:reorderImages`
- Preload API exposing all methods via `window.electronAPI.tags` and `window.electronAPI.albums`

**Missing (UI layer):**
- TagManager component for creating/editing/deleting tags
- AlbumManager component for album organization
- Tag assignment UI in thumbnail grid and photo detail
- Album browsing view
- Multi-select batch tagging
- Tag/album filtering in sidebar

## Proposed Solution

Build a tag and album UI that:
- **Tags:** Color-coded labels assignable to images, with batch tagging support
- **Albums:** Ordered collections of images with cover images
- **Integration:** Seamless tagging from thumbnail grid and photo detail view
- **Filtering:** Browse images by tag or album from the sidebar

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Renderer Process                         │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ FolderTree  │  │  ThumbnailGrid  │  │    PhotoDetail      │  │
│  │  + TagList  │  │  + TagBadges    │  │    + TagPanel       │  │
│  │  + Albums   │  │  + Selection    │  │    + AlbumPanel     │  │
│  └──────┬──────┘  └────────┬────────┘  └──────────┬──────────┘  │
│         │                  │                      │              │
│  ┌──────┴──────────────────┴──────────────────────┴──────────┐  │
│  │               App.tsx (State + Tag/Album Context)          │  │
│  └────────────────────────────┬───────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │ IPC (already implemented)
┌───────────────────────────────┼─────────────────────────────────┐
│                         Main Process                             │
│          Database + IPC handlers (already complete)              │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

#### Task 1: TagManager Component

**File:** `src/renderer/components/TagManager.tsx`

Create a modal/panel for managing tags.

**Features:**
- List all tags with color swatches
- Create new tag with name and color picker
- Edit tag name/color (inline editing)
- Delete tag with confirmation (shows affected image count)
- Search/filter tags

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Manage Tags                         [×] │
├─────────────────────────────────────────┤
│ [+ New Tag]  Search: [___________]      │
│                                         │
│ ● Nature (12 images)            [✎][🗑] │
│ ● Family (45 images)            [✎][🗑] │
│ ● Vacation (23 images)          [✎][🗑] │
│ ● Work (8 images)               [✎][🗑] │
│                                         │
│ Create New Tag:                         │
│ Name: [___________]                     │
│ Color: [●●●●●●●●] (color picker)        │
│ [Create Tag]                            │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsChanged: () => void; // Refresh callback
}

// State
const [tags, setTags] = useState<Tag[]>([]);
const [newTagName, setNewTagName] = useState('');
const [newTagColor, setNewTagColor] = useState('#6b7280');
const [editingTagId, setEditingTagId] = useState<number | null>(null);
const [searchQuery, setSearchQuery] = useState('');
```

#### Task 2: AlbumManager Component

**File:** `src/renderer/components/AlbumManager.tsx`

Create a panel for managing albums.

**Features:**
- Grid view of albums with cover images
- Create new album (name, description)
- Edit album metadata
- Delete album with confirmation
- View album contents

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Albums                              [+] │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ [cover] │ │ [cover] │ │ [cover] │    │
│ │ Summer  │ │ Wedding │ │ Kids    │    │
│ │ 45 imgs │ │ 120 imgs│ │ 89 imgs │    │
│ └─────────┘ └─────────┘ └─────────┘    │
│                                         │
│ ┌─────────┐ ┌─────────┐                │
│ │ [cover] │ │   [+]   │                │
│ │ Travel  │ │ Create  │                │
│ │ 67 imgs │ │  New    │                │
│ └─────────┘ └─────────┘                │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
interface AlbumManagerProps {
  onAlbumSelect: (albumId: number) => void;
  selectedAlbumId: number | null;
}

interface AlbumWithCount extends Album {
  imageCount: number;
  coverThumbnail: string | null;
}
```

#### Task 3: TagBadges on ThumbnailGrid

**File:** `src/renderer/components/ThumbnailGrid.tsx` (modify)

Add tag badges to thumbnail items.

**Features:**
- Small colored dots/pills showing tags on each thumbnail
- Maximum 3 visible + "+N more" indicator
- Tooltip showing all tags on hover

**Implementation:**
```typescript
// Add to ThumbnailItem component
const [imageTags, setImageTags] = useState<Tag[]>([]);

useEffect(() => {
  if (imageId) {
    window.electronAPI.tags.getForImage(imageId).then(response => {
      if (response.success) setImageTags(response.data);
    });
  }
}, [imageId]);
```

**Styling:**
```tsx
<div className="absolute bottom-1 left-1 flex gap-0.5">
  {imageTags.slice(0, 3).map(tag => (
    <span
      key={tag.id}
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: tag.color }}
      title={tag.name}
    />
  ))}
  {imageTags.length > 3 && (
    <span className="text-[10px] text-white bg-black/50 px-1 rounded">
      +{imageTags.length - 3}
    </span>
  )}
</div>
```

#### Task 4: QuickTagMenu Component

**File:** `src/renderer/components/QuickTagMenu.tsx`

Context menu for quick tag assignment.

**Features:**
- Right-click on thumbnail(s) to open
- Shows all tags with checkboxes
- Checked = image has tag
- Partially checked = some selected images have tag
- Quick create new tag inline

**UI Mockup:**
```
┌────────────────────────┐
│ Tags                   │
├────────────────────────┤
│ ☑ Nature              │
│ ☐ Family              │
│ ☑ Vacation            │
│ ▣ Work (partial)      │
├────────────────────────┤
│ [+ Create new tag...] │
└────────────────────────┘
```

**Implementation:**
```typescript
interface QuickTagMenuProps {
  x: number;
  y: number;
  imageIds: number[];
  onClose: () => void;
  onTagsChanged: () => void;
}
```

#### Task 5: PhotoDetail Tag/Album Panel

**File:** `src/renderer/components/PhotoDetail.tsx` (modify)

Add tag and album management to photo detail view.

**Features:**
- Show current tags as removable chips
- Add tag via dropdown/autocomplete
- Show albums containing this image
- Add to album via dropdown

**UI Addition:**
```
┌─────────────────────────────────────────┐
│ Tags                                    │
│ [Nature ×] [Vacation ×] [+ Add Tag ▼]  │
├─────────────────────────────────────────┤
│ Albums                                  │
│ [Summer 2024 ×] [Travel ×] [+ Add ▼]   │
└─────────────────────────────────────────┘
```

#### Task 6: Sidebar Tag/Album Lists

**File:** `src/renderer/components/FolderTree.tsx` (modify) or `Sidebar.tsx` (new)

Add collapsible tag and album lists to sidebar.

**Features:**
- Collapsible "Tags" section showing all tags
- Click tag to filter grid to show only images with that tag
- Collapsible "Albums" section showing all albums
- Click album to view album contents

**UI:**
```
┌─────────────────────────┐
│ Folders                 │
│ ▼ Photos               │
│   ├── 2024             │
│   └── 2023             │
├─────────────────────────┤
│ ▼ Tags           [⚙]   │
│   ● Nature (12)        │
│   ● Family (45)        │
│   ● Vacation (23)      │
├─────────────────────────┤
│ ▼ Albums         [+]   │
│   📁 Summer 2024 (45)  │
│   📁 Wedding (120)     │
└─────────────────────────┘
```

#### Task 7: Multi-Select Batch Tagging

**File:** `src/renderer/components/BatchActions.tsx` (new)

Toolbar for batch operations when multiple images selected.

**Features:**
- Appears when 2+ images selected
- Shows selection count
- "Add Tags" button → opens tag selector
- "Add to Album" button → opens album selector
- "Remove from Album" (when viewing album)

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ 5 images selected  [Add Tags] [Add to Album] [Clear]       │
└─────────────────────────────────────────────────────────────┘
```

#### Task 8: Album View Mode

**File:** `src/renderer/App.tsx` (modify)

Add view mode for browsing album contents.

**Features:**
- Click album in sidebar → show album contents in grid
- Album header with name, description, image count
- Drag-to-reorder images within album
- "Remove from Album" context menu item
- Set cover image option

**State Addition:**
```typescript
type AppView = 'browser' | 'duplicates' | 'album';

const [currentView, setCurrentView] = useState<AppView>('browser');
const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
```

#### Task 9: Tag/Album TypeScript Types

**File:** `src/renderer/App.tsx` (modify ElectronAPI interface)

Ensure all tag/album APIs are properly typed.

```typescript
interface ElectronAPI {
  // ... existing
  tags: {
    create: (name: string, color?: string) => Promise<IpcResponse<number>>;
    get: (id: number) => Promise<IpcResponse<Tag>>;
    getByName: (name: string) => Promise<IpcResponse<Tag>>;
    getAll: () => Promise<IpcResponse<Tag[]>>;
    update: (id: number, updates: Partial<Tag>) => Promise<IpcResponse<void>>;
    delete: (id: number) => Promise<IpcResponse<void>>;
    addToImage: (imageId: number, tagId: number) => Promise<IpcResponse<void>>;
    removeFromImage: (imageId: number, tagId: number) => Promise<IpcResponse<void>>;
    getForImage: (imageId: number) => Promise<IpcResponse<Tag[]>>;
    getImages: (tagId: number) => Promise<IpcResponse<ImageRecord[]>>;
  };
  albums: {
    create: (name: string, description?: string) => Promise<IpcResponse<number>>;
    get: (id: number) => Promise<IpcResponse<Album>>;
    getAll: () => Promise<IpcResponse<Album[]>>;
    update: (id: number, updates: Partial<Album>) => Promise<IpcResponse<void>>;
    delete: (id: number) => Promise<IpcResponse<void>>;
    addImage: (albumId: number, imageId: number, position?: number) => Promise<IpcResponse<void>>;
    removeImage: (albumId: number, imageId: number) => Promise<IpcResponse<void>>;
    getImages: (albumId: number) => Promise<IpcResponse<ImageRecord[]>>;
    getForImage: (imageId: number) => Promise<IpcResponse<Album[]>>;
    reorderImages: (albumId: number, imageIds: number[]) => Promise<IpcResponse<void>>;
  };
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/components/TagManager.tsx` | Create | Tag CRUD modal |
| `src/renderer/components/AlbumManager.tsx` | Create | Album management panel |
| `src/renderer/components/QuickTagMenu.tsx` | Create | Right-click tag assignment |
| `src/renderer/components/BatchActions.tsx` | Create | Multi-select toolbar |
| `src/renderer/components/TagBadge.tsx` | Create | Reusable tag badge component |
| `src/renderer/components/AlbumCard.tsx` | Create | Album grid card component |
| `src/renderer/components/ThumbnailGrid.tsx` | Modify | Add tag badges, context menu |
| `src/renderer/components/PhotoDetail.tsx` | Modify | Add tag/album panels |
| `src/renderer/components/FolderTree.tsx` | Modify | Add tags/albums sections |
| `src/renderer/App.tsx` | Modify | Add album view, type updates |

## Acceptance Criteria

### Functional Requirements

- [ ] User can create, edit, and delete tags
- [ ] User can assign tags via right-click context menu
- [ ] User can assign tags from photo detail view
- [ ] Tag badges appear on thumbnails
- [ ] User can create, edit, and delete albums
- [ ] User can add images to albums
- [ ] User can view album contents
- [ ] User can reorder images within an album
- [ ] User can set album cover image
- [ ] User can filter images by tag via sidebar
- [ ] User can batch-tag multiple selected images
- [ ] Tags and albums persist across app restarts

### Non-Functional Requirements

- [ ] Tag operations complete within 100ms
- [ ] Album operations complete within 100ms
- [ ] Tag badges load asynchronously without blocking thumbnail render
- [ ] Context menus appear within 50ms of right-click

### Quality Gates

- [ ] All components use Tailwind CSS classes
- [ ] No TypeScript errors
- [ ] Follows existing patterns (useRef for tracking, proper cleanup)
- [ ] No infinite loops in useEffect/useCallback

## Verification Steps

1. **Tag CRUD:**
   - Create a new tag with custom color
   - Rename the tag
   - Delete the tag (verify images no longer show it)

2. **Tag Assignment:**
   - Right-click thumbnail → assign tag
   - Verify tag badge appears
   - Open photo detail → verify tag shown
   - Remove tag from photo detail

3. **Multi-Select Tagging:**
   - Select 3+ images
   - Use batch toolbar to add tag
   - Verify all selected images have tag

4. **Album Management:**
   - Create new album
   - Add images to album
   - View album contents
   - Reorder images in album
   - Set cover image
   - Delete album

5. **Sidebar Filtering:**
   - Click tag in sidebar
   - Verify grid shows only images with that tag
   - Click album in sidebar
   - Verify grid shows album contents

## Implementation Order

1. [x] **Task 9** - TypeScript types (foundation)
2. [x] **Task 1** - TagManager (can test tag CRUD)
3. [x] **Task 5** - PhotoDetail tag panel (single-image tagging)
4. [x] **Task 3** - TagBadges on thumbnails (visual feedback)
5. [x] **Task 4** - QuickTagMenu (context menu tagging)
6. [x] **Task 7** - BatchActions toolbar (multi-select)
7. [x] **Task 2** - AlbumManager (album CRUD)
8. [x] **Task 6** - Sidebar lists (navigation)
9. [x] **Task 8** - Album view mode (browsing)

## References

### Internal
- Parent plan: `docs/plans/2026-01-22-feat-phase-1a-core-photo-management-plan.md`
- Database implementation: `src/main/database.ts:514-731`
- IPC handlers: `src/main/ipc-handlers.ts:686-835`
- Preload API: `src/preload.ts:88-114`
- UI patterns: `docs/solutions/feature-implementations/duplicate-detection-ui.md`

### Patterns to Follow
- useRef for tracking loaded state (from DuplicateReview)
- Listener cleanup functions (from duplicates progress)
- User-controlled selection (no auto-assignment)

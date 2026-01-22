---
date: 2026-01-22
topic: photo-app-expanded-vision
---

# Photo App - Expanded Vision Brainstorm

## What We're Building

A full-featured photo management application built with Electron, React, and SQLite. Starting as a duplicate finder, expanding into a complete photo organizer with browsing, tagging, albums, search, and eventually AI-powered features like face recognition.

## Phased Approach

### Phase 1a: Core Functionality
- **Folder browsing:** Two-pane layout - folder tree (left), thumbnail grid (right)
- **Photo detail view:** Full-size preview with complete EXIF metadata (date, location, camera, lens, aperture, shutter speed, ISO, focal length)
- **Duplicate detection:** Exact hash matching (MD5/SHA), delete duplicates to system trash
- **Manual organization:** Tags, albums, search by file metadata and tags
- **Thumbnail generation:** Cache thumbnails for performance
- **HEIC support:** Convert iPhone photos for display

### Phase 1b: ML-Powered Content Search
- **CLIP integration:** Local model (clip-vit-base-patch32) for natural language image search
- **Image embeddings:** One-time encoding per image, stored in database
- **Search examples:** "beach sunset", "birthday party", "red car"
- **Learning goal:** Hands-on experience with local ML/ONNX runtime

### Phase 2: Face Recognition
- **Face detection:** Identify faces in photos
- **Face clustering:** Group similar faces
- **Person tagging:** Name individuals, search by person
- **Training UX:** "Is this the same person?" workflow
- **Local processing:** Privacy-focused, no cloud APIs

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Duplicate detection | Exact hash first, perceptual hash later | Start simple, perceptual_hash field already in schema |
| Deletion behavior | System trash via `shell.trashItem()` | Safest, recoverable, zero maintenance |
| Browsing UX | Folder tree + thumbnail grid | Familiar file-browser pattern |
| Photo detail | Full EXIF data | User is a photographer, wants aperture/ISO/lens info |
| File formats | JPG, PNG, HEIC | No RAW needed; HEIC for iPhone support |
| Scanning approach | On-demand per folder | Fast startup, simpler implementation |
| Metadata storage | SQLite only (no XMP) | Simpler, faster; can add XMP export later if needed |
| AI/ML approach | Local models, phased | CLIP for content search (Phase 1b), faces later (Phase 2) |

## Technical Implications

### Database Schema Extensions Needed
- `tags` table (id, name)
- `image_tags` junction table (image_id, tag_id)
- `albums` table (id, name, created)
- `album_images` junction table (album_id, image_id, sort_order)
- `image_embeddings` table for CLIP vectors (Phase 1b)
- `faces` and `persons` tables (Phase 2)

### Libraries to Evaluate
- **CSS Framework:** Tailwind CSS (utility-first, polished UI out of the gate)
- **Thumbnails/HEIC:** `sharp` (fast, handles HEIC conversion)
- **EXIF parsing:** `exifr` (comprehensive, fast)
- **Folder tree UI:** Need alternative to deprecated `react-sortable-tree`
- **CLIP inference:** `@xenova/transformers` or ONNX Runtime

### Performance Considerations
- Thumbnail caching is critical for large libraries
- CLIP embedding generation should be background/async
- Consider virtual scrolling for thumbnail grids with 1000+ images

## Open Questions

- Folder tree component: Which React tree library to use?
- Thumbnail cache location: App data folder? Alongside images?
- Album smart rules: Auto-populate albums by date/location? (Future consideration)

## What's Not In Scope (For Now)

- RAW file support
- Cloud sync
- Photo editing
- Video support
- XMP sidecar files
- Slideshows (future consideration)
- Auto-update (personal use only for now)

## Housekeeping

- Add MIT license to repository

## Next Steps

Run `/workflows:plan` to create implementation plan for Phase 1a.

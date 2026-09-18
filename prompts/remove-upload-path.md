# Implementation Prompt: Remove Upload Path & Enforce Sync-Only YouTube Model

## Goal
Enforce the sync-only architectural scope defined in `AGENTS.md` (Sections 1, 3, 5, 7, 8) by completely removing all remnants of the local file upload and transcoding path:
1. Remove the "Upload a file" option from `components/room/AddSourceModal.tsx` so only "Paste a YouTube link" remains.
2. Delete `components/player/UploadPlaceholder.tsx` and remove its import and usage from `app/room/[code]/page.tsx`.
3. Simplify `lib/player/types.ts` and `lib/models/Room.ts` by removing `"upload"` from `VideoSourceType` / `IActiveVideo` and dropping `transcodeStatus`.
4. Ensure API routes (`app/api/rooms/[code]/route.ts`, etc.) return only the simplified `activeVideo` schema without any upload-related fields.
5. Verify with automated checks that no references to the removed upload path remain and that the app builds cleanly.

---

## Skills and Docs Inspected
- `AGENTS.md`:
  - Section 1: "This product is sync-only. There is no local file upload... If a task or a stray reference anywhere still mentions upload, transcoding, or an object-storage pipeline, that's leftover from an earlier direction — flag it and remove it rather than building around it."
  - Section 3: "The add-source modal reference (`design/3-add-source-modal.jpg`) originally showed two options. Since uploads are cut, that modal now has one real option (paste a YouTube link) — don't preserve a disabled or dead 'Upload a file' option out of fidelity to an outdated mockup."
  - Section 8: "A Video describes a playable source: the YouTube video id, and duration. There is no upload type and no transcodeStatus — every video is a YouTube source."
  - Section 12: "Keep it small... This product does not accept file uploads — don't build toward one. Save a prompt and get approval before coding. Run the checks."
- `design/3-add-source-modal.jpg`: Reference modal visual structure adapted to single YouTube source option.

---

## Code Inspected
1. `components/room/AddSourceModal.tsx`:
   - Contains `handleSelectUpload` function and "Upload a file" button matching the old mockup.
2. `components/player/UploadPlaceholder.tsx`:
   - Component dedicated to rendering transcode progress / upload queued state.
3. `app/room/[code]/page.tsx`:
   - Imports `UploadPlaceholder` and renders it conditionally when `activeVideo?.type === 'upload'`.
4. `lib/player/types.ts`:
   - Defines `VideoSourceType = "youtube" | "upload"` and `transcodeStatus?: "pending" | "processing" | "ready" | "failed"`.
5. `lib/models/Room.ts`:
   - Defines `IActiveVideo` with `type: "youtube" | "upload"`, `transcodeStatus`, and Mongoose `ActiveVideoSchema` validation.
6. `app/api/rooms/[code]/route.ts`:
   - Returns `room.activeVideo` from MongoDB.

---

## Decisions and Assumptions
1. **Source Selection Modal UX**:
   - In `components/room/AddSourceModal.tsx`, remove `handleSelectUpload` and the "Upload a file" card.
   - Present the "Paste a YouTube link" option cleanly with its input form, preserving modal cancel action and quick demo presets for seamless testing.
2. **Delete `UploadPlaceholder.tsx`**:
   - Delete the file entirely using Node fs / terminal command.
   - In `app/room/[code]/page.tsx`, remove `import UploadPlaceholder` and the `activeVideo?.type === "upload"` branch. The fallback will remain the room placeholder video state.
3. **Data Model Simplification**:
   - In `lib/player/types.ts`, redefine:
     ```ts
     export type VideoSourceType = "youtube";
     export interface ActiveVideoSource {
       type: VideoSourceType;
       videoId?: string;
       title?: string;
       duration?: number;
     }
     ```
   - In `lib/models/Room.ts`, redefine:
     ```ts
     export interface IActiveVideo {
       type: "youtube";
       videoId?: string;
       duration?: number;
     }
     ```
     and in `ActiveVideoSchema`, constrain `type` to `enum: ["youtube"]` with `default: "youtube"`, removing `transcodeStatus`.

---

## Files to Touch
- `components/room/AddSourceModal.tsx` [MODIFY]
- `components/player/UploadPlaceholder.tsx` [DELETE]
- `app/room/[code]/page.tsx` [MODIFY]
- `lib/player/types.ts` [MODIFY]
- `lib/models/Room.ts` [MODIFY]

---

## Requirements
- The "Upload a file" option must be completely absent from `AddSourceModal.tsx`.
- `UploadPlaceholder.tsx` must be removed from the project.
- `app/room/[code]/page.tsx` must not reference or render `UploadPlaceholder`.
- `lib/player/types.ts` and `lib/models/Room.ts` must have zero mention of `upload` or `transcodeStatus`.
- No lingering references to upload pipelines or transcoding states remain in application code.

---

## Security Considerations
- Prevents any inadvertent API exposure or database fields for arbitrary file uploads or unvalidated storage keys.
- Strictly adheres to copyright and hosting boundaries by only allowing embeddable YouTube sources.

---

## Acceptance Criteria
- [ ] `components/player/UploadPlaceholder.tsx` is deleted.
- [ ] `AddSourceModal.tsx` only shows the YouTube link option (no "Upload a file").
- [ ] `app/room/[code]/page.tsx` cleanly handles YouTube and empty/placeholder states without upload branches.
- [ ] Types in `lib/player/types.ts` and `lib/models/Room.ts` are simplified to YouTube-only with no `transcodeStatus`.
- [ ] Codebase search confirms zero upload/transcode references in active app code (`lib/`, `components/`, `app/`).
- [ ] `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Checks to Run
- Code search: `grep` across `lib/`, `components/`, and `app/` to verify absence of `upload` and `transcode`.
- `npx tsc --noEmit`: Type check for all components and API routes.
- `npm run lint`: ESLint check for unused imports or formatting issues.

---

## Exact Manual Test Steps
1. Navigate to `http://localhost:3000/room/CDJF7B`.
2. Click "+ Add video":
   - Verify modal opens with only "Paste a YouTube link" (no "Upload a file" option).
3. Click "Paste a YouTube link" and paste a YouTube URL (or click demo preset).
4. Verify video loads and plays as YouTube source without any errors.

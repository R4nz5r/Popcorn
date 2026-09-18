# Implementation Prompt: MongoDB TTL Auto-Cleanup for Ephemeral Rooms

## 1. Goal
Implement a MongoDB TTL (Time-To-Live) index on the `Room` collection in `lib/models/Room.ts`. This automatically expires and deletes ephemeral watch rooms 48 hours (172,800 seconds) after creation, ensuring the MongoDB database remains permanently clean, lean, and within free tier limits without requiring cron jobs or manual administrative maintenance.

---

## 2. Skills & Code Inspected
- **Skills**: MongoDB Atlas TTL indexing, Mongoose schema definitions, Next.js API routes.
- **Code Inspected**:
  - [lib/models/Room.ts](file:///f:/Nextjs/watch-together/lib/models/Room.ts): Current `RoomSchema` with `timestamps: true` (provides `createdAt` and `updatedAt`) and `persistentSlug`.
  - [app/api/rooms/route.ts](file:///f:/Nextjs/watch-together/app/api/rooms/route.ts): Room creation route that writes new rooms with `code`, `hostId`, and `status`.

---

## 3. Decisions & Assumptions
- **Expiration Period**: 48 hours (`172800` seconds). This gives ample time for extended watch parties, pauses, and re-joining while ensuring stale/abandoned rooms get pruned naturally.
- **Partial Filter Expression**: Apply `{ partialFilterExpression: { persistentSlug: { $exists: false } } }` so only anonymous/ephemeral rooms auto-delete, preserving named/persistent rooms if any exist.
- **Mongoose Index Synchronization**: Mongoose auto-builds indexes in development or during the initial connection to MongoDB.

---

## 4. Files to Touch
- **[lib/models/Room.ts](file:///f:/Nextjs/watch-together/lib/models/Room.ts)**:
  - Add the TTL index declaration to `RoomSchema`.

---

## 5. Security & Edge Case Considerations
- **Non-Destructive to Active Sessions**: MongoDB's background TTL monitor runs once every 60 seconds and only deletes documents where `Date.now() - createdAt >= 48 hours`. Active watch sessions never last 48 continuous hours.
- **Index Build Safety**: Creating an index on `createdAt` with `background: true` is safe on MongoDB Atlas M0 clusters without blocking operations.

---

## 6. Acceptance Criteria
1. `RoomSchema` defines an index on `createdAt: 1` with `expireAfterSeconds: 172800`.
2. Partial filter expression protects any room with a `persistentSlug`.
3. `npm run lint` and `npm run build` pass with 0 errors.

---

## 7. Checks to Run
- `npm run lint`
- `npm run build`

---

## 8. Manual Test Steps
1. Review `lib/models/Room.ts` to verify index definition syntax.
2. Run `npm run build` to ensure type safety and schema compilation.
3. Test creating a room via `/api/rooms` or homepage to confirm creation succeeds normally with `createdAt` timestamp.

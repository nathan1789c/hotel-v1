# Security Specification — Hotel25 Firestore Rules

## 1. Data Invariants
1. **Workspace Ownership & PII Isolation**: Every hotel workspace (`/hotels/{hotelId}`) and its subcollections (`rooms`, `bookings`) store PII (`guestName`, `guestPhone`, `guestIdCard`, `hotelEmail`, `hotelPhone`). Only verified owners (`request.auth.uid == hotelId && resource.data.ownerUid == request.auth.uid && request.auth.token.email_verified == true`) or verified admins may read, list, create, update, or delete records.
2. **Master Gate Sync**: Every `room` and `booking` inside `/hotels/{hotelId}/...` MUST verify that parent `/hotels/{hotelId}` exists (`exists(...)`) on create and belongs to the authenticated verified user (`get(...).data.ownerUid == request.auth.uid`).
3. **Immutability & Temporal Integrity**: `ownerUid` and `serverCreatedAt` are immutable after creation. `serverCreatedAt` must equal `request.time` on create, and `serverUpdatedAt` must equal `request.time` on both create and update.
4. **Action-Based Updates & Terminal State Locking**: Updates to `bookings` are locked once `status` reaches `'completed'` or `'cancelled'` (unless performed by an admin). Every update explicitly allowlists affected keys and re-runs `isValidBooking` / `isValidRoom` / `isValidHotelWorkspace`.
5. **Bounded Arrays & String Lengths**: Every string field enforces strict `.size()` bounds and arrays (`services`, `servicesList`) enforce strict upper size bounds (`<= 50` / `<= 100`).

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /hotels/user123/bookings/bk-01` with `auth == null`.
2. **Unverified Email Write**: `CREATE /hotels/user123` with `auth.token.email_verified == false`.
3. **Admin Email Spoofing**: `GET /hotels/victim/bookings/bk-01` with `auth.token.email == 'Nathan.bui1789@gmail.com'` and `email_verified == false`.
4. **Cross-Tenant List Scraping**: `LIST /hotels/victim/bookings` without `where('ownerUid', '==', auth.uid)`.
5. **Identity Spoofing on Create**: `CREATE /hotels/user123/bookings/bk-x` with `ownerUid: 'otherUid'`.
6. **Shadow Ghost Field Injection**: `CREATE /hotels/user123/rooms/101` with extra `isAdmin: true`.
7. **ID Poisoning**: `CREATE /hotels/user123/rooms/<1500-char-id>` violating `isValidId`.
8. **Resource Exhaustion (1MB String)**: `UPDATE /hotels/user123/bookings/bk-01` setting `notes` to a 5,000-character string.
9. **Client Timestamp Forgery**: `CREATE /hotels/user123/bookings/bk-02` with `serverCreatedAt` set to a client-supplied past date instead of `request.time`.
10. **Terminal State Tampering**: `UPDATE /hotels/user123/bookings/bk-completed` changing `totalRoomPrice` after `status == 'completed'` (non-admin).
11. **Owner Reassignment**: `UPDATE /hotels/user123/rooms/101` modifying `ownerUid`.
12. **Privilege Escalation**: Non-admin attempting `CREATE /admins/attackerUid`.

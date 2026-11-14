import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  DocumentReference,
} from 'firebase/firestore';
import { Booking, HotelSettings, Room } from '../types/hotel';
import { DEFAULT_HOURLY_RATES, INITIAL_SETTINGS } from '../data/initialData';
import { db, handleFirestoreError, OperationType } from './firebase';

const workspaceCreatedAtMap = new Map<string, Timestamp>();
const roomCreatedAtMap = new Map<string, Timestamp>();
const bookingCreatedAtMap = new Map<string, Timestamp>();

function truncateStr(value: unknown, maxLen: number): string {
  const str = typeof value === 'string' ? value : String(value ?? '');
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function sanitizeId(value: string, fallbackPrefix: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}-${Date.now()}`;
}

async function resolveCreatedAt(
  ref: DocumentReference,
  cacheKey: string,
  cacheMap: Map<string, Timestamp>,
  path: string
): Promise<Timestamp | ReturnType<typeof serverTimestamp>> {
  const cached = cacheMap.get(cacheKey);
  if (cached) return cached;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const ts = snap.data()?.serverCreatedAt;
      if (ts instanceof Timestamp) {
        cacheMap.set(cacheKey, ts);
        return ts;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  return serverTimestamp();
}

export function buildWorkspacePayload(
  settings: HotelSettings,
  ownerUid: string,
  createdAtValue: Timestamp | ReturnType<typeof serverTimestamp>
): Record<string, unknown> {
  const servicesList = (Array.isArray(settings.servicesList) ? settings.servicesList : [])
    .slice(0, 100)
    .map((s) => ({
      id: truncateStr(s.id, 64),
      name: truncateStr(s.name, 120),
      price: Math.max(0, Number(s.price) || 0),
      category: s.category || 'other',
      unit: truncateStr(s.unit || '', 30),
      isActive: s.isActive !== false,
    }));

  const payload: Record<string, unknown> = {
    ownerUid,
    hotelName: truncateStr(settings.hotelName || INITIAL_SETTINGS.hotelName, 120) || 'Hotel25',
    hotelAddress: truncateStr(settings.hotelAddress || '', 300),
    hotelPhone: truncateStr(settings.hotelPhone || '', 40),
    hotelEmail: truncateStr(settings.hotelEmail || '', 120),
    defaultManagementFee: Math.max(0, Number(settings.defaultManagementFee) || 0),
    channelCommissions: settings.channelCommissions || INITIAL_SETTINGS.channelCommissions,
    pricingFormula:
      settings.pricingFormula === 'simple_markup' ? 'simple_markup' : 'net_guaranteed',
    roundingMethod:
      settings.roundingMethod === '10000' || settings.roundingMethod === 'none'
        ? settings.roundingMethod
        : '1000',
    servicesList,
    hourlyRates: {
      ...DEFAULT_HOURLY_RATES,
      ...(settings.hourlyRates || {}),
    },
    serverCreatedAt: createdAtValue,
    serverUpdatedAt: serverTimestamp(),
  };

  return payload;
}

export function buildRoomPayload(
  room: Room,
  ownerUid: string,
  createdAtValue: Timestamp | ReturnType<typeof serverTimestamp>
): Record<string, unknown> {
  const safeId = sanitizeId(room.id, 'room');
  const payload: Record<string, unknown> = {
    id: safeId,
    ownerUid,
    number: truncateStr(room.number || safeId, 20),
    floor: Math.min(50, Math.max(1, Number(room.floor) || 1)),
    type: room.type || 'standard_single',
    status: room.status || 'available',
    bedDescription: truncateStr(room.bedDescription || '', 120),
    directPrice: Math.max(0, Number(room.directPrice) || 0),
    serverCreatedAt: createdAtValue,
    serverUpdatedAt: serverTimestamp(),
  };

  if (room.currentBookingId) {
    payload.currentBookingId = truncateStr(room.currentBookingId, 128);
  }
  if (room.cleaningNote) {
    payload.cleaningNote = truncateStr(room.cleaningNote, 300);
  }
  if (room.cleaningMonth) {
    payload.cleaningMonth = truncateStr(room.cleaningMonth, 20);
  }
  if (room.lastCleanedAt) {
    payload.lastCleanedAt = truncateStr(room.lastCleanedAt, 40);
  }

  return payload;
}

export function buildBookingPayload(
  booking: Booking,
  ownerUid: string,
  createdAtValue: Timestamp | ReturnType<typeof serverTimestamp>
): Record<string, unknown> {
  const safeId = sanitizeId(booking.id, 'bk');
  const safeRoomId = sanitizeId(booking.roomId, 'room');
  const services = (Array.isArray(booking.services) ? booking.services : [])
    .slice(0, 50)
    .map((item) => ({
      id: truncateStr(item.id, 64),
      name: truncateStr(item.name, 120),
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      total: Math.max(0, Number(item.total) || 0),
      category: item.category || 'other',
      addedAt: truncateStr(item.addedAt || '', 40),
    }));

  const payload: Record<string, unknown> = {
    id: safeId,
    ownerUid,
    bookingCode: truncateStr(booking.bookingCode || safeId, 64),
    roomId: safeRoomId,
    roomNumber: truncateStr(booking.roomNumber || safeRoomId, 20),
    roomType: booking.roomType || 'standard_single',
    guestName: truncateStr(booking.guestName || 'Khách lẻ', 150) || 'Khách lẻ',
    guestPhone: truncateStr(booking.guestPhone || '', 40),
    channel: booking.channel || 'direct',
    checkInDate: truncateStr(booking.checkInDate || '2026-01-01', 20),
    checkOutDate: truncateStr(booking.checkOutDate || booking.checkInDate || '2026-01-02', 20),
    nights: Math.max(0, Number(booking.nights) || 0),
    roomPricePerNight: Math.max(0, Number(booking.roomPricePerNight) || 0),
    totalRoomPrice: Math.max(0, Number(booking.totalRoomPrice) || 0),
    managementFee: Math.max(0, Number(booking.managementFee) || 0),
    otaCommissionRate: Math.min(1, Math.max(0, Number(booking.otaCommissionRate) || 0)),
    otaCommissionAmount: Math.max(0, Number(booking.otaCommissionAmount) || 0),
    services,
    deposit: Math.max(0, Number(booking.deposit) || 0),
    discount: Math.max(0, Number(booking.discount) || 0),
    status: booking.status || 'reserved',
    createdAt: truncateStr(booking.createdAt || new Date().toISOString(), 64),
    serverCreatedAt: createdAtValue,
    serverUpdatedAt: serverTimestamp(),
  };

  if (booking.guestIdCard) {
    payload.guestIdCard = truncateStr(booking.guestIdCard, 50);
  }
  if (booking.channelBookingRef) {
    payload.channelBookingRef = truncateStr(booking.channelBookingRef, 80);
  }
  if (booking.stayType === 'hourly' || booking.stayType === 'nightly') {
    payload.stayType = booking.stayType;
  }
  if (booking.checkInTime) {
    payload.checkInTime = truncateStr(booking.checkInTime, 20);
  }
  if (booking.checkOutTime) {
    payload.checkOutTime = truncateStr(booking.checkOutTime, 20);
  }
  if (
    booking.stayType === 'hourly' ||
    (typeof booking.hours === 'number' && !isNaN(booking.hours) && booking.hours >= 1)
  ) {
    payload.hours = Math.min(720, Math.max(1, Number(booking.hours) || 3));
  }
  if (typeof booking.hourlyBasePrice === 'number' && !isNaN(booking.hourlyBasePrice)) {
    payload.hourlyBasePrice = Math.max(0, booking.hourlyBasePrice);
  }
  if (typeof booking.hourlyExtraPrice === 'number' && !isNaN(booking.hourlyExtraPrice)) {
    payload.hourlyExtraPrice = Math.max(0, booking.hourlyExtraPrice);
  }
  if (booking.notes) {
    payload.notes = truncateStr(booking.notes, 500);
  }
  if (booking.checkedOutAt) {
    payload.checkedOutAt = truncateStr(booking.checkedOutAt, 64);
  }
  if (booking.cancelledAt) {
    payload.cancelledAt = truncateStr(booking.cancelledAt, 64);
  }
  if (
    booking.paymentMethod === 'cash' ||
    booking.paymentMethod === 'transfer' ||
    booking.paymentMethod === 'card' ||
    booking.paymentMethod === 'ota_collect'
  ) {
    payload.paymentMethod = booking.paymentMethod;
  }

  return payload;
}

function docToSettings(data: Record<string, any>): HotelSettings {
  return {
    hotelName: data.hotelName || INITIAL_SETTINGS.hotelName,
    hotelAddress: data.hotelAddress || '',
    hotelPhone: data.hotelPhone || '',
    hotelEmail: data.hotelEmail || '',
    defaultManagementFee: Number(data.defaultManagementFee ?? INITIAL_SETTINGS.defaultManagementFee),
    channelCommissions: data.channelCommissions || INITIAL_SETTINGS.channelCommissions,
    pricingFormula: data.pricingFormula || 'net_guaranteed',
    roundingMethod: data.roundingMethod || '1000',
    servicesList: Array.isArray(data.servicesList) ? data.servicesList : INITIAL_SETTINGS.servicesList,
    hourlyRates: {
      ...DEFAULT_HOURLY_RATES,
      ...(data.hourlyRates || {}),
    },
  };
}

function docToRoom(data: Record<string, any>): Room {
  return {
    id: data.id,
    number: data.number,
    floor: Number(data.floor) || 1,
    type: data.type,
    status: data.status,
    bedDescription: data.bedDescription || '',
    directPrice: Number(data.directPrice) || 0,
    currentBookingId: data.currentBookingId,
    cleaningNote: data.cleaningNote,
    cleaningMonth: data.cleaningMonth,
    lastCleanedAt: data.lastCleanedAt,
  };
}

function docToBooking(data: Record<string, any>): Booking {
  return {
    id: data.id,
    bookingCode: data.bookingCode,
    roomId: data.roomId,
    roomNumber: data.roomNumber,
    roomType: data.roomType,
    guestName: data.guestName,
    guestPhone: data.guestPhone || '',
    guestIdCard: data.guestIdCard,
    channel: data.channel,
    channelBookingRef: data.channelBookingRef,
    stayType: data.stayType,
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    checkInTime: data.checkInTime,
    checkOutTime: data.checkOutTime,
    nights: Number(data.nights) || 0,
    hours: typeof data.hours === 'number' ? data.hours : undefined,
    hourlyBasePrice: typeof data.hourlyBasePrice === 'number' ? data.hourlyBasePrice : undefined,
    hourlyExtraPrice: typeof data.hourlyExtraPrice === 'number' ? data.hourlyExtraPrice : undefined,
    roomPricePerNight: Number(data.roomPricePerNight) || 0,
    totalRoomPrice: Number(data.totalRoomPrice) || 0,
    managementFee: Number(data.managementFee) || 0,
    otaCommissionRate: Number(data.otaCommissionRate) || 0,
    otaCommissionAmount: Number(data.otaCommissionAmount) || 0,
    services: Array.isArray(data.services) ? data.services : [],
    deposit: Number(data.deposit) || 0,
    discount: Number(data.discount) || 0,
    status: data.status,
    notes: data.notes,
    createdAt: data.createdAt,
    checkedOutAt: data.checkedOutAt,
    cancelledAt: data.cancelledAt,
    paymentMethod: data.paymentMethod,
  };
}

export async function ensureCloudWorkspaceInitialized(
  hotelId: string,
  localRooms: Room[],
  localBookings: Booking[],
  localSettings: HotelSettings
): Promise<boolean> {
  const workspacePath = `hotels/${hotelId}`;
  const workspaceRef = doc(db, 'hotels', hotelId);

  let workspaceSnap;
  try {
    workspaceSnap = await getDoc(workspaceRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }

  if (workspaceSnap && workspaceSnap.exists()) {
    const ts = workspaceSnap.data()?.serverCreatedAt;
    if (ts instanceof Timestamp) {
      workspaceCreatedAtMap.set(hotelId, ts);
    }

    // Self-heal if workspace exists but rooms subcollection was never seeded
    const roomsPath = `hotels/${hotelId}/rooms`;
    try {
      const roomsSnap = await getDocs(
        query(collection(db, 'hotels', hotelId, 'rooms'), where('ownerUid', '==', hotelId))
      );
      if (roomsSnap.empty && localRooms.length > 0) {
        const roomBatch = writeBatch(db);
        localRooms.forEach((room) => {
          const rRef = doc(db, 'hotels', hotelId, 'rooms', sanitizeId(room.id, 'room'));
          roomBatch.set(rRef, buildRoomPayload(room, hotelId, serverTimestamp()));
        });
        await roomBatch.commit();
        return true;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, roomsPath);
    }

    return false; // Already exists in cloud
  }

  // First-time cloud setup:
  // 1) Create workspace doc first so parent exists() checks pass for rooms
  // 2) Seed 25 rooms so room exists() checks pass for bookings
  // 3) Seed bookings
  try {
    await setDoc(
      workspaceRef,
      buildWorkspacePayload(localSettings, hotelId, serverTimestamp())
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }

  if (localRooms.length > 0) {
    const roomsPath = `hotels/${hotelId}/rooms`;
    try {
      const batch1 = writeBatch(db);
      localRooms.forEach((room) => {
        const rRef = doc(db, 'hotels', hotelId, 'rooms', sanitizeId(room.id, 'room'));
        batch1.set(rRef, buildRoomPayload(room, hotelId, serverTimestamp()));
      });
      await batch1.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, roomsPath);
    }
  }

  if (localBookings.length > 0) {
    const bookingsPath = `hotels/${hotelId}/bookings`;
    try {
      const batch2 = writeBatch(db);
      localBookings.forEach((booking) => {
        const bRef = doc(db, 'hotels', hotelId, 'bookings', sanitizeId(booking.id, 'bk'));
        batch2.set(bRef, buildBookingPayload(booking, hotelId, serverTimestamp()));
      });
      await batch2.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, bookingsPath);
    }
  }

  return true;
}

export async function pushAllLocalDataToCloud(
  hotelId: string,
  rooms: Room[],
  bookings: Booking[],
  settings: HotelSettings
): Promise<void> {
  const workspacePath = `hotels/${hotelId}`;
  const workspaceRef = doc(db, 'hotels', hotelId);
  const wsCreatedAt = await resolveCreatedAt(
    workspaceRef,
    hotelId,
    workspaceCreatedAtMap,
    workspacePath
  );

  try {
    const batch1 = writeBatch(db);
    batch1.set(workspaceRef, buildWorkspacePayload(settings, hotelId, wsCreatedAt));

    for (const room of rooms) {
      const safeId = sanitizeId(room.id, 'room');
      const rPath = `hotels/${hotelId}/rooms/${safeId}`;
      const rRef = doc(db, 'hotels', hotelId, 'rooms', safeId);
      const rCreatedAt = await resolveCreatedAt(rRef, `${hotelId}:${safeId}`, roomCreatedAtMap, rPath);
      batch1.set(rRef, buildRoomPayload(room, hotelId, rCreatedAt));
    }
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }

  const bookingsPath = `hotels/${hotelId}/bookings`;
  try {
    // Delete cloud bookings no longer in local list (e.g. after reset to defaults)
    const existingSnap = await getDocs(
      query(collection(db, 'hotels', hotelId, 'bookings'), where('ownerUid', '==', hotelId))
    );
    const localIds = new Set(bookings.map((b) => sanitizeId(b.id, 'bk')));
    const lockedFinalIds = new Set<string>();
    const batch2 = writeBatch(db);

    existingSnap.forEach((d) => {
      const data = d.data();
      if (!localIds.has(d.id)) {
        if (data?.status === 'active' || data?.status === 'reserved') {
          batch2.delete(d.ref);
        }
      } else {
        if (data?.serverCreatedAt instanceof Timestamp) {
          bookingCreatedAtMap.set(`${hotelId}:${d.id}`, data.serverCreatedAt);
        }
        if (data?.status === 'completed' || data?.status === 'cancelled') {
          lockedFinalIds.add(d.id);
        }
      }
    });

    for (const booking of bookings) {
      const safeId = sanitizeId(booking.id, 'bk');
      if (lockedFinalIds.has(safeId)) continue;
      const bPath = `hotels/${hotelId}/bookings/${safeId}`;
      const bRef = doc(db, 'hotels', hotelId, 'bookings', safeId);
      const bCreatedAt = await resolveCreatedAt(bRef, `${hotelId}:${safeId}`, bookingCreatedAtMap, bPath);
      batch2.set(bRef, buildBookingPayload(booking, hotelId, bCreatedAt));
    }

    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, bookingsPath);
  }
}

export async function syncWorkspaceSettingsToCloud(
  hotelId: string,
  settings: HotelSettings
): Promise<void> {
  const path = `hotels/${hotelId}`;
  const ref = doc(db, 'hotels', hotelId);
  const createdAt = await resolveCreatedAt(ref, hotelId, workspaceCreatedAtMap, path);
  try {
    await setDoc(ref, buildWorkspacePayload(settings, hotelId, createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncRoomsToCloud(hotelId: string, changedRooms: Room[]): Promise<void> {
  if (changedRooms.length === 0) return;
  const path = `hotels/${hotelId}/rooms`;
  try {
    const batch = writeBatch(db);
    for (const room of changedRooms) {
      const safeId = sanitizeId(room.id, 'room');
      const rPath = `${path}/${safeId}`;
      const rRef = doc(db, 'hotels', hotelId, 'rooms', safeId);
      const createdAt = await resolveCreatedAt(rRef, `${hotelId}:${safeId}`, roomCreatedAtMap, rPath);
      batch.set(rRef, buildRoomPayload(room, hotelId, createdAt));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncBookingToCloud(hotelId: string, booking: Booking): Promise<void> {
  const safeId = sanitizeId(booking.id, 'bk');
  const path = `hotels/${hotelId}/bookings/${safeId}`;
  const ref = doc(db, 'hotels', hotelId, 'bookings', safeId);
  const createdAt = await resolveCreatedAt(ref, `${hotelId}:${safeId}`, bookingCreatedAtMap, path);
  try {
    await setDoc(ref, buildBookingPayload(booking, hotelId, createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncBookingAndRoomsToCloud(
  hotelId: string,
  booking: Booking,
  changedRooms: Room[]
): Promise<void> {
  await syncRoomsToCloud(hotelId, changedRooms);
  await syncBookingToCloud(hotelId, booking);
}

export function subscribeWorkspace(
  hotelId: string,
  callbacks: {
    onSettings: (settings: HotelSettings) => void;
    onRooms: (rooms: Room[]) => void;
    onBookings: (bookings: Booking[]) => void;
    onError: (message: string) => void;
  }
): () => void {
  const wsPath = `hotels/${hotelId}`;
  const roomsPath = `hotels/${hotelId}/rooms`;
  const bookingsPath = `hotels/${hotelId}/bookings`;

  const unsubWorkspace = onSnapshot(
    doc(db, 'hotels', hotelId),
    (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        const data = snap.data();
        if (data?.serverCreatedAt instanceof Timestamp) {
          workspaceCreatedAtMap.set(hotelId, data.serverCreatedAt);
        }
        callbacks.onSettings(docToSettings(data));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, wsPath);
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : String(e));
      }
    }
  );

  const unsubRooms = onSnapshot(
    query(collection(db, 'hotels', hotelId, 'rooms'), where('ownerUid', '==', hotelId)),
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.empty) return;
      const list: Room[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data?.serverCreatedAt instanceof Timestamp) {
          roomCreatedAtMap.set(`${hotelId}:${d.id}`, data.serverCreatedAt);
        }
        list.push(docToRoom(data));
      });
      list.sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
      callbacks.onRooms(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, roomsPath);
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : String(e));
      }
    }
  );

  const unsubBookings = onSnapshot(
    query(collection(db, 'hotels', hotelId, 'bookings'), where('ownerUid', '==', hotelId)),
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const list: Booking[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data?.serverCreatedAt instanceof Timestamp) {
          bookingCreatedAtMap.set(`${hotelId}:${d.id}`, data.serverCreatedAt);
        }
        list.push(docToBooking(data));
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callbacks.onBookings(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, bookingsPath);
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : String(e));
      }
    }
  );

  return () => {
    unsubWorkspace();
    unsubRooms();
    unsubBookings();
  };
}

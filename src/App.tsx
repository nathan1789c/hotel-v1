import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Room, Booking, HotelSettings, RoomStatus, BookingServiceItem } from './types/hotel';
import { loadStoredData, saveStoredData, resetToDefaults } from './utils/storage';
import { addDaysToDateStr, getMonthBounds, getMonthKey } from './utils/pricing';
import {
  initAuth,
  isSuperAdminEmail,
  logout,
  SHARED_HOTEL_ID,
  UserRole,
} from './utils/firebase';
import {
  ensureCloudWorkspaceInitialized,
  ensureDefaultSuperAdminsInCloud,
  pushAllLocalDataToCloud,
  subscribeMyPermission,
  subscribeWorkspace,
  syncBookingAndRoomsToCloud,
  syncBookingToCloud,
  syncRoomsToCloud,
  syncWorkspaceSettingsToCloud,
} from './utils/firestoreSync';
import LoginLockScreen from './components/LoginLockScreen';
import Header, { AppView } from './components/Header';
import RoomGrid from './components/RoomGrid';
import OtaPricingCalculator from './components/OtaPricingCalculator';
import BookingList from './components/BookingList';
import AnalyticsView from './components/AnalyticsView';
import StaffPermissionsView from './components/StaffPermissionsView';
import BookingModal from './components/BookingModal';
import CheckoutModal, { CheckoutUpdatePayload } from './components/CheckoutModal';
import RoomDetailModal from './components/RoomDetailModal';
import SettingsModal from './components/SettingsModal';
import ExtendStayModal, { ExtendStayPayload } from './components/ExtendStayModal';
import SyncExportModal from './components/SyncExportModal';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [permissionChecked, setPermissionChecked] = useState(false);
  const [authorizedRole, setAuthorizedRole] = useState<UserRole | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<HotelSettings>({} as HotelSettings);

  const [currentView, setCurrentView] = useState<AppView>('rooms');
  const [selectedGridMonth, setSelectedGridMonth] = useState<string>(() => getMonthKey(''));

  // Shared Firebase Cloud Sync State
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const roomsRef = useRef<Room[]>([]);
  const bookingsRef = useRef<Booking[]>([]);
  const settingsRef = useRef<HotelSettings>({} as HotelSettings);
  roomsRef.current = rooms;
  bookingsRef.current = bookings;
  settingsRef.current = settings;

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<Room | null>(null);
  const [isReservationMode, setIsReservationMode] = useState(false);
  const [bookingDefaultMonth, setBookingDefaultMonth] = useState<string | undefined>(undefined);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [checkoutRoom, setCheckoutRoom] = useState<Room | null>(null);

  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendBooking, setExtendBooking] = useState<Booking | null>(null);
  const [extendRoom, setExtendRoom] = useState<Room | null>(null);

  const [isRoomDetailOpen, setIsRoomDetailOpen] = useState(false);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<Room | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const userRole: UserRole = authorizedRole === 'admin' ? 'admin' : 'staff';
  const isAdmin = authorizedRole === 'admin';

  // Mandatory Google Auth listener
  useEffect(() => {
    const unsubAuth = initAuth((user) => {
      if (user && !user.emailVerified) {
        setAuthError('Tài khoản Google chưa xác minh email. Vui lòng sử dụng Gmail đã xác minh.');
        setAuthUser(null);
      } else {
        setAuthError(null);
        setAuthUser(user);
      }
      setAuthReady(true);

      if (!user) {
        setPermissionChecked(false);
        setAuthorizedRole(null);
        setPermissionError(null);
        setCurrentView('rooms');
        setIsSettingsModalOpen(false);
        setIsSyncModalOpen(false);
        setIsCloudConnected(false);
        setCloudError(null);
        setDataLoaded(false);
        setRooms([]);
        setBookings([]);
      }
    });
    return () => unsubAuth();
  }, []);

  // Verify signed-in user against Firestore permissions collection (real-time)
  useEffect(() => {
    if (!authReady || !authUser) return;

    const userEmail = authUser.email || '';
    setPermissionError(null);

    if (isSuperAdminEmail(userEmail)) {
      setAuthorizedRole('admin');
      setPermissionChecked(true);
      ensureDefaultSuperAdminsInCloud(userEmail).catch((err) => {
        console.error('Could not seed default super admins in permissions:', err);
      });
      return;
    }

    setPermissionChecked(false);
    setAuthorizedRole(null);

    const unsubPerm = subscribeMyPermission(userEmail, {
      onResult: (role) => {
        setAuthorizedRole(role);
        setPermissionChecked(true);
        if (!role) {
          setIsCloudConnected(false);
          setDataLoaded(false);
          setRooms([]);
          setBookings([]);
          setCurrentView('rooms');
          setIsSettingsModalOpen(false);
          setIsSyncModalOpen(false);
        }
      },
      onError: (msg) => {
        setPermissionError(msg);
        setAuthorizedRole(null);
        setPermissionChecked(true);
      },
    });

    return () => unsubPerm();
  }, [authReady, authUser?.uid, authUser?.email]);

  // Force-guard Staff away from Admin-only views and Settings modal
  useEffect(() => {
    if (!isAdmin) {
      if (currentView === 'ota' || currentView === 'analytics' || currentView === 'permissions') {
        setCurrentView('rooms');
      }
      if (isSettingsModalOpen) {
        setIsSettingsModalOpen(false);
      }
    }
  }, [isAdmin, currentView, isSettingsModalOpen]);

  // Load initial/cached hotel data only AFTER authentication + authorization succeed
  useEffect(() => {
    if (!authReady || !authUser || !permissionChecked || !authorizedRole) return;
    const data = loadStoredData();
    setRooms(data.rooms);
    setBookings(data.bookings);
    setSettings(data.settings);
    setDataLoaded(true);
  }, [authReady, authUser?.uid, permissionChecked, authorizedRole]);

  // Save data on changes to localStorage cache (only when authenticated & authorized & loaded)
  useEffect(() => {
    if (authUser && authorizedRole && dataLoaded) {
      saveStoredData(rooms, bookings, settings);
    }
  }, [authUser, authorizedRole, rooms, bookings, settings, dataLoaded]);

  // Connect & subscribe to shared Firestore workspace ONLY when authenticated & authorized
  useEffect(() => {
    if (!authReady || !authUser || !permissionChecked || !authorizedRole || !dataLoaded) return;

    let active = true;
    let unsubFirestore: (() => void) | null = null;

    setCloudError(null);
    setIsSyncingCloud(true);

    ensureCloudWorkspaceInitialized(
      SHARED_HOTEL_ID,
      roomsRef.current,
      bookingsRef.current,
      settingsRef.current
    )
      .then(() => {
        if (!active) return;
        setIsCloudConnected(true);
        unsubFirestore = subscribeWorkspace(SHARED_HOTEL_ID, {
          onSettings: (cloudSettings) => {
            setSettings(cloudSettings);
          },
          onRooms: (cloudRooms) => {
            if (cloudRooms.length > 0) {
              setRooms(cloudRooms);
            }
          },
          onBookings: (cloudBookings) => {
            setBookings(cloudBookings);
          },
          onError: (msg) => {
            setIsCloudConnected(false);
            setCloudError(msg);
          },
        });
      })
      .catch((err) => {
        if (!active) return;
        setIsCloudConnected(false);
        setCloudError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setIsSyncingCloud(false);
      });

    return () => {
      active = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, [authReady, authUser?.uid, permissionChecked, authorizedRole, dataLoaded, syncRetryTick]);

  // 1. Auth checking splash (no internal hotel data rendered)
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Đang kiểm tra phiên đăng nhập Google...
      </div>
    );
  }

  // 2. Mandatory Google Login Lock Screen (blocks 100% of hotel data & rooms)
  if (!authUser) {
    return <LoginLockScreen externalError={authError} />;
  }

  // 3. Checking Firestore permissions list before allowing access
  if (!permissionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Đang kiểm tra quyền truy cập tài khoản...
      </div>
    );
  }

  // 4. Reject accounts not found in Firestore permissions collection
  if (!authorizedRole) {
    return (
      <LoginLockScreen
        externalError={permissionError}
        accessDeniedEmail={authUser.email || 'Tài khoản Google'}
        onSignOut={() => {
          logout().catch((err) => setPermissionError(err instanceof Error ? err.message : String(err)));
        }}
      />
    );
  }

  // 5. Loading workspace data after login & permission check
  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Đang tải dữ liệu khách sạn 25 phòng...
      </div>
    );
  }

  // Helper maps (prefer 'active' over 'reserved' if a room has both today + future reservation)
  const activeBookingsMap = new Map<string, Booking>();
  bookings.forEach((b) => {
    if (b.status === 'reserved' && !activeBookingsMap.has(b.roomId)) {
      activeBookingsMap.set(b.roomId, b);
    }
  });
  bookings.forEach((b) => {
    if (b.status === 'active') {
      activeBookingsMap.set(b.roomId, b);
    }
  });

  const getTodayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const syncRoomStatusWithBookings = (
    room: Room,
    allBookings: Booking[],
    todayStr: string
  ): Room => {
    const activeMatch = allBookings.find((b) => b.roomId === room.id && b.status === 'active');
    if (activeMatch) {
      return {
        ...room,
        status: 'occupied' as RoomStatus,
        currentBookingId: activeMatch.id,
        cleaningMonth: undefined,
      };
    }

    if (room.status === 'cleaning' || room.status === 'maintenance') {
      return {
        ...room,
        currentBookingId: undefined,
      };
    }

    const todayReserved = allBookings
      .filter((b) => b.roomId === room.id && b.status === 'reserved' && b.checkInDate <= todayStr)
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0];

    if (todayReserved) {
      return {
        ...room,
        status: 'reserved' as RoomStatus,
        currentBookingId: todayReserved.id,
      };
    }

    return {
      ...room,
      status: 'available' as RoomStatus,
      currentBookingId: undefined,
    };
  };

  // Action Handlers
  const handleOpenBookingModal = (room?: Room, isReservation = false, defaultMonth?: string) => {
    setEditingBooking(null);
    setSelectedRoomForBooking(room || rooms[0] || null);
    setIsReservationMode(isReservation);
    setBookingDefaultMonth(defaultMonth);
    setIsBookingModalOpen(true);
  };

  const handleOpenEditBookingModal = (booking: Booking) => {
    const r = rooms.find((rm) => rm.id === booking.roomId) || rooms[0] || null;
    setSelectedRoomForBooking(r);
    setEditingBooking(booking);
    setIsReservationMode(booking.status === 'reserved');
    setBookingDefaultMonth(undefined);
    setIsBookingModalOpen(true);
  };

  const reportCloudError = (err: unknown) => {
    setCloudError(err instanceof Error ? err.message : String(err));
  };

  const handlePushLocalToCloud = async () => {
    if (!isAdmin) return;
    setIsSyncingCloud(true);
    try {
      await pushAllLocalDataToCloud(SHARED_HOTEL_ID, rooms, bookings, settings);
      setIsCloudConnected(true);
      setCloudError(null);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleUpdateSettings = (updatedSettings: HotelSettings) => {
    if (!isAdmin) return;
    setSettings(updatedSettings);
    syncWorkspaceSettingsToCloud(SHARED_HOTEL_ID, updatedSettings).catch(reportCloudError);
  };

  const handleUpdateRooms = (updatedRooms: Room[]) => {
    if (!isAdmin) return;
    setRooms(updatedRooms);
    syncRoomsToCloud(SHARED_HOTEL_ID, updatedRooms).catch(reportCloudError);
  };

  const handleSaveBooking = (newBooking: Booking, targetRoomId: string, isCheckInNow: boolean) => {
    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);

    const todayStr = getTodayStr();
    const updatedRooms = rooms.map((r) => {
      if (r.id !== targetRoomId) return r;
      if (isCheckInNow) {
        return {
          ...r,
          status: 'occupied' as RoomStatus,
          currentBookingId: newBooking.id,
          cleaningNote: undefined,
          cleaningMonth: undefined,
        };
      }
      if (r.status === 'occupied' || r.status === 'cleaning' || r.status === 'maintenance') {
        return r;
      }
      if (newBooking.checkInDate <= todayStr) {
        return {
          ...r,
          status: 'reserved' as RoomStatus,
          currentBookingId: newBooking.id,
        };
      }
      return {
        ...r,
        status: 'available' as RoomStatus,
        currentBookingId: undefined,
      };
    });
    setRooms(updatedRooms);

    const targetRoom = updatedRooms.find((r) => r.id === targetRoomId);
    syncBookingAndRoomsToCloud(
      SHARED_HOTEL_ID,
      newBooking,
      targetRoom ? [targetRoom] : []
    ).catch(reportCloudError);
  };

  const handleUpdateBooking = (
    updatedBooking: Booking,
    oldRoomId: string,
    newRoomId: string,
    isCheckInNow: boolean
  ) => {
    const updatedBookings = bookings.map((b) =>
      b.id === updatedBooking.id ? updatedBooking : b
    );
    setBookings(updatedBookings);

    const todayStr = getTodayStr();
    const updatedRooms = rooms.map((r) => {
      if (r.id !== oldRoomId && r.id !== newRoomId) return r;

      if (r.id === newRoomId && isCheckInNow) {
        return {
          ...r,
          status: 'occupied' as RoomStatus,
          currentBookingId: updatedBooking.id,
          cleaningNote: undefined,
          cleaningMonth: undefined,
        };
      }

      return syncRoomStatusWithBookings(r, updatedBookings, todayStr);
    });

    setRooms(updatedRooms);

    const changedRooms = updatedRooms.filter((r) => r.id === oldRoomId || r.id === newRoomId);
    syncBookingAndRoomsToCloud(SHARED_HOTEL_ID, updatedBooking, changedRooms).catch(reportCloudError);
  };

  const handleCheckInReservation = (bookingId: string, roomId: string) => {
    const updatedBookings = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'active' as const,
          }
        : b
    );
    setBookings(updatedBookings);

    const updatedRooms = rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            status: 'occupied' as RoomStatus,
            currentBookingId: bookingId,
            cleaningNote: undefined,
            cleaningMonth: undefined,
          }
        : r
    );
    setRooms(updatedRooms);

    const targetBooking = updatedBookings.find((b) => b.id === bookingId);
    const targetRoom = updatedRooms.find((r) => r.id === roomId);
    if (targetBooking) {
      syncBookingAndRoomsToCloud(
        SHARED_HOTEL_ID,
        targetBooking,
        targetRoom ? [targetRoom] : []
      ).catch(reportCloudError);
    }
  };

  const handleCancelBooking = (bookingId: string, roomId: string) => {
    const updatedBookings = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'cancelled' as const,
            cancelledAt: new Date().toISOString(),
          }
        : b
    );
    setBookings(updatedBookings);

    const todayStr = getTodayStr();
    const updatedRooms = rooms.map((r) =>
      r.id === roomId ? syncRoomStatusWithBookings(r, updatedBookings, todayStr) : r
    );
    setRooms(updatedRooms);

    if (selectedRoomDetail?.id === roomId) {
      const targetRoom = updatedRooms.find((rm) => rm.id === roomId) || null;
      setSelectedRoomDetail(targetRoom);
    }

    const targetBooking = updatedBookings.find((b) => b.id === bookingId);
    const targetRoom = updatedRooms.find((r) => r.id === roomId);
    if (targetBooking) {
      syncBookingAndRoomsToCloud(
        SHARED_HOTEL_ID,
        targetBooking,
        targetRoom ? [targetRoom] : []
      ).catch(reportCloudError);
    }
  };

  const handleOpenExtendModal = (booking: Booking, room: Room) => {
    setExtendBooking(booking);
    setExtendRoom(room);
    setIsExtendModalOpen(true);
  };

  const handleConfirmExtend = (payload: ExtendStayPayload) => {
    const updatedBookings = bookings.map((b) =>
      b.id === payload.bookingId
        ? {
            ...b,
            stayType: payload.stayType,
            checkOutDate: payload.checkOutDate,
            checkOutTime: payload.checkOutTime,
            nights: payload.nights,
            hours: payload.hours,
            roomPricePerNight: payload.roomPricePerNight,
            totalRoomPrice: payload.totalRoomPrice,
            managementFee: payload.managementFee,
            otaCommissionAmount: payload.otaCommissionAmount,
            notes: payload.notes,
          }
        : b
    );
    setBookings(updatedBookings);

    const targetBooking = updatedBookings.find((b) => b.id === payload.bookingId);
    if (targetBooking) {
      syncBookingToCloud(SHARED_HOTEL_ID, targetBooking).catch(reportCloudError);
    }
  };

  const handleOpenCheckoutModal = (booking: Booking, room: Room) => {
    setCheckoutBooking(booking);
    setCheckoutRoom(room);
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = (
    bookingId: string,
    roomId: string,
    paymentMethod: string,
    finalServices: BookingServiceItem[],
    hourlyUpdates?: CheckoutUpdatePayload
  ) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    const checkoutMonthKey =
      currentView === 'rooms' && selectedGridMonth
        ? selectedGridMonth
        : getMonthKey(targetBooking?.checkInDate || '');

    const updatedBookings = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            ...(hourlyUpdates || {}),
            status: 'completed' as const,
            services: finalServices,
            paymentMethod: paymentMethod as any,
            checkedOutAt: new Date().toISOString(),
          }
        : b
    );
    setBookings(updatedBookings);

    const currentTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updatedRooms = rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            status: 'cleaning' as RoomStatus,
            currentBookingId: undefined,
            cleaningNote: `Khách vừa trả phòng lúc ${currentTimeStr}`,
            cleaningMonth: checkoutMonthKey,
          }
        : r
    );
    setRooms(updatedRooms);

    if (selectedRoomDetail?.id === roomId) {
      setIsRoomDetailOpen(false);
    }

    const completedBooking = updatedBookings.find((b) => b.id === bookingId);
    const updatedRoom = updatedRooms.find((r) => r.id === roomId);
    if (completedBooking) {
      syncBookingAndRoomsToCloud(
        SHARED_HOTEL_ID,
        completedBooking,
        updatedRoom ? [updatedRoom] : []
      ).catch(reportCloudError);
    }
  };

  const handleQuickCleanRoom = (roomId: string) => {
    const todayStr = getTodayStr();
    const updatedRooms = rooms.map((r) => {
      if (r.id !== roomId) return r;
      const cleanedRoom: Room = {
        ...r,
        status: 'available',
        cleaningNote: undefined,
        cleaningMonth: undefined,
        lastCleanedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      return syncRoomStatusWithBookings(cleanedRoom, bookings, todayStr);
    });
    setRooms(updatedRooms);

    const targetRoom = updatedRooms.find((r) => r.id === roomId);
    if (targetRoom) {
      syncRoomsToCloud(SHARED_HOTEL_ID, [targetRoom]).catch(reportCloudError);
    }
  };

  const handleQuickSetStatus = (roomId: string, status: RoomStatus, cleaningNote?: string) => {
    const todayStr = getTodayStr();
    const updatedRooms = rooms.map((r) => {
      if (r.id !== roomId) return r;
      if (status === 'available') {
        const resetRoom: Room = {
          ...r,
          status: 'available',
          cleaningNote: undefined,
          cleaningMonth: undefined,
        };
        return syncRoomStatusWithBookings(resetRoom, bookings, todayStr);
      }
      return {
        ...r,
        status,
        cleaningNote: cleaningNote !== undefined ? cleaningNote : r.cleaningNote,
        cleaningMonth:
          status === 'cleaning' || status === 'maintenance'
            ? currentView === 'rooms' && selectedGridMonth
              ? selectedGridMonth
              : getMonthKey('')
            : undefined,
      };
    });
    setRooms(updatedRooms);

    const targetRoom = updatedRooms.find((r) => r.id === roomId);
    if (targetRoom) {
      syncRoomsToCloud(SHARED_HOTEL_ID, [targetRoom]).catch(reportCloudError);
    }
  };

  const handleOpenRoomDetail = (room: Room) => {
    setSelectedRoomDetail(room);
    setIsRoomDetailOpen(true);
  };

  const handleAddServiceToBooking = (bookingId: string, item: BookingServiceItem) => {
    const updatedBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      return {
        ...b,
        services: [...b.services, item],
      };
    });
    setBookings(updatedBookings);

    const targetBooking = updatedBookings.find((b) => b.id === bookingId);
    if (targetBooking) {
      syncBookingToCloud(SHARED_HOTEL_ID, targetBooking).catch(reportCloudError);
    }
  };

  const handleRemoveServiceFromBooking = (bookingId: string, serviceId: string) => {
    const updatedBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      return {
        ...b,
        services: b.services.filter((s) => s.id !== serviceId),
      };
    });
    setBookings(updatedBookings);

    const targetBooking = updatedBookings.find((b) => b.id === bookingId);
    if (targetBooking) {
      syncBookingToCloud(SHARED_HOTEL_ID, targetBooking).catch(reportCloudError);
    }
  };

  const handleResetDefaults = () => {
    if (!isAdmin) return;
    const data = resetToDefaults();
    setRooms(data.rooms);
    setBookings(data.bookings);
    setSettings(data.settings);
    setSelectedRoomDetail(null);
    setIsRoomDetailOpen(false);
    setIsCheckoutModalOpen(false);
    setIsExtendModalOpen(false);
    setIsBookingModalOpen(false);

    pushAllLocalDataToCloud(SHARED_HOTEL_ID, data.rooms, data.bookings, data.settings).catch(
      reportCloudError
    );
  };

  const currentRoomDetail = selectedRoomDetail
    ? rooms.find((r) => r.id === selectedRoomDetail.id) || selectedRoomDetail
    : null;

  const currentRoomAllBookings = currentRoomDetail
    ? bookings
        .filter((b) => b.roomId === currentRoomDetail.id && (b.status === 'active' || b.status === 'reserved'))
        .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))
    : [];

  const getActiveBookingForSelectedMonth = () => {
    if (!currentRoomDetail) return null;
    if (currentView === 'rooms' && selectedGridMonth) {
      const { start, end } = getMonthBounds(selectedGridMonth);
      const activeMatch = currentRoomAllBookings.find((b) => {
        if (b.status !== 'active') return false;
        const bStart = b.checkInDate;
        const bEnd =
          b.stayType === 'hourly'
            ? b.checkInDate
            : b.checkOutDate > b.checkInDate
            ? addDaysToDateStr(b.checkOutDate, -1)
            : b.checkInDate;
        return bStart <= end && bEnd >= start;
      });
      return activeMatch || null;
    }
    const activeMatch = activeBookingsMap.get(currentRoomDetail.id);
    return activeMatch && activeMatch.status === 'active' ? activeMatch : null;
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        currentView={currentView}
        onChangeView={(view) => {
          if (!isAdmin && (view === 'ota' || view === 'analytics' || view === 'permissions')) return;
          setCurrentView(view);
        }}
        settings={settings}
        rooms={rooms}
        userRole={userRole}
        userEmail={authUser.email || ''}
        onSignOut={() => {
          logout().catch(reportCloudError);
        }}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncingCloud}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenSettings={() => {
          if (isAdmin) setIsSettingsModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {cloudError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
            <span className="break-words">
              <strong>Lỗi đồng bộ Firebase:</strong> {cloudError}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCloudError(null);
                  setSyncRetryTick((n) => n + 1);
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => setCloudError(null)}
                className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
        {currentView === 'rooms' && (
          <RoomGrid
            rooms={rooms}
            bookings={bookings}
            settings={settings}
            selectedMonth={selectedGridMonth}
            onChangeMonth={setSelectedGridMonth}
            onOpenBookingModal={handleOpenBookingModal}
            onOpenEditBookingModal={handleOpenEditBookingModal}
            onOpenCheckoutModal={handleOpenCheckoutModal}
            onOpenExtendModal={handleOpenExtendModal}
            onOpenRoomDetail={handleOpenRoomDetail}
            onQuickCleanRoom={handleQuickCleanRoom}
            onQuickSetStatus={handleQuickSetStatus}
            onCheckInReservation={handleCheckInReservation}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {isAdmin && currentView === 'ota' && (
          <OtaPricingCalculator
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {currentView === 'bookings' && (
          <BookingList
            bookings={bookings}
            rooms={rooms}
            settings={settings}
            isAdmin={isAdmin}
            onOpenCheckoutModal={handleOpenCheckoutModal}
            onOpenExtendModal={handleOpenExtendModal}
            onOpenEditBookingModal={handleOpenEditBookingModal}
            onOpenBookingModal={handleOpenBookingModal}
            onSelectBooking={(b) => {
              const r = rooms.find((rm) => rm.id === b.roomId);
              if (r) handleOpenRoomDetail(r);
            }}
            onCheckInReservation={handleCheckInReservation}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {isAdmin && currentView === 'analytics' && (
          <AnalyticsView
            bookings={bookings}
            rooms={rooms}
            settings={settings}
          />
        )}

        {isAdmin && currentView === 'permissions' && (
          <StaffPermissionsView currentUserEmail={authUser.email || ''} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>{settings.hotelName}</strong> • Quy mô 25 phòng (Standard, VIP 501, Deluxe 505, Family)
          </div>
          <div>
            Kênh OTA: Agoda, Booking.com, Trip.com, Airbnb (+150.000₫ phí quản lý) • Hỗ trợ khách giờ
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RoomDetailModal
        isOpen={isRoomDetailOpen}
        onClose={() => setIsRoomDetailOpen(false)}
        room={currentRoomDetail}
        activeBooking={getActiveBookingForSelectedMonth()}
        roomBookings={currentRoomAllBookings}
        selectedMonth={currentView === 'rooms' ? selectedGridMonth : undefined}
        settings={settings}
        isAdmin={isAdmin}
        onUpdateRoomStatus={handleQuickSetStatus}
        onAddServiceToBooking={handleAddServiceToBooking}
        onRemoveServiceFromBooking={handleRemoveServiceFromBooking}
        onOpenBookingModal={handleOpenBookingModal}
        onOpenEditBookingModal={handleOpenEditBookingModal}
        onOpenCheckoutModal={handleOpenCheckoutModal}
        onOpenExtendModal={handleOpenExtendModal}
        onCheckInReservation={handleCheckInReservation}
        onCancelBooking={handleCancelBooking}
      />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setEditingBooking(null);
          setBookingDefaultMonth(undefined);
        }}
        selectedRoom={selectedRoomForBooking}
        rooms={rooms}
        settings={settings}
        isReservation={isReservationMode}
        defaultMonth={bookingDefaultMonth}
        editingBooking={editingBooking}
        onSaveBooking={handleSaveBooking}
        onUpdateBooking={handleUpdateBooking}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        booking={checkoutBooking}
        room={checkoutRoom}
        settings={settings}
        onConfirmCheckout={handleConfirmCheckout}
      />

      <ExtendStayModal
        isOpen={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        booking={extendBooking}
        room={extendRoom}
        settings={settings}
        onConfirmExtend={handleConfirmExtend}
      />

      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          rooms={rooms}
          onSaveSettings={handleUpdateSettings}
          onUpdateRooms={handleUpdateRooms}
          onResetDefaults={handleResetDefaults}
        />
      )}

      <SyncExportModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isAdmin={isAdmin}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncingCloud}
        cloudError={cloudError}
        bookings={bookings}
        onPushLocalToCloud={handlePushLocalToCloud}
        onRetryConnection={() => {
          setCloudError(null);
          setSyncRetryTick((n) => n + 1);
        }}
      />
    </div>
  );
}

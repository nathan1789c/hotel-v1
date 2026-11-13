import { useState, useEffect } from 'react';
import { Room, Booking, HotelSettings, RoomStatus, BookingServiceItem } from './types/hotel';
import { loadStoredData, saveStoredData, resetToDefaults } from './utils/storage';
import { addDaysToDateStr, getMonthBounds, getMonthKey } from './utils/pricing';
import Header from './components/Header';
import RoomGrid from './components/RoomGrid';
import OtaPricingCalculator from './components/OtaPricingCalculator';
import BookingList from './components/BookingList';
import AnalyticsView from './components/AnalyticsView';
import BookingModal from './components/BookingModal';
import CheckoutModal, { CheckoutUpdatePayload } from './components/CheckoutModal';
import RoomDetailModal from './components/RoomDetailModal';
import SettingsModal from './components/SettingsModal';
import ExtendStayModal, { ExtendStayPayload } from './components/ExtendStayModal';

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<HotelSettings>({} as HotelSettings);

  const [currentView, setCurrentView] = useState<'rooms' | 'ota' | 'bookings' | 'analytics'>('rooms');
  const [selectedGridMonth, setSelectedGridMonth] = useState<string>(() => getMonthKey(''));

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

  // Load data on mount
  useEffect(() => {
    const data = loadStoredData();
    setRooms(data.rooms);
    setBookings(data.bookings);
    setSettings(data.settings);
    setDataLoaded(true);
  }, []);

  // Save data on changes
  useEffect(() => {
    if (dataLoaded) {
      saveStoredData(rooms, bookings, settings);
    }
  }, [rooms, bookings, settings, dataLoaded]);

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Đang khởi động hệ thống quản lý khách sạn 25 phòng...
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
      // Future reservations (or reservations when room is occupied/cleaning/maintenance)
      // must NOT overwrite physical room availability today
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
  };

  const handleOpenExtendModal = (booking: Booking, room: Room) => {
    setExtendBooking(booking);
    setExtendRoom(room);
    setIsExtendModalOpen(true);
  };

  const handleConfirmExtend = (payload: ExtendStayPayload) => {
    setBookings((prev) =>
      prev.map((b) =>
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
      )
    );
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

    // 1. Mark booking completed
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

    // 2. Mark room as cleaning (preserving cleaningMonth so Need Cleaning always displays right after checkout)
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
  };

  const handleQuickCleanRoom = (roomId: string) => {
    const todayStr = getTodayStr();
    setRooms(
      rooms.map((r) => {
        if (r.id !== roomId) return r;
        const cleanedRoom: Room = {
          ...r,
          status: 'available',
          cleaningNote: undefined,
          cleaningMonth: undefined,
          lastCleanedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        return syncRoomStatusWithBookings(cleanedRoom, bookings, todayStr);
      })
    );
  };

  const handleQuickSetStatus = (roomId: string, status: RoomStatus, cleaningNote?: string) => {
    const todayStr = getTodayStr();
    setRooms(
      rooms.map((r) => {
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
      })
    );
  };

  const handleOpenRoomDetail = (room: Room) => {
    setSelectedRoomDetail(room);
    setIsRoomDetailOpen(true);
  };

  const handleAddServiceToBooking = (bookingId: string, item: BookingServiceItem) => {
    setBookings(
      bookings.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          services: [...b.services, item],
        };
      })
    );
  };

  const handleRemoveServiceFromBooking = (bookingId: string, serviceId: string) => {
    setBookings(
      bookings.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          services: b.services.filter((s) => s.id !== serviceId),
        };
      })
    );
  };

  const handleResetDefaults = () => {
    const data = resetToDefaults();
    setRooms(data.rooms);
    setBookings(data.bookings);
    setSettings(data.settings);
    setSelectedRoomDetail(null);
    setIsRoomDetailOpen(false);
    setIsCheckoutModalOpen(false);
    setIsExtendModalOpen(false);
    setIsBookingModalOpen(false);
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
        onChangeView={setCurrentView}
        settings={settings}
        rooms={rooms}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

        {currentView === 'ota' && (
          <OtaPricingCalculator
            settings={settings}
            onUpdateSettings={setSettings}
          />
        )}

        {currentView === 'bookings' && (
          <BookingList
            bookings={bookings}
            rooms={rooms}
            settings={settings}
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

        {currentView === 'analytics' && (
          <AnalyticsView
            bookings={bookings}
            rooms={rooms}
            settings={settings}
          />
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

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        rooms={rooms}
        onSaveSettings={setSettings}
        onUpdateRooms={setRooms}
        onResetDefaults={handleResetDefaults}
      />
    </div>
  );
}

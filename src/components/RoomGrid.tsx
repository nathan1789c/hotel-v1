import { useState } from 'react';
import { Room, Booking, RoomStatus, HotelSettings } from '../types/hotel';
import { ROOM_TYPES, CHANNELS } from '../data/initialData';
import {
  addDaysToDateStr,
  calculateHourlyPrice,
  formatMonthLabel,
  formatShortVND,
  formatVND,
  getMonthBounds,
  getMonthKey,
} from '../utils/pricing';
import { 
  Sparkles, 
  LogIn, 
  LogOut, 
  Wrench, 
  CheckCircle2, 
  Filter, 
  Layers, 
  Search,
  CalendarPlus,
  Clock,
  XCircle,
  Pencil,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface RoomGridProps {
  rooms: Room[];
  bookings: Booking[];
  settings: HotelSettings;
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
  onOpenBookingModal: (room: Room, isReservation?: boolean, defaultMonth?: string) => void;
  onOpenEditBookingModal: (booking: Booking) => void;
  onOpenCheckoutModal: (booking: Booking, room: Room) => void;
  onOpenExtendModal: (booking: Booking, room: Room) => void;
  onOpenRoomDetail: (room: Room) => void;
  onQuickCleanRoom: (roomId: string) => void;
  onQuickSetStatus: (roomId: string, status: RoomStatus) => void;
  onCheckInReservation: (bookingId: string, roomId: string) => void;
  onCancelBooking: (bookingId: string, roomId: string) => void;
}

export default function RoomGrid({
  rooms,
  bookings,
  settings,
  selectedMonth,
  onChangeMonth,
  onOpenBookingModal,
  onOpenEditBookingModal,
  onOpenCheckoutModal,
  onOpenExtendModal,
  onOpenRoomDetail,
  onQuickCleanRoom,
  onQuickSetStatus,
  onCheckInReservation,
  onCancelBooking,
}: RoomGridProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmCancelBookingId, setConfirmCancelBookingId] = useState<string | null>(null);
  const [confirmCheckInBookingId, setConfirmCheckInBookingId] = useState<string | null>(null);

  // Group rooms by floor (Floor 1 to Floor 5)
  const floors = [1, 2, 3, 4, 5];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMonthKey = getMonthKey('');
  const shiftMonth = (baseMonth: string, delta: number): string => {
    const [y, m] = (baseMonth || nowMonthKey).split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const nextMonthKey = shiftMonth(nowMonthKey, 1);

  // Check if a booking overlaps a target YYYY-MM month
  const doesBookingOverlapMonth = (b: Booking, monthKey: string): boolean => {
    const { start, end } = getMonthBounds(monthKey);
    const bStart = b.checkInDate;
    const bEnd =
      b.stayType === 'hourly'
        ? b.checkInDate
        : b.checkOutDate > b.checkInDate
        ? addDaysToDateStr(b.checkOutDate, -1)
        : b.checkInDate;
    return bStart <= end && bEnd >= start;
  };

  // Build available month tabs (current month, next month, and all months that have active/reserved bookings)
  const monthBookingCounts = new Map<string, number>();
  monthBookingCounts.set(nowMonthKey, 0);
  monthBookingCounts.set(nextMonthKey, 0);
  if (!monthBookingCounts.has(selectedMonth)) {
    monthBookingCounts.set(selectedMonth, 0);
  }
  bookings.forEach((b) => {
    if (b.status === 'active' || b.status === 'reserved') {
      const mk = getMonthKey(b.checkInDate);
      if (!monthBookingCounts.has(mk)) {
        monthBookingCounts.set(mk, 0);
      }
    }
  });
  const availableMonths = Array.from(monthBookingCounts.keys()).sort((a, b) => a.localeCompare(b));
  availableMonths.forEach((mk) => {
    const count = bookings.filter(
      (b) => (b.status === 'active' || b.status === 'reserved') && doesBookingOverlapMonth(b, mk)
    ).length;
    monthBookingCounts.set(mk, count);
  });

  // Compute month-scoped status & non-overlapping bookings for each of the 25 rooms
  const roomViewMap = new Map<
    string,
    {
      displayStatus: RoomStatus;
      activeBooking: Booking | null;
      reservedBookings: Booking[];
      primaryReserved: Booking | null;
      monthBookings: Booking[];
    }
  >();

  rooms.forEach((room) => {
    const roomMonthBookings = bookings
      .filter(
        (b) =>
          b.roomId === room.id &&
          (b.status === 'active' || b.status === 'reserved') &&
          doesBookingOverlapMonth(b, selectedMonth)
      )
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.checkInDate.localeCompare(b.checkInDate);
      });

    const activeBooking = roomMonthBookings.find((b) => b.status === 'active') || null;
    const reservedBookings = roomMonthBookings.filter((b) => b.status === 'reserved');
    const isCleaningVisible =
      room.status === 'cleaning' &&
      (selectedMonth === nowMonthKey || room.cleaningMonth === selectedMonth);
    const isMaintenanceVisible =
      room.status === 'maintenance' &&
      (selectedMonth === nowMonthKey || room.cleaningMonth === selectedMonth);

    let displayStatus: RoomStatus = 'available';
    let primaryReserved: Booking | null = null;

    // Strict priority: Occupied -> Cleaning -> Maintenance -> Arriving Reserved -> Available (with optional future reserved schedule)
    if (activeBooking) {
      displayStatus = 'occupied';
    } else if (isCleaningVisible) {
      displayStatus = 'cleaning';
    } else if (isMaintenanceVisible) {
      displayStatus = 'maintenance';
    } else if (selectedMonth === nowMonthKey) {
      const todayReserved = reservedBookings.find((b) => b.checkInDate <= todayStr) || null;
      if (todayReserved) {
        displayStatus = 'reserved';
        primaryReserved = todayReserved;
      } else {
        displayStatus = 'available';
      }
    } else if (reservedBookings.length > 0) {
      displayStatus = 'reserved';
      primaryReserved = reservedBookings[0];
    }

    roomViewMap.set(room.id, {
      displayStatus,
      activeBooking,
      reservedBookings,
      primaryReserved,
      monthBookings: roomMonthBookings,
    });
  });

  // Calculate month-scoped statistics
  const totalRooms = rooms.length;
  const occupiedCount = rooms.filter((r) => roomViewMap.get(r.id)?.displayStatus === 'occupied').length;
  const availableCount = rooms.filter((r) => roomViewMap.get(r.id)?.displayStatus === 'available').length;
  const cleaningCount = rooms.filter((r) => roomViewMap.get(r.id)?.displayStatus === 'cleaning').length;
  const reservedCount = rooms.filter((r) => (roomViewMap.get(r.id)?.reservedBookings.length || 0) > 0).length;
  const maintenanceCount = rooms.filter((r) => roomViewMap.get(r.id)?.displayStatus === 'maintenance').length;
  const busyRoomsCount = rooms.filter((r) => {
    const view = roomViewMap.get(r.id);
    return view?.displayStatus === 'occupied' || (view?.reservedBookings.length || 0) > 0;
  }).length;
  const occupancyPercent = totalRooms > 0 ? Math.round((busyRoomsCount / totalRooms) * 100) : 0;

  // Filtered rooms
  const filteredRooms = rooms.filter((room) => {
    const view = roomViewMap.get(room.id);
    const displayStatus = view?.displayStatus || 'available';
    if (statusFilter === 'reserved') {
      if ((view?.reservedBookings.length || 0) === 0) return false;
    } else if (statusFilter !== 'all' && displayStatus !== statusFilter) {
      return false;
    }
    if (typeFilter !== 'all' && room.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const monthBookings = view?.monthBookings || [];
      const guestMatch = monthBookings.some(
        (b) => b.guestName.toLowerCase().includes(q) || b.guestPhone.includes(q)
      );
      const roomMatch =
        room.number.toLowerCase().includes(q) ||
        ROOM_TYPES[room.type]?.name.toLowerCase().includes(q);
      if (!guestMatch && !roomMatch) return false;
    }
    return true;
  });

  const getStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case 'available':
        return {
          label: 'Phòng Trống',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dotClass: 'bg-emerald-500',
        };
      case 'occupied':
        return {
          label: 'Đang Ở',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          dotClass: 'bg-rose-500 animate-pulse',
        };
      case 'reserved':
        return {
          label: 'Đặt Trước',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          dotClass: 'bg-amber-500',
        };
      case 'cleaning':
        return {
          label: 'Cần Dọn',
          badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
          dotClass: 'bg-sky-500',
        };
      case 'maintenance':
        return {
          label: 'Bảo Trì',
          badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
          dotClass: 'bg-slate-500',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Monthly Room Grid Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Sơ Đồ 25 Phòng Theo Từng Tháng — {formatMonthLabel(selectedMonth)}
              </h3>
              <p className="text-[11px] text-slate-500">
                {selectedMonth === nowMonthKey
                  ? 'Đang xem tháng hiện tại. Các đơn đặt trước thuộc tháng khác sẽ hiển thị riêng ở tháng đó.'
                  : `Đang xem lịch phòng riêng cho ${formatMonthLabel(selectedMonth)} (${occupiedCount + reservedCount} phòng có lịch trong tháng).`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) onChangeMonth(e.target.value);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
            />

            <button
              type="button"
              onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {selectedMonth !== nowMonthKey && (
              <button
                type="button"
                onClick={() => onChangeMonth(nowMonthKey)}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold"
              >
                Về Tháng Hiện Tại
              </button>
            )}
          </div>
        </div>

        {/* Quick Month Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {availableMonths.map((mk) => {
            const count = monthBookingCounts.get(mk) || 0;
            return (
              <button
                key={mk}
                type="button"
                onClick={() => onChangeMonth(mk)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedMonth === mk
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {formatMonthLabel(mk)} {mk === nowMonthKey ? '(Hiện tại)' : ''} • {count} đơn
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-md border-indigo-600 scale-[1.02]'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'all' ? 'text-indigo-100' : 'text-slate-500'}>Tổng số phòng</span>
            <Layers className="w-4 h-4 opacity-70" />
          </div>
          <div className="text-2xl font-black">{totalRooms}</div>
          <div className="text-[11px] mt-1 opacity-80">Công suất: {occupancyPercent}%</div>
        </button>

        <button
          onClick={() => setStatusFilter('available')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'available'
              ? 'bg-emerald-600 text-white shadow-md border-emerald-600 scale-[1.02]'
              : 'bg-white hover:bg-emerald-50/50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'available' ? 'text-emerald-100' : 'text-slate-500'}>Phòng Trống</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'available' ? 'text-white' : 'text-emerald-600'}`}>
            {availableCount}
          </div>
          <div className={`text-[11px] mt-1 ${statusFilter === 'available' ? 'text-emerald-100' : 'text-emerald-600/80'}`}>
            Sẵn sàng đón khách
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('occupied')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'occupied'
              ? 'bg-rose-600 text-white shadow-md border-rose-600 scale-[1.02]'
              : 'bg-white hover:bg-rose-50/50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'occupied' ? 'text-rose-100' : 'text-slate-500'}>Đang Có Khách</span>
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'occupied' ? 'text-white' : 'text-rose-600'}`}>
            {occupiedCount}
          </div>
          <div className={`text-[11px] mt-1 ${statusFilter === 'occupied' ? 'text-rose-100' : 'text-rose-600/80'}`}>
            {occupancyPercent}% phòng đang ở
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('reserved')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'reserved'
              ? 'bg-amber-600 text-white shadow-md border-amber-600 scale-[1.02]'
              : 'bg-white hover:bg-amber-50/50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'reserved' ? 'text-amber-100' : 'text-slate-500'}>Đặt Trước</span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'reserved' ? 'text-white' : 'text-amber-600'}`}>
            {reservedCount}
          </div>
          <div className={`text-[11px] mt-1 ${statusFilter === 'reserved' ? 'text-amber-100' : 'text-amber-600/80'}`}>
            Có đơn đặt tháng này
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('cleaning')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'cleaning'
              ? 'bg-sky-600 text-white shadow-md border-sky-600 scale-[1.02]'
              : 'bg-white hover:bg-sky-50/50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'cleaning' ? 'text-sky-100' : 'text-slate-500'}>Cần Dọn Dẹp</span>
            <Sparkles className={`w-3.5 h-3.5 ${statusFilter === 'cleaning' ? 'text-white' : 'text-sky-500'}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'cleaning' ? 'text-white' : 'text-sky-600'}`}>
            {cleaningCount}
          </div>
          <div className={`text-[11px] mt-1 ${statusFilter === 'cleaning' ? 'text-sky-100' : 'text-sky-600/80'}`}>
            Chờ buồng phòng
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('maintenance')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'maintenance'
              ? 'bg-slate-700 text-white shadow-md border-slate-700 scale-[1.02]'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statusFilter === 'maintenance' ? 'text-slate-200' : 'text-slate-500'}>Bảo Trì</span>
            <Wrench className={`w-3.5 h-3.5 ${statusFilter === 'maintenance' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'maintenance' ? 'text-white' : 'text-slate-700'}`}>
            {maintenanceCount}
          </div>
          <div className={`text-[11px] mt-1 ${statusFilter === 'maintenance' ? 'text-slate-200' : 'text-slate-500'}`}>
            Tạm ngưng đón
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Lọc Hạng Phòng:
          </div>
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả (25 phòng)
          </button>
          <button
            onClick={() => setTypeFilter('standard_single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'standard_single'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Standard 1 Giường
          </button>
          <button
            onClick={() => setTypeFilter('standard_twin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'standard_twin'
                ? 'bg-teal-600 text-white'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
            }`}
          >
            Standard 2 Giường (P.105)
          </button>
          <button
            onClick={() => setTypeFilter('vip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'vip'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            Đơn VIP (P.501)
          </button>
          <button
            onClick={() => setTypeFilter('deluxe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'deluxe'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
            }`}
          >
            Deluxe (P.505)
          </button>
          <button
            onClick={() => setTypeFilter('family')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              typeFilter === 'family'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
            }`}
          >
            Family (P.201, 401)
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm số phòng, tên khách, SĐT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Floor by Floor Layout */}
      <div className="space-y-6">
        {floors.map((floorNum) => {
          const floorRooms = filteredRooms.filter((r) => r.floor === floorNum);
          if (floorRooms.length === 0) return null;

          return (
            <div key={floorNum} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center">
                  T{floorNum}
                </span>
                <h3 className="font-bold text-slate-800 text-base">
                  Tầng {floorNum}
                </h3>
                <span className="text-xs text-slate-400">
                  ({floorRooms.length} phòng)
                </span>
              </div>

              {/* Grid of rooms on this floor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {floorRooms.map((room) => {
                  const view = roomViewMap.get(room.id);
                  const displayStatus = view?.displayStatus || 'available';
                  const activeBooking = view?.activeBooking || null;
                  const reservedBookings = view?.reservedBookings || [];
                  const primaryReserved = view?.primaryReserved || reservedBookings[0] || null;
                  const sideReservedList =
                    displayStatus === 'reserved' && primaryReserved
                      ? reservedBookings.filter((b) => b.id !== primaryReserved.id)
                      : reservedBookings;

                  const typeInfo = ROOM_TYPES[room.type] || ROOM_TYPES.standard_single;
                  const statusInfo = getStatusBadge(displayStatus);
                  const channelInfo = activeBooking ? CHANNELS[activeBooking.channel] : null;
                  const reservedChannelInfo = primaryReserved ? CHANNELS[primaryReserved.channel] : null;
                  const hourlyRates = calculateHourlyPrice(room.type, 3, settings);
                  const isConfirmingCancel = primaryReserved && confirmCancelBookingId === primaryReserved.id;
                  const isConfirmingCheckIn = primaryReserved && confirmCheckInBookingId === primaryReserved.id;

                  return (
                    <div
                      key={room.id}
                      onClick={() => onOpenRoomDetail(room)}
                      className={`relative bg-white rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-lg flex flex-col justify-between ${
                        displayStatus === 'occupied'
                          ? 'border-rose-300 ring-1 ring-rose-200'
                          : displayStatus === 'cleaning'
                          ? 'border-sky-300 ring-1 ring-sky-200 bg-sky-50/20'
                          : displayStatus === 'reserved'
                          ? 'border-amber-300 ring-1 ring-amber-200'
                          : displayStatus === 'maintenance'
                          ? 'border-slate-300 opacity-70 bg-slate-50'
                          : reservedBookings.length > 0
                          ? 'border-emerald-300 ring-1 ring-amber-200/70'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {/* Top Bar: Room Number & Status Badge */}
                      <div className="p-3.5 pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                              {room.number}
                            </span>
                            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>🛏️ {typeInfo.bedDescription}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                              {statusInfo.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                              {typeInfo.badgeName}
                            </span>
                          </div>
                        </div>

                        {/* Direct Price & Hourly Rate Tag */}
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">Qua đêm:</span>
                            <span className="font-bold text-emerald-700">
                              {formatVND(room.directPrice)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[10px]">Khách giờ (3h đầu):</span>
                            <span className="font-semibold text-purple-700 text-[11px]">
                              {formatShortVND(hourlyRates.first3HoursPrice)} (+{formatShortVND(hourlyRates.extraHourPrice)}/h)
                            </span>
                          </div>
                        </div>

                        {/* Guest / Booking Details If Occupied */}
                        {displayStatus === 'occupied' && activeBooking && (
                          <div className="mt-2.5 p-2 rounded-lg bg-rose-50/80 border border-rose-100 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 truncate">
                                {activeBooking.guestName}
                              </span>
                              {activeBooking.stayType === 'hourly' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 shrink-0 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  Giờ
                                </span>
                              ) : (
                                channelInfo && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${channelInfo.bgColor}`}>
                                    {channelInfo.shortName}
                                  </span>
                                )
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between">
                              {activeBooking.stayType === 'hourly' ? (
                                <>
                                  <span>
                                    {activeBooking.checkInTime || '--:--'} → {activeBooking.checkOutTime || '--:--'}
                                  </span>
                                  <span className="font-semibold text-purple-700">
                                    {activeBooking.hours || 3} giờ
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>Out: {activeBooking.checkOutDate}</span>
                                  <span className="font-medium text-rose-700">{activeBooking.nights} đêm</span>
                                </>
                              )}
                            </div>
                            {activeBooking.services.length > 0 && (
                              <div className="text-[10px] text-amber-700 font-semibold">
                                + {activeBooking.services.length} món minibar/dịch vụ
                              </div>
                            )}
                          </div>
                        )}

                        {/* Cleaning note */}
                        {displayStatus === 'cleaning' && (
                          <div className="mt-2.5 p-2 rounded-lg bg-sky-50 border border-sky-100 text-[11px] text-sky-800">
                            <span className="font-semibold block">🧹 {room.cleaningNote || 'Cần dọn dẹp thay ga gối'}</span>
                          </div>
                        )}

                        {/* Maintenance note */}
                        {displayStatus === 'maintenance' && (
                          <div className="mt-2.5 p-2 rounded-lg bg-slate-100 text-[11px] text-slate-700">
                            <span>🛠️ {room.cleaningNote || 'Đang bảo dưỡng kỹ thuật'}</span>
                          </div>
                        )}

                        {/* Arriving Reserved Info (status === reserved) */}
                        {displayStatus === 'reserved' && primaryReserved && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 truncate">
                                {primaryReserved.guestName}
                              </span>
                              {primaryReserved.stayType === 'hourly' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 shrink-0">
                                  Giờ
                                </span>
                              ) : (
                                reservedChannelInfo && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${reservedChannelInfo.bgColor}`}>
                                    {reservedChannelInfo.shortName}
                                  </span>
                                )
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {primaryReserved.stayType === 'hourly'
                                ? `Đến: ${primaryReserved.checkInDate} (${primaryReserved.checkInTime || ''} • ${primaryReserved.hours || 3}h)`
                                : `Đến: ${primaryReserved.checkInDate} (${primaryReserved.nights} đêm)`}
                            </div>
                            {primaryReserved.deposit > 0 && (
                              <div className="text-[10px] font-bold text-emerald-700">
                                Đã cọc: {formatVND(primaryReserved.deposit)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Non-blocking Upcoming Reservations Schedule (when room is available today, occupied, or cleaning) */}
                        {sideReservedList.length > 0 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2.5 p-2 rounded-lg bg-amber-50/90 border border-amber-200 text-[11px] space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase">
                              <span>📅 Đặt trước ({sideReservedList.length})</span>
                              <span>{sideReservedList[0].checkInDate.slice(5)}</span>
                            </div>
                            <div className="font-bold text-slate-800 truncate">
                              {sideReservedList[0].guestName}
                              {sideReservedList[0].deposit > 0 && (
                                <span className="text-emerald-700 ml-1 font-semibold">
                                  • Cọc {formatShortVND(sideReservedList[0].deposit)}
                                </span>
                              )}
                            </div>

                            {confirmCancelBookingId === sideReservedList[0].id ? (
                              <div className="flex items-center justify-between gap-1 bg-rose-50 border border-rose-200 rounded px-1.5 py-1">
                                <span className="text-[10px] font-bold text-rose-800">Hủy đặt?</span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onCancelBooking(sideReservedList[0].id, room.id);
                                      setConfirmCancelBookingId(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCancelBookingId(null)}
                                    className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10px]"
                                  >
                                    Giữ
                                  </button>
                                </div>
                              </div>
                            ) : confirmCheckInBookingId === sideReservedList[0].id ? (
                              <div className="flex items-center justify-between gap-1 bg-amber-100 border border-amber-300 rounded px-1.5 py-1">
                                <span className="text-[10px] font-bold text-amber-950">Check-in?</span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onCheckInReservation(sideReservedList[0].id, room.id);
                                      setConfirmCheckInBookingId(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCheckInBookingId(null)}
                                    className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10px]"
                                  >
                                    Chưa
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenEditBookingModal(sideReservedList[0])}
                                  className="flex-1 py-0.5 px-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold"
                                >
                                  Sửa
                                </button>
                                {displayStatus === 'available' && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCheckInBookingId(sideReservedList[0].id)}
                                    className="flex-1 py-0.5 px-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-bold"
                                    title="Khách đặt trước đã đến nhận phòng"
                                  >
                                    Check-in
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmCancelBookingId(sideReservedList[0].id)}
                                  className="py-0.5 px-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-[10px] font-bold"
                                  title="Hủy đơn đặt này"
                                >
                                  Hủy
                                </button>
                              </div>
                            )}

                            {sideReservedList.length > 1 && (
                              <div className="text-[10px] text-indigo-700 font-semibold">
                                +{sideReservedList.length - 1} đơn đặt khác (bấm phòng để xem)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Buttons */}
                      <div
                        className="p-2 bg-slate-50/90 border-t border-slate-100 flex flex-col gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {displayStatus === 'available' && (
                          selectedMonth === nowMonthKey ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onOpenBookingModal(room, false, selectedMonth)}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                Nhận Phòng
                              </button>
                              <button
                                onClick={() => onOpenBookingModal(room, true, selectedMonth)}
                                className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                                title="Đặt trước"
                              >
                                Đặt Trước
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => onOpenBookingModal(room, true, selectedMonth)}
                              className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              Đặt Trước ({formatMonthLabel(selectedMonth)})
                            </button>
                          )
                        )}

                        {displayStatus === 'occupied' && activeBooking && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenCheckoutModal(activeBooking, room)}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Trả Phòng
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenExtendModal(activeBooking, room)}
                              className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                              title="Gia hạn thêm ngày hoặc giờ"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              Gia Hạn
                            </button>
                          </div>
                        )}

                        {displayStatus === 'reserved' && primaryReserved && (
                          <>
                            {/* Room has no active guest right now: allow walk-in check-in in current month */}
                            {selectedMonth === nowMonthKey && (
                              <button
                                type="button"
                                onClick={() => onOpenBookingModal(room, false, selectedMonth)}
                                className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                title="Phòng hiện chưa có khách ở — Nhận khách vãng lai/khách mới ngay"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                Nhận Phòng (Khách Hiện Tại)
                              </button>
                            )}

                            {isConfirmingCancel ? (
                              <div className="flex items-center justify-between gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                                <span className="text-[11px] font-bold text-rose-800">Hủy đặt?</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onCancelBooking(primaryReserved.id, room.id);
                                      setConfirmCancelBookingId(null);
                                    }}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCancelBookingId(null)}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                                  >
                                    Giữ
                                  </button>
                                </div>
                              </div>
                            ) : isConfirmingCheckIn ? (
                              <div className="flex items-center justify-between gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
                                <span className="text-[10px] font-bold text-amber-900 leading-tight">
                                  Check-in ({primaryReserved.checkInDate.slice(5)})?
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onCheckInReservation(primaryReserved.id, room.id);
                                      setConfirmCheckInBookingId(null);
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCheckInBookingId(null)}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                                  >
                                    Chưa
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenEditBookingModal(primaryReserved)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                  title="Sửa đặt phòng, đổi hạng phòng hoặc tiền cọc"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Sửa Đặt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCheckInBookingId(primaryReserved.id)}
                                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors"
                                  title="Xác nhận khách đặt trước đã đến ở"
                                >
                                  <LogIn className="w-3.5 h-3.5" />
                                  Check-in
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCancelBookingId(primaryReserved.id)}
                                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                                  title="Hủy phòng đặt trước"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {displayStatus === 'cleaning' && (
                          <button
                            onClick={() => onQuickCleanRoom(room.id)}
                            className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã Dọn Xong (Sẵn Sàng)
                          </button>
                        )}

                        {displayStatus === 'maintenance' && (
                          <button
                            onClick={() => onQuickSetStatus(room.id, 'available')}
                            className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Xong Bảo Trì → Mở Bán
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

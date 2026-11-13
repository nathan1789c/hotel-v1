import { useState } from 'react';
import { Booking, Room, HotelSettings } from '../types/hotel';
import { ROOM_TYPES, CHANNELS } from '../data/initialData';
import { formatMonthLabel, formatVND, getMonthKey } from '../utils/pricing';
import {
  Search,
  LogOut,
  LogIn,
  XCircle,
  Clock,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
} from 'lucide-react';

interface BookingListProps {
  bookings: Booking[];
  rooms: Room[];
  settings: HotelSettings;
  onOpenCheckoutModal: (booking: Booking, room: Room) => void;
  onOpenExtendModal: (booking: Booking, room: Room) => void;
  onOpenEditBookingModal: (booking: Booking) => void;
  onOpenBookingModal: (room: Room, isReservation?: boolean) => void;
  onSelectBooking: (booking: Booking) => void;
  onCheckInReservation: (bookingId: string, roomId: string) => void;
  onCancelBooking: (bookingId: string, roomId: string) => void;
}

export default function BookingList({
  bookings,
  rooms,
  onOpenCheckoutModal,
  onOpenExtendModal,
  onOpenEditBookingModal,
  onCheckInReservation,
  onCancelBooking,
}: BookingListProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [groupByMonth, setGroupByMonth] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmCheckInId, setConfirmCheckInId] = useState<string | null>(null);

  const roomsMap = new Map<string, Room>();
  rooms.forEach((r) => roomsMap.set(r.id, r));

  // Collect all unique months present in bookings + current month
  const nowMonthKey = getMonthKey('');
  const monthCounts = new Map<string, number>();
  bookings.forEach((b) => {
    const mk = getMonthKey(b.checkInDate);
    monthCounts.set(mk, (monthCounts.get(mk) || 0) + 1);
  });
  if (!monthCounts.has(nowMonthKey)) {
    monthCounts.set(nowMonthKey, 0);
  }
  const availableMonths = Array.from(monthCounts.keys()).sort((a, b) => b.localeCompare(a));

  const shiftMonth = (baseMonth: string, delta: number): string => {
    const target = baseMonth === 'all' ? nowMonthKey : baseMonth;
    const [y, m] = target.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Month-scoped bookings (before status/channel/search filter, for accurate status counts in that month)
  const monthBookings = bookings.filter((b) => {
    if (selectedMonth !== 'all' && getMonthKey(b.checkInDate) !== selectedMonth) return false;
    return true;
  });

  const filteredBookings = monthBookings.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterChannel !== 'all' && b.channel !== filterChannel) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        b.guestName.toLowerCase().includes(q) ||
        b.guestPhone.includes(q) ||
        b.roomNumber.includes(q) ||
        b.bookingCode.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Group filteredBookings by month key when showing grouped view
  const groupedMonthsMap = new Map<string, Booking[]>();
  filteredBookings.forEach((b) => {
    const mk = getMonthKey(b.checkInDate);
    const arr = groupedMonthsMap.get(mk) || [];
    arr.push(b);
    groupedMonthsMap.set(mk, arr);
  });
  const groupedMonthKeys = Array.from(groupedMonthsMap.keys()).sort((a, b) => b.localeCompare(a));

  const monthActiveRevenue = monthBookings
    .filter((b) => b.status === 'active' || b.status === 'completed')
    .reduce(
      (sum, b) => sum + b.totalRoomPrice + b.services.reduce((s, i) => s + i.total, 0) - (b.discount || 0),
      0
    );

  const renderBookingRows = (list: Booking[]) =>
    list.map((b) => {
      const room = roomsMap.get(b.roomId);
      const roomType = ROOM_TYPES[b.roomType] || ROOM_TYPES.standard_single;
      const channel = CHANNELS[b.channel] || CHANNELS.direct;
      const totalServices = b.services.reduce((s, i) => s + i.total, 0);
      const isHourly = b.stayType === 'hourly';
      const isConfirmingCancel = confirmCancelId === b.id;
      const isConfirmingCheckIn = confirmCheckInId === b.id;

      return (
        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
          {/* Code & Room */}
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 text-sm">
                Phòng {b.roomNumber}
              </span>
              {isHourly && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  <Clock className="w-2.5 h-2.5" />
                  Giờ
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {b.bookingCode}
            </div>
            <span className="text-[10px] text-indigo-700 font-medium">
              {roomType.badgeName}
            </span>
          </td>

          {/* Guest Info */}
          <td className="py-3.5 px-4">
            <div className="font-bold text-slate-900">{b.guestName}</div>
            <div className="text-[11px] text-slate-500">{b.guestPhone || 'Không có SĐT'}</div>
            {b.notes && (
              <div className="text-[10px] text-amber-700 italic truncate max-w-xs">
                "{b.notes}"
              </div>
            )}
          </td>

          {/* Channel */}
          <td className="py-3.5 px-3">
            <span className={`inline-block px-2 py-0.5 rounded font-bold ${channel.bgColor}`}>
              {channel.name}
            </span>
            {b.channelBookingRef && (
              <span className="text-[10px] text-slate-400 block font-mono">
                {b.channelBookingRef}
              </span>
            )}
          </td>

          {/* Dates */}
          <td className="py-3.5 px-3">
            {isHourly ? (
              <>
                <div className="font-semibold text-slate-800">
                  {b.checkInDate} ({b.checkInTime || '--:--'} → {b.checkOutTime || '--:--'})
                </div>
                <div className="text-[11px] font-bold text-purple-700">
                  {b.hours || 3} giờ
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-slate-800">
                  {b.checkInDate} → {b.checkOutDate}
                </div>
                <div className="text-[11px] text-slate-500">
                  {b.nights} đêm
                </div>
              </>
            )}
          </td>

          {/* Price per night / hourly */}
          <td className="py-3.5 px-3">
            <div className="font-bold text-slate-900">
              {formatVND(isHourly ? b.totalRoomPrice : b.roomPricePerNight)}
            </div>
            {isHourly ? (
              <div className="text-[10px] text-purple-700 font-semibold">
                Khách giờ
              </div>
            ) : (
              b.channel !== 'direct' && (
                <div className="text-[10px] text-amber-700 font-semibold">
                  +150k phí QL
                </div>
              )
            )}
          </td>

          {/* Total */}
          <td className="py-3.5 px-3">
            <div className="font-extrabold text-indigo-950">
              {formatVND(b.totalRoomPrice + totalServices - (b.discount || 0))}
            </div>
            {totalServices > 0 && (
              <div className="text-[10px] text-slate-500">
                (+{formatVND(totalServices)} minibar)
              </div>
            )}
            {b.deposit > 0 && (
              <div className="text-[10px] font-bold text-emerald-700">
                Đã cọc: {formatVND(b.deposit)}
              </div>
            )}
          </td>

          {/* Status */}
          <td className="py-3.5 px-3">
            {b.status === 'active' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Đang Ở
              </span>
            )}
            {b.status === 'reserved' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Đặt Trước
              </span>
            )}
            {b.status === 'completed' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Đã Check-out
              </span>
            )}
            {b.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                Đã Hủy
              </span>
            )}
          </td>

          {/* Actions */}
          <td className="py-3.5 px-4 text-right">
            {isConfirmingCancel ? (
              <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                <span className="text-[11px] font-bold text-rose-800">Hủy đơn?</span>
                <button
                  type="button"
                  onClick={() => {
                    onCancelBooking(b.id, b.roomId);
                    setConfirmCancelId(null);
                  }}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancelId(null)}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                >
                  Không
                </button>
              </div>
            ) : (
              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                {b.status === 'active' && room && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenEditBookingModal(b)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                      title="Sửa phòng, đổi hạng phòng hoặc tiền cọc"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenExtendModal(b, room)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                      title="Gia hạn thêm ngày hoặc giờ"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Gia Hạn
                    </button>
                    <button
                      onClick={() => onOpenCheckoutModal(b, room)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Trả Phòng
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancelId(b.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Hủy
                    </button>
                  </>
                )}
                {b.status === 'reserved' && (
                  isConfirmingCheckIn ? (
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
                      <span className="text-[11px] font-bold text-amber-900">
                        Khách đến check-in ({b.checkInDate})?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onCheckInReservation(b.id, b.roomId);
                          setConfirmCheckInId(null);
                        }}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCheckInId(null)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                      >
                        Chưa
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenEditBookingModal(b)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                        title="Sửa đặt phòng, đổi hạng phòng, cập nhật tiền cọc"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Sửa Đặt
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCheckInId(b.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors"
                        title="Xác nhận khách đã đến nhận phòng"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Check-in
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(b.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Hủy Đặt
                      </button>
                    </>
                  )
                )}
                {b.status === 'completed' && room && (
                  <button
                    onClick={() => onOpenCheckoutModal(b, room)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    Xem Hóa Đơn
                  </button>
                )}
                {b.status === 'cancelled' && (
                  <span className="text-[11px] text-slate-400 italic">Đã hủy đặt</span>
                )}
              </div>
            )}
          </td>
        </tr>
      );
    });

  return (
    <div className="space-y-5">
      {/* Monthly Management Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Quản Lý Đặt Phòng Theo Từng Tháng
              </h3>
              <p className="text-[11px] text-slate-500">
                {selectedMonth === 'all'
                  ? `Đang xem tất cả các tháng (${monthBookings.length} đơn • Doanh thu phát sinh: ${formatVND(monthActiveRevenue)})`
                  : `Đang lọc ${formatMonthLabel(selectedMonth)}: ${monthBookings.length} đơn • Doanh thu phát sinh: ${formatVND(monthActiveRevenue)}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="month"
              value={selectedMonth === 'all' ? '' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || 'all')}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
            />

            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setGroupByMonth(!groupByMonth)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                groupByMonth
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              title="Chia nhóm danh sách phòng đặt theo từng tháng"
            >
              <Layers className="w-3.5 h-3.5" />
              {groupByMonth ? 'Đang chia theo tháng' : 'Danh sách liền'}
            </button>
          </div>
        </div>

        {/* Quick Month Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              selectedMonth === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả các tháng ({bookings.length})
          </button>

          {availableMonths.map((mk) => (
            <button
              key={mk}
              type="button"
              onClick={() => setSelectedMonth(mk)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedMonth === mk
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              {formatMonthLabel(mk)} ({monthCounts.get(mk) || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Search and Status Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterStatus === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({monthBookings.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterStatus === 'active' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Đang ở ({monthBookings.filter((b) => b.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterStatus('reserved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterStatus === 'reserved' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Đặt trước ({monthBookings.filter((b) => b.status === 'reserved').length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterStatus === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Đã trả phòng ({monthBookings.filter((b) => b.status === 'completed').length})
          </button>
          <button
            onClick={() => setFilterStatus('cancelled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filterStatus === 'cancelled' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Đã hủy ({monthBookings.filter((b) => b.status === 'cancelled').length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Channel Filter */}
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="all">Mọi kênh OTA & Trực tiếp</option>
            <option value="direct">Đặt trực tiếp</option>
            <option value="agoda">Agoda</option>
            <option value="booking">Booking.com</option>
            <option value="trip">Trip.com</option>
            <option value="airbnb">Airbnb</option>
          </select>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm khách, phòng, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table (Grouped by Month or Flat) */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-10 text-center text-xs text-slate-400">
          Không tìm thấy đơn đặt phòng nào phù hợp với tháng và bộ lọc đã chọn.
        </div>
      ) : groupByMonth ? (
        <div className="space-y-5">
          {groupedMonthKeys.map((mk) => {
            const list = groupedMonthsMap.get(mk) || [];
            const activeInMonth = list.filter((b) => b.status === 'active' || b.status === 'completed');
            const totalInMonth = activeInMonth.reduce(
              (sum, b) =>
                sum + b.totalRoomPrice + b.services.reduce((s, i) => s + i.total, 0) - (b.discount || 0),
              0
            );
            const nightsInMonth = activeInMonth.reduce(
              (sum, b) => sum + (b.stayType === 'hourly' ? 0 : b.nights),
              0
            );
            const hourlyInMonth = activeInMonth.filter((b) => b.stayType === 'hourly').length;

            return (
              <div key={mk} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Month Group Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-extrabold">
                      {formatMonthLabel(mk)}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {list.length} đơn đặt phòng
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({nightsInMonth} đêm{hourlyInMonth > 0 ? ` · ${hourlyInMonth} lượt giờ` : ''})
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    Doanh thu tháng:{' '}
                    <span className="font-black text-emerald-700 text-sm">{formatVND(totalInMonth)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Mã Đặt & Phòng</th>
                        <th className="py-3 px-4">Khách Hàng</th>
                        <th className="py-3 px-3">Kênh Đặt</th>
                        <th className="py-3 px-3">Thời Gian Lưu Trú</th>
                        <th className="py-3 px-3">Đơn Giá</th>
                        <th className="py-3 px-3">Tổng Tiền</th>
                        <th className="py-3 px-3">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {renderBookingRows(list)}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Mã Đặt & Phòng</th>
                  <th className="py-3 px-4">Khách Hàng</th>
                  <th className="py-3 px-3">Kênh Đặt</th>
                  <th className="py-3 px-3">Thời Gian Lưu Trú</th>
                  <th className="py-3 px-3">Đơn Giá</th>
                  <th className="py-3 px-3">Tổng Tiền</th>
                  <th className="py-3 px-3">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {renderBookingRows(filteredBookings)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

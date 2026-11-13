import { useState, useEffect } from 'react';
import { Room, Booking, RoomStatus, HotelSettings, BookingServiceItem } from '../types/hotel';
import { ROOM_TYPES, CHANNELS, DEFAULT_SERVICES } from '../data/initialData';
import {
  calculateHourlyPrice,
  calculateOtaPrice,
  formatMonthLabel,
  formatVND,
  getMonthKey,
} from '../utils/pricing';
import { 
  X, 
  Plus, 
  Trash2, 
  LogIn, 
  LogOut, 
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarPlus,
  Pencil,
  Calendar
} from 'lucide-react';

interface RoomDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  activeBooking: Booking | null;
  roomBookings?: Booking[];
  selectedMonth?: string;
  settings: HotelSettings;
  onUpdateRoomStatus: (roomId: string, status: RoomStatus, cleaningNote?: string) => void;
  onAddServiceToBooking: (bookingId: string, item: BookingServiceItem) => void;
  onRemoveServiceFromBooking: (bookingId: string, serviceId: string) => void;
  onOpenBookingModal: (room: Room, isReservation?: boolean, defaultMonth?: string) => void;
  onOpenEditBookingModal: (booking: Booking) => void;
  onOpenCheckoutModal: (booking: Booking, room: Room) => void;
  onOpenExtendModal: (booking: Booking, room: Room) => void;
  onCheckInReservation: (bookingId: string, roomId: string) => void;
  onCancelBooking: (bookingId: string, roomId: string) => void;
}

export default function RoomDetailModal({
  isOpen,
  onClose,
  room,
  activeBooking,
  roomBookings = [],
  selectedMonth,
  settings,
  onUpdateRoomStatus,
  onAddServiceToBooking,
  onRemoveServiceFromBooking,
  onOpenBookingModal,
  onOpenEditBookingModal,
  onOpenCheckoutModal,
  onOpenExtendModal,
  onCheckInReservation,
  onCancelBooking,
}: RoomDetailModalProps) {
  const [cleaningNoteInput, setCleaningNoteInput] = useState<string>(room?.cleaningNote || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<boolean>(false);
  const [confirmCheckIn, setConfirmCheckIn] = useState<boolean>(false);
  const [confirmReservationCancelId, setConfirmReservationCancelId] = useState<string | null>(null);
  const [confirmReservationCheckInId, setConfirmReservationCheckInId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && room) {
      setCleaningNoteInput(room.cleaningNote || '');
      setConfirmCancel(false);
      setConfirmCheckIn(false);
      setConfirmReservationCancelId(null);
      setConfirmReservationCheckInId(null);
      setCopiedKey(null);
    }
  }, [isOpen, room, activeBooking?.id]);

  if (!isOpen || !room) return null;

  const roomType = ROOM_TYPES[room.type] || ROOM_TYPES.standard_single;
  const hourlyRates = calculateHourlyPrice(room.type, 3, settings);

  const availableServices = (
    settings.servicesList && settings.servicesList.length > 0
      ? settings.servicesList
      : DEFAULT_SERVICES
  ).filter((s) => s.isActive !== false);

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleQuickAddService = (item: { name: string; price: number; category: any; unit?: string }) => {
    if (!activeBooking) return;
    const newService: BookingServiceItem = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      price: item.price,
      quantity: 1,
      total: item.price,
      category: item.category,
      addedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    onAddServiceToBooking(activeBooking.id, newService);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">Phòng {room.number}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                Tầng {room.floor}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                {roomType.badgeName}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <span>🛏️ {roomType.bedDescription}</span>
              <span>•</span>
              <span>Tiêu chuẩn {roomType.capacity.adults} người lớn</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Switcher Bar */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">
              Chuyển Đổi Trạng Thái Phòng
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => onUpdateRoomStatus(room.id, 'available')}
                className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                  room.status === 'available'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                }`}
              >
                🟢 Phòng Trống
              </button>
              <button
                type="button"
                onClick={() => onUpdateRoomStatus(room.id, 'cleaning')}
                className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                  room.status === 'cleaning'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200'
                }`}
              >
                🧹 Cần Dọn
              </button>
              <button
                type="button"
                onClick={() => onUpdateRoomStatus(room.id, 'maintenance', cleaningNoteInput)}
                className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                  room.status === 'maintenance'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🛠️ Bảo Trì
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!activeBooking) {
                    onOpenBookingModal(room, false, selectedMonth);
                  }
                }}
                className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                  activeBooking?.status === 'active'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white hover:bg-rose-50 text-slate-700 border-slate-200'
                }`}
              >
                🔴 Đang Ở
              </button>
              <button
                type="button"
                onClick={() => onOpenBookingModal(room, true, selectedMonth)}
                className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                  roomBookings.some((b) => b.status === 'reserved')
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
                }`}
              >
                🟡 Đặt Trước
              </button>
            </div>
          </div>

          {/* Cleaning Action Banner whenever physical room needs housekeeping */}
          {room.status === 'cleaning' && (
            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-sky-950 text-sm block">
                  🧹 Phòng {room.number} đang cần dọn dẹp
                </span>
                <span className="text-xs text-sky-700 block mt-0.5">
                  {room.cleaningNote || 'Khách vừa trả phòng — cần dọn dẹp thay ga gối trước khi đón khách mới.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateRoomStatus(room.id, 'available')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                Đã Dọn Xong (Sẵn Sàng)
              </button>
            </div>
          )}

          {/* Current Active Guest Card (if occupied or reserved) */}
          {activeBooking && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {activeBooking.status === 'reserved' ? 'Đơn Đặt Giữ Phòng Trước' : 'Đơn Đang Lưu Trú'}
                    </span>
                    {activeBooking.stayType === 'hourly' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        <Clock className="w-3 h-3" />
                        Khách Giờ
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                    {activeBooking.guestName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    SĐT: {activeBooking.guestPhone || 'Chưa cập nhật'} • CCCD: {activeBooking.guestIdCard || 'Chưa lưu'}
                  </p>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${CHANNELS[activeBooking.channel]?.bgColor}`}>
                    {CHANNELS[activeBooking.channel]?.name}
                  </span>
                  <span className="text-xs text-slate-500 block mt-1">
                    {activeBooking.stayType === 'hourly'
                      ? `${activeBooking.checkInDate} (${activeBooking.checkInTime || '--:--'} → ${activeBooking.checkOutTime || '--:--'}, ${activeBooking.hours || 3} giờ)`
                      : `${activeBooking.checkInDate} → ${activeBooking.checkOutDate} (${activeBooking.nights} đêm)`}
                  </span>
                  {activeBooking.deposit > 0 && (
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                      Đã đặt cọc: {formatVND(activeBooking.deposit)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons for booking */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                {confirmCancel ? (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-rose-900">
                      Xác nhận hủy đơn {activeBooking.bookingCode} và trả Phòng {room.number} về Trống?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onCancelBooking(activeBooking.id, room.id);
                          setConfirmCancel(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                      >
                        Xác Nhận Hủy Phòng
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        Không
                      </button>
                    </div>
                  </div>
                ) : confirmCheckIn ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-950">
                      Xác nhận khách <strong>{activeBooking.guestName}</strong> đã đến ở thực tế (Check-in ngày {activeBooking.checkInDate})?
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onCheckInReservation(activeBooking.id, room.id);
                          setConfirmCheckIn(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                      >
                        Xác Nhận Check-in
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCheckIn(false)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        Chưa (Giữ Đặt Trước)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeBooking.status === 'reserved' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenEditBookingModal(activeBooking)}
                          className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Sửa Phòng / Đổi Hạng / Cọc
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCheckIn(true)}
                          className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Khách Đến (Check-in)
                        </button>
                      </>
                    )}

                    {activeBooking.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenCheckoutModal(activeBooking, room)}
                          className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Trả Phòng & Xuất Hóa Đơn
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenExtendModal(activeBooking, room)}
                          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Gia Hạn Thêm
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEditBookingModal(activeBooking)}
                          className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Sửa / Cọc
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {activeBooking.status === 'reserved' ? 'Hủy Đặt Phòng' : 'Hủy Đơn'}
                    </button>
                  </div>
                )}
              </div>

              {/* Minibar consumed in room */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Dịch Vụ & Minibar Tiêu Dùng ({activeBooking.services.length} món)
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    {formatVND(activeBooking.services.reduce((s, i) => s + i.total, 0))}
                  </span>
                </div>

                {activeBooking.services.length > 0 && (
                  <div className="divide-y divide-slate-200 text-xs bg-white rounded-lg p-2 border border-slate-200">
                    {activeBooking.services.map((item) => (
                      <div key={item.id} className="py-1 flex items-center justify-between">
                        <span className="text-slate-800">
                          {item.name} x{item.quantity}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{formatVND(item.total)}</span>
                          <button
                            onClick={() => onRemoveServiceFromBooking(activeBooking.id, item.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick add items */}
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-28 overflow-y-auto">
                  {availableServices.map((item) => (
                    <button
                      key={item.id || item.name}
                      onClick={() => handleQuickAddService(item)}
                      className="inline-flex items-center gap-1 text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2 py-1 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{item.name}</span>
                      <span className="font-bold text-slate-900">
                        ({formatVND(item.price)}{item.unit ? `/${item.unit}` : ''})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Check-in banner whenever room has no active stay right now */}
          {!activeBooking && room.status !== 'maintenance' && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-emerald-900 text-sm block">
                  {room.status === 'cleaning'
                    ? 'Phòng chưa có khách ở (cần dọn)'
                    : 'Phòng hiện tại đang trống — sẵn sàng nhận khách ngay!'}
                </span>
                <span className="text-xs text-emerald-700 block">
                  Qua đêm: {formatVND(room.directPrice)} • Khách giờ (3h đầu): {formatVND(hourlyRates.first3HoursPrice)} (+{formatVND(hourlyRates.extraHourPrice)}/h)
                </span>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenBookingModal(room, false, selectedMonth)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Nhận Phòng Ngay
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBookingModal(room, true, selectedMonth)}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Đặt Trước{selectedMonth ? ` (${formatMonthLabel(selectedMonth)})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Reservations for this room across months (separated cleanly from active stay) */}
          {roomBookings.filter((b) => b.id !== activeBooking?.id).length > 0 && (
            <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200 space-y-2.5">
              <div className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Lịch Đặt Trước Của Phòng {room.number} ({roomBookings.filter((b) => b.id !== activeBooking?.id).length} đơn)
              </div>
              <div className="space-y-2">
                {roomBookings
                  .filter((b) => b.id !== activeBooking?.id)
                  .map((b) => {
                    const isConfirmCancel = confirmReservationCancelId === b.id;
                    const isConfirmCheckIn = confirmReservationCheckInId === b.id;
                    const chInfo = CHANNELS[b.channel];

                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-lg p-3 border border-amber-200 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                {formatMonthLabel(getMonthKey(b.checkInDate))}
                              </span>
                              <span className="font-bold text-slate-900">{b.guestName}</span>
                              {b.stayType === 'hourly' ? (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                  Giờ
                                </span>
                              ) : (
                                chInfo && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${chInfo.bgColor}`}>
                                    {chInfo.shortName}
                                  </span>
                                )
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">{b.bookingCode}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-1">
                              {b.stayType === 'hourly'
                                ? `${b.checkInDate} (${b.checkInTime || '--:--'} → ${b.checkOutTime || '--:--'}, ${b.hours || 3} giờ)`
                                : `${b.checkInDate} → ${b.checkOutDate} (${b.nights} đêm)`}
                              {b.deposit > 0 && (
                                <span className="text-emerald-700 font-bold ml-2">
                                  • Đã cọc: {formatVND(b.deposit)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isConfirmCancel ? (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-rose-900">
                              Hủy đơn đặt {b.bookingCode}?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onCancelBooking(b.id, room.id);
                                  setConfirmReservationCancelId(null);
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                              >
                                Xác Nhận Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmReservationCancelId(null)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px]"
                              >
                                Giữ
                              </button>
                            </div>
                          </div>
                        ) : isConfirmCheckIn ? (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-amber-950">
                              Khách <strong>{b.guestName}</strong> đã đến nhận phòng?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onCheckInReservation(b.id, room.id);
                                  setConfirmReservationCheckInId(null);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                              >
                                Check-in Ngay
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmReservationCheckInId(null)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px]"
                              >
                                Chưa
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => onOpenEditBookingModal(b)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              Sửa Đặt / Cọc
                            </button>
                            {!activeBooking && (
                              <button
                                type="button"
                                onClick={() => setConfirmReservationCheckInId(b.id)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                              >
                                <LogIn className="w-3 h-3" />
                                Khách Đến (Check-in)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmReservationCancelId(b.id)}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ml-auto"
                            >
                              <XCircle className="w-3 h-3" />
                              Hủy
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Dedicated Rates for this specific room */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Bảng Giá Niêm Yết Của Phòng {room.number}
              </h4>
              <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                +150k phí quản lý sau trừ % sàn
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Direct */}
              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 block">Đặt Trực Tiếp (Qua đêm)</span>
                  <span className="text-[10px] text-emerald-700">0% hoa hồng</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-700 text-sm">{formatVND(room.directPrice)}</span>
                  <span className="text-[10px] text-emerald-600 block">Thực nhận 100%</span>
                </div>
              </div>

              {/* Hourly Rate */}
              <div className="p-3 bg-purple-50/70 rounded-lg border border-purple-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Khách Giờ (3 giờ đầu)
                  </span>
                  <span className="text-[10px] text-purple-700">
                    Giờ tiếp theo: +{formatVND(hourlyRates.extraHourPrice)} / giờ
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-purple-700 text-sm">
                    {formatVND(hourlyRates.first3HoursPrice)}
                  </span>
                  <span className="text-[10px] text-purple-600 block">3 giờ đầu</span>
                </div>
              </div>

              {/* OTAs */}
              {(['agoda', 'booking', 'trip', 'airbnb'] as const).map((ch) => {
                const chInfo = CHANNELS[ch];
                const rate = settings.channelCommissions[ch] ?? 0.15;
                const breakdown = calculateOtaPrice(
                  room.directPrice,
                  ch,
                  rate,
                  settings.defaultManagementFee,
                  settings.pricingFormula,
                  settings.roundingMethod
                );

                return (
                  <div key={ch} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${chInfo.bgColor}`}>
                          {chInfo.name}
                        </span>
                        <span className="text-[10px] text-slate-400">-{Math.round(rate * 100)}%</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Thực nhận: <strong className="text-emerald-700">{formatVND(breakdown.netPayout)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="text-right">
                        <span className="font-bold text-slate-900 text-sm">{formatVND(breakdown.listedPrice)}</span>
                        <span className="text-[10px] text-slate-400 block">Niêm yết</span>
                      </div>
                      <button
                        onClick={() => handleCopy(breakdown.listedPrice.toString(), `room-${ch}`)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600"
                        title="Sao chép"
                      >
                        {copiedKey === `room-${ch}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

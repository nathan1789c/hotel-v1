import { useState, useEffect } from 'react';
import {
  Room,
  Booking,
  BookingChannel,
  HotelSettings,
  BookingServiceItem,
  StayType,
} from '../types/hotel';
import { ROOM_TYPES, CHANNELS, DEFAULT_SERVICES } from '../data/initialData';
import {
  addDaysToDateStr,
  addHoursToTime,
  calculateHourlyPrice,
  calculateOtaPrice,
  formatVND,
  getMonthKey,
} from '../utils/pricing';
import {
  X,
  User,
  Phone,
  CreditCard,
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Moon,
  AlertCircle,
  Minus,
  ArrowRightLeft
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoom: Room | null;
  rooms: Room[];
  settings: HotelSettings;
  isReservation?: boolean;
  defaultMonth?: string;
  editingBooking?: Booking | null;
  onSaveBooking: (booking: Booking, targetRoomId: string, isCheckInNow: boolean) => void;
  onUpdateBooking?: (
    updatedBooking: Booking,
    oldRoomId: string,
    newRoomId: string,
    isCheckInNow: boolean
  ) => void;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function BookingModal({
  isOpen,
  onClose,
  selectedRoom,
  rooms,
  settings,
  isReservation = false,
  defaultMonth,
  editingBooking = null,
  onSaveBooking,
  onUpdateBooking,
}: BookingModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [roomId, setRoomId] = useState<string>(selectedRoom?.id || rooms[0]?.id || '101');
  const [stayType, setStayType] = useState<StayType>('nightly');
  const [channel, setChannel] = useState<BookingChannel>('direct');
  const [channelBookingRef, setChannelBookingRef] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestIdCard, setGuestIdCard] = useState<string>('');
  const [checkInDate, setCheckInDate] = useState<string>(todayStr);
  const [checkOutDate, setCheckOutDate] = useState<string>(tomorrowStr);
  const [checkInTime, setCheckInTime] = useState<string>(getCurrentTimeHHMM());
  const [hours, setHours] = useState<number>(3);
  const [customPricePerNight, setCustomPricePerNight] = useState<number | null>(null);
  const [customHourlyTotal, setCustomHourlyTotal] = useState<number | null>(null);
  const [deposit, setDeposit] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [isCheckInNow, setIsCheckInNow] = useState<boolean>(!isReservation);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = Boolean(editingBooking);

  useEffect(() => {
    if (isOpen) {
      if (editingBooking) {
        const editStayType: StayType = editingBooking.stayType === 'hourly' ? 'hourly' : 'nightly';
        setRoomId(editingBooking.roomId || selectedRoom?.id || rooms[0]?.id || '101');
        setStayType(editStayType);
        setChannel(editingBooking.channel || 'direct');
        setChannelBookingRef(editingBooking.channelBookingRef || '');
        setGuestName(editingBooking.guestName || '');
        setGuestPhone(editingBooking.guestPhone || '');
        setGuestIdCard(editingBooking.guestIdCard || '');
        setCheckInDate(editingBooking.checkInDate || new Date().toISOString().split('T')[0]);
        setCheckOutDate(
          editingBooking.checkOutDate || editingBooking.checkInDate || new Date().toISOString().split('T')[0]
        );
        setCheckInTime(editingBooking.checkInTime || getCurrentTimeHHMM());
        setHours(editingBooking.hours || 3);
        setCustomPricePerNight(
          editStayType === 'nightly' ? editingBooking.roomPricePerNight : null
        );
        setCustomHourlyTotal(
          editStayType === 'hourly' ? editingBooking.totalRoomPrice : null
        );
        setDeposit(editingBooking.deposit || 0);
        setDiscount(editingBooking.discount || 0);
        setNotes(editingBooking.notes || '');
        setServices(editingBooking.services || []);
        setIsCheckInNow(editingBooking.status === 'active');
        setFormError(null);
      } else {
        const nowToday = new Date().toISOString().split('T')[0];
        const currentMonthKey = getMonthKey('');
        const useTargetMonth = defaultMonth && defaultMonth !== currentMonthKey;
        const initialCheckIn = useTargetMonth ? `${defaultMonth}-01` : nowToday;
        const initialCheckOut = addDaysToDateStr(initialCheckIn, 1);
        const isFutureMonth = Boolean(defaultMonth && defaultMonth > currentMonthKey);

        setRoomId(selectedRoom?.id || rooms[0]?.id || '101');
        setStayType('nightly');
        setChannel('direct');
        setChannelBookingRef('');
        setGuestName('');
        setGuestPhone('');
        setGuestIdCard('');
        setCheckInDate(initialCheckIn);
        setCheckOutDate(initialCheckOut);
        setCheckInTime(getCurrentTimeHHMM());
        setHours(3);
        setCustomPricePerNight(null);
        setCustomHourlyTotal(null);
        setDeposit(0);
        setDiscount(0);
        setNotes('');
        setServices([]);
        setIsCheckInNow(isFutureMonth ? false : !isReservation);
        setFormError(null);
      }
    }
  }, [isOpen, selectedRoom, isReservation, defaultMonth, editingBooking, rooms]);

  if (!isOpen) return null;

  const currentRoom = rooms.find((r) => r.id === roomId) || selectedRoom || rooms[0];
  const roomType = ROOM_TYPES[currentRoom?.type || 'standard_single'];

  // Calculate nights (for nightly)
  const checkInTimeMs = new Date(checkInDate).getTime();
  const checkOutTimeMs = new Date(checkOutDate).getTime();
  const diffDays = Math.max(1, Math.round((checkOutTimeMs - checkInTimeMs) / (1000 * 60 * 60 * 24)));
  const nights = isNaN(diffDays) ? 1 : diffDays;

  // Hourly calculations
  const hourlyCalc = calculateHourlyPrice(currentRoom.type, hours, settings);
  const checkOutTime = addHoursToTime(checkInTime, Math.max(1, hours));

  // Auto calculate nightly price per night based on channel
  const commissionRate = settings.channelCommissions[channel] ?? 0.15;
  const otaCalculation = calculateOtaPrice(
    currentRoom?.directPrice || 800000,
    channel,
    commissionRate,
    settings.defaultManagementFee,
    settings.pricingFormula,
    settings.roundingMethod
  );

  const activePricePerNight = customPricePerNight !== null ? customPricePerNight : otaCalculation.listedPrice;
  const activeHourlyTotal = customHourlyTotal !== null ? customHourlyTotal : hourlyCalc.totalPrice;

  const totalRoomPrice = stayType === 'hourly' ? activeHourlyTotal : activePricePerNight * nights;
  const totalServices = services.reduce((sum, s) => sum + s.total, 0);
  const totalManagementFee =
    stayType === 'nightly' && channel !== 'direct' ? settings.defaultManagementFee * nights : 0;
  const totalOtaCommission =
    stayType === 'nightly' && channel !== 'direct' ? Math.round(totalRoomPrice * commissionRate) : 0;

  const handleCheckInDateChange = (newDate: string) => {
    setCheckInDate(newDate);
    if (!newDate) return;
    if (stayType === 'hourly') {
      setCheckOutDate(newDate);
    } else {
      const currentStayNights = Math.max(1, nights);
      setCheckOutDate(addDaysToDateStr(newDate, currentStayNights));
    }
  };

  const handleStayTypeChange = (nextType: StayType) => {
    setStayType(nextType);
    setCustomPricePerNight(null);
    setCustomHourlyTotal(null);
    if (nextType === 'hourly') {
      setChannel('direct');
      setCheckOutDate(checkInDate);
      setCheckInTime(getCurrentTimeHHMM());
      setHours(3);
    } else {
      setCheckOutDate(addDaysToDateStr(checkInDate || todayStr, 1));
    }
  };

  // Handle channel change
  const handleChannelChange = (newChannel: BookingChannel) => {
    setChannel(newChannel);
    setCustomPricePerNight(null);
  };

  const availableServices = (
    settings.servicesList && settings.servicesList.length > 0
      ? settings.servicesList
      : DEFAULT_SERVICES
  ).filter((s) => s.isActive !== false);

  const handleAddService = (item: { name: string; price: number; category: any }) => {
    const existingIndex = services.findIndex((s) => s.name === item.name);
    if (existingIndex >= 0) {
      const updated = [...services];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].price;
      setServices(updated);
    } else {
      const newService: BookingServiceItem = {
        id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        price: item.price,
        quantity: 1,
        total: item.price,
        category: item.category,
        addedAt: new Date().toLocaleString('vi-VN'),
      };
      setServices([...services, newService]);
    }
  };

  const handleRemoveService = (serviceId: string) => {
    setServices(services.filter((s) => s.id !== serviceId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setFormError('Vui lòng nhập họ tên khách hàng trước khi lưu!');
      return;
    }
    setFormError(null);

    if (isEditing && editingBooking && onUpdateBooking) {
      const updatedBooking: Booking = {
        ...editingBooking,
        roomId: currentRoom.id,
        roomNumber: currentRoom.number,
        roomType: currentRoom.type,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestIdCard: guestIdCard.trim(),
        channel: stayType === 'hourly' ? 'direct' : channel,
        channelBookingRef: stayType === 'hourly' ? '' : channelBookingRef.trim(),
        stayType,
        checkInDate,
        checkOutDate: stayType === 'hourly' ? checkInDate : checkOutDate,
        checkInTime: stayType === 'hourly' ? checkInTime : undefined,
        checkOutTime: stayType === 'hourly' ? checkOutTime : undefined,
        nights: stayType === 'hourly' ? 0 : nights,
        hours: stayType === 'hourly' ? hours : undefined,
        hourlyBasePrice: stayType === 'hourly' ? hourlyCalc.first3HoursPrice : undefined,
        hourlyExtraPrice: stayType === 'hourly' ? hourlyCalc.extraHourPrice : undefined,
        roomPricePerNight: stayType === 'hourly' ? activeHourlyTotal : activePricePerNight,
        totalRoomPrice,
        managementFee: totalManagementFee,
        otaCommissionRate: stayType === 'hourly' ? 0 : commissionRate,
        otaCommissionAmount: totalOtaCommission,
        services,
        deposit,
        discount,
        status: isCheckInNow ? 'active' : 'reserved',
        notes: notes.trim(),
      };

      onUpdateBooking(updatedBooking, editingBooking.roomId, currentRoom.id, isCheckInNow);
      onClose();
      return;
    }

    const prefix = stayType === 'hourly' ? 'HR' : channel.substring(0, 3).toUpperCase();
    const bookingCode = `BK-${currentRoom.number}-${prefix}-${Math.floor(100 + Math.random() * 900)}`;

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      bookingCode,
      roomId: currentRoom.id,
      roomNumber: currentRoom.number,
      roomType: currentRoom.type,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestIdCard: guestIdCard.trim(),
      channel: stayType === 'hourly' ? 'direct' : channel,
      channelBookingRef: stayType === 'hourly' ? '' : channelBookingRef.trim(),
      stayType,
      checkInDate,
      checkOutDate: stayType === 'hourly' ? checkInDate : checkOutDate,
      checkInTime: stayType === 'hourly' ? checkInTime : undefined,
      checkOutTime: stayType === 'hourly' ? checkOutTime : undefined,
      nights: stayType === 'hourly' ? 0 : nights,
      hours: stayType === 'hourly' ? hours : undefined,
      hourlyBasePrice: stayType === 'hourly' ? hourlyCalc.first3HoursPrice : undefined,
      hourlyExtraPrice: stayType === 'hourly' ? hourlyCalc.extraHourPrice : undefined,
      roomPricePerNight: stayType === 'hourly' ? activeHourlyTotal : activePricePerNight,
      totalRoomPrice,
      managementFee: totalManagementFee,
      otaCommissionRate: stayType === 'hourly' ? 0 : commissionRate,
      otaCommissionAmount: totalOtaCommission,
      services,
      deposit,
      discount,
      status: isCheckInNow ? 'active' : 'reserved',
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveBooking(newBooking, currentRoom.id, isCheckInNow);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {isEditing
                  ? `Sửa Đơn ${editingBooking?.bookingCode}`
                  : isCheckInNow
                  ? 'Nhận Phòng (Check-in Ngay)'
                  : 'Đặt Giữ Phòng Trước'}
              </span>
              <span className="text-xs text-slate-300">
                Phòng {currentRoom?.number} ({roomType?.badgeName})
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">
              {isEditing ? 'Chỉnh Sửa Đặt Phòng / Đổi Hạng & Tiền Cọc' : 'Tạo Đơn Đặt Phòng Mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Stay Type Selector: Nightly vs Hourly */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Hình Thức Thuê Phòng
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleStayTypeChange('nightly')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  stayType === 'nightly'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    stayType === 'nightly' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold">Theo Đêm (Qua Đêm)</div>
                  <div
                    className={`text-[11px] ${
                      stayType === 'nightly' ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    Giá gốc {formatVND(currentRoom.directPrice)} / đêm • Hỗ trợ OTA
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStayTypeChange('hourly')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  stayType === 'hourly'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    stayType === 'hourly' ? 'bg-white/20' : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold">Khách Giờ (Nghỉ Giờ)</div>
                  <div
                    className={`text-[11px] ${
                      stayType === 'hourly' ? 'text-purple-100' : 'text-slate-500'
                    }`}
                  >
                    3 giờ đầu {formatVND(hourlyCalc.first3HoursPrice)} • +{formatVND(hourlyCalc.extraHourPrice)}/giờ thêm
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Room & Channel Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {isEditing ? 'Chọn Phòng / Đổi Hạng Phòng (25 phòng)' : 'Chọn Phòng (Tổng 25 phòng)'}
              </label>
              <select
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setCustomPricePerNight(null);
                  setCustomHourlyTotal(null);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                {rooms.map((r) => {
                  const t = ROOM_TYPES[r.type];
                  const statusLabel =
                    r.status === 'available'
                      ? 'Trống'
                      : r.status === 'occupied'
                      ? 'Đang ở'
                      : r.status === 'reserved'
                      ? 'Đã giữ'
                      : r.status === 'cleaning'
                      ? 'Cần dọn'
                      : 'Bảo trì';
                  return (
                    <option key={r.id} value={r.id}>
                      Phòng {r.number} (T{r.floor}) - {t?.badgeName} -{' '}
                      {stayType === 'hourly'
                        ? `3h: ${formatVND(calculateHourlyPrice(r.type, 3, settings).first3HoursPrice)}`
                        : formatVND(r.directPrice)}{' '}
                      [{statusLabel}]
                    </option>
                  );
                })}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">
                🛏️ {roomType?.bedDescription} •{' '}
                {stayType === 'hourly'
                  ? `3 giờ đầu: ${formatVND(hourlyCalc.first3HoursPrice)} (+${formatVND(hourlyCalc.extraHourPrice)}/giờ)`
                  : `Giá trực tiếp: ${formatVND(currentRoom.directPrice)}`}
              </div>
              {isEditing && editingBooking && currentRoom.id !== editingBooking.roomId && (
                <div className="mt-1.5 p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Đổi từ <strong>Phòng {editingBooking.roomNumber}</strong> ({ROOM_TYPES[editingBooking.roomType]?.badgeName}) →{' '}
                    <strong>Phòng {currentRoom.number}</strong> ({roomType?.badgeName}) • Giá tự động cập nhật theo hạng phòng mới.
                  </span>
                </div>
              )}
            </div>

            {stayType === 'nightly' ? (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nguồn / Kênh Đặt Phòng
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['direct', 'agoda', 'booking', 'trip', 'airbnb'] as BookingChannel[]).map((ch) => {
                    const chInfo = CHANNELS[ch];
                    const isSelected = channel === ch;
                    return (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => handleChannelChange(ch)}
                        className={`p-1.5 rounded-lg border text-xs font-bold transition-all text-center ${
                          isSelected
                            ? `${chInfo.bgColor} ring-2 ring-indigo-500 shadow-sm`
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {chInfo.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs space-y-1">
                <span className="font-bold text-purple-900 block">
                  Quy tắc tính giá khách giờ ({roomType?.badgeName}):
                </span>
                <div className="text-purple-800 text-[11px] space-y-0.5">
                  <div>
                    • 3 giờ đầu tiên: <strong>{formatVND(hourlyCalc.first3HoursPrice)}</strong>
                  </div>
                  <div>
                    • Từ giờ thứ 4 trở đi: <strong>+{formatVND(hourlyCalc.extraHourPrice)} / giờ</strong>
                  </div>
                  <div className="text-purple-600 pt-0.5">
                    (Standard 300k · VIP 400k · Family 450k cho 3h đầu)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OTA Pricing Notification Box */}
          {stayType === 'nightly' && channel !== 'direct' && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Đã tự động tính giá niêm yết trên {CHANNELS[channel].name} (+150k phí quản lý):
                </span>
                <span className="font-black text-blue-950 text-sm">
                  {formatVND(otaCalculation.listedPrice)} / đêm
                </span>
              </div>
              <div className="text-slate-600 text-[11px] flex items-center justify-between">
                <span>
                  Trừ {Math.round(commissionRate * 100)}% hoa hồng ({formatVND(otaCalculation.commissionAmount)}) → Thực nhận: <strong>{formatVND(otaCalculation.netPayout)}</strong>
                </span>
                <span className="font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                  Dôi dư +150.000₫ quản lý
                </span>
              </div>
            </div>
          )}

          {/* Channel Booking Reference ID (if OTA) */}
          {stayType === 'nightly' && channel !== 'direct' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mã đặt phòng trên sàn {CHANNELS[channel].name} (tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: AGD-981249, BK-1204859..."
                value={channelBookingRef}
                onChange={(e) => setChannelBookingRef(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          )}

          {/* Guest Information */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Thông Tin Khách Hàng
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Họ và tên khách *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="0912 345 678"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  CCCD / Hộ chiếu
                </label>
                <div className="relative">
                  <CreditCard className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="07909500xxxx"
                    value={guestIdCard}
                    onChange={(e) => setGuestIdCard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dates & Rates */}
          {stayType === 'nightly' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Ngày nhận phòng (Check-in)
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => handleCheckInDateChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Ngày trả phòng (Check-out)
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate ? addDaysToDateStr(checkInDate, 1) : undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && checkInDate && val <= checkInDate) {
                      setCheckOutDate(addDaysToDateStr(checkInDate, 1));
                    } else {
                      setCheckOutDate(val);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Giá phòng / đêm ({nights} đêm)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={activePricePerNight}
                  onChange={(e) => setCustomPricePerNight(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-indigo-700"
                />
                <span className="text-[10px] text-slate-400">Có thể sửa giá trực tiếp nếu muốn</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Ngày sử dụng
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => {
                      setCheckInDate(e.target.value);
                      setCheckOutDate(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Giờ nhận phòng
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Số giờ thuê ({checkInTime} → {checkOutTime})
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setHours((h) => Math.max(1, h - 1));
                        setCustomHourlyTotal(null);
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 text-slate-700"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={hours}
                      onChange={(e) => {
                        setHours(Math.max(1, Number(e.target.value) || 1));
                        setCustomHourlyTotal(null);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-black text-center text-purple-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setHours((h) => Math.min(24, h + 1));
                        setCustomHourlyTotal(null);
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Tổng tiền giờ ({hours} giờ)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={activeHourlyTotal}
                    onChange={(e) => setCustomHourlyTotal(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-purple-700"
                  />
                  <span className="text-[10px] text-slate-400">Có thể chỉnh sửa nếu muốn</span>
                </div>
              </div>

              {/* Quick Hour Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-semibold mr-1">Chọn nhanh:</span>
                {[3, 4, 5, 6, 8].map((h) => {
                  const preview = calculateHourlyPrice(currentRoom.type, h, settings);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setHours(h);
                        setCustomHourlyTotal(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-colors ${
                        hours === h && customHourlyTotal === null
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {h} giờ ({formatVND(preview.totalPrice)})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Add Common Services */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Dịch vụ tiêu dùng & Minibar (tùy chọn)
              </label>
              <span className="text-xs text-slate-500">
                Đã thêm {services.length} món ({formatVND(totalServices)})
              </span>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200/60">
              {availableServices.map((srv) => (
                <button
                  type="button"
                  key={srv.id || srv.name}
                  onClick={() => handleAddService(srv)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2 py-1 rounded-md border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-600" />
                  <span>{srv.name}</span>
                  <span className="font-bold text-slate-900">
                    ({formatVND(srv.price)}{srv.unit ? `/${srv.unit}` : ''})
                  </span>
                </button>
              ))}
            </div>

            {/* Added services list */}
            {services.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-2.5 divide-y divide-slate-200 text-xs max-h-32 overflow-y-auto">
                {services.map((s) => (
                  <div key={s.id} className="py-1 flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      {s.name} x{s.quantity}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{formatVND(s.total)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(s.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deposit, Discount, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Tiền cọc trước (nếu có)
              </label>
              <input
                type="number"
                step="50000"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Giảm giá / Ưu đãi (VNĐ)
              </label>
              <input
                type="number"
                step="50000"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Ghi chú đặc biệt
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Yêu cầu tầng cao, giường phụ, khách nghỉ giờ gia hạn..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* Price Summary Calculation Card */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            {stayType === 'hourly' ? (
              <>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>
                    3 giờ đầu ({roomType?.badgeName}):
                  </span>
                  <span className="font-bold text-white">{formatVND(hourlyCalc.first3HoursPrice)}</span>
                </div>
                {hourlyCalc.extraHours > 0 && (
                  <div className="flex justify-between text-xs text-purple-300">
                    <span>
                      Giờ tiếp theo ({hourlyCalc.extraHours} giờ × {formatVND(hourlyCalc.extraHourPrice)}):
                    </span>
                    <span className="font-bold">+{formatVND(hourlyCalc.extraTotal)}</span>
                  </div>
                )}
                {customHourlyTotal !== null && customHourlyTotal !== hourlyCalc.totalPrice && (
                  <div className="flex justify-between text-xs text-amber-300">
                    <span>Giá giờ điều chỉnh thủ công:</span>
                    <span className="font-bold">{formatVND(activeHourlyTotal)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-xs text-slate-300">
                <span>
                  Tiền phòng ({formatVND(activePricePerNight)} x {nights} đêm):
                </span>
                <span className="font-bold text-white">{formatVND(totalRoomPrice)}</span>
              </div>
            )}

            {stayType === 'nightly' && channel !== 'direct' && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Phí quản lý dôi dư (+150k x {nights} đêm):</span>
                <span className="font-bold">+{formatVND(totalManagementFee)}</span>
              </div>
            )}

            {totalServices > 0 && (
              <div className="flex justify-between text-xs text-slate-300">
                <span>Dịch vụ minibar phụ trợ:</span>
                <span className="font-bold text-white">+{formatVND(totalServices)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex justify-between text-xs text-rose-300">
                <span>Giảm giá khuyến mãi:</span>
                <span className="font-bold">-{formatVND(discount)}</span>
              </div>
            )}

            {deposit > 0 && (
              <div className="flex justify-between text-xs text-emerald-300">
                <span>Đã đặt cọc:</span>
                <span className="font-bold">-{formatVND(deposit)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
              <span className="font-bold">Tổng dự kiến thu:</span>
              <span className="text-xl font-black text-emerald-400">
                {formatVND(totalRoomPrice + totalServices - discount - deposit)}
              </span>
            </div>
          </div>

          {/* Check-in now toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="checkInNowToggle"
              checked={isCheckInNow}
              onChange={(e) => setIsCheckInNow(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <label htmlFor="checkInNowToggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Khách nhận phòng ngay lúc này (Trạng thái phòng chuyển sang <span className="text-rose-600 font-bold">Đang ở</span>)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              {isEditing
                ? 'Lưu Thay Đổi Đặt Phòng'
                : isCheckInNow
                ? 'Xác Nhận & Nhận Phòng'
                : 'Lưu Đặt Chỗ Trước'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

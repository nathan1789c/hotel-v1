import { useState, useEffect } from 'react';
import { Booking, HotelSettings, Room } from '../types/hotel';
import { ROOM_TYPES, CHANNELS } from '../data/initialData';
import {
  addDaysToDateStr,
  addHoursToTime,
  calculateHourlyPrice,
  calculateOtaPrice,
  formatVND,
} from '../utils/pricing';
import {
  X,
  Clock,
  Moon,
  Plus,
  Minus,
  CalendarPlus,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export interface ExtendStayPayload {
  bookingId: string;
  stayType: 'nightly' | 'hourly';
  checkOutDate: string;
  checkOutTime?: string;
  nights: number;
  hours?: number;
  roomPricePerNight: number;
  totalRoomPrice: number;
  managementFee: number;
  otaCommissionAmount: number;
  notes?: string;
}

interface ExtendStayModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  room: Room | null;
  settings: HotelSettings;
  onConfirmExtend: (payload: ExtendStayPayload) => void;
}

export default function ExtendStayModal({
  isOpen,
  onClose,
  booking,
  room,
  settings,
  onConfirmExtend,
}: ExtendStayModalProps) {
  const [extendMode, setExtendMode] = useState<'add_nights' | 'add_hours' | 'hourly_to_nightly'>('add_nights');
  const [extraNights, setExtraNights] = useState<number>(1);
  const [extraHours, setExtraHours] = useState<number>(1);
  const [customExtraFee, setCustomExtraFee] = useState<number | null>(null);
  const [extendNote, setExtendNote] = useState<string>('');

  useEffect(() => {
    if (isOpen && booking) {
      setExtendMode(booking.stayType === 'hourly' ? 'add_hours' : 'add_nights');
      setExtraNights(1);
      setExtraHours(1);
      setCustomExtraFee(null);
      setExtendNote('');
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking || !room) return null;

  const isCurrentlyHourly = booking.stayType === 'hourly';
  const roomType = ROOM_TYPES[room.type] || ROOM_TYPES.standard_single;
  const channel = CHANNELS[booking.channel] || CHANNELS.direct;

  // Hourly rate info for this room
  const currentHours = booking.hours || 3;
  const hourlyRates = calculateHourlyPrice(
    room.type,
    currentHours,
    settings,
    booking.hourlyBasePrice,
    booking.hourlyExtraPrice
  );

  // Nightly rate info for converting hourly -> nightly or adding nights
  const nightlyCalculation = calculateOtaPrice(
    room.directPrice,
    booking.channel,
    booking.otaCommissionRate ?? settings.channelCommissions[booking.channel] ?? 0,
    settings.defaultManagementFee,
    settings.pricingFormula,
    settings.roundingMethod
  );
  const effectiveNightRate =
    isCurrentlyHourly
      ? nightlyCalculation.listedPrice
      : booking.roomPricePerNight || nightlyCalculation.listedPrice;

  // Calculate preview values depending on selected mode
  let newStayType: 'nightly' | 'hourly' = isCurrentlyHourly ? 'hourly' : 'nightly';
  let newNights = booking.nights;
  let newHours = booking.hours;
  let newCheckOutDate = booking.checkOutDate;
  let newCheckOutTime = booking.checkOutTime;
  let newRoomPricePerNight = booking.roomPricePerNight;
  let addedAmount = 0;
  let newTotalRoomPrice = booking.totalRoomPrice;
  let newManagementFee = booking.managementFee || 0;
  let newOtaCommission = booking.otaCommissionAmount || 0;
  let autoNoteSummary = '';

  if (extendMode === 'add_nights') {
    newStayType = 'nightly';
    newNights = booking.nights + extraNights;
    newCheckOutDate = addDaysToDateStr(booking.checkOutDate, extraNights);
    const defaultAdded = effectiveNightRate * extraNights;
    addedAmount = customExtraFee !== null ? customExtraFee : defaultAdded;
    newTotalRoomPrice = booking.totalRoomPrice + addedAmount;
    newRoomPricePerNight = effectiveNightRate;
    if (booking.channel !== 'direct') {
      newManagementFee = (booking.managementFee || 0) + settings.defaultManagementFee * extraNights;
      newOtaCommission = Math.round(newTotalRoomPrice * (booking.otaCommissionRate || 0));
    }
    autoNoteSummary = `Gia hạn +${extraNights} đêm (đến ${newCheckOutDate})`;
  } else if (extendMode === 'add_hours') {
    if (isCurrentlyHourly) {
      newStayType = 'hourly';
      newHours = currentHours + extraHours;
      newCheckOutTime = addHoursToTime(booking.checkInTime || '12:00', newHours);
      const updatedHourly = calculateHourlyPrice(
        room.type,
        newHours,
        settings,
        booking.hourlyBasePrice,
        booking.hourlyExtraPrice
      );
      const defaultAdded = Math.max(0, updatedHourly.totalPrice - booking.totalRoomPrice);
      addedAmount = customExtraFee !== null ? customExtraFee : defaultAdded;
      newTotalRoomPrice = booking.totalRoomPrice + addedAmount;
      newRoomPricePerNight = newTotalRoomPrice;
      autoNoteSummary = `Gia hạn +${extraHours} giờ (tổng ${newHours}h, ra lúc ${newCheckOutTime})`;
    } else {
      // Nightly guest staying extra hours (late check-out extension by hours)
      newStayType = 'nightly';
      const defaultAdded = extraHours * hourlyRates.extraHourPrice;
      addedAmount = customExtraFee !== null ? customExtraFee : defaultAdded;
      newTotalRoomPrice = booking.totalRoomPrice + addedAmount;
      if (booking.channel !== 'direct') {
        newOtaCommission = Math.round(newTotalRoomPrice * (booking.otaCommissionRate || 0));
      }
      autoNoteSummary = `Gia hạn ở thêm ${extraHours} giờ (+${formatVND(addedAmount)})`;
    }
  } else if (extendMode === 'hourly_to_nightly') {
    newStayType = 'nightly';
    newNights = extraNights;
    newHours = undefined;
    newCheckOutDate = addDaysToDateStr(booking.checkInDate, extraNights);
    newCheckOutTime = undefined;
    const defaultTotal = effectiveNightRate * extraNights;
    const defaultAdded = Math.max(0, defaultTotal - booking.totalRoomPrice);
    addedAmount = customExtraFee !== null ? customExtraFee : defaultAdded;
    newTotalRoomPrice = booking.totalRoomPrice + addedAmount;
    newRoomPricePerNight = effectiveNightRate;
    if (booking.channel !== 'direct') {
      newManagementFee = settings.defaultManagementFee * extraNights;
      newOtaCommission = Math.round(newTotalRoomPrice * (booking.otaCommissionRate || 0));
    }
    autoNoteSummary = `Chuyển từ khách giờ sang ở ${extraNights} đêm (đến ${newCheckOutDate})`;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const noteLine = extendNote.trim() ? `${autoNoteSummary}: ${extendNote.trim()}` : autoNoteSummary;
    const combinedNotes = booking.notes ? `${booking.notes} | ${noteLine}` : noteLine;

    onConfirmExtend({
      bookingId: booking.id,
      stayType: newStayType,
      checkOutDate: newCheckOutDate,
      checkOutTime: newCheckOutTime,
      nights: newNights,
      hours: newHours,
      roomPricePerNight: newRoomPricePerNight,
      totalRoomPrice: newTotalRoomPrice,
      managementFee: newManagementFee,
      otaCommissionAmount: newOtaCommission,
      notes: combinedNotes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Gia Hạn Thời Gian Lưu Trú
                </span>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
                  {booking.bookingCode}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                Phòng {room.number} • {booking.guestName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current stay info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Hiện tại:</span>
              {isCurrentlyHourly ? (
                <span className="font-bold text-purple-800">
                  Khách giờ • {currentHours} giờ ({booking.checkInTime || '--:--'} → {booking.checkOutTime || '--:--'})
                </span>
              ) : (
                <span className="font-bold text-slate-900">
                  Qua đêm • {booking.nights} đêm ({booking.checkInDate} → {booking.checkOutDate})
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tiền phòng hiện tại:</span>
              <span className="font-black text-indigo-700 text-sm">{formatVND(booking.totalRoomPrice)}</span>
            </div>
          </div>

          {/* Extend mode selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Chọn Hình Thức Gia Hạn
            </label>
            <div className="grid grid-cols-2 gap-2">
              {!isCurrentlyHourly ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExtendMode('add_nights');
                      setCustomExtraFee(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      extendMode === 'add_nights'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Moon className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <div>Gia hạn thêm đêm</div>
                      <div className={`text-[10px] font-normal ${extendMode === 'add_nights' ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {formatVND(effectiveNightRate)} / đêm
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExtendMode('add_hours');
                      setCustomExtraFee(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      extendMode === 'add_hours'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <div>Ở thêm giờ (trả muộn)</div>
                      <div className={`text-[10px] font-normal ${extendMode === 'add_hours' ? 'text-purple-100' : 'text-slate-400'}`}>
                        +{formatVND(hourlyRates.extraHourPrice)} / giờ
                      </div>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExtendMode('add_hours');
                      setCustomExtraFee(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      extendMode === 'add_hours'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <div>Gia hạn thêm giờ</div>
                      <div className={`text-[10px] font-normal ${extendMode === 'add_hours' ? 'text-purple-100' : 'text-slate-400'}`}>
                        +{formatVND(hourlyRates.extraHourPrice)} / giờ
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExtendMode('hourly_to_nightly');
                      setCustomExtraFee(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      extendMode === 'hourly_to_nightly'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Moon className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <div>Chuyển sang qua đêm</div>
                      <div className={`text-[10px] font-normal ${extendMode === 'hourly_to_nightly' ? 'text-indigo-100' : 'text-slate-400'}`}>
                        Tính giá {formatVND(effectiveNightRate)} / đêm
                      </div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quantity selector */}
          {extendMode === 'add_hours' ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Số giờ gia hạn thêm
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExtraHours((h) => Math.max(1, h - 1));
                    setCustomExtraFee(null);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={extraHours}
                  onChange={(e) => {
                    setExtraHours(Math.max(1, Number(e.target.value) || 1));
                    setCustomExtraFee(null);
                  }}
                  className="w-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-center text-sm font-black text-purple-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setExtraHours((h) => Math.min(24, h + 1));
                    setCustomExtraFee(null);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="flex flex-wrap gap-1.5 ml-1">
                  {[1, 2, 3, 4].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setExtraHours(h);
                        setCustomExtraFee(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                        extraHours === h
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      +{h} giờ
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {extendMode === 'hourly_to_nightly' ? 'Số đêm lưu trú' : 'Số đêm gia hạn thêm'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExtraNights((n) => Math.max(1, n - 1));
                    setCustomExtraFee(null);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={extraNights}
                  onChange={(e) => {
                    setExtraNights(Math.max(1, Number(e.target.value) || 1));
                    setCustomExtraFee(null);
                  }}
                  className="w-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-center text-sm font-black text-indigo-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setExtraNights((n) => Math.min(30, n + 1));
                    setCustomExtraFee(null);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="flex flex-wrap gap-1.5 ml-1">
                  {[1, 2, 3, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setExtraNights(n);
                        setCustomExtraFee(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                        extraNights === n
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      +{n} đêm
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom extra price override & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Phí gia hạn cộng thêm (VNĐ)
              </label>
              <input
                type="number"
                step="10000"
                value={addedAmount}
                onChange={(e) => setCustomExtraFee(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-indigo-700"
              />
              <span className="text-[10px] text-slate-400">Có thể chỉnh giá thỏa thuận riêng</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Ghi chú gia hạn (tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: Khách báo ở thêm do trễ chuyến bay..."
                value={extendNote}
                onChange={(e) => setExtendNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          {/* Preview Box */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span>Thời gian sau gia hạn:</span>
              <span className="font-bold text-white flex items-center gap-1">
                {newStayType === 'hourly' ? (
                  <>
                    {newHours} giờ ({booking.checkInTime || '--:--'} <ArrowRight className="w-3 h-3" /> {newCheckOutTime})
                  </>
                ) : (
                  <>
                    {newNights} đêm ({booking.checkInDate} <ArrowRight className="w-3 h-3" /> {newCheckOutDate})
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-amber-300">
              <span>Cộng thêm vào tiền phòng ({channel.shortName}):</span>
              <span className="font-bold">+{formatVND(addedAmount)}</span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
              <span className="font-bold">Tổng tiền phòng mới:</span>
              <span className="text-xl font-black text-emerald-400">
                {formatVND(newTotalRoomPrice)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Xác Nhận Gia Hạn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

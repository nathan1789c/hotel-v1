import { Booking, BookingChannel, HotelSettings, HourlyRateConfig, RoomType } from '../types/hotel';
import { DEFAULT_HOURLY_RATES, ROOM_TYPES } from '../data/initialData';

export interface PriceBreakdown {
  directPrice: number;
  managementFee: number;
  commissionRate: number;
  listedPrice: number;
  commissionAmount: number;
  netPayout: number;
  profitDelta: number; // netPayout - directPrice (should equal management fee)
  formulaDescription: string;
}

export interface HourlyPriceBreakdown {
  baseHours: number;
  first3HoursPrice: number;
  extraHourPrice: number;
  totalHours: number;
  extraHours: number;
  extraTotal: number;
  totalPrice: number;
}

export function formatVND(amount: number): string {
  if (isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫';
}

export function formatShortVND(amount: number): string {
  if (amount >= 1000000) {
    const val = amount / 1000000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)) + ' tr';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'k';
  }
  return amount + '₫';
}

export function roundPrice(amount: number, rounding: '1000' | '10000' | 'none'): number {
  if (rounding === '10000') {
    return Math.round(amount / 10000) * 10000;
  }
  if (rounding === '1000') {
    return Math.round(amount / 1000) * 1000;
  }
  return Math.round(amount);
}

export function getHourlyRatesForRoomType(
  roomType: RoomType,
  settings?: HotelSettings
): HourlyRateConfig {
  const configured = settings?.hourlyRates?.[roomType];
  if (configured) {
    return configured;
  }
  const typeInfo = ROOM_TYPES[roomType];
  if (typeInfo) {
    return {
      first3Hours: typeInfo.hourlyFirst3HoursPrice,
      extraHour: typeInfo.hourlyExtraHourPrice,
    };
  }
  return DEFAULT_HOURLY_RATES.standard_single;
}

/**
 * Hourly pricing rule:
 * - Standard (single / twin): 300,000 VND for first 3 hours, +50,000 VND per extra hour
 * - VIP: 400,000 VND for first 3 hours, +50,000 VND per extra hour
 * - Deluxe: 420,000 VND for first 3 hours, +50,000 VND per extra hour
 * - Family: 450,000 VND for first 3 hours, +50,000 VND per extra hour
 */
export function calculateHourlyPrice(
  roomType: RoomType,
  hours: number,
  settings?: HotelSettings,
  customFirst3Hours?: number,
  customExtraHour?: number
): HourlyPriceBreakdown {
  const defaultRates = getHourlyRatesForRoomType(roomType, settings);
  const first3HoursPrice = customFirst3Hours ?? defaultRates.first3Hours;
  const extraHourPrice = customExtraHour ?? defaultRates.extraHour;
  const normalizedHours = Math.max(1, Math.round(hours || 1));
  const extraHours = Math.max(0, normalizedHours - 3);
  const extraTotal = extraHours * extraHourPrice;
  const totalPrice = first3HoursPrice + extraTotal;

  return {
    baseHours: 3,
    first3HoursPrice,
    extraHourPrice,
    totalHours: normalizedHours,
    extraHours,
    extraTotal,
    totalPrice,
  };
}

export function addHoursToTime(timeStr: string, hoursToAdd: number): string {
  const [hRaw, mRaw] = (timeStr || '12:00').split(':').map((n) => parseInt(n, 10));
  const h = isNaN(hRaw) ? 12 : hRaw;
  const m = isNaN(mRaw) ? 0 : mRaw;
  const totalMinutes = (h * 60 + m + Math.round(hoursToAdd * 60)) % (24 * 60);
  const outH = Math.floor(totalMinutes / 60);
  const outM = totalMinutes % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const parts = (dateStr || '').split('-').map((n) => parseInt(n, 10));
  const base =
    parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  base.setDate(base.getDate() + daysToAdd);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(dateStr: string): string {
  if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 7);
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = (monthKey || '').split('-');
  if (!y || !m) return monthKey;
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

export function getMonthBounds(monthKey: string): { start: string; end: string } {
  const [y, m] = (monthKey || '').split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    const last = new Date(yr, mo, 0).getDate();
    return {
      start: `${yr}-${String(mo).padStart(2, '0')}-01`,
      end: `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    };
  }
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatStayDuration(booking: Booking): string {
  if (booking.stayType === 'hourly') {
    const hrs = booking.hours || 3;
    return `${hrs} giờ`;
  }
  return `${booking.nights} đêm`;
}

/**
 * Calculates OTA listing price and breakdown based on the formula:
 * 
 * Target: When OTA deducts their % commission, the hotel must receive
 * exactly (Direct Price + Management Fee).
 * 
 * Formula A (Net Guaranteed):
 * Listed Price = (Direct Price + Management Fee) / (1 - Commission Rate)
 * 
 * Formula B (Simple Markup):
 * Listed Price = (Direct Price / (1 - Commission Rate)) + Management Fee
 */
export function calculateOtaPrice(
  directPrice: number,
  channel: BookingChannel,
  commissionRate: number,
  managementFee: number = 150000,
  formula: 'net_guaranteed' | 'simple_markup' = 'net_guaranteed',
  rounding: '1000' | '10000' | 'none' = '1000'
): PriceBreakdown {
  // If direct booking, 0 commission and 0 management fee surcharge
  if (channel === 'direct' || commissionRate === 0) {
    return {
      directPrice,
      managementFee: 0,
      commissionRate: 0,
      listedPrice: directPrice,
      commissionAmount: 0,
      netPayout: directPrice,
      profitDelta: 0,
      formulaDescription: 'Giá bán trực tiếp gốc (không mất hoa hồng sàn)',
    };
  }

  let rawListedPrice = 0;
  let formulaDescription = '';

  if (formula === 'net_guaranteed') {
    // Listed = (Direct + ManagementFee) / (1 - Commission)
    // Ensures Net Payout = Direct + ManagementFee after OTA deduction
    const targetNet = directPrice + managementFee;
    rawListedPrice = targetNet / (1 - commissionRate);
    formulaDescription = `(${formatVND(directPrice)} + ${formatVND(managementFee)}) ÷ (1 - ${(commissionRate * 100).toFixed(0)}%)`;
  } else {
    // Listed = (Direct / (1 - Commission)) + ManagementFee
    rawListedPrice = (directPrice / (1 - commissionRate)) + managementFee;
    formulaDescription = `(${formatVND(directPrice)} ÷ [1 - ${(commissionRate * 100).toFixed(0)}%]) + ${formatVND(managementFee)}`;
  }

  const listedPrice = roundPrice(rawListedPrice, rounding);
  const commissionAmount = Math.round(listedPrice * commissionRate);
  const netPayout = listedPrice - commissionAmount;
  const profitDelta = netPayout - directPrice;

  return {
    directPrice,
    managementFee,
    commissionRate,
    listedPrice,
    commissionAmount,
    netPayout,
    profitDelta,
    formulaDescription,
  };
}

/**
 * Quick helper to get price for a specific room type and channel
 */
export function getRoomPriceForChannel(
  directPrice: number,
  channel: BookingChannel,
  channelCommissions: Record<BookingChannel, number>,
  managementFee: number = 150000,
  formula: 'net_guaranteed' | 'simple_markup' = 'net_guaranteed',
  rounding: '1000' | '10000' | 'none' = '1000'
): number {
  if (channel === 'direct') return directPrice;
  const rate = channelCommissions[channel] ?? 0.15;
  const breakdown = calculateOtaPrice(directPrice, channel, rate, managementFee, formula, rounding);
  return breakdown.listedPrice;
}

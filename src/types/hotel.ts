export type RoomType = 'standard_single' | 'standard_twin' | 'vip' | 'deluxe' | 'family';

export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export type BookingChannel = 'direct' | 'agoda' | 'booking' | 'trip' | 'airbnb';

export type StayType = 'nightly' | 'hourly';

export interface HourlyRateConfig {
  first3Hours: number;
  extraHour: number;
}

export interface RoomTypeInfo {
  id: RoomType;
  name: string;
  badgeName: string;
  bedDescription: string;
  directPrice: number;
  hourlyFirst3HoursPrice: number;
  hourlyExtraHourPrice: number;
  totalRoomsCount: number;
  capacity: { adults: number; children: number };
  description: string;
  color: string;
}

export interface ChannelInfo {
  id: BookingChannel;
  name: string;
  shortName: string;
  defaultCommissionRate: number; // e.g. 0.15 for 15%
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  logoText: string;
  description: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  status: RoomStatus;
  bedDescription: string;
  directPrice: number;
  currentBookingId?: string;
  cleaningNote?: string;
  cleaningMonth?: string;
  lastCleanedAt?: string;
}

export interface BookingServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  category: 'minibar' | 'laundry' | 'rental' | 'surcharge' | 'other';
  addedAt: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  roomId: string;
  roomNumber: string;
  roomType: RoomType;
  guestName: string;
  guestPhone: string;
  guestIdCard?: string;
  channel: BookingChannel;
  channelBookingRef?: string;
  stayType?: StayType; // 'nightly' (default) or 'hourly'
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm for hourly stays
  checkOutTime?: string; // HH:mm for hourly stays
  nights: number;
  hours?: number; // total hours for hourly stays
  hourlyBasePrice?: number; // first 3 hours price snapshot
  hourlyExtraPrice?: number; // each additional hour price snapshot
  roomPricePerNight: number;
  totalRoomPrice: number;
  managementFee: number; // 150k fee
  otaCommissionRate: number;
  otaCommissionAmount: number;
  services: BookingServiceItem[];
  deposit: number;
  discount: number;
  status: 'active' | 'reserved' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  checkedOutAt?: string;
  cancelledAt?: string;
  paymentMethod?: 'cash' | 'transfer' | 'card' | 'ota_collect';
}

export interface ServiceItemConfig {
  id: string;
  name: string;
  price: number;
  category: 'minibar' | 'laundry' | 'rental' | 'surcharge' | 'other';
  unit?: string; // e.g. "chai", "lon", "gói", "bộ", "ngày", "lượt"
  isActive?: boolean;
}

export interface HotelSettings {
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelEmail: string;
  defaultManagementFee: number; // 150,000 VND
  channelCommissions: Record<BookingChannel, number>;
  pricingFormula: 'net_guaranteed' | 'simple_markup';
  roundingMethod: '1000' | '10000' | 'none';
  servicesList: ServiceItemConfig[];
  hourlyRates?: Record<RoomType, HourlyRateConfig>;
}

import { Booking } from '../types/hotel';
import { CHANNELS, ROOM_TYPES } from '../data/initialData';
import { getMonthKey } from './pricing';

function formatStatusLabel(status: Booking['status']): string {
  switch (status) {
    case 'active':
      return 'Đang ở';
    case 'reserved':
      return 'Đặt trước';
    case 'completed':
      return 'Đã trả phòng';
    case 'cancelled':
      return 'Đã hủy';
  }
}

function buildBookingRows(bookings: Booking[]): (string | number)[][] {
  const header = [
    'Mã đơn',
    'Phòng',
    'Hạng phòng',
    'Khách hàng',
    'SĐT',
    'CCCD/Passport',
    'Kênh bán',
    'Hình thức',
    'Ngày đến',
    'Ngày đi',
    'Thời lượng',
    'Tiền phòng (VNĐ)',
    'Phí quản lý 150k (VNĐ)',
    'Hoa hồng OTA (VNĐ)',
    'Dịch vụ/Minibar (VNĐ)',
    'Đã cọc (VNĐ)',
    'Giảm giá (VNĐ)',
    'Tổng thanh toán (VNĐ)',
    'Trạng thái',
    'Ghi chú',
  ];

  const rows = bookings.map((b) => {
    const servicesTotal = b.services.reduce((s, i) => s + i.total, 0);
    const totalAmount = b.totalRoomPrice + servicesTotal - (b.discount || 0);
    const isHourly = b.stayType === 'hourly';
    const duration = isHourly ? `${b.hours || 3} giờ` : `${b.nights} đêm`;
    return [
      b.bookingCode,
      b.roomNumber,
      ROOM_TYPES[b.roomType]?.badgeName || b.roomType,
      b.guestName,
      b.guestPhone || '',
      b.guestIdCard || '',
      CHANNELS[b.channel]?.name || b.channel,
      isHourly ? 'Khách giờ' : 'Qua đêm',
      isHourly ? `${b.checkInDate} ${b.checkInTime || ''}`.trim() : b.checkInDate,
      isHourly ? `${b.checkOutDate} ${b.checkOutTime || ''}`.trim() : b.checkOutDate,
      duration,
      b.totalRoomPrice,
      b.managementFee || 0,
      b.otaCommissionAmount || 0,
      servicesTotal,
      b.deposit || 0,
      b.discount || 0,
      totalAmount,
      formatStatusLabel(b.status),
      b.notes || '',
    ];
  });

  return [header, ...rows];
}

function buildMonthlyRevenueRows(bookings: Booking[]): (string | number)[][] {
  const relevant = bookings.filter((b) => b.status === 'active' || b.status === 'completed');
  const months = Array.from(new Set(relevant.map((b) => getMonthKey(b.checkInDate)))).sort((a, b) =>
    b.localeCompare(a)
  );

  const header = [
    'Tháng',
    'Số đơn',
    'Tổng đêm',
    'Lượt khách giờ',
    'Doanh thu phòng (VNĐ)',
    'Doanh thu dịch vụ (VNĐ)',
    'Tổng phát sinh (VNĐ)',
    'Phí quản lý 150k (VNĐ)',
    'Hoa hồng OTA (VNĐ)',
    'Thực nhận Net (VNĐ)',
  ];

  const rows = months.map((mk) => {
    const mBookings = relevant.filter((b) => getMonthKey(b.checkInDate) === mk);
    const nights = mBookings.reduce((s, b) => s + (b.stayType === 'hourly' ? 0 : b.nights), 0);
    const hourlyCount = mBookings.filter((b) => b.stayType === 'hourly').length;
    const roomRev = mBookings.reduce((s, b) => s + b.totalRoomPrice, 0);
    const srvRev = mBookings.reduce(
      (s, b) => s + b.services.reduce((acc, item) => acc + item.total, 0),
      0
    );
    const gross = mBookings.reduce(
      (s, b) =>
        s + b.totalRoomPrice + b.services.reduce((acc, item) => acc + item.total, 0) - (b.discount || 0),
      0
    );
    const mgmt = mBookings.reduce((s, b) => s + (b.managementFee || 0), 0);
    const comm = mBookings.reduce((s, b) => s + (b.otaCommissionAmount || 0), 0);
    const net = gross - comm;

    return [mk, mBookings.length, nights, hourlyCount, roomRev, srvRev, gross, mgmt, comm, net];
  });

  return [header, ...rows];
}

function downloadCsvFile(filename: string, rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBookingsToCsv(bookings: Booking[]): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`hotel25-dat-phong-${dateStr}.csv`, buildBookingRows(bookings));
}

export function exportMonthlyRevenueToCsv(bookings: Booking[]): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`hotel25-doanh-thu-thang-${dateStr}.csv`, buildMonthlyRevenueRows(bookings));
}

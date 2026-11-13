import { useState } from 'react';
import { Booking, Room, HotelSettings } from '../types/hotel';
import { ROOM_TYPES, CHANNELS } from '../data/initialData';
import { formatMonthLabel, formatVND, getMonthKey } from '../utils/pricing';
import { 
  DollarSign, 
  Percent, 
  Bed, 
  Sparkles, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';

interface AnalyticsViewProps {
  bookings: Booking[];
  rooms: Room[];
  settings: HotelSettings;
}

export default function AnalyticsView({ bookings, rooms }: AnalyticsViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'YYYY-MM'

  // Aggregate occupancy stats
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // All revenue-generating bookings (active or completed)
  const allRelevantBookings = bookings.filter((b) => b.status === 'active' || b.status === 'completed');

  // Collect available months from all bookings + current month
  const nowMonthKey = getMonthKey('');
  const monthKeysSet = new Set<string>([nowMonthKey]);
  allRelevantBookings.forEach((b) => {
    monthKeysSet.add(getMonthKey(b.checkInDate));
  });
  const availableMonths = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));

  const shiftMonth = (baseMonth: string, delta: number): string => {
    const target = baseMonth === 'all' ? nowMonthKey : baseMonth;
    const [y, m] = target.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Monthly breakdown across all available months
  const monthlyBreakdown = availableMonths.map((mk) => {
    const mBookings = allRelevantBookings.filter((b) => getMonthKey(b.checkInDate) === mk);
    const gross = mBookings.reduce((sum, b) => {
      const srv = b.services.reduce((s, i) => s + i.total, 0);
      return sum + b.totalRoomPrice + srv - (b.discount || 0);
    }, 0);
    const roomRevenue = mBookings.reduce((sum, b) => sum + b.totalRoomPrice, 0);
    const serviceRevenue = mBookings.reduce(
      (sum, b) => sum + b.services.reduce((s, i) => s + i.total, 0),
      0
    );
    const mgmtFee = mBookings.reduce((sum, b) => sum + (b.managementFee || 0), 0);
    const comm = mBookings.reduce((sum, b) => sum + (b.otaCommissionAmount || 0), 0);
    const net = gross - comm;
    const nights = mBookings.reduce((sum, b) => sum + (b.stayType === 'hourly' ? 0 : b.nights), 0);
    const hourlyCount = mBookings.filter((b) => b.stayType === 'hourly').length;

    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      bookingsCount: mBookings.length,
      nightsCount: nights,
      hourlyCount,
      roomRevenue,
      serviceRevenue,
      gross,
      mgmtFee,
      comm,
      net,
    };
  });

  const maxMonthlyNet = Math.max(1, ...monthlyBreakdown.map((m) => m.net));

  // Filter bookings by selectedMonth for KPI cards, Channel Performance, and Room Type breakdown
  const relevantBookings = allRelevantBookings.filter((b) => {
    if (selectedMonth !== 'all' && getMonthKey(b.checkInDate) !== selectedMonth) return false;
    return true;
  });

  const totalGrossRevenue = relevantBookings.reduce((sum, b) => {
    const srv = b.services.reduce((s, i) => s + i.total, 0);
    return sum + b.totalRoomPrice + srv - (b.discount || 0);
  }, 0);

  const totalManagementFees = relevantBookings.reduce((sum, b) => sum + (b.managementFee || 0), 0);
  const totalOtaCommissions = relevantBookings.reduce((sum, b) => sum + (b.otaCommissionAmount || 0), 0);
  const totalNetRevenue = totalGrossRevenue - totalOtaCommissions;

  // By Channel statistics
  const channelStats = (['direct', 'agoda', 'booking', 'trip', 'airbnb'] as const).map((ch) => {
    const chBookings = relevantBookings.filter((b) => b.channel === ch);
    const revenue = chBookings.reduce((sum, b) => sum + b.totalRoomPrice, 0);
    const mgmtFee = chBookings.reduce((sum, b) => sum + (b.managementFee || 0), 0);
    const comm = chBookings.reduce((sum, b) => sum + (b.otaCommissionAmount || 0), 0);
    const count = chBookings.length;
    const nights = chBookings.reduce((sum, b) => sum + (b.stayType === 'hourly' ? 0 : b.nights), 0);
    const hourlyCount = chBookings.filter((b) => b.stayType === 'hourly').length;

    return {
      channel: ch,
      info: CHANNELS[ch],
      bookingsCount: count,
      nightsCount: nights,
      hourlyCount,
      revenue,
      mgmtFee,
      comm,
      net: revenue - comm,
    };
  });

  // By Room Type statistics
  const roomTypeStats = Object.keys(ROOM_TYPES).map((typeKey) => {
    const t = ROOM_TYPES[typeKey];
    const tBookings = relevantBookings.filter((b) => b.roomType === typeKey);
    const revenue = tBookings.reduce((sum, b) => sum + b.totalRoomPrice, 0);
    const nights = tBookings.reduce((sum, b) => sum + (b.stayType === 'hourly' ? 0 : b.nights), 0);
    const hourlyCount = tBookings.filter((b) => b.stayType === 'hourly').length;

    return {
      typeKey,
      info: t,
      bookingsCount: tBookings.length,
      nightsCount: nights,
      hourlyCount,
      revenue,
    };
  });

  return (
    <div className="space-y-6">
      {/* Month Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Báo Cáo Doanh Thu Theo Tháng
              </h2>
              <p className="text-[11px] text-slate-500">
                {selectedMonth === 'all'
                  ? 'Đang xem tổng hợp doanh thu toàn bộ các tháng (tính theo ngày nhận phòng)'
                  : `Đang xem chi tiết doanh thu ${formatMonthLabel(selectedMonth)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              selectedMonth === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả các tháng
          </button>

          {availableMonths.map((mk) => (
            <button
              key={mk}
              type="button"
              onClick={() => setSelectedMonth(mk)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedMonth === mk
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {formatMonthLabel(mk)}
            </button>
          ))}
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>
              Doanh Thu Thực Nhận {selectedMonth !== 'all' ? `(${formatMonthLabel(selectedMonth)})` : ''}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {formatVND(totalNetRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Tổng phát sinh: {formatVND(totalGrossRevenue)} ({relevantBookings.length} đơn)
          </div>
        </div>

        {/* Management Fee Bonus */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
            <span>Phí Quản Lý Thu Được (+150k)</span>
            <span className="p-1.5 rounded-lg bg-amber-200/60 text-amber-800">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-800">
            {formatVND(totalManagementFees)}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            Dôi dư sau khi trừ chiết khấu sàn OTA
          </div>
        </div>

        {/* OTA Commissions Paid */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Hoa Hồng Sàn OTA Đã Trừ</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatVND(totalOtaCommissions)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Agoda, Booking, Trip, Airbnb giữ lại
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Công Suất Phòng Hiện Tại</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Bed className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {occupancyRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {occupiedRooms} / {totalRooms} phòng đang ở
          </div>
        </div>
      </div>

      {/* Monthly Comparison Table & Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Tổng Hợp Doanh Thu Chi Tiết Từng Tháng
              </h3>
              <p className="text-xs text-slate-500">
                Bấm vào một tháng bất kỳ để lọc nhanh chi tiết kênh bán và hạng phòng của tháng đó
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Tháng</th>
                <th className="py-3 px-3 text-center">Lượt Đặt</th>
                <th className="py-3 px-3 text-right">Tiền Phòng</th>
                <th className="py-3 px-3 text-right">Minibar & DV</th>
                <th className="py-3 px-3 text-right">Hoa Hồng OTA</th>
                <th className="py-3 px-3 text-right">Phí QL (+150k)</th>
                <th className="py-3 px-4 text-right">Thực Thu Tháng</th>
                <th className="py-3 px-4 w-44">Biểu Đồ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {monthlyBreakdown.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                const barWidth = Math.round((m.net / maxMonthlyNet) * 100);
                return (
                  <tr
                    key={m.monthKey}
                    onClick={() => setSelectedMonth(isSelected ? 'all' : m.monthKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-extrabold ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-50 text-indigo-800'
                        }`}
                      >
                        {m.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-bold text-slate-800">{m.bookingsCount} đơn</span>
                      <span className="text-[11px] text-slate-400 block">
                        {m.nightsCount} đêm{m.hourlyCount > 0 ? ` · ${m.hourlyCount} giờ` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-800">
                      {formatVND(m.roomRevenue)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-600">
                      {m.serviceRevenue > 0 ? `+${formatVND(m.serviceRevenue)}` : '0 ₫'}
                    </td>
                    <td className="py-3.5 px-3 text-right text-rose-600 font-medium">
                      {m.comm > 0 ? `-${formatVND(m.comm)}` : '0 ₫'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-amber-600">
                      {m.mgmtFee > 0 ? `+${formatVND(m.mgmtFee)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                      {formatVND(m.net)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isSelected ? 'bg-emerald-600' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Channel Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Báo Cáo Hiệu Quả Theo Kênh Bán {selectedMonth !== 'all' ? `— ${formatMonthLabel(selectedMonth)}` : ''}
            </h3>
            <p className="text-xs text-slate-500">
              Đánh giá tỷ lệ doanh thu, chiết khấu và lợi nhuận quản lý thực tế trên từng kênh
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Kênh Bán</th>
                <th className="py-3 px-3 text-center">Đơn / Thời Lượng</th>
                <th className="py-3 px-3 text-right">Tổng Tiền Niêm Yết</th>
                <th className="py-3 px-3 text-right">Hoa Hồng Sàn Trừ</th>
                <th className="py-3 px-3 text-right">Phí Quản Lý Thu (+150k)</th>
                <th className="py-3 px-4 text-right">Thực Thu Về Khách Sạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {channelStats.map((st) => (
                <tr key={st.channel} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded font-bold ${st.info.bgColor}`}>
                      {st.info.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {st.channel === 'direct' ? '0% hoa hồng' : `Hoa hồng ~${Math.round(st.info.defaultCommissionRate * 100)}%`}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-bold text-slate-800">{st.bookingsCount} đơn</span>
                    <span className="text-[11px] text-slate-400 block">
                      {st.nightsCount} đêm{st.hourlyCount > 0 ? ` · ${st.hourlyCount} khách giờ` : ''}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                    {formatVND(st.revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-600 font-medium">
                    {st.comm > 0 ? `-${formatVND(st.comm)}` : '0 ₫'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-amber-600">
                    {st.mgmtFee > 0 ? `+${formatVND(st.mgmtFee)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                    {formatVND(st.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Room Type Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-base">
            Doanh Thu Theo Hạng Phòng {selectedMonth !== 'all' ? `— ${formatMonthLabel(selectedMonth)}` : ''}
          </h3>
          <p className="text-xs text-slate-500">
            Standard (20 phòng: 19 1G + 1 2G), Đơn VIP (501), Deluxe (505), Family (201 & 401)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-5">
          {roomTypeStats.map((r) => (
            <div key={r.typeKey} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-xs font-bold text-indigo-700 block uppercase">
                {r.info.badgeName}
              </span>
              <div className="font-extrabold text-slate-900 text-base">{r.info.name}</div>
              <div className="text-xs text-slate-500">
                🛏️ {r.info.bedDescription}
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">Giá gốc:</span>
                <span className="font-bold text-emerald-700">{formatVND(r.info.directPrice)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Đã bán:</span>
                <span className="font-bold text-slate-800">
                  {r.nightsCount} đêm{r.hourlyCount > 0 ? ` + ${r.hourlyCount} giờ` : ''} ({r.bookingsCount} lượt)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 font-bold">
                <span className="text-slate-700">Tổng doanh thu:</span>
                <span className="text-indigo-950 font-black">{formatVND(r.revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { HotelSettings, Room } from '../types/hotel';
import { UserRole } from '../utils/firebase';
import {
  Building2,
  Sliders,
  Layers,
  Sparkles,
  BarChart3,
  FileText,
  Cloud,
  LogOut,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';

export type AppView = 'rooms' | 'ota' | 'bookings' | 'analytics' | 'permissions';

interface HeaderProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  settings: HotelSettings;
  rooms: Room[];
  userRole: UserRole;
  userEmail: string;
  onSignOut: () => void;
  isCloudConnected?: boolean;
  isSyncingCloud?: boolean;
  onOpenSyncModal: () => void;
  onOpenSettings: () => void;
}

export default function Header({
  currentView,
  onChangeView,
  settings,
  rooms,
  userRole,
  userEmail,
  onSignOut,
  isCloudConnected = false,
  isSyncingCloud = false,
  onOpenSyncModal,
  onOpenSettings,
}: HeaderProps) {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setDate(
        now.toLocaleDateString('vi-VN', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const available = rooms.filter((r) => r.status === 'available').length;
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const cleaning = rooms.filter((r) => r.status === 'cleaning').length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Hotel Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-tight truncate">
                  {settings.hotelName}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  25 Phòng
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                {isAdmin
                  ? 'Quản lý phòng & Kênh OTA (+150k phí quản lý)'
                  : 'Chế độ Lễ tân / Buồng phòng (Staff)'}
              </p>
            </div>
          </div>

          {/* Quick Room Occupancy Status Pills (Hidden on small mobile) */}
          <div className="hidden xl:flex items-center gap-2 text-xs shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {available} Trống
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {occupied} Đang ở
            </span>
            {cleaning > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                {cleaning} Cần dọn
              </span>
            )}
          </div>

          {/* Right Action Buttons & Authenticated Identity */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex flex-col text-right text-[11px] text-slate-500 border-r border-slate-200 pr-2.5">
              <span className="font-bold text-slate-800">{time}</span>
              <span className="capitalize">{date}</span>
            </div>

            {/* Role + Email Badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${
                isAdmin
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-sky-50 text-sky-900 border-sky-200'
              }`}
              title={`Đang đăng nhập: ${userEmail} (${isAdmin ? 'Admin' : 'Staff'})`}
            >
              {isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              )}
              <span className="uppercase tracking-wide">{isAdmin ? 'Admin' : 'Staff'}</span>
              <span className="text-slate-500 font-medium max-w-[140px] truncate hidden lg:inline">
                • {userEmail}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenSyncModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isCloudConnected
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
              title={isAdmin ? 'Đồng bộ Firebase Cloud & Xuất Excel' : 'Trạng thái đồng bộ Firebase'}
            >
              <Cloud className={`w-4 h-4 ${isCloudConnected ? 'text-emerald-600' : 'text-indigo-600'}`} />
              <span className="hidden sm:inline">
                {isSyncingCloud
                  ? 'Đang đồng bộ...'
                  : isCloudConnected
                  ? 'Firebase'
                  : 'Cloud'}
              </span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                title="Cài đặt hệ thống & 25 phòng"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title={`Đăng xuất (${userEmail})`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 -mx-2 px-2 scrollbar-none border-t border-slate-100">
          <button
            type="button"
            onClick={() => onChangeView('rooms')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentView === 'rooms'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Sơ Đồ 25 Phòng (Tầng 1 - 5)
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onChangeView('ota')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                currentView === 'ota'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Bảng Giá OTA & Kênh Bán (+150k)
            </button>
          )}

          <button
            type="button"
            onClick={() => onChangeView('bookings')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentView === 'bookings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Quản Lý Đặt Phòng
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onChangeView('analytics')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                currentView === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Báo Cáo Doanh Thu
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => onChangeView('permissions')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                currentView === 'permissions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Quản Lý Nhân Sự
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import {
  HotelSettings,
  Room,
  RoomType,
  BookingChannel,
  ServiceItemConfig,
  HourlyRateConfig,
} from '../types/hotel';
import {
  ROOM_TYPES,
  CHANNELS,
  DEFAULT_SERVICES,
  DEFAULT_HOURLY_RATES,
} from '../data/initialData';
import { 
  X, 
  Save, 
  RotateCcw, 
  Check, 
  Coffee,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: HotelSettings;
  rooms: Room[];
  onSaveSettings: (settings: HotelSettings) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onResetDefaults: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  rooms,
  onSaveSettings,
  onUpdateRooms,
  onResetDefaults,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'services' | 'rooms' | 'ota'>('general');
  const [formData, setFormData] = useState<HotelSettings>({
    ...settings,
    servicesList:
      settings.servicesList && settings.servicesList.length > 0
        ? [...settings.servicesList]
        : [...DEFAULT_SERVICES],
    hourlyRates: {
      ...DEFAULT_HOURLY_RATES,
      ...(settings.hourlyRates || {}),
    },
  });
  const [editableRooms, setEditableRooms] = useState<Room[]>([...rooms]);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Inline confirmation & error states (no window.alert/window.confirm)
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [confirmResetServices, setConfirmResetServices] = useState(false);
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);

  // New service item form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(25000);
  const [newServiceCategory, setNewServiceCategory] = useState<
    'minibar' | 'laundry' | 'rental' | 'surcharge' | 'other'
  >('minibar');
  const [newServiceUnit, setNewServiceUnit] = useState('lon');
  const [serviceFilterCategory, setServiceFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...settings,
        servicesList:
          settings.servicesList && settings.servicesList.length > 0
            ? [...settings.servicesList]
            : [...DEFAULT_SERVICES],
        hourlyRates: {
          ...DEFAULT_HOURLY_RATES,
          ...(settings.hourlyRates || {}),
        },
      });
      setEditableRooms([...rooms]);
      setConfirmResetAll(false);
      setResetPasswordInput('');
      setResetPasswordError(null);
      setConfirmResetServices(false);
      setConfirmDeleteServiceId(null);
      setServiceFormError(null);
      setShowSavedToast(false);
    }
  }, [isOpen, settings, rooms]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    onUpdateRooms(editableRooms);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 600);
  };

  const handleRoomTypeChange = (roomId: string, newType: RoomType) => {
    const typeInfo = ROOM_TYPES[newType];
    setEditableRooms(
      editableRooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              type: newType,
              bedDescription: typeInfo.bedDescription,
              directPrice: typeInfo.directPrice,
            }
          : r
      )
    );
  };

  const handleRoomPriceChange = (roomId: string, price: number) => {
    setEditableRooms(
      editableRooms.map((r) => (r.id === roomId ? { ...r, directPrice: price } : r))
    );
  };

  const handleHourlyRateChange = (
    roomType: RoomType,
    field: keyof HourlyRateConfig,
    value: number
  ) => {
    const currentRates = formData.hourlyRates || { ...DEFAULT_HOURLY_RATES };
    const updatedRates = {
      ...currentRates,
      [roomType]: {
        ...(currentRates[roomType] || DEFAULT_HOURLY_RATES[roomType]),
        [field]: value,
      },
    };
    setFormData({
      ...formData,
      hourlyRates: updatedRates,
    });
  };

  // Add new service
  const handleAddNewService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      setServiceFormError('Vui lòng nhập tên món dịch vụ!');
      return;
    }
    setServiceFormError(null);
    const newItem: ServiceItemConfig = {
      id: `srv-cfg-${Date.now()}`,
      name: newServiceName.trim(),
      price: newServicePrice,
      category: newServiceCategory,
      unit: newServiceUnit.trim() || 'phần',
      isActive: true,
    };

    setFormData({
      ...formData,
      servicesList: [newItem, ...formData.servicesList],
    });

    setNewServiceName('');
    setNewServicePrice(25000);
    setNewServiceUnit('lon');
  };

  // Delete service (after inline confirm)
  const handleConfirmDeleteService = (serviceId: string) => {
    setFormData({
      ...formData,
      servicesList: formData.servicesList.filter((s) => s.id !== serviceId),
    });
    setConfirmDeleteServiceId(null);
  };

  // Toggle active/inactive
  const handleToggleServiceActive = (serviceId: string) => {
    setFormData({
      ...formData,
      servicesList: formData.servicesList.map((s) =>
        s.id === serviceId ? { ...s, isActive: s.isActive === false ? true : false } : s
      ),
    });
  };

  // Update existing service
  const handleUpdateServiceField = (serviceId: string, field: keyof ServiceItemConfig, value: any) => {
    setFormData({
      ...formData,
      servicesList: formData.servicesList.map((s) =>
        s.id === serviceId ? { ...s, [field]: value } : s
      ),
    });
  };

  const filteredServices = formData.servicesList.filter((s) => {
    if (serviceFilterCategory !== 'all' && s.category !== serviceFilterCategory) return false;
    return true;
  });

  const hourlyRates = formData.hourlyRates || DEFAULT_HOURLY_RATES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Cài Đặt Hệ Thống & Khách Sạn</h2>
            <p className="text-xs text-slate-300">
              Quản lý thông tin, giá khách giờ, Menu dịch vụ & minibar, tỷ lệ hoa hồng OTA và cấu hình 25 phòng
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Thông Tin Khách Sạn & Giá Giờ
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'services'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
            Dịch Vụ Tiêu Dùng & Minibar ({formData.servicesList.length})
          </button>

          <button
            onClick={() => setActiveTab('ota')}
            className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'ota'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoa Hồng Kênh OTA (Agoda, Booking, Trip, Airbnb)
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'rooms'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Danh Sách 25 Phòng (Tầng & Giá Gốc)
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tên Khách Sạn
                  </label>
                  <input
                    type="text"
                    value={formData.hotelName}
                    onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Số Điện Thoại / Hotline
                  </label>
                  <input
                    type="text"
                    value={formData.hotelPhone}
                    onChange={(e) => setFormData({ ...formData, hotelPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Địa Chỉ Khách Sạn
                </label>
                <input
                  type="text"
                  value={formData.hotelAddress}
                  onChange={(e) => setFormData({ ...formData, hotelAddress: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Khách Sạn
                </label>
                <input
                  type="email"
                  value={formData.hotelEmail}
                  onChange={(e) => setFormData({ ...formData, hotelEmail: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                />
              </div>

              {/* Management fee default */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <label className="text-xs font-black text-amber-900 block uppercase">
                  Phí Quản Lý Mặc Định Cộng Thêm Cho Kênh OTA (VNĐ)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="10000"
                    value={formData.defaultManagementFee}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultManagementFee: Number(e.target.value) })
                    }
                    className="w-48 bg-white border border-amber-300 rounded-lg p-2 text-sm font-bold text-amber-900"
                  />
                  <span className="text-xs text-amber-800 font-semibold">/ phòng / đêm</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Khoản phí 150.000₫ được cộng thêm sau khi trừ chiết khấu sàn OTA theo yêu cầu của bạn.
                </p>
              </div>

              {/* Hourly Rates Configuration */}
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-black text-purple-950 uppercase">
                    Bảng Giá Khách Giờ (3 Giờ Đầu & Giờ Tiếp Theo)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(
                    [
                      { key: 'standard_single', label: 'Phòng Standard (1G & 2G)' },
                      { key: 'vip', label: 'Phòng Đơn VIP (P.501)' },
                      { key: 'deluxe', label: 'Phòng Deluxe (P.505)' },
                      { key: 'family', label: 'Phòng Family (P.201, 401)' },
                    ] as { key: RoomType; label: string }[]
                  ).map((item) => {
                    const rate = hourlyRates[item.key] || DEFAULT_HOURLY_RATES[item.key];
                    return (
                      <div key={item.key} className="bg-white p-3 rounded-lg border border-purple-200 space-y-2">
                        <div className="font-bold text-slate-900">{item.label}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">3 giờ đầu (VNĐ)</span>
                            <input
                              type="number"
                              step="10000"
                              value={rate.first3Hours}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleHourlyRateChange(item.key, 'first3Hours', val);
                                if (item.key === 'standard_single') {
                                  // Keep standard_twin synced unless changed separately
                                  setFormData((prev) => {
                                    const cur = prev.hourlyRates || { ...DEFAULT_HOURLY_RATES };
                                    return {
                                      ...prev,
                                      hourlyRates: {
                                        ...cur,
                                        standard_single: { ...cur.standard_single, first3Hours: val },
                                        standard_twin: { ...cur.standard_twin, first3Hours: val },
                                      },
                                    };
                                  });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-bold text-purple-700"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Mỗi giờ tiếp theo</span>
                            <input
                              type="number"
                              step="10000"
                              value={rate.extraHour}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleHourlyRateChange(item.key, 'extraHour', val);
                                if (item.key === 'standard_single') {
                                  setFormData((prev) => {
                                    const cur = prev.hourlyRates || { ...DEFAULT_HOURLY_RATES };
                                    return {
                                      ...prev,
                                      hourlyRates: {
                                        ...cur,
                                        standard_single: { ...cur.standard_single, extraHour: val },
                                        standard_twin: { ...cur.standard_twin, extraHour: val },
                                      },
                                    };
                                  });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-bold text-purple-700"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reset all bookings to clean empty state with password confirmation (87878787) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                {!confirmResetAll ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResetAll(true);
                      setResetPasswordInput('');
                      setResetPasswordError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3.5 py-2.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Xóa Toàn Bộ Dữ Liệu Đặt Phòng & Đưa 25 Phòng Về Mới Tinh
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                    <div className="flex items-start gap-2 text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong className="block text-sm">
                          Xác nhận xóa sạch toàn bộ dữ liệu đặt phòng và đưa 25 phòng về mới tinh?
                        </strong>
                        <span className="text-rose-700">
                          Thao tác này sẽ xóa toàn bộ đơn đặt phòng, hóa đơn, doanh thu trên cả máy này lẫn Firebase Cloud và đưa toàn bộ 25 phòng về trạng thái trống hoàn toàn.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-rose-900 block">
                        Nhập mật khẩu xác nhận để xóa dữ liệu:
                      </label>
                      <input
                        type="password"
                        value={resetPasswordInput}
                        onChange={(e) => {
                          setResetPasswordInput(e.target.value);
                          if (resetPasswordError) setResetPasswordError(null);
                        }}
                        placeholder="Nhập mật khẩu..."
                        className="w-full sm:w-64 bg-white border border-rose-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      {resetPasswordError && (
                        <p className="text-xs font-bold text-rose-600">{resetPasswordError}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (resetPasswordInput.trim() !== '87878787') {
                            setResetPasswordError(
                              'Mật khẩu không đúng! Vui lòng nhập đúng mật khẩu để xác nhận xóa.'
                            );
                            return;
                          }
                          onResetDefaults();
                          setConfirmResetAll(false);
                          setResetPasswordInput('');
                          setResetPasswordError(null);
                          onClose();
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                      >
                        Xác Nhận Xóa Sạch Ngay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmResetAll(false);
                          setResetPasswordInput('');
                          setResetPasswordError(null);
                        }}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SERVICES & MINIBAR CONFIGURATION */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              {/* Add New Service Item Box */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/60 p-4 sm:p-5 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      +
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Thêm Mới Món Dịch Vụ / Đồ Minibar
                    </h3>
                  </div>

                  {!confirmResetServices ? (
                    <button
                      type="button"
                      onClick={() => setConfirmResetServices(true)}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 underline font-medium"
                    >
                      Khôi phục danh mục mẫu
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-indigo-200 text-[11px]">
                      <span className="font-semibold text-slate-700">Khôi phục mẫu?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            servicesList: [...DEFAULT_SERVICES],
                          });
                          setConfirmResetServices(false);
                        }}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded font-bold"
                      >
                        Đồng ý
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetServices(false)}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>

                {serviceFormError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {serviceFormError}
                  </div>
                )}

                <form onSubmit={handleAddNewService} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                  <div className="sm:col-span-5">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Tên món / dịch vụ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nước yến lon, Snack khoai tây, Thuê xe ga..."
                      value={newServiceName}
                      onChange={(e) => {
                        setNewServiceName(e.target.value);
                        if (serviceFormError) setServiceFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Đơn giá (VNĐ) *
                    </label>
                    <input
                      type="number"
                      step="5000"
                      min="0"
                      required
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Đơn vị
                    </label>
                    <input
                      type="text"
                      placeholder="chai, lon, kg..."
                      value={newServiceUnit}
                      onChange={(e) => setNewServiceUnit(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nhóm
                    </label>
                    <select
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                    >
                      <option value="minibar">Minibar</option>
                      <option value="laundry">Giặt ủi</option>
                      <option value="rental">Thuê xe</option>
                      <option value="surcharge">Phụ thu</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-12 flex justify-end mt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lưu Thêm Vào Menu
                    </button>
                  </div>
                </form>
              </div>

              {/* Filter by category */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Bộ lọc:</span>
                  <button
                    type="button"
                    onClick={() => setServiceFilterCategory('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      serviceFilterCategory === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({formData.servicesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterCategory('minibar')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      serviceFilterCategory === 'minibar'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Minibar ({formData.servicesList.filter((s) => s.category === 'minibar').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterCategory('laundry')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      serviceFilterCategory === 'laundry'
                        ? 'bg-sky-600 text-white'
                        : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                    }`}
                  >
                    Giặt ủi ({formData.servicesList.filter((s) => s.category === 'laundry').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterCategory('rental')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      serviceFilterCategory === 'rental'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    Thuê xe ({formData.servicesList.filter((s) => s.category === 'rental').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterCategory('surcharge')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      serviceFilterCategory === 'surcharge'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Phụ thu ({formData.servicesList.filter((s) => s.category === 'surcharge').length})
                  </button>
                </div>

                <div className="text-[11px] text-slate-400">
                  Click trực tiếp vào ô để sửa Tên, Đơn Giá và Đơn Vị tính
                </div>
              </div>

              {/* Services Table with Inline Editing */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">STT</th>
                      <th className="py-2.5 px-3">Tên Dịch Vụ / Món</th>
                      <th className="py-2.5 px-3 w-36">Đơn Giá (VNĐ)</th>
                      <th className="py-2.5 px-2 w-24">Đơn Vị</th>
                      <th className="py-2.5 px-3 w-32">Nhóm</th>
                      <th className="py-2.5 px-2 w-24 text-center">Hiển Thị</th>
                      <th className="py-2.5 px-3 w-24 text-right">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Chưa có dịch vụ nào trong nhóm này.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((item, idx) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50 transition-colors ${
                            item.isActive === false ? 'opacity-50 bg-slate-50/50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Name Input */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateServiceField(item.id, 'name', e.target.value)}
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-2 py-1 font-semibold text-slate-900 focus:outline-none"
                            />
                          </td>

                          {/* Price Input */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="5000"
                                value={item.price}
                                onChange={(e) => handleUpdateServiceField(item.id, 'price', Number(e.target.value))}
                                className="w-24 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-2 py-1 font-extrabold text-indigo-700 text-right focus:outline-none"
                              />
                              <span className="text-[11px] text-slate-400">₫</span>
                            </div>
                          </td>

                          {/* Unit Input */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.unit || ''}
                              onChange={(e) => handleUpdateServiceField(item.id, 'unit', e.target.value)}
                              placeholder="cái, lon..."
                              className="w-16 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1.5 py-1 text-slate-600 focus:outline-none"
                            />
                          </td>

                          {/* Category select */}
                          <td className="py-2 px-3">
                            <select
                              value={item.category}
                              onChange={(e) => handleUpdateServiceField(item.id, 'category', e.target.value as any)}
                              className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              <option value="minibar">Minibar</option>
                              <option value="laundry">Giặt ủi</option>
                              <option value="rental">Thuê xe</option>
                              <option value="surcharge">Phụ thu</option>
                              <option value="other">Khác</option>
                            </select>
                          </td>

                          {/* Active / Inactive Toggle */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleServiceActive(item.id)}
                              className={`p-1.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                item.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                              title={item.isActive !== false ? 'Đang bật mở bán tại quầy' : 'Đang tạm ẩn'}
                            >
                              {item.isActive !== false ? (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Bật</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Ẩn</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Delete Action */}
                          <td className="py-2 px-3 text-right">
                            {confirmDeleteServiceId === item.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteService(item.id)}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteServiceId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteServiceId(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Xóa khỏi danh mục"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <span>
                  💡 <strong>Gợi ý:</strong> Khi bạn thêm hoặc sửa dịch vụ tại đây, các nút bấm chọn nhanh trong phiếu <strong>Nhận phòng (Check-in)</strong>, <strong>Chi tiết phòng</strong> và <strong>Trả phòng (Hóa đơn)</strong> sẽ tự động cập nhật ngay lập tức!
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: OTA COMMISSIONS */}
          {activeTab === 'ota' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Điều chỉnh tỷ lệ % hoa hồng mà từng sàn OTA khấu trừ trên tổng giá niêm yết (theo hợp đồng ký kết của khách sạn):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['agoda', 'booking', 'trip', 'airbnb'] as BookingChannel[]).map((ch) => {
                  const chInfo = CHANNELS[ch];
                  const currentRate = (formData.channelCommissions[ch] ?? 0.15) * 100;

                  return (
                    <div key={ch} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${chInfo.bgColor}`}>
                          {chInfo.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={Math.round(currentRate)}
                            onChange={(e) => {
                              const newRate = Number(e.target.value) / 100;
                              setFormData({
                                ...formData,
                                channelCommissions: {
                                  ...formData.channelCommissions,
                                  [ch]: newRate,
                                },
                              });
                            }}
                            className="w-16 bg-white border border-slate-300 rounded p-1 text-sm font-bold text-center"
                          />
                          <span className="text-xs font-bold text-slate-700">%</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">{chInfo.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ROOMS */}
          {activeTab === 'rooms' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Cấu hình chi tiết 25 phòng: Standard (800k / 3h đầu 300k), VIP 501 (1.000k / 3h đầu 400k), Deluxe 505 (1.100k / 3h đầu 420k), Family 201 & 401 (1.200k / 3h đầu 450k).
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Phòng</th>
                      <th className="py-2.5 px-2">Tầng</th>
                      <th className="py-2.5 px-3">Hạng Phòng</th>
                      <th className="py-2.5 px-3">Loại Giường</th>
                      <th className="py-2.5 px-3">Giá Trực Tiếp (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {editableRooms.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-extrabold text-slate-900">{r.number}</td>
                        <td className="py-2 px-2 text-slate-500">T{r.floor}</td>
                        <td className="py-2 px-3">
                          <select
                            value={r.type}
                            onChange={(e) => handleRoomTypeChange(r.id, e.target.value as RoomType)}
                            className="bg-white border border-slate-300 rounded p-1 text-xs font-semibold"
                          >
                            <option value="standard_single">Standard 1 Giường (800k)</option>
                            <option value="standard_twin">Standard 2 Giường (800k)</option>
                            <option value="vip">Đơn VIP 501 (1.000k)</option>
                            <option value="deluxe">Deluxe 505 (1.100k)</option>
                            <option value="family">Family 201, 401 (1.200k)</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{r.bedDescription}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="50000"
                            value={r.directPrice}
                            onChange={(e) => handleRoomPriceChange(r.id, Number(e.target.value))}
                            className="w-28 bg-white border border-slate-300 rounded p-1 text-xs font-bold text-indigo-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {showSavedToast && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <Check className="w-4 h-4" /> Đã lưu cài đặt thành công!
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Lưu Thay Đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

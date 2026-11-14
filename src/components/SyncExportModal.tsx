import { useState, useEffect } from 'react';
import { Booking } from '../types/hotel';
import { exportBookingsToCsv, exportMonthlyRevenueToCsv } from '../utils/exportCsv';
import {
  X,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';

interface SyncExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCloudConnected: boolean;
  isSyncingCloud: boolean;
  cloudError: string | null;
  bookings: Booking[];
  onPushLocalToCloud: () => Promise<void>;
  onRetryConnection: () => void;
}

export default function SyncExportModal({
  isOpen,
  onClose,
  isCloudConnected,
  isSyncingCloud,
  cloudError,
  bookings,
  onPushLocalToCloud,
  onRetryConnection,
}: SyncExportModalProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [confirmOverwriteCloud, setConfirmOverwriteCloud] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setConfirmOverwriteCloud(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold">Đồng Bộ Firebase Cloud & Xuất Excel</h3>
              <p className="text-xs text-slate-300">
                Tự động đồng bộ chung 25 phòng cho mọi thiết bị mà không cần đăng nhập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Status feedback banner */}
          {(feedback || cloudError) && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                feedback?.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback?.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="break-words">{feedback?.message || cloudError}</span>
            </div>
          )}

          {/* Section 1: Always-on Shared Firebase Cloud Sync */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">
                  1. Đồng Bộ Đám Mây Firebase (Dùng Chung)
                </h4>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isCloudConnected
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                {isSyncingCloud
                  ? 'Đang đồng bộ...'
                  : isCloudConnected
                  ? 'Đã kết nối Real-time'
                  : 'Chưa kết nối'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Hệ thống luôn tự động kết nối cơ sở dữ liệu dùng chung trên Firebase Firestore. Mọi nhân viên hoặc thiết bị mở ứng dụng đều xem và cập nhật chung 25 phòng và danh sách đặt phòng ngay lập tức mà không cần đăng nhập.
            </p>

            {!confirmOverwriteCloud ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOverwriteCloud(true)}
                  disabled={isBusy || isSyncingCloud}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đẩy Dữ Liệu Hiện Tại Lên Cloud
                </button>
                {cloudError && (
                  <button
                    type="button"
                    onClick={onRetryConnection}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Kết nối lại
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2 text-xs">
                <p className="font-bold text-amber-950">
                  Xác nhận đồng bộ toàn bộ 25 phòng & {bookings.length} đơn hiện tại trên màn hình lên Firebase Cloud?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsBusy(true);
                      try {
                        await onPushLocalToCloud();
                        setConfirmOverwriteCloud(false);
                        setFeedback({
                          type: 'success',
                          message: 'Đã đồng bộ toàn bộ dữ liệu hiện tại lên Firebase Cloud!',
                        });
                      } catch (err) {
                        setFeedback({
                          type: 'error',
                          message: err instanceof Error ? err.message : 'Lỗi đồng bộ lên Cloud.',
                        });
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Xác Nhận Đẩy Lên Cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOverwriteCloud(false)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Offline Excel CSV Export */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-slate-700" />
              <h4 className="text-sm font-black text-slate-900">
                2. Trích Xuất File Excel (.csv)
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Tải nhanh file bảng tính chuẩn UTF-8 tiếng Việt để mở trực tiếp bằng Microsoft Excel.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportBookingsToCsv(bookings)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                Xuất DS Đặt Phòng ({bookings.length} đơn)
              </button>
              <button
                type="button"
                onClick={() => exportMonthlyRevenueToCsv(bookings)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Xuất Doanh Thu Theo Tháng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

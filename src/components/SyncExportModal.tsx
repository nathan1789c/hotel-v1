import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Booking } from '../types/hotel';
import { exportBookingsToCsv, exportMonthlyRevenueToCsv } from '../utils/exportCsv';
import {
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  LogOut,
} from 'lucide-react';

interface SyncExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isSyncingCloud: boolean;
  cloudError: string | null;
  bookings: Booking[];
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  onPushLocalToCloud: () => Promise<void>;
}

export default function SyncExportModal({
  isOpen,
  onClose,
  user,
  isSyncingCloud,
  cloudError,
  bookings,
  onSignInGoogle,
  onSignOutGoogle,
  onPushLocalToCloud,
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

  const handleGoogleSignInClick = async () => {
    setFeedback(null);
    setIsBusy(true);
    try {
      await onSignInGoogle();
      setFeedback({
        type: 'success',
        message: 'Đã kết nối Firebase Cloud và kích hoạt đồng bộ thời gian thực thành công!',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Đăng nhập Google thất bại.',
      });
    } finally {
      setIsBusy(false);
    }
  };

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
                Đồng bộ dữ liệu nhiều thiết bị theo thời gian thực và tải file báo cáo
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

          {/* Section 1: Firebase Cloud Sync */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">
                  1. Đồng Bộ Đám Mây Firebase (Firestore)
                </h4>
              </div>
              {user ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isSyncingCloud ? 'Đang đồng bộ...' : 'Đã kết nối Real-time'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                  <CloudOff className="w-3 h-3" />
                  Đang lưu cục bộ (Offline)
                </span>
              )}
            </div>

            {!user ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đăng nhập bằng tài khoản Google để lưu toàn bộ 25 phòng, đơn đặt phòng và cài đặt lên Firebase Firestore. Các máy tính hoặc điện thoại khác đăng nhập cùng tài khoản sẽ tự động đồng bộ tức thì.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignInClick}
                  disabled={isBusy}
                  className="gsi-material-button inline-flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  <span className="w-4 h-4 shrink-0 inline-block">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </span>
                  <span>{isBusy ? 'Đang kết nối...' : 'Sign in with Google để đồng bộ Firebase'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{user.displayName || 'Tài khoản Google'}</div>
                    <div className="text-slate-500">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await onSignOutGoogle();
                      setFeedback({ type: 'success', message: 'Đã đăng xuất Firebase.' });
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Đăng Xuất
                  </button>
                </div>

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
                    <span className="text-[11px] text-slate-500">
                      Mọi thay đổi phòng/đơn mới đều tự động đồng bộ lên Firebase.
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2 text-xs">
                    <p className="font-bold text-amber-950">
                      Xác nhận ghi đè toàn bộ 25 phòng & {bookings.length} đơn hiện tại trên màn hình lên Firebase Cloud?
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
              Tải nhanh file bảng tính chuẩn UTF-8 tiếng Việt để mở trực tiếp bằng Microsoft Excel hoặc Google Sheets.
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

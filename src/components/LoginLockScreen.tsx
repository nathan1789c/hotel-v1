import { useState } from 'react';
import { Building2, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { googleSignIn } from '../utils/firebase';

interface LoginLockScreenProps {
  externalError?: string | null;
}

export default function LoginLockScreen({ externalError }: LoginLockScreenProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);
    try {
      await googleSignIn();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMessage('Bạn đã đóng cửa sổ đăng nhập Google. Vui lòng thử lại.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('Trình duyệt đang chặn cửa sổ bật lên (Popup). Vui lòng cho phép popup để đăng nhập Google.');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const displayError = errorMessage || externalError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 px-6 py-7 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Building2 className="w-7 h-7 text-indigo-300" />
          </div>
          <h1 className="text-xl font-black tracking-tight">Thái Hà Huy Hotel</h1>
          <p className="text-xs text-indigo-200 mt-1">
            Hệ Thống Quản Lý Khách Sạn 25 Phòng & Kênh OTA
          </p>
        </div>

        {/* Lock Gate Body */}
        <div className="p-6 sm:p-7 space-y-5">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Yêu Cầu Xác Thực Tài Khoản Google</p>
              <p className="text-slate-600 leading-relaxed">
                Toàn bộ sơ đồ phòng, thông tin khách hàng và báo cáo được khóa bảo mật. Vui lòng đăng nhập bằng tài khoản Google được cấp quyền để tiếp tục.
              </p>
            </div>
          </div>

          {displayError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="break-words">{displayError}</span>
            </div>
          )}

          {/* Official Google Identity Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="gsi-material-button w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold text-sm border border-slate-300 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
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
            <span>
              {isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}
            </span>
          </button>

          <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Tài khoản <strong>Admin</strong> được toàn quyền quản trị & báo cáo doanh thu. Các tài khoản Gmail khác tự động nhận quyền <strong>Staff</strong> (lễ tân & buồng phòng).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

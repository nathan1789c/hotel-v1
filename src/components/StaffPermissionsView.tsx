import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { isSuperAdminEmail, normalizeEmail, UserRole } from '../utils/firebase';
import {
  grantOrUpdateUserPermission,
  isValidPermissionEmail,
  PermissionRecord,
  revokeUserPermission,
  subscribeAllPermissions,
} from '../utils/firestoreSync';

interface StaffPermissionsViewProps {
  currentUserEmail: string;
}

export default function StaffPermissionsView({ currentUserEmail }: StaffPermissionsViewProps) {
  const [records, setRecords] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [emailInput, setEmailInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('staff');
  const [submitting, setSubmitting] = useState(false);

  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAllPermissions({
      onChange: (list) => {
        setRecords(list);
        setLoading(false);
        setError(null);
      },
      onError: (msg) => {
        setError(msg);
        setLoading(false);
      },
    });
    return () => unsub();
  }, []);

  const handleGrantSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const normalized = normalizeEmail(emailInput);
    if (!isValidPermissionEmail(normalized)) {
      setFeedback({
        type: 'error',
        message: 'Vui lòng nhập địa chỉ Gmail/email hợp lệ (ví dụ: nhanvien@gmail.com).',
      });
      return;
    }

    if (isSuperAdminEmail(normalized)) {
      setFeedback({
        type: 'error',
        message: 'Tài khoản này là Admin tối cao mặc định và luôn có toàn quyền.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await grantOrUpdateUserPermission({
        email: normalized,
        role: roleInput,
        displayName: displayNameInput,
        actorEmail: currentUserEmail,
      });
      setEmailInput('');
      setDisplayNameInput('');
      setRoleInput('staff');
      setFeedback({
        type: 'success',
        message: `Đã cấp quyền ${roleInput === 'admin' ? 'Admin' : 'Staff'} cho tài khoản ${normalized}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể cấp quyền cho tài khoản này.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRole = async (record: PermissionRecord) => {
    if (record.isDefaultSuperAdmin) return;
    setFeedback(null);
    setBusyEmail(record.email);
    const nextRole: UserRole = record.role === 'admin' ? 'staff' : 'admin';
    try {
      await grantOrUpdateUserPermission({
        email: record.email,
        role: nextRole,
        displayName: record.displayName,
        actorEmail: currentUserEmail,
      });
      setFeedback({
        type: 'success',
        message: `Đã chuyển ${record.email} sang quyền ${nextRole === 'admin' ? 'Admin' : 'Staff'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể cập nhật quyền.',
      });
    } finally {
      setBusyEmail(null);
    }
  };

  const handleConfirmDelete = async (email: string) => {
    setFeedback(null);
    setBusyEmail(email);
    try {
      await revokeUserPermission(email);
      setConfirmDeleteEmail(null);
      setFeedback({
        type: 'success',
        message: `Đã thu hồi quyền truy cập của tài khoản ${email}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể xóa quyền nhân viên.',
      });
    } finally {
      setBusyEmail(null);
    }
  };

  const adminCount = records.filter((r) => r.role === 'admin').length;
  const staffCount = records.filter((r) => r.role === 'staff').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Quản Lý Nhân Sự & Phân Quyền Truy Cập
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Chỉ những tài khoản Google có mặt trong danh sách bên dưới mới được phép truy cập hệ thống quản lý 25 phòng.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 text-xs">
          <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold">
            Admin: {adminCount}
          </div>
          <div className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 font-bold">
            Staff: {staffCount}
          </div>
        </div>
      </div>

      {/* Grant Access Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            Cấp Quyền Tài Khoản Google Mới
          </h3>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="break-words">{feedback.message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl border bg-rose-50 border-rose-200 text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <form onSubmit={handleGrantSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Địa chỉ Gmail nhân viên <span className="text-rose-600">*</span>
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="nhanvien@gmail.com"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên / Bộ phận (tùy chọn)
            </label>
            <input
              type="text"
              maxLength={100}
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="VD: Lễ tân ca sáng"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò</label>
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="staff">Staff (Nhân viên)</option>
              <option value="admin">Admin (Quản trị)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {submitting ? 'Đang lưu...' : 'Cấp quyền nhân viên'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px] text-slate-600">
          <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              <strong>Staff (Nhân viên):</strong> Chỉ xem sơ đồ 25 phòng, nhận phòng, trả phòng, gia hạn, minibar và dọn phòng. Ẩn toàn bộ Báo cáo doanh thu, Bảng giá OTA & Quản lý nhân sự.
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Admin (Quản trị):</strong> Toàn quyền xem doanh thu, cấu hình bảng giá OTA, chỉnh sửa phòng và quản lý nhân sự.
            </span>
          </div>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Danh Sách Tài Khoản Được Cấp Quyền ({records.length})
          </h3>
          {loading && <span className="text-[11px] text-slate-500">Đang tải...</span>}
        </div>

        <div className="divide-y divide-slate-200">
          {records.map((rec) => {
            const isConfirmingDelete = confirmDeleteEmail === rec.email;
            const isBusy = busyEmail === rec.email;
            const isSelf = normalizeEmail(currentUserEmail) === rec.email;

            return (
              <div
                key={rec.email}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900 break-all">
                      {rec.email}
                    </span>

                    {rec.isDefaultSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <Shield className="w-3 h-3" />
                        Admin Tối Cao (Mặc Định)
                      </span>
                    ) : rec.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
                        <UserCheck className="w-3 h-3" />
                        Staff
                      </span>
                    )}

                    {isSelf && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đang đăng nhập
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                    {rec.displayName && (
                      <span className="font-semibold text-slate-700">{rec.displayName}</span>
                    )}
                    {!rec.isDefaultSuperAdmin && (
                      <span>
                        • Cấp bởi: <span className="font-medium">{rec.addedBy}</span>
                        {rec.updatedAtMs
                          ? ` • Cập nhật: ${new Date(rec.updatedAtMs).toLocaleDateString('vi-VN')}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {rec.isDefaultSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      Không thể xóa
                    </span>
                  ) : isConfirmingDelete ? (
                    <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1">
                      <span className="text-[11px] font-bold text-rose-900">
                        Thu hồi quyền?
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleConfirmDelete(rec.email)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer disabled:opacity-60"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteEmail(null)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRole(rec)}
                        className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {rec.role === 'admin' ? 'Chuyển về Staff' : 'Nâng lên Admin'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteEmail(rec.email)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

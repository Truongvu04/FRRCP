import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import axios from "axios";
import Navbar from "../../components/Navbar";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Users,
  RotateCcw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  Lock,
  Unlock,
  Trash2,
  Activity,
  ShieldCheck,
  Ambulance,
  MapPin,
  Loader2,
  RefreshCw,
  BadgeCheck,
  Phone,
  User,
  EyeOff,
  Waves,
  Home,
  Users2,
  ClipboardList,
  BarChart3,
  Mail,
  Clock3,
} from "lucide-react";

/* =========================
   TYPES
========================= */
interface RescueStatProps {
  label: string;
  value: string;
  subText: string;
  icon: React.ReactNode;
  accent?: "blue" | "emerald" | "amber" | "rose";
}

type ToastType = "success" | "error" | "warning" | "info";

const VIETNAM_PROVINCES_34 = [
  "Thành phố Hà Nội",
  "Tỉnh Cao Bằng",
  "Tỉnh Tuyên Quang",
  "Tỉnh Điện Biên",
  "Tỉnh Lai Châu",
  "Tỉnh Sơn La",
  "Tỉnh Lào Cai",
  "Tỉnh Thái Nguyên",
  "Tỉnh Lạng Sơn",
  "Tỉnh Quảng Ninh",
  "Tỉnh Bắc Ninh",
  "Tỉnh Phú Thọ",
  "Thành phố Hải Phòng",
  "Tỉnh Hưng Yên",
  "Tỉnh Ninh Bình",
  "Tỉnh Thanh Hóa",
  "Tỉnh Nghệ An",
  "Tỉnh Hà Tĩnh",
  "Tỉnh Quảng Trị",
  "Thành phố Huế",
  "Thành phố Đà Nẵng",
  "Tỉnh Quảng Ngãi",
  "Tỉnh Gia Lai",
  "Tỉnh Khánh Hòa",
  "Tỉnh Đắk Lắk",
  "Tỉnh Lâm Đồng",
  "Tỉnh Đồng Nai",
  "Thành phố Hồ Chí Minh",
  "Tỉnh Tây Ninh",
  "Tỉnh Đồng Tháp",
  "Tỉnh Vĩnh Long",
  "Tỉnh An Giang",
  "Thành phố Cần Thơ",
  "Tỉnh Cà Mau",
];

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

interface NotificationToastProps {
  toast: ToastState;
  onClose: () => void;
}

interface TeamRowProps {
  team: any;
  onDelete: (id: number) => void;
  onToggle: (id: number, currentStatus: string, nextStatus: string) => void;
  onView: (team: any) => void;
  onResetPassword: (team: any) => void;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}

interface RescuerHistoryItem {
  notification_id: number;
  rescue_id: number | null;
  event_type: string;
  title: string;
  description: string;
  created_at: string;
  sos_type?: string | null;
  rescue_status?: string | null;
  citizen_name?: string | null;
  citizen_phone?: string | null;
  rescue_address?: string | null;
  rescue_lat?: number | null;
  rescue_lng?: number | null;
  victims?: number | null;
  received_at?: string | null;
  completed_at?: string | null;
}

interface RescuerDetailData {
  profile: {
    user_id: number;
    full_name: string;
    email: string;
    phone: string;
    address: string;
    status: string;
    account_status: string;
    lat?: number | null;
    lng?: number | null;
    created_at?: string | null;
  };
  summary: {
    accepted: number;
    canceled: number;
    completed: number;
  };
  history: RescuerHistoryItem[];
}

interface InputFieldProps {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  maxLength?: number;
  onChange: (value: string) => void;
  rightElement?: React.ReactNode;
  required?: boolean;
}

/* =========================
   TOAST CONFIG
========================= */
const toastMeta = {
  success: {
    title: "Thành công",
    icon: CheckCircle2,
    border: "border-emerald-200 dark:border-emerald-800",
    iconWrap:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    line: "bg-emerald-500",
  },
  error: {
    title: "Có lỗi xảy ra",
    icon: XCircle,
    border: "border-red-200 dark:border-red-800",
    iconWrap:
      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    line: "bg-red-500",
  },
  warning: {
    title: "Cảnh báo",
    icon: AlertTriangle,
    border: "border-amber-200 dark:border-amber-800",
    iconWrap:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    line: "bg-amber-500",
  },
  info: {
    title: "Thông báo",
    icon: Info,
    border: "border-blue-200 dark:border-blue-800",
    iconWrap:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    line: "bg-blue-500",
  },
} as const;

/* =========================
   HELPERS
========================= */
const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getActivityStatusLabel = (value?: string | null) => {
  switch (value) {
    case "busy":
      return "Đang cứu hộ";
    case "available":
      return "Sẵn sàng";
    default:
      return "Nghỉ ngơi";
  }
};

const getSosTypeLabel = (value?: string | null) => {
  switch (value) {
    case "rescue":
      return "Cứu hộ khẩn cấp";
    case "supplies":
      return "Nhu yếu phẩm";
    case "vehicle":
      return "Cứu hộ phương tiện";
    case "other":
      return "Yêu cầu khác";
    default:
      return "Chưa xác định";
  }
};

const getHistoryEventMeta = (eventType?: string) => {
  switch (eventType) {
    case "rescuer_accept_sos":
      return {
        label: "Đã nhận",
        icon: <BadgeCheck size={14} />,
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
      };
    case "rescuer_return_sos":
      return {
        label: "Đã hủy",
        icon: <RotateCcw size={14} />,
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
      };
    case "rescuer_complete_sos":
      return {
        label: "Đã hoàn thành",
        icon: <CheckCircle2 size={14} />,
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
      };
    default:
      return {
        label: "Hoạt động",
        icon: <Activity size={14} />,
        className:
          "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
      };
  }
};

/* =========================
   TOAST
========================= */
const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [showAnim, setShowAnim] = useState(false);

  useEffect(() => {
    if (toast.show) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShowAnim(true));
      return () => cancelAnimationFrame(raf);
    }

    setShowAnim(false);
    const timer = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(timer);
  }, [toast.show, toast.id]);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(onClose, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.show, toast.duration, onClose]);

  if (!mounted) return null;

  const meta = toastMeta[toast.type];
  const Icon = meta.icon;

  return createPortal(
    <>
      <style>{`
        @keyframes toastIn {
          0% { opacity: 0; transform: translateY(-20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastOut {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-15px); }
        }
        @keyframes shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>

      <div className="fixed top-5 inset-x-0 flex justify-center z-[10000] pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-[360px] rounded-2xl border shadow-2xl overflow-hidden bg-white dark:bg-slate-900",
            meta.border
          )}
          style={{
            animation: `${showAnim ? "toastIn" : "toastOut"} 0.28s ease`,
          }}
        >
          <div className="relative flex items-start gap-3 p-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                meta.iconWrap
              )}
            >
              <Icon size={18} />
            </div>

            <div className="flex-1">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {meta.title}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {toast.message}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Tự đóng sau {Math.ceil(toast.duration / 1000)}s
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div
              key={toast.id}
              className={meta.line}
              style={{
                height: "100%",
                transformOrigin: "left",
                animation: `shrink ${toast.duration}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

/* =========================
   CONFIRM MODAL
========================= */
type ConfirmModalTone = "slate" | "red" | "amber" | "emerald" | "blue";

const ConfirmModal = ({
  open,
  title,
  message,
  description = "Vui lòng xác nhận thao tác này.",
  onConfirm,
  onCancel,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  loading = false,
  tone = "amber",
}: {
  open: boolean;
  title: string;
  message: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  tone?: ConfirmModalTone;
}) => {
  if (!open) return null;

  const toneMap: Record<
    ConfirmModalTone,
    {
      box: string;
      icon: string;
    }
  > = {
    slate: {
      box: "border-slate-200 bg-slate-50",
      icon: "text-slate-500",
    },
    amber: {
      box: "border-amber-200 bg-amber-50",
      icon: "text-amber-500",
    },
    red: {
      box: "border-red-200 bg-red-50",
      icon: "text-red-500",
    },
    emerald: {
      box: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-500",
    },
    blue: {
      box: "border-blue-200 bg-blue-50",
      icon: "text-blue-500",
    },
  };

  const currentTone = toneMap[tone];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <h3 className="text-lg font-extrabold leading-tight">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-100">
            {description}
          </p>
        </div>

        <div className="px-6 py-5">
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              currentTone.box
            )}
          >
            <AlertTriangle
              size={18}
              className={cn("mt-0.5 shrink-0", currentTone.icon)}
            />

            <p className="text-sm leading-6 text-slate-700">
              {message}
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Đang xử lý..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* =========================
   CREATE MODAL
========================= */
const CreateRescuerModal = ({
  open,
  onClose,
  onCreated,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}) => {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState({
    password: false,
    confirm: false,
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const isFormDirty = useMemo(() => {
    return Object.values(form).some((value) => value.trim() !== "");
  }, [form]);

  const handleRequestClose = () => {
    if (submitting) return;

    if (!isFormDirty) {
      onClose();
      return;
    }

    setShowCloseConfirm(true);
  };

  const resetForm = () => {
    setForm({
      full_name: "",
      phone: "",
      address: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setShowPassword({
      password: false,
      confirm: false,
    });
  };

  const handleEmailChange = (value: string) => {
    setForm((prev) => ({ ...prev, email: value }));
  };

  const handleFullNameChange = (value: string) => {
    const clean = value.replace(/[^a-zA-ZÀ-ỹ\s]/g, "");
    setForm((prev) => ({ ...prev, full_name: clean }));
  };

  const handlePhoneChange = (value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    if (clean.length === 1 && clean !== "0") return;
    if (clean.length > 10) return;
    setForm((prev) => ({ ...prev, phone: clean }));
  };

  const handleSubmit = async () => {
    if (
      !form.full_name.trim() ||
      !form.phone.trim() ||
      !form.address.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.confirmPassword.trim()
    ) {
      showToast("Vui lòng điền đầy đủ thông tin", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showToast("Email không hợp lệ!", "warning");
      return;
    }

    if (form.full_name.trim().length < 2) {
      showToast("Tên đội cứu hộ không hợp lệ!", "warning");
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(form.phone)) {
      showToast("Số điện thoại phải 10 số và bắt đầu bằng 0", "warning");
      return;
    }

    if (form.password.length < 6) {
      showToast("Mật khẩu phải có ít nhất 6 ký tự!", "warning");
      return;
    }

    if (form.password !== form.confirmPassword) {
      showToast("Mật khẩu không khớp. Vui lòng nhập lại!", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");

      await axios.post(
        "http://localhost:3000/api/admin/rescuers",
        {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showToast("Tạo tài khoản cứu hộ thành công", "success");
      resetForm();
      onClose();
      onCreated();
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Email đã được sử dụng") ||
        message.includes("email đã được sử dụng") ||
        message.includes("Email đã tồn tại") ||
        message.includes("email đã tồn tại") ||
        message.includes("Số điện thoại đã được sử dụng") ||
        message.includes("số điện thoại đã được sử dụng") ||
        message.includes("Số điện thoại đã tồn tại") ||
        message.includes("số điện thoại đã tồn tại")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Tạo tài khoản thất bại", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        onClick={handleRequestClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          <div className="px-6 md:px-7 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-xl">Tạo tài khoản cứu hộ</h3>
                <p className="text-sm text-slate-200 mt-1">
                  Thêm đội cứu hộ mới vào hệ thống điều phối FRRP
                </p>
              </div>

              <button
                onClick={handleRequestClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 md:p-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField
                label="Tên đội cứu hộ"
                placeholder="Ví dụ: Đội cứu hộ Sơn Trà"
                value={form.full_name}
                maxLength={50}
                icon={<User size={16} />}
                onChange={handleFullNameChange}
                required
              />
            </div>

            <InputField
              label="Số điện thoại"
              placeholder="Nhập số điện thoại"
              value={form.phone}
              maxLength={10}
              icon={<Phone size={16} />}
              onChange={handlePhoneChange}
              required
            />

            <InputField
              label="Email"
              placeholder="Nhập email đăng nhập"
              value={form.email}
              maxLength={100}
              icon={<Mail size={16} />}
              onChange={handleEmailChange}
              required
            />

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Tỉnh / thành phố <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />

                <select
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-10 py-3 text-sm text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 appearance-none"
                >
                  <option value="">Chọn tỉnh / thành phố</option>
                  {VIETNAM_PROVINCES_34.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>

                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  ▼
                </div>
              </div>
            </div>

            <InputField
              label="Mật khẩu"
              type={showPassword.password ? "text" : "password"}
              placeholder="Nhập mật khẩu"
              value={form.password}
              maxLength={50}
              onChange={(v) => setForm((prev) => ({ ...prev, password: v }))}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      password: !prev.password,
                    }))
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword.password ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              }
            />

            <InputField
              label="Nhập lại mật khẩu"
              type={showPassword.confirm ? "text" : "password"}
              placeholder="Nhập lại mật khẩu"
              value={form.confirmPassword}
              maxLength={50}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, confirmPassword: v }))
              }
              required
              rightElement={
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      confirm: !prev.confirm,
                    }))
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword.confirm ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              }
            />
          </div>

          <div className="px-6 md:px-7 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={handleRequestClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Hủy
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-semibold transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Tạo tài khoản
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showCloseConfirm}
        tone="amber"
        title="Xác nhận đóng form"
        description="Bạn đã thay đổi thông tin. Nếu đóng bây giờ, dữ liệu chưa lưu sẽ bị mất."
        message="Bạn có chắc muốn đóng form cập nhật không?"
        confirmText="Đóng form"
        cancelText="Quay lại"
        loading={false}
        onCancel={() => setShowCloseConfirm(false)}
        onConfirm={() => {
          setShowCloseConfirm(false);
          resetForm();
          onClose();
        }}
      />
    </>,
    document.body
  );
};

/* =========================
   ResetPassword
========================= */
const ResetPasswordModal = ({
  open,
  team,
  onClose,
  onSubmit,
  submitting,
  showToast,
}: {
  open: boolean;
  team: any | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  submitting: boolean;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}) => {
  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState({
    newPassword: false,
    confirmPassword: false,
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        newPassword: "",
        confirmPassword: "",
      });
      setShowPassword({
        newPassword: false,
        confirmPassword: false,
      });
      setShowConfirmModal(false);
    }
  }, [open]);

  const handleRequestSubmit = () => {
    if (!form.newPassword.trim() || !form.confirmPassword.trim()) {
      showToast("Vui lòng nhập đầy đủ mật khẩu mới", "warning");
      return;
    }

    if (form.newPassword.trim().length < 6) {
      showToast("Mật khẩu mới phải có ít nhất 6 ký tự", "warning");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      showToast("Xác nhận mật khẩu không khớp", "warning");
      return;
    }

    setShowConfirmModal(true);
  };

  if (!open || !team) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="px-6 md:px-7 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-xl">Đặt lại mật khẩu đội cứu hộ</h3>
                <p className="text-sm text-blue-50 mt-1">
                  Đặt lại mật khẩu khi đội cứu hộ quên mật khẩu và không thể lấy mã qua email
                </p>
              </div>

              <button
                onClick={onClose}
                disabled={submitting}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition disabled:opacity-60"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 md:p-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-black mb-2">
                Đội cứu hộ
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white">
                {team.full_name || "--"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Mã đội: #{team.user_id}
              </div>
            </div>

            <InputField
              label="Mật khẩu mới"
              type={showPassword.newPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu mới"
              value={form.newPassword}
              maxLength={50}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, newPassword: value }))
              }
              required
              rightElement={
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      newPassword: !prev.newPassword,
                    }))
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword.newPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              }
            />

            <InputField
              label="Nhập lại mật khẩu mới"
              type={showPassword.confirmPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirmPassword}
              maxLength={50}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, confirmPassword: value }))
              }
              required
              rightElement={
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      confirmPassword: !prev.confirmPassword,
                    }))
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword.confirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              }
            />
          </div>

          <div className="px-6 md:px-7 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-60"
            >
              Hủy
            </button>

            <button
              onClick={handleRequestSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-sm text-white dark:text-slate-900 font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Đặt lại mật khẩu
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirmModal}
        title="Xác nhận đặt lại mật khẩu"
        message={`Bạn có chắc muốn đặt lại mật khẩu cho ${team.full_name || "đội cứu hộ"} không?`}
        confirmText="Xác nhận"
        cancelText="Quay lại"
        loading={submitting}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          onSubmit(form.newPassword.trim());
        }}
      />
    </>,
    document.body
  );
};

/* =========================
   DETAIL MODAL
========================= */
const TeamDetailModal = ({
  open,
  team,
  onClose,
  showToast,
}: {
  open: boolean;
  team: any | null;
  onClose: () => void;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RescuerDetailData | null>(null);
  const [filterEventType, setFilterEventType] = useState("all");
  const [filterSosType, setFilterSosType] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);

  const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
  const [showSosTypeDropdown, setShowSosTypeDropdown] = useState(false);

  const eventTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const sosTypeDropdownRef = useRef<HTMLDivElement | null>(null);

  const historyItemsPerPage = 5;

  useEffect(() => {
    if (!open || !team?.user_id) return;

    setDetail(null); // reset trước để tránh hiện dữ liệu cũ
    setLoading(true);

    const token = localStorage.getItem("token");

    axios
      .get(`http://localhost:3000/api/admin/rescuers/${team.user_id}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setDetail(res.data);
      })
      .catch((err: any) => {
        setDetail(null);
        showToast(
          err?.response?.data?.message || "Không thể tải chi tiết đội cứu hộ",
          "error"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, team?.user_id, showToast]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setLoading(false);
      setFilterEventType("all");
      setFilterSosType("all");
      setHistoryPage(1);
      setShowEventTypeDropdown(false);
      setShowSosTypeDropdown(false);
    }
  }, [open]);

  const profile = detail?.profile;
  const history = detail?.history || [];
  const summary = detail?.summary || {
    accepted: 0,
    canceled: 0,
    completed: 0,
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchEvent =
        filterEventType === "all" || item.event_type === filterEventType;

      const matchSosType =
        filterSosType === "all" || item.sos_type === filterSosType;

      return matchEvent && matchSosType;
    });
  }, [history, filterEventType, filterSosType]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / historyItemsPerPage)
  );

  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historyStartIndex = (safeHistoryPage - 1) * historyItemsPerPage;
  const currentHistoryItems = filteredHistory.slice(
    historyStartIndex,
    historyStartIndex + historyItemsPerPage
  );

  const historyFromRecord =
    filteredHistory.length === 0 ? 0 : historyStartIndex + 1;

  const historyToRecord = Math.min(
    historyStartIndex + historyItemsPerPage,
    filteredHistory.length
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [filterEventType, filterSosType, team?.user_id]);

  const accountActive = profile?.account_status === "active";

  const getEventTypeLabel = (value: string) => {
    switch (value) {
      case "rescuer_accept_sos":
        return "Đã nhận";
      case "rescuer_return_sos":
        return "Đã hủy";
      case "rescuer_complete_sos":
        return "Đã hoàn thành";
      default:
        return "Tất cả hoạt động";
    }
  };

  const getHistorySosTypeLabel = (value: string) => {
    switch (value) {
      case "rescue":
        return "Cứu hộ khẩn cấp";
      case "supplies":
        return "Nhu yếu phẩm";
      case "vehicle":
        return "Cứu hộ phương tiện";
      case "other":
        return "Yêu cầu khác";
      default:
        return "Tất cả loại yêu cầu";
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showEventTypeDropdown &&
        eventTypeDropdownRef.current &&
        !eventTypeDropdownRef.current.contains(target)
      ) {
        setShowEventTypeDropdown(false);
      }

      if (
        showSosTypeDropdown &&
        sosTypeDropdownRef.current &&
        !sosTypeDropdownRef.current.contains(target)
      ) {
        setShowSosTypeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEventTypeDropdown, showSosTypeDropdown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="px-6 md:px-7 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                <Users size={14} />
                Hồ sơ đội cứu hộ
              </div>

              <h3 className="mt-3 text-xl md:text-2xl font-black tracking-tight">
                {team?.full_name || "Chi tiết đội cứu hộ"}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Thông tin tài khoản và lịch sử xử lý yêu cầu SOS của đội cứu hộ.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-104px)] overflow-hidden rounded-b-[28px] bg-slate-50 dark:bg-slate-950/40">
          <div className="max-h-[calc(92vh-104px)] overflow-y-auto p-6 md:p-7 pr-3 md:pr-4 pb-12 md:pb-14">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <Loader2 size={30} className="animate-spin mb-3" />
                <p className="font-medium">Đang tải chi tiết đội cứu hộ...</p>
              </div>
            ) : !profile ? (
              <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                Không có dữ liệu chi tiết.
              </div>
            ) : (
              <div className="space-y-6">
                <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <Users size={28} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-black text-slate-900 dark:text-slate-100">
                            {profile.full_name || "Chưa có tên"}
                          </h4>

                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                              accountActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
                            )}
                          >
                            {accountActive ? <BadgeCheck size={13} /> : <Lock size={13} />}
                            {accountActive ? "Đang hoạt động" : "Đã bị khóa"}
                          </span>

                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                            <Activity size={13} />
                            {getActivityStatusLabel(profile.status)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Mã đội
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              #{profile.user_id}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Email
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                              {profile.email || "Chưa cập nhật"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Số điện thoại
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {profile.phone || "Chưa cập nhật"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Khu vực
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {profile.address || "Chưa cập nhật"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={18} className="text-slate-500 dark:text-slate-400" />
                      <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Tổng hợp hoạt động
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Đã nhận
                        </div>
                        <div className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-100">
                          {summary.accepted}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Đã hủy / trả lại
                        </div>
                        <div className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-100">
                          {summary.canceled}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Đã hoàn thành
                        </div>
                        <div className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-100">
                          {summary.completed}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Lịch sử hoạt động
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Danh sách các yêu cầu SOS mà đội đã nhận, trả lại hoặc hoàn thành
                      </p>
                    </div>

                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {filteredHistory.length} hoạt động
                    </span>
                  </div>

                  <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="relative min-w-[220px]" ref={eventTypeDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowEventTypeDropdown((prev) => !prev);
                            setShowSosTypeDropdown(false);
                          }}
                          className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                        >
                          <span className="truncate">{getEventTypeLabel(filterEventType)}</span>

                          <ChevronRight
                            size={16}
                            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showEventTypeDropdown ? "rotate-[-90deg]" : "rotate-90"
                              }`}
                          />
                        </button>

                        {showEventTypeDropdown && (
                          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                            {[
                              { value: "all", label: "Tất cả hoạt động" },
                              { value: "rescuer_accept_sos", label: "Đã nhận" },
                              { value: "rescuer_return_sos", label: "Đã hủy" },
                              { value: "rescuer_complete_sos", label: "Đã hoàn thành" },
                            ].map((option) => {
                              const active = filterEventType === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFilterEventType(option.value);
                                    setShowEventTypeDropdown(false);
                                    setHistoryPage(1);
                                  }}
                                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active
                                    ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                    }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="relative min-w-[220px]" ref={sosTypeDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSosTypeDropdown((prev) => !prev);
                            setShowEventTypeDropdown(false);
                          }}
                          className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                        >
                          <span className="truncate">{getHistorySosTypeLabel(filterSosType)}</span>

                          <ChevronRight
                            size={16}
                            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showSosTypeDropdown ? "rotate-[-90deg]" : "rotate-90"
                              }`}
                          />
                        </button>

                        {showSosTypeDropdown && (
                          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                            {[
                              { value: "all", label: "Tất cả loại yêu cầu" },
                              { value: "rescue", label: "Cứu hộ khẩn cấp" },
                              { value: "supplies", label: "Nhu yếu phẩm" },
                              { value: "vehicle", label: "Cứu hộ phương tiện" },
                              { value: "other", label: "Yêu cầu khác" },
                            ].map((option) => {
                              const active = filterSosType === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFilterSosType(option.value);
                                    setShowSosTypeDropdown(false);
                                    setHistoryPage(1);
                                  }}
                                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active
                                    ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                    }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterEventType("all");
                            setFilterSosType("all");
                            setHistoryPage(1);
                            setShowEventTypeDropdown(false);
                            setShowSosTypeDropdown(false);
                          }}
                          className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center gap-2"
                        >
                          <RotateCcw size={16} />
                          Đặt lại
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {filteredHistory.length === 0 ? (
                      <div className="py-14 text-center">
                        <div className="mx-auto w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                          <ClipboardList size={26} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <h5 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          Không có dữ liệu phù hợp
                        </h5>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Hãy thử thay đổi bộ lọc hoạt động hoặc loại yêu cầu.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="space-y-4">
                          {currentHistoryItems.map((item) => {
                            const eventMeta = getHistoryEventMeta(item.event_type);

                            return (
                              <div
                                key={item.notification_id}
                                className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 md:p-5"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                                          eventMeta.className
                                        )}
                                      >
                                        {eventMeta.icon}
                                        {eventMeta.label}
                                      </span>

                                      {item.rescue_id && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                                          #SOS-{item.rescue_id}
                                        </span>
                                      )}

                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">
                                        {getSosTypeLabel(item.sos_type)}
                                      </span>
                                    </div>

                                    <h5 className="mt-3 text-base md:text-lg font-bold text-slate-900 dark:text-slate-100">
                                      {item.title || "Hoạt động đội cứu hộ"}
                                    </h5>

                                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                      {item.description || "Không có mô tả"}
                                    </p>
                                  </div>

                                  <div className="shrink-0 text-sm text-slate-500 dark:text-slate-400 inline-flex items-center gap-2">
                                    <Clock3 size={15} />
                                    {formatDateTime(item.created_at)}
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Người gửi SOS
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {item.citizen_name || "Người dân"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Số điện thoại
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {item.citizen_phone || "Chưa cập nhật"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Thời gian nhận
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {formatDateTime(item.received_at)}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Thời gian hoàn thành
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {formatDateTime(item.completed_at)}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Địa chỉ SOS
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                                    {item.rescue_address || "Chưa cập nhật"}
                                  </div>

                                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Tọa độ:{" "}
                                    {item.rescue_lat != null && item.rescue_lng != null
                                      ? `${item.rescue_lat}, ${item.rescue_lng}`
                                      : "Chưa cập nhật"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 mb-1 flex flex-col md:flex-row items-center justify-between gap-4 rounded-[22px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-4">
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Hiển thị <span className="font-semibold">{historyFromRecord}</span> -{" "}
                            <span className="font-semibold">{historyToRecord}</span> trong tổng số{" "}
                            <span className="font-semibold">{filteredHistory.length}</span> hoạt động
                          </p>

                          <div className="flex items-center gap-2 flex-wrap justify-center">
                            <PaginationButton
                              icon={<ChevronLeft size={16} />}
                              disabled={safeHistoryPage === 1}
                              onClick={() =>
                                setHistoryPage((prev) => Math.max(prev - 1, 1))
                              }
                            />

                            {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
                              .slice(
                                Math.max(0, safeHistoryPage - 3),
                                Math.max(0, safeHistoryPage - 3) + 5
                              )
                              .map((page) => (
                                <PaginationButton
                                  key={page}
                                  label={String(page)}
                                  active={safeHistoryPage === page}
                                  onClick={() => setHistoryPage(page)}
                                />
                              ))}

                            <PaginationButton
                              icon={<ChevronRight size={16} />}
                              disabled={safeHistoryPage === totalHistoryPages}
                              onClick={() =>
                                setHistoryPage((prev) =>
                                  Math.min(prev + 1, totalHistoryPages)
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* =========================
   INPUT
========================= */
const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  icon,
  maxLength,
  rightElement,
  required = false,
}) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>

    <div className="relative">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
          {icon}
        </div>
      )}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40",
          icon ? "pl-10" : "px-4",
          rightElement ? "pr-11" : "pr-4"
        )}
      />

      {rightElement && (
        <div className="absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          {rightElement}
        </div>
      )}
    </div>
  </div>
);

/* =========================
   STAT CARD
========================= */
const accentMap = {
  blue: {
    ring: "from-blue-500/10 to-cyan-500/10",
    iconWrap:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    badge: "text-blue-600 dark:text-blue-300",
  },
  emerald: {
    ring: "from-emerald-500/10 to-green-500/10",
    iconWrap:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    badge: "text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    ring: "from-amber-500/10 to-orange-500/10",
    iconWrap:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    badge: "text-amber-600 dark:text-amber-300",
  },
  rose: {
    ring: "from-rose-500/10 to-pink-500/10",
    iconWrap:
      "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
    badge: "text-rose-600 dark:text-rose-300",
  },
};

const RescueStatCard: React.FC<RescueStatProps> = ({
  label,
  value,
  subText,
  icon,
  accent = "blue",
}) => {
  const theme = accentMap[accent];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-lg transition-all duration-300">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br pointer-events-none",
          theme.ring
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {value}
            </span>
          </div>
          <p className={cn("mt-2 text-xs font-bold uppercase", theme.badge)}>
            {subText}
          </p>
        </div>

        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
            theme.iconWrap
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

/* =========================
   ACTION MENU
========================= */
const ActionMenu = ({
  open,
  position,
  onClose,
  onView,
  onResetPassword,
  onLock,
  onTemporaryLock,
  onUnlock,
  onDelete,
  accountStatus,
}: {
  open: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onView: () => void;
  onResetPassword: () => void;
  onLock: () => void;
  onTemporaryLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
  accountStatus: string;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
      }}
      className="w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden"
    >
      <button
        type="button"
        onClick={onView}
        className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        <Eye size={16} />
        Xem chi tiết
      </button>

      <button
        type="button"
        onClick={onResetPassword}
        className="w-full px-4 py-3 flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
      >
        <ShieldCheck size={16} />
        Reset mật khẩu
      </button>

      {accountStatus === "active" && (
        <>
          <button
            type="button"
            onClick={onTemporaryLock}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
          >
            <AlertTriangle size={16} />
            Khóa tạm thời
          </button>

          <button
            type="button"
            onClick={onLock}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Lock size={16} />
            Khóa tài khoản
          </button>
        </>
      )}

      {accountStatus === "temporary_locked" && (
        <>
          <button
            type="button"
            onClick={onUnlock}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
          >
            <Unlock size={16} />
            Mở khóa tạm thời
          </button>

          <button
            type="button"
            onClick={onLock}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Lock size={16} />
            Khóa tài khoản
          </button>
        </>
      )}

      {accountStatus === "inactive" && (
        <button
          type="button"
          onClick={onUnlock}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
        >
          <Unlock size={16} />
          Mở khóa tài khoản
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
      >
        <Trash2 size={16} />
        Xóa tài khoản
      </button>
    </div>,
    document.body
  );
};

/* =========================
   TABLE ROW
========================= */
const RescueTableRow: React.FC<TeamRowProps> = ({
  team,
  onDelete,
  onToggle,
  onView,
  onResetPassword,
  showToast,
}) => {
  const [openMenu, setOpenMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const statusLabel =
    team.status === "busy"
      ? "Đang cứu hộ"
      : team.status === "available"
        ? "Sẵn sàng"
        : "Nghỉ ngơi";

  const activityStyles =
    team.status === "busy"
      ? {
        dot: "bg-blue-500",
        text: "text-blue-600 dark:text-blue-300",
        chip: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      }
      : team.status === "available"
        ? {
          dot: "bg-emerald-500",
          text: "text-emerald-600 dark:text-emerald-300",
          chip:
            "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
        }
        : {
          dot: "bg-slate-400",
          text: "text-slate-500 dark:text-slate-300",
          chip: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        };

  const accountStatus = team.account_status || "active";
  const accountActive = accountStatus === "active";
  const accountTemporaryLocked = accountStatus === "temporary_locked";

  const openActionMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - 208,
    });

    setOpenMenu((prev) => !prev);
  };

  return (
    <tr className="hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3 min-w-[220px]">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm">
            <Users size={18} />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {team.full_name || "Chưa có tên"}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Mã đội: #{team.user_id}
            </div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
            accountActive
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : accountTemporaryLocked
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800"
          )}
        >
          {accountActive ? <BadgeCheck size={14} /> : accountTemporaryLocked ? <AlertTriangle size={14} /> : <Lock size={14} />}
          {accountActive ? "Đang hoạt động" : accountTemporaryLocked ? "Khóa tạm thời" : "Đã bị khóa"}
        </span>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 max-w-[280px]">
          <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="line-clamp-2">{team.address || "Chưa cập nhật"}</span>
        </div>
      </td>

      <td className="px-6 py-4">
        <span
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold",
            activityStyles.chip,
            activityStyles.text
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", activityStyles.dot)} />
          {statusLabel}
        </span>
      </td>

      <td className="px-6 py-4">
        {team.sos_id ? (
          <span className="inline-flex px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-sm font-semibold">
            #SOS-{team.sos_id}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-sm">--</span>
        )}
      </td>

      <td className="px-6 py-4 text-right">
        <button
          type="button"
          ref={buttonRef}
          onClick={openActionMenu}
          className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <MoreVertical size={18} />
        </button>

        <ActionMenu
          open={openMenu}
          position={menuPos}
          onClose={() => setOpenMenu(false)}
          onView={() => {
            onView(team);
            setOpenMenu(false);
          }}
          onResetPassword={() => {
            onResetPassword(team);
            setOpenMenu(false);
          }}
          onLock={() => {
            onToggle(team.user_id, team.account_status, "inactive");
            setOpenMenu(false);
          }}
          onTemporaryLock={() => {
            onToggle(team.user_id, team.account_status, "temporary_locked");
            setOpenMenu(false);
          }}
          onUnlock={() => {
            onToggle(team.user_id, team.account_status, "active");
            setOpenMenu(false);
          }}
          onDelete={() => {
            onDelete(team.user_id);
            setOpenMenu(false);
          }}
          accountStatus={accountStatus}
        />
      </td>
    </tr>
  );
};

/* =========================
   PAGINATION BUTTON
========================= */
const PaginationButton: React.FC<{
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ label, icon, active, disabled, onClick }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "min-w-9 h-9 px-3 flex items-center justify-center rounded-xl border text-sm font-semibold transition",
      active
        ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
      disabled && "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-slate-900"
    )}
  >
    {label || icon}
  </button>
);

/* =========================
   PAGE
========================= */
const RescueTeamAdmin: React.FC = () => {
  const itemsPerPage = 10;

  const [currentPage, setCurrentPage] = useState(1);
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    busy: 0,
    available: 0,
    active: 0,
  });

  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, 250);

  const [filterAccountStatus, setFilterAccountStatus] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toggleId, setToggleId] = useState<number | null>(null);
  const [toggleStatus, setToggleStatus] = useState<string>("");
  const [toggleNextStatus, setToggleNextStatus] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const [showAccountStatusDropdown, setShowAccountStatusDropdown] = useState(false);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);

  const accountStatusDropdownRef = useRef<HTMLDivElement | null>(null);
  const activityDropdownRef = useRef<HTMLDivElement | null>(null);

  const [resetPasswordTeam, setResetPasswordTeam] = useState<any | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const getAccountStatusLabel = (value: string) => {
    switch (value) {
      case "active":
        return "Đang hoạt động";
      case "inactive":
        return "Đã bị khóa";
      case "temporary_locked":
        return "Khóa tạm thời";
      default:
        return "Tất cả trạng thái TK";
    }
  };

  const getActivityLabel = (value: string) => {
    switch (value) {
      case "busy":
        return "Đang cứu hộ";
      case "available":
        return "Sẵn sàng";
      default:
        return "Tất cả hoạt động";
    }
  };

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration = 3000
  ) => {
    setToast({
      id: Date.now(),
      show: true,
      message,
      type,
      duration,
    });
  };

  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const token = localStorage.getItem("token");

      const [statsRes, teamRes] = await Promise.all([
        axios.get("http://localhost:3000/api/admin/rescuer-stats", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("http://localhost:3000/api/admin/rescuers-full", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const newTeams = Array.isArray(teamRes.data) ? teamRes.data : [];

      setTeams((prev) => {
        const same =
          prev.length === newTeams.length &&
          prev.every(
            (p, i) =>
              p.user_id === newTeams[i]?.user_id &&
              p.account_status === newTeams[i]?.account_status &&
              p.status === newTeams[i]?.status &&
              p.sos_id === newTeams[i]?.sos_id &&
              p.full_name === newTeams[i]?.full_name &&
              p.address === newTeams[i]?.address
          );

        return same ? prev : newTeams;
      });

      setStats({
        total: Number(statsRes.data?.total ?? 0),
        busy: Number(statsRes.data?.busy ?? 0),
        available: Number(statsRes.data?.available ?? 0),
        active: Number(statsRes.data?.active ?? 0),
      });
    } catch (err: any) {
      console.log("ERROR:", err.response?.data || err.message);
      if (!silent) showToast("Không thể tải dữ liệu đội cứu hộ", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showAccountStatusDropdown &&
        accountStatusDropdownRef.current &&
        !accountStatusDropdownRef.current.contains(target)
      ) {
        setShowAccountStatusDropdown(false);
      }

      if (
        showActivityDropdown &&
        activityDropdownRef.current &&
        !activityDropdownRef.current.contains(target)
      ) {
        setShowActivityDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAccountStatusDropdown, showActivityDropdown]);

  useEffect(() => {
    fetchData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !selectedTeam) {
        fetchData(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData, selectedTeam]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const search = debouncedSearch.toLowerCase();

      const matchSearch =
        (t.full_name || "").toLowerCase().includes(search) ||
        (t.address || "").toLowerCase().includes(search) ||
        String(t.user_id || "").includes(search) ||
        String(t.phone || "").includes(search);

      const matchAccount =
        filterAccountStatus === "all" ||
        t.account_status === filterAccountStatus;

      const matchActivity =
        filterActivity === "all" || t.status === filterActivity;

      return matchSearch && matchAccount && matchActivity;
    });
  }, [teams, debouncedSearch, filterAccountStatus, filterActivity]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterAccountStatus, filterActivity]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTeams.length / itemsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentTeams = filteredTeams.slice(startIndex, startIndex + itemsPerPage);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      setDeleteLoading(true);
      const token = localStorage.getItem("token");

      await axios.delete(
        `http://localhost:3000/api/admin/rescuers/${deleteId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const id = deleteId;

      setTeams((prev) => prev.filter((t) => t.user_id !== id));
      setStats((prev) => ({
        ...prev,
        total: Math.max(prev.total - 1, 0),
        active:
          teams.find((t) => t.user_id === id)?.account_status === "active"
            ? Math.max(prev.active - 1, 0)
            : prev.active,
      }));

      setDeleteId(null);
      showToast("Xóa tài khoản thành công", "success");
      fetchData(true);
    } catch {
      showToast("Xóa tài khoản thất bại", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleId) return;

    try {
      setToggleLoading(true);
      const token = localStorage.getItem("token");

      const currentTeam = teams.find((t) => t.user_id === toggleId);
      const currentStatus = currentTeam?.account_status || "active";
      const targetStatus = toggleNextStatus || (currentStatus === "active" ? "inactive" : "active");

      const response = await axios.patch(
        `http://localhost:3000/api/admin/rescuers/${toggleId}/toggle`,
        { nextStatus: targetStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const nextStatus = response?.data?.status || targetStatus;

      setTeams((prev) =>
        prev.map((t) =>
          t.user_id === toggleId
            ? {
              ...t,
              account_status: nextStatus,
            }
            : t
        )
      );

      setStats((prev) => ({
        ...prev,
        active:
          currentStatus === "active" && nextStatus !== "active"
            ? Math.max(prev.active - 1, 0)
            : currentStatus !== "active" && nextStatus === "active"
              ? prev.active + 1
              : prev.active,
      }));

      setToggleId(null);
      setToggleNextStatus("");
      showToast(
        nextStatus === "temporary_locked"
          ? "Đã khóa tạm thời tài khoản đội cứu hộ"
          : nextStatus === "inactive"
            ? `Đã khóa tài khoản${response?.data?.canceled_rescues ? ` và hủy ${response.data.canceled_rescues} yêu cầu đang nhận` : ""}`
            : "Đã mở lại tài khoản đội cứu hộ",
        "success"
      );
      fetchData(true);
    } catch {
      showToast("Cập nhật tài khoản thất bại", "error");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordTeam?.user_id) return;

    try {
      setResetPasswordLoading(true);
      const token = localStorage.getItem("token");

      await axios.patch(
        `http://localhost:3000/api/admin/rescuers/${resetPasswordTeam.user_id}/reset-password`,
        { newPassword },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showToast(
        `Đã đặt lại mật khẩu cho ${resetPasswordTeam.full_name || "đội cứu hộ"}`,
        "success"
      );

      setResetPasswordTeam(null);
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || "Đặt lại mật khẩu thất bại",
        "error"
      );
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const fromRecord = filteredTeams.length === 0 ? 0 : startIndex + 1;
  const toRecord = Math.min(startIndex + itemsPerPage, filteredTeams.length);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <NotificationToast toast={toast} onClose={handleCloseToast} />

      <CreateRescuerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchData(false)}
        showToast={showToast}
      />

      <TeamDetailModal
        open={selectedTeam !== null}
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        showToast={showToast}
      />

      <ResetPasswordModal
        open={resetPasswordTeam !== null}
        team={resetPasswordTeam}
        onClose={() => setResetPasswordTeam(null)}
        onSubmit={handleResetPassword}
        submitting={resetPasswordLoading}
        showToast={showToast}
      />

      <ConfirmModal
        open={deleteId !== null}
        tone="red"
        title="Xác nhận xóa tài khoản"
        description="Tài khoản đội cứu hộ sẽ bị xóa khỏi hệ thống và không thể khôi phục."
        message="Bạn có chắc muốn xóa tài khoản này không?"
        confirmText="Xóa tài khoản"
        cancelText="Quay lại"
        loading={deleteLoading}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <ConfirmModal
        open={toggleId !== null}
        tone={
          toggleNextStatus === "temporary_locked"
            ? "amber"
            : toggleNextStatus === "inactive"
              ? "red"
              : "emerald"
        }
        title={
          toggleNextStatus === "temporary_locked"
            ? "Khóa tạm thời tài khoản"
            : toggleNextStatus === "inactive"
              ? "Khóa tài khoản"
              : "Mở khóa tài khoản"
        }
        description={
          toggleNextStatus === "temporary_locked"
            ? "Đội cứu hộ sẽ bị hạn chế nhận thêm yêu cầu mới."
            : toggleNextStatus === "inactive"
              ? "Đội cứu hộ sẽ bị khóa và không thể tiếp tục sử dụng hệ thống."
              : "Tài khoản đội cứu hộ sẽ được mở lại để tiếp tục hoạt động."
        }
        message={
          toggleNextStatus === "temporary_locked"
            ? "Đội cứu hộ vẫn được đăng nhập và hoàn thành các yêu cầu đã nhận, nhưng sẽ không thể nhận thêm yêu cầu mới."
            : toggleNextStatus === "inactive"
              ? "Đội cứu hộ sẽ bị đăng xuất ngay nếu đang sử dụng hệ thống và tất cả yêu cầu đang nhận sẽ bị hủy về trạng thái chờ."
              : "Bạn có chắc muốn mở lại tài khoản này không?"
        }
        confirmText={
          toggleNextStatus === "temporary_locked"
            ? "Khóa tạm thời"
            : toggleNextStatus === "inactive"
              ? "Khóa tài khoản"
              : "Mở khóa"
        }
        cancelText="Quay lại"
        loading={toggleLoading}
        onCancel={() => {
          setToggleId(null);
          setToggleNextStatus("");
        }}
        onConfirm={handleToggle}
      />

      <Navbar />

      <main className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <section className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_24%)]" />

          <div className="relative px-5 md:px-6 py-5 md:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                <ShieldCheck size={14} />
                Trung tâm quản lý cứu hộ
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                QUẢN LÝ ĐỘI CỨU HỘ
              </h1>

              <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                Quản lý tài khoản, trạng thái và điều phối đội cứu hộ theo thời gian thực.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Activity size={13} />
                  Cập nhật 5 giây/lần
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Users size={13} />
                  Điều phối lực lượng
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => fetchData(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Làm mới
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:scale-[1.02] transition shadow-md"
              >
                <Plus size={16} />
                Tạo tài khoản
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <RescueStatCard
            label="Tổng đội cứu hộ"
            value={String(stats.total ?? 0)}
            subText="Tổng tất cả đội"
            accent="blue"
            icon={<Users size={20} />}
          />
          <RescueStatCard
            label="Tài khoản hoạt động"
            value={String(stats.active ?? 0)}
            subText="Đang hoạt động"
            accent="emerald"
            icon={<ShieldCheck size={20} />}
          />
          <RescueStatCard
            label="Đội đang cứu hộ"
            value={String(stats.busy ?? 0)}
            subText="Đang xử lý SOS"
            accent="amber"
            icon={<Ambulance size={20} />}
          />
          <RescueStatCard
            label="Đội sẵn sàng"
            value={String(stats.available ?? 0)}
            subText="Sẵn sàng tiếp nhận"
            accent="rose"
            icon={<BadgeCheck size={20} />}
          />
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-5">
          <div className="flex flex-col xl:flex-row gap-4 xl:items-center">
            <div className="flex-1 relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                size={18}
              />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-900/40 focus:border-blue-500 focus:outline-none transition"
                placeholder="Tìm kiếm tên đội, địa chỉ, số điện thoại, ID..."
                type="text"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[220px]" ref={accountStatusDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountStatusDropdown((prev) => !prev);
                    setShowActivityDropdown(false);
                  }}
                  className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                >
                  <span className="truncate">{getAccountStatusLabel(filterAccountStatus)}</span>

                  <ChevronRight
                    size={16}
                    className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showAccountStatusDropdown ? "rotate-[-90deg]" : "rotate-90"
                      }`}
                  />
                </button>

                {showAccountStatusDropdown && (
                  <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                    {[
                      { value: "all", label: "Tất cả trạng thái TK" },
                      { value: "active", label: "Đang hoạt động" },
                      { value: "temporary_locked", label: "Khóa tạm thời" },
                      { value: "inactive", label: "Đã bị khóa" },
                    ].map((option) => {
                      const active = filterAccountStatus === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFilterAccountStatus(option.value);
                            setShowAccountStatusDropdown(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active
                            ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                            }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative min-w-[220px]" ref={activityDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowActivityDropdown((prev) => !prev);
                    setShowAccountStatusDropdown(false);
                  }}
                  className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                >
                  <span className="truncate">{getActivityLabel(filterActivity)}</span>

                  <ChevronRight
                    size={16}
                    className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showActivityDropdown ? "rotate-[-90deg]" : "rotate-90"
                      }`}
                  />
                </button>

                {showActivityDropdown && (
                  <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                    {[
                      { value: "all", label: "Tất cả hoạt động" },
                      { value: "busy", label: "Đang cứu hộ" },
                      { value: "available", label: "Sẵn sàng" },
                    ].map((option) => {
                      const active = filterActivity === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFilterActivity(option.value);
                            setShowActivityDropdown(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active
                            ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                            }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                title="Reset bộ lọc"
                onClick={() => {
                  setSearchText("");
                  setFilterAccountStatus("all");
                  setFilterActivity("all");
                  setShowAccountStatusDropdown(false);
                  setShowActivityDropdown(false);
                }}
                className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center gap-2"
              >
                <RotateCcw size={17} />
                Đặt lại
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Danh sách đội cứu hộ
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Theo dõi trạng thái tài khoản và hoạt động theo thời gian thực
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <Loader2 size={30} className="animate-spin mb-3" />
              <p className="font-medium">Đang tải danh sách đội cứu hộ...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="py-20 px-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Users size={26} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Không có dữ liệu phù hợp
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 sticky top-0 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Tên đội cứu hộ
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Trạng thái tài khoản
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Địa chỉ
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Hoạt động
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Mã SOS phụ trách
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentTeams.map((team) => (
                      <RescueTableRow
                        key={team.user_id}
                        team={team}
                        onDelete={(id) => setDeleteId(id)}
                        onToggle={(id, currentStatus, nextStatus) => {
                          setToggleId(id);
                          setToggleStatus(currentStatus);
                          setToggleNextStatus(nextStatus);
                        }}
                        onView={(teamData) => setSelectedTeam(teamData)}
                        onResetPassword={(teamData) => setResetPasswordTeam(teamData)}
                        showToast={showToast}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị <span className="font-semibold">{fromRecord}</span> -{" "}
                  <span className="font-semibold">{toRecord}</span> trong tổng số{" "}
                  <span className="font-semibold">{filteredTeams.length}</span> bản
                  ghi
                </p>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <PaginationButton
                    icon={<ChevronLeft size={16} />}
                    disabled={safeCurrentPage === 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                  />

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, safeCurrentPage - 3),
                      Math.max(0, safeCurrentPage - 3) + 5
                    )
                    .map((page) => (
                      <PaginationButton
                        key={page}
                        label={String(page)}
                        active={safeCurrentPage === page}
                        onClick={() => setCurrentPage(page)}
                      />
                    ))}

                  <PaginationButton
                    icon={<ChevronRight size={16} />}
                    disabled={safeCurrentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                  <Waves className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    FRRP System
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Flood Rescue Response Platform
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Hệ thống hỗ trợ cứu hộ thiên tai, tiếp nhận SOS khẩn cấp và điều
                phối đội cứu hộ nhanh chóng, chính xác và an toàn.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Liên kết nhanh
              </h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a
                    href="/homeadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Home className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map_admin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteamadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Users2 className="h-4 w-4" />
                    Quản lý Đội cứu hộ
                  </a>
                </li>
                <li>
                  <a
                    href="/requestsosadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Quản lý Dân cư
                  </a>
                </li>
                <li>
                  <a
                    href="/analytics"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Phân tích dữ liệu
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Hỗ trợ khẩn cấp
              </h4>

              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-500" />
                  Hotline cứu nạn: <span className="font-bold">112</span>
                </p>

                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  Quản trị hệ thống: <span className="font-bold">0888 100 204</span>
                </p>

                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Cấp tài khoản đội cứu hộ qua Admin
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            © {new Date().getFullYear()} FRRP System. All rights reserved.
            <br />
            Developed for Flood Emergency Rescue Coordination.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RescueTeamAdmin;
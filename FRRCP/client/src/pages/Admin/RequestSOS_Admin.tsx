import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import Navbar from "../../components/Navbar";
import { createPortal } from "react-dom";
import {
  Search,
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
  KeyRound,
  CalendarDays,
  AtSign,
} from "lucide-react";

/* =========================
   CONFIG
========================= */
const API_BASE = "http://localhost:3000";
const ITEMS_PER_PAGE = 10;
const HISTORY_ITEMS_PER_PAGE = 5;

/* =========================
   TYPES
========================= */
type ToastType = "success" | "error" | "warning" | "info";
type AccountStatus = "active" | "temporary_locked" | "inactive" | string;
type ProviderType = "manual" | "facebook" | null;

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

interface CitizenRowData {
  user_id: number;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  provider?: ProviderType;
  email_source?: string | null;
  avatar?: string | null;
  created_at?: string | null;
  account_status?: AccountStatus;
  total_sos?: number | string | null;
  active_sos?: number | string | null;
  completed_sos?: number | string | null;
  canceled_sos?: number | string | null;
  last_sos_at?: string | null;
  has_password?: boolean | number | null;
}

interface CitizenStatData {
  total: number;
  active: number;
  locked: number;
  facebook: number;
  totalSos: number;
}

interface CitizenHistoryItem {
  id: number;
  name?: string | null;
  phone?: string | null;
  sos_type?: string | null;
  status?: string | null;
  address?: string | null;
  victims?: number | string | null;
  note?: string | null;
  source_url?: string | null;
  assigned_team?: string | null;
  handled_by?: number | null;
  handled_by_name?: string | null;
  created_at?: string | null;
  received_at?: string | null;
  completed_at?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}

interface CitizenDetailData {
  profile: CitizenRowData;
  summary: {
    total: number;
    active: number;
    completed: number;
    canceled: number;
  };
  history: CitizenHistoryItem[];
}

interface StatCardProps {
  label: string;
  value: string;
  subText: string;
  icon: React.ReactNode;
  accent?: "blue" | "emerald" | "amber" | "rose";
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

const getTokenHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

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


const formatImageUrl = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_BASE}${value.startsWith("/") ? value : `/${value}`}`;
};

const formatCoordinate = (
  lat?: number | string | null,
  lng?: number | string | null
) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return "Chưa cập nhật tọa độ";
  }

  return `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
};

const getAccountStatusLabel = (value?: AccountStatus) => {
  switch (value) {
    case "active":
      return "Đang hoạt động";
    case "temporary_locked":
      return "Khóa tạm thời";
    case "inactive":
      return "Đã bị khóa";
    default:
      return "Đang hoạt động";
  }
};

const normalizeProviderType = (value?: ProviderType) => {
  const provider = String(value || "").toLowerCase().trim();

  if (provider === "facebook") return "facebook";

  return "manual";
};

const getProviderLabel = (value?: ProviderType) => {
  const provider = normalizeProviderType(value);

  switch (provider) {
    case "facebook":
      return "Facebook";
    default:
      return "Tài khoản thường";
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

const getRescueStatusMeta = (value?: string | null) => {
  switch (value) {
    case "new":
      return {
        label: "Đang chờ",
        icon: <Clock3 size={14} />,
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
      };
    case "rescuing":
      return {
        label: "Đang cứu hộ",
        icon: <Activity size={14} />,
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
      };
    case "done":
      return {
        label: "Hoàn thành",
        icon: <CheckCircle2 size={14} />,
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "cancel":
      return {
        label: "Đã hủy",
        icon: <XCircle size={14} />,
        className:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
      };
    default:
      return {
        label: "Chưa xác định",
        icon: <Info size={14} />,
        className:
          "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
      };
  }
};

const buildStatsFromCitizens = (citizens: CitizenRowData[]): CitizenStatData => ({
  total: citizens.length,
  active: citizens.filter((item) => (item.account_status || "active") === "active").length,
  locked: citizens.filter((item) => (item.account_status || "active") !== "active").length,
  facebook: citizens.filter((item) => item.provider === "facebook").length,
  totalSos: citizens.reduce((sum, item) => sum + toNumber(item.total_sos), 0),
});

const normalizeCitizen = (item: any): CitizenRowData => ({
  user_id: Number(item.user_id ?? item.id),
  email: item.email ?? item.username ?? null,
  full_name: item.full_name ?? item.name ?? null,
  phone: item.phone ?? null,
  address: item.address ?? null,
  lat: item.lat ?? null,
  lng: item.lng ?? null,
  provider: normalizeProviderType(item.provider ?? item.email_source),
  email_source: item.email_source ?? null,
  avatar: item.avatar ?? null,
  created_at: item.created_at ?? null,
  account_status: item.account_status ?? item.status_account ?? "active",
  total_sos: item.total_sos ?? item.sos_count ?? 0,
  active_sos: item.active_sos ?? item.active_sos_count ?? 0,
  completed_sos: item.completed_sos ?? item.completed_sos_count ?? 0,
  canceled_sos: item.canceled_sos ?? item.canceled_sos_count ?? 0,
  last_sos_at: item.last_sos_at ?? item.last_request_at ?? null,
  has_password: item.has_password ?? null,
});

/* =========================
   TOAST
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

const NotificationToast = ({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
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
              type="button"
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
   COMMON COMPONENTS
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
      box: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70",
      icon: "text-slate-500 dark:text-slate-300",
    },
    amber: {
      box: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
      icon: "text-amber-500 dark:text-amber-300",
    },
    red: {
      box: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
      icon: "text-red-500 dark:text-red-300",
    },
    emerald: {
      box: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
      icon: "text-emerald-500 dark:text-emerald-300",
    },
    blue: {
      box: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
      icon: "text-blue-500 dark:text-blue-300",
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
        className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-900"
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

            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
              {message}
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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

const PaginationButton: React.FC<{
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ label, icon, active, disabled, onClick }) => (
  <button
    type="button"
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

const StatCard: React.FC<StatCardProps> = ({
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
   RESET PASSWORD MODAL
========================= */
const ResetPasswordModal = ({
  open,
  citizen,
  onClose,
  onSubmit,
  submitting,
  showToast,
}: {
  open: boolean;
  citizen: CitizenRowData | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  submitting: boolean;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}) => {
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState({ newPassword: false, confirmPassword: false });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({ newPassword: "", confirmPassword: "" });
      setShowPassword({ newPassword: false, confirmPassword: false });
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

  if (!open || !citizen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="px-6 md:px-7 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-xl">Đặt lại mật khẩu dân cư</h3>
                <p className="text-sm text-blue-50 mt-1">
                  Dùng khi người dân quên mật khẩu và cần admin hỗ trợ.
                </p>
              </div>

              <button
                type="button"
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
                Tài khoản dân cư
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white">
                {citizen.full_name || "Người dân"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Mã tài khoản: #{citizen.user_id}
              </div>
            </div>

            <InputField
              label="Mật khẩu mới"
              type={showPassword.newPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu mới"
              value={form.newPassword}
              maxLength={50}
              onChange={(value) => setForm((prev) => ({ ...prev, newPassword: value }))}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, newPassword: !prev.newPassword }))
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword.newPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <InputField
              label="Nhập lại mật khẩu mới"
              type={showPassword.confirmPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirmPassword}
              maxLength={50}
              onChange={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
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
                  {showPassword.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          </div>

          <div className="px-6 md:px-7 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-60"
            >
              Hủy
            </button>

            <button
              type="button"
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
        message={`Bạn có chắc muốn đặt lại mật khẩu cho ${citizen.full_name || "người dân"} không?`}
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
const CitizenDetailModal = ({
  open,
  citizen,
  onClose,
  showToast,
}: {
  open: boolean;
  citizen: CitizenRowData | null;
  onClose: () => void;
  showToast: (msg: string, type?: ToastType, duration?: number) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CitizenDetailData | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSosType, setFilterSosType] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSosTypeDropdown, setShowSosTypeDropdown] = useState(false);

  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const sosTypeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !citizen?.user_id) return;

    let mounted = true;
    setDetail(null);
    setLoading(true);

    axios
      .get(`${API_BASE}/api/admin/citizens/${citizen.user_id}/details`, {
        headers: getTokenHeaders(),
      })
      .then((res) => {
        if (!mounted) return;
        setDetail({
          profile: normalizeCitizen(res.data?.profile || citizen),
          summary: {
            total: toNumber(res.data?.summary?.total ?? citizen.total_sos),
            active: toNumber(res.data?.summary?.active ?? citizen.active_sos),
            completed: toNumber(res.data?.summary?.completed ?? citizen.completed_sos),
            canceled: toNumber(res.data?.summary?.canceled ?? citizen.canceled_sos),
          },
          history: Array.isArray(res.data?.history) ? res.data.history : [],
        });
      })
      .catch((err: any) => {
        if (!mounted) return;
        setDetail({
          profile: citizen,
          summary: {
            total: toNumber(citizen.total_sos),
            active: toNumber(citizen.active_sos),
            completed: toNumber(citizen.completed_sos),
            canceled: toNumber(citizen.canceled_sos),
          },
          history: [],
        });

        showToast(
          err?.response?.data?.message ||
          "Chỉ hiển thị thông tin cơ bản vì chưa tải được lịch sử SOS",
          "warning"
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, citizen, showToast]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setLoading(false);
      setFilterStatus("all");
      setFilterSosType("all");
      setHistoryPage(1);
      setShowStatusDropdown(false);
      setShowSosTypeDropdown(false);
    }
  }, [open]);

  useEffect(() => {
    setHistoryPage(1);
  }, [filterStatus, filterSosType, citizen?.user_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showStatusDropdown &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(target)
      ) {
        setShowStatusDropdown(false);
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStatusDropdown, showSosTypeDropdown]);

  const profile = detail?.profile;
  const summary = detail?.summary || { total: 0, active: 0, completed: 0, canceled: 0 };
  const history = detail?.history || [];

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchStatus = filterStatus === "all" || item.status === filterStatus;
      const matchSosType = filterSosType === "all" || item.sos_type === filterSosType;
      return matchStatus && matchSosType;
    });
  }, [history, filterStatus, filterSosType]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_ITEMS_PER_PAGE));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historyStartIndex = (safeHistoryPage - 1) * HISTORY_ITEMS_PER_PAGE;
  const currentHistoryItems = filteredHistory.slice(
    historyStartIndex,
    historyStartIndex + HISTORY_ITEMS_PER_PAGE
  );

  const historyFromRecord = filteredHistory.length === 0 ? 0 : historyStartIndex + 1;
  const historyToRecord = Math.min(historyStartIndex + HISTORY_ITEMS_PER_PAGE, filteredHistory.length);
  const avatarUrl = formatImageUrl(profile?.avatar);

  const getStatusFilterLabel = (value: string) => {
    switch (value) {
      case "new":
        return "Đang chờ";
      case "rescuing":
        return "Đang cứu hộ";
      case "done":
        return "Hoàn thành";
      case "cancel":
        return "Đã hủy";
      default:
        return "Tất cả trạng thái SOS";
    }
  };

  const getSosTypeFilterLabel = (value: string) => {
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="px-6 md:px-7 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                <Users size={14} />
                Hồ sơ dân cư
              </div>

              <h3 className="mt-3 text-xl md:text-2xl font-black tracking-tight">
                {citizen?.full_name || "Chi tiết tài khoản dân cư"}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Thông tin tài khoản, hồ sơ cá nhân và lịch sử gửi yêu cầu SOS.
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
                <p className="font-medium">Đang tải chi tiết tài khoản dân cư...</p>
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
                      <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={28} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-black text-slate-900 dark:text-slate-100">
                            {profile.full_name || "Chưa có tên"}
                          </h4>

                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                              (profile.account_status || "active") === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                                : (profile.account_status || "active") === "temporary_locked"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
                            )}
                          >
                            {(profile.account_status || "active") === "active" ? (
                              <BadgeCheck size={13} />
                            ) : (
                              <Lock size={13} />
                            )}
                            {getAccountStatusLabel(profile.account_status)}
                          </span>

                          <ProviderBadge provider={profile.provider} />
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Mã tài khoản
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
                              Ngày đăng ký
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {formatDateTime(profile.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Địa chỉ / khu vực
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                            {profile.address || "Chưa cập nhật"}
                          </div>
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Tọa độ: {profile.lat != null && profile.lng != null ? `${profile.lat}, ${profile.lng}` : "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={18} className="text-slate-500 dark:text-slate-400" />
                      <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Tổng hợp SOS
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Tổng yêu cầu
                        </div>
                        <div className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-100">
                          {summary.total}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Đang xử lý
                        </div>
                        <div className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-100">
                          {summary.active}
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

                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                        <div className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                          Đã hủy
                        </div>
                        <div className="mt-1 text-2xl font-black text-red-900 dark:text-red-100">
                          {summary.canceled}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Lịch sử yêu cầu SOS
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Danh sách các yêu cầu người dân đã gửi lên hệ thống.
                      </p>
                    </div>

                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {filteredHistory.length} yêu cầu
                    </span>
                  </div>

                  <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="relative min-w-[220px]" ref={statusDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowStatusDropdown((prev) => !prev);
                            setShowSosTypeDropdown(false);
                          }}
                          className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                        >
                          <span className="truncate">{getStatusFilterLabel(filterStatus)}</span>
                          <ChevronRight
                            size={16}
                            className={cn(
                              "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                              showStatusDropdown ? "rotate-[-90deg]" : "rotate-90"
                            )}
                          />
                        </button>

                        {showStatusDropdown && (
                          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                            {[
                              { value: "all", label: "Tất cả trạng thái SOS" },
                              { value: "new", label: "Đang chờ" },
                              { value: "rescuing", label: "Đang cứu hộ" },
                              { value: "done", label: "Hoàn thành" },
                              { value: "cancel", label: "Đã hủy" },
                            ].map((option) => {
                              const active = filterStatus === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFilterStatus(option.value);
                                    setShowStatusDropdown(false);
                                    setHistoryPage(1);
                                  }}
                                  className={cn(
                                    "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                                    active
                                      ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                  )}
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
                            setShowStatusDropdown(false);
                          }}
                          className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                        >
                          <span className="truncate">{getSosTypeFilterLabel(filterSosType)}</span>
                          <ChevronRight
                            size={16}
                            className={cn(
                              "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                              showSosTypeDropdown ? "rotate-[-90deg]" : "rotate-90"
                            )}
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
                                  className={cn(
                                    "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                                    active
                                      ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                  )}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFilterStatus("all");
                          setFilterSosType("all");
                          setHistoryPage(1);
                          setShowStatusDropdown(false);
                          setShowSosTypeDropdown(false);
                        }}
                        className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center gap-2"
                      >
                        <RotateCcw size={16} />
                        Đặt lại
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    {filteredHistory.length === 0 ? (
                      <div className="py-14 text-center">
                        <div className="mx-auto w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                          <ClipboardList size={26} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <h5 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          Chưa có lịch sử phù hợp
                        </h5>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Hãy thử thay đổi bộ lọc trạng thái hoặc loại yêu cầu.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="space-y-4">
                          {currentHistoryItems.map((item) => {
                            const meta = getRescueStatusMeta(item.status);
                            return (
                              <div
                                key={item.id}
                                className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 md:p-5"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                                          meta.className
                                        )}
                                      >
                                        {meta.icon}
                                        {meta.label}
                                      </span>

                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                                        #SOS-{item.id}
                                      </span>

                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">
                                        {getSosTypeLabel(item.sos_type)}
                                      </span>
                                    </div>

                                    <h5 className="mt-3 text-base md:text-lg font-bold text-slate-900 dark:text-slate-100">
                                      {item.name || "Yêu cầu SOS"}
                                    </h5>

                                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                      {item.note || "Không có ghi chú"}
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
                                      Số điện thoại SOS
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {item.phone || "Chưa cập nhật"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Số người cần hỗ trợ
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {item.victims || "--"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Đội phụ trách
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {item.assigned_team || item.handled_by_name || "Chưa có"}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      Hoàn thành
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
                                    {item.address || "Chưa cập nhật"}
                                  </div>

                                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Tọa độ: {item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : "Chưa cập nhật"}
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
                            <span className="font-semibold">{filteredHistory.length}</span> yêu cầu
                          </p>

                          <div className="flex items-center gap-2 flex-wrap justify-center">
                            <PaginationButton
                              icon={<ChevronLeft size={16} />}
                              disabled={safeHistoryPage === 1}
                              onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                            />

                            {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
                              .slice(Math.max(0, safeHistoryPage - 3), Math.max(0, safeHistoryPage - 3) + 5)
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
                              onClick={() => setHistoryPage((prev) => Math.min(prev + 1, totalHistoryPages))}
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
   ACTION MENU & ROW
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
  accountStatus: AccountStatus;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
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
      style={{ position: "absolute", top: position.top, left: position.left }}
      className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden"
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
        <KeyRound size={16} />
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

const AccountStatusBadge = ({ status }: { status: AccountStatus }) => {
  const accountStatus = status || "active";
  const accountActive = accountStatus === "active";
  const accountTemporaryLocked = accountStatus === "temporary_locked";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap",
        accountActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          : accountTemporaryLocked
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            : "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
      )}
    >
      {accountActive ? (
        <BadgeCheck size={13} />
      ) : accountTemporaryLocked ? (
        <AlertTriangle size={13} />
      ) : (
        <Lock size={13} />
      )}
      {getAccountStatusLabel(accountStatus)}
    </span>
  );
};

const ProviderIcon = ({ provider }: { provider?: ProviderType }) => {
  const type = normalizeProviderType(provider);

  if (type === "facebook") {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1877F2] text-[12px] font-black leading-none text-white">
        f
      </span>
    );
  }

  return <KeyRound size={13} />;
};

const ProviderBadge = ({ provider }: { provider?: ProviderType }) => {
  const type = normalizeProviderType(provider);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap",
        type === "facebook"
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      )}
    >
      <ProviderIcon provider={type} />
      {getProviderLabel(type)}
    </span>
  );
};

const SosMiniStat = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "amber" | "emerald" | "red";
}) => {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold",
        toneClass
      )}
    >
      {icon}
      {value} {label}
    </span>
  );
};

const CitizenActionButton = ({
  buttonRef,
  onClick,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    type="button"
    ref={buttonRef}
    onClick={onClick}
    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
  >
    <MoreVertical size={18} />
  </button>
);

const CitizenTableRow = ({
  citizen,
  onView,
  onResetPassword,
  onToggle,
  onDelete,
}: {
  citizen: CitizenRowData;
  onView: (citizen: CitizenRowData) => void;
  onResetPassword: (citizen: CitizenRowData) => void;
  onToggle: (id: number, currentStatus: string, nextStatus: string) => void;
  onDelete: (id: number) => void;
}) => {
  const [openMenu, setOpenMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const accountStatus = citizen.account_status || "active";
  const avatarUrl = formatImageUrl(citizen.avatar);

  const openActionMenu = (e: React.MouseEvent) => {
    e.stopPropagation();

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(12, rect.right + window.scrollX - 224),
    });

    setOpenMenu((prev) => !prev);
  };

  return (
    <tr
      onClick={() => onView(citizen)}
      className="group cursor-pointer transition hover:bg-blue-50/45 dark:hover:bg-slate-800/70"
    >
      <td className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600 shadow-sm ring-1 ring-slate-200 dark:from-blue-900/40 dark:to-cyan-900/30 dark:text-blue-300 dark:ring-slate-700">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User size={20} />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-black text-slate-900 dark:text-white">
                {citizen.full_name || "Chưa có tên"}
              </p>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                #{citizen.user_id}
              </span>
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Mail size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">
                {citizen.email || "Chưa cập nhật email"}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Phone size={13} className="shrink-0 text-slate-400" />
              <span>{citizen.phone || "Chưa cập nhật SĐT"}</span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-2">
          <AccountStatusBadge status={accountStatus} />
          <ProviderBadge provider={citizen.provider} />
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <MapPin
              size={15}
              className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"
            />
            <span className="line-clamp-2">
              {citizen.address || "Chưa cập nhật địa chỉ"}
            </span>
          </div>

          <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
            <span className="shrink-0 font-bold text-slate-400">Tọa độ</span>
            <span className="truncate text-slate-700 dark:text-slate-200">
              {formatCoordinate(citizen.lat, citizen.lng)}
            </span>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CalendarDays size={15} className="shrink-0 text-slate-400" />
          <span className="font-medium">
            {formatDateTime(citizen.created_at)}
          </span>
        </div>
      </td>

      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        <CitizenActionButton buttonRef={buttonRef} onClick={openActionMenu} />

        <ActionMenu
          open={openMenu}
          position={menuPos}
          onClose={() => setOpenMenu(false)}
          onView={() => {
            onView(citizen);
            setOpenMenu(false);
          }}
          onResetPassword={() => {
            onResetPassword(citizen);
            setOpenMenu(false);
          }}
          onLock={() => {
            onToggle(citizen.user_id, accountStatus, "inactive");
            setOpenMenu(false);
          }}
          onTemporaryLock={() => {
            onToggle(citizen.user_id, accountStatus, "temporary_locked");
            setOpenMenu(false);
          }}
          onUnlock={() => {
            onToggle(citizen.user_id, accountStatus, "active");
            setOpenMenu(false);
          }}
          onDelete={() => {
            onDelete(citizen.user_id);
            setOpenMenu(false);
          }}
          accountStatus={accountStatus}
        />
      </td>
    </tr>
  );
};

const CitizenMobileCard = ({
  citizen,
  onView,
  onResetPassword,
  onToggle,
  onDelete,
}: {
  citizen: CitizenRowData;
  onView: (citizen: CitizenRowData) => void;
  onResetPassword: (citizen: CitizenRowData) => void;
  onToggle: (id: number, currentStatus: string, nextStatus: string) => void;
  onDelete: (id: number) => void;
}) => {
  const [openMenu, setOpenMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const accountStatus = citizen.account_status || "active";
  const avatarUrl = formatImageUrl(citizen.avatar);

  const openActionMenu = (e: React.MouseEvent) => {
    e.stopPropagation();

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(12, rect.right + window.scrollX - 224),
    });

    setOpenMenu((prev) => !prev);
  };

  return (
    <div
      onClick={() => onView(citizen)}
      className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User size={20} />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate font-black text-slate-900 dark:text-white">
              {citizen.full_name || "Chưa có tên"}
            </p>
            <p className="text-xs font-semibold text-slate-400">
              ID #{citizen.user_id}
            </p>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <CitizenActionButton buttonRef={buttonRef} onClick={openActionMenu} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AccountStatusBadge status={accountStatus} />
        <ProviderBadge provider={citizen.provider} />
      </div>

      <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
        <div className="flex min-w-0 items-center gap-2">
          <Mail size={14} className="shrink-0 text-slate-400" />
          <span className="truncate">{citizen.email || "Chưa cập nhật email"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Phone size={14} className="shrink-0 text-slate-400" />
          <span>{citizen.phone || "Chưa cập nhật SĐT"}</span>
        </div>

        <div className="flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">
            {citizen.address || "Chưa cập nhật địa chỉ"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <MapPin size={13} className="shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-400">Tọa độ:</span>
          <span className="truncate text-slate-600 dark:text-slate-300">
            {formatCoordinate(citizen.lat, citizen.lng)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SosMiniStat
          icon={<ClipboardList size={13} />}
          label="SOS"
          value={toNumber(citizen.total_sos)}
          tone="blue"
        />
        <SosMiniStat
          icon={<Activity size={13} />}
          label="đang xử lý"
          value={toNumber(citizen.active_sos)}
          tone="amber"
        />
        <SosMiniStat
          icon={<CheckCircle2 size={13} />}
          label="hoàn thành"
          value={toNumber(citizen.completed_sos)}
          tone="emerald"
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
        <span>Ngày đăng ký</span>
        <span className="font-semibold text-slate-500 dark:text-slate-300">
          {formatDateTime(citizen.created_at)}
        </span>
      </div>

      <ActionMenu
        open={openMenu}
        position={menuPos}
        onClose={() => setOpenMenu(false)}
        onView={() => {
          onView(citizen);
          setOpenMenu(false);
        }}
        onResetPassword={() => {
          onResetPassword(citizen);
          setOpenMenu(false);
        }}
        onLock={() => {
          onToggle(citizen.user_id, accountStatus, "inactive");
          setOpenMenu(false);
        }}
        onTemporaryLock={() => {
          onToggle(citizen.user_id, accountStatus, "temporary_locked");
          setOpenMenu(false);
        }}
        onUnlock={() => {
          onToggle(citizen.user_id, accountStatus, "active");
          setOpenMenu(false);
        }}
        onDelete={() => {
          onDelete(citizen.user_id);
          setOpenMenu(false);
        }}
        accountStatus={accountStatus}
      />
    </div>
  );
};

/* =========================
   PAGE
========================= */
const RequestSOS_Admin: React.FC = () => {
  const [citizens, setCitizens] = useState<CitizenRowData[]>([]);
  const [stats, setStats] = useState<CitizenStatData>({
    total: 0,
    active: 0,
    locked: 0,
    facebook: 0,
    totalSos: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, 250);

  const [filterAccountStatus, setFilterAccountStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const [selectedCitizen, setSelectedCitizen] = useState<CitizenRowData | null>(null);
  const [resetPasswordCitizen, setResetPasswordCitizen] = useState<CitizenRowData | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toggleId, setToggleId] = useState<number | null>(null);
  const [toggleCurrentStatus, setToggleCurrentStatus] = useState<string>("");
  const [toggleNextStatus, setToggleNextStatus] = useState<string>("");

  const [showAccountStatusDropdown, setShowAccountStatusDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const accountStatusDropdownRef = useRef<HTMLDivElement | null>(null);
  const providerDropdownRef = useRef<HTMLDivElement | null>(null);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    setToast({ id: Date.now(), show: true, message, type, duration });
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const getAccountFilterLabel = (value: string) => {
    switch (value) {
      case "active":
        return "Đang hoạt động";
      case "temporary_locked":
        return "Khóa tạm thời";
      case "inactive":
        return "Đã bị khóa";
      default:
        return "Tất cả trạng thái TK";
    }
  };

  const getProviderFilterLabel = (value: string) => {
    switch (value) {
      case "manual":
        return "Tài khoản thường";
      case "facebook":
        return "Facebook";
      default:
        return "Tất cả phương thức";
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const listRes = await axios.get(`${API_BASE}/api/admin/citizens-full`, {
        headers: getTokenHeaders(),
      });

      const newCitizens = Array.isArray(listRes.data)
        ? listRes.data.map(normalizeCitizen).filter((item) => Number.isFinite(item.user_id))
        : [];

      setCitizens((prev) => {
        const same =
          prev.length === newCitizens.length &&
          prev.every((p, i) => {
            const n = newCitizens[i];
            return (
              p.user_id === n.user_id &&
              p.account_status === n.account_status &&
              p.full_name === n.full_name &&
              p.phone === n.phone &&
              p.address === n.address &&
              p.total_sos === n.total_sos &&
              p.active_sos === n.active_sos
            );
          });

        return same ? prev : newCitizens;
      });

      try {
        const statsRes = await axios.get(`${API_BASE}/api/admin/citizen-stats`, {
          headers: getTokenHeaders(),
        });

        setStats({
          total: toNumber(statsRes.data?.total ?? newCitizens.length),
          active: toNumber(statsRes.data?.active),
          locked: toNumber(statsRes.data?.locked),
          facebook: toNumber(statsRes.data?.facebook),
          totalSos: toNumber(statsRes.data?.totalSos ?? statsRes.data?.total_sos),
        });
      } catch {
        setStats(buildStatsFromCitizens(newCitizens));
      }
    } catch (err: any) {
      console.log("ERROR:", err.response?.data || err.message);
      if (!silent) {
        showToast(
          err?.response?.data?.message || "Không thể tải dữ liệu tài khoản dân cư",
          "error"
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

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
        showProviderDropdown &&
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(target)
      ) {
        setShowProviderDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountStatusDropdown, showProviderDropdown]);

  useEffect(() => {
    fetchData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !selectedCitizen) fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData, selectedCitizen]);

  const filteredCitizens = useMemo(() => {
    return citizens.filter((item) => {
      const search = debouncedSearch.trim().toLowerCase();
      const provider = item.provider || "manual";
      const accountStatus = item.account_status || "active";

      const matchSearch =
        !search ||
        (item.full_name || "").toLowerCase().includes(search) ||
        (item.email || "").toLowerCase().includes(search) ||
        (item.phone || "").toLowerCase().includes(search) ||
        (item.address || "").toLowerCase().includes(search) ||
        String(item.user_id || "").includes(search);

      const matchAccount = filterAccountStatus === "all" || accountStatus === filterAccountStatus;
      const matchProvider = filterProvider === "all" || provider === filterProvider;

      return matchSearch && matchAccount && matchProvider;
    });
  }, [citizens, debouncedSearch, filterAccountStatus, filterProvider]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterAccountStatus, filterProvider]);

  const totalPages = Math.max(1, Math.ceil(filteredCitizens.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const currentCitizens = filteredCitizens.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const fromRecord = filteredCitizens.length === 0 ? 0 : startIndex + 1;
  const toRecord = Math.min(startIndex + ITEMS_PER_PAGE, filteredCitizens.length);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      setDeleteLoading(true);
      await axios.delete(`${API_BASE}/api/admin/citizens/${deleteId}`, {
        headers: getTokenHeaders(),
      });

      const id = deleteId;
      const deletedCitizen = citizens.find((item) => item.user_id === id);

      setCitizens((prev) => prev.filter((item) => item.user_id !== id));
      setStats((prev) => ({
        ...prev,
        total: Math.max(prev.total - 1, 0),
        active:
          (deletedCitizen?.account_status || "active") === "active"
            ? Math.max(prev.active - 1, 0)
            : prev.active,
        locked:
          (deletedCitizen?.account_status || "active") !== "active"
            ? Math.max(prev.locked - 1, 0)
            : prev.locked,
        facebook: deletedCitizen?.provider === "facebook" ? Math.max(prev.facebook - 1, 0) : prev.facebook,
        totalSos: Math.max(prev.totalSos - toNumber(deletedCitizen?.total_sos), 0),
      }));

      setDeleteId(null);
      showToast("Xóa tài khoản dân cư thành công", "success");
      fetchData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Xóa tài khoản dân cư thất bại", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleId) return;

    try {
      setToggleLoading(true);
      const currentCitizen = citizens.find((item) => item.user_id === toggleId);
      const currentStatus = currentCitizen?.account_status || toggleCurrentStatus || "active";
      const targetStatus = toggleNextStatus || (currentStatus === "active" ? "inactive" : "active");

      const response = await axios.patch(
        `${API_BASE}/api/admin/citizens/${toggleId}/toggle`,
        { nextStatus: targetStatus },
        { headers: getTokenHeaders() }
      );

      const nextStatus = response?.data?.status || targetStatus;

      setCitizens((prev) =>
        prev.map((item) =>
          item.user_id === toggleId ? { ...item, account_status: nextStatus } : item
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
        locked:
          currentStatus === "active" && nextStatus !== "active"
            ? prev.locked + 1
            : currentStatus !== "active" && nextStatus === "active"
              ? Math.max(prev.locked - 1, 0)
              : prev.locked,
      }));

      setToggleId(null);
      setToggleCurrentStatus("");
      setToggleNextStatus("");

      showToast(
        nextStatus === "temporary_locked"
          ? "Đã khóa tạm thời tài khoản dân cư"
          : nextStatus === "inactive"
            ? "Đã khóa tài khoản dân cư"
            : "Đã mở lại tài khoản dân cư",
        "success"
      );

      fetchData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Cập nhật tài khoản thất bại", "error");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordCitizen?.user_id) return;

    try {
      setResetPasswordLoading(true);
      await axios.patch(
        `${API_BASE}/api/admin/citizens/${resetPasswordCitizen.user_id}/reset-password`,
        { newPassword },
        { headers: getTokenHeaders() }
      );

      showToast(
        `Đã đặt lại mật khẩu cho ${resetPasswordCitizen.full_name || "người dân"}`,
        "success"
      );

      setResetPasswordCitizen(null);
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Đặt lại mật khẩu thất bại", "error");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <NotificationToast toast={toast} onClose={handleCloseToast} />

      <CitizenDetailModal
        open={selectedCitizen !== null}
        citizen={selectedCitizen}
        onClose={() => setSelectedCitizen(null)}
        showToast={showToast}
      />

      <ResetPasswordModal
        open={resetPasswordCitizen !== null}
        citizen={resetPasswordCitizen}
        onClose={() => setResetPasswordCitizen(null)}
        onSubmit={handleResetPassword}
        submitting={resetPasswordLoading}
        showToast={showToast}
      />

      <ConfirmModal
        open={deleteId !== null}
        tone="red"
        title="Xác nhận xóa tài khoản"
        description="Tài khoản dân cư sẽ bị xóa khỏi hệ thống và không thể khôi phục."
        message="Bạn có chắc muốn xóa tài khoản dân cư này không? Nếu tài khoản đã từng gửi SOS, hệ thống nên giữ lại lịch sử cứu hộ để tránh mất dữ liệu."
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
            ? "Người dân sẽ bị hạn chế gửi yêu cầu SOS mới."
            : toggleNextStatus === "inactive"
              ? "Tài khoản dân cư sẽ bị khóa và không thể tiếp tục sử dụng hệ thống."
              : "Tài khoản dân cư sẽ được mở lại để tiếp tục sử dụng hệ thống."
        }
        message={
          toggleNextStatus === "temporary_locked"
            ? "Người dân vẫn có thể đăng nhập và xem lịch sử cũ, nhưng sẽ không thể gửi yêu cầu SOS mới cho đến khi được quản trị viên mở khóa."
            : toggleNextStatus === "inactive"
              ? "Người dân sẽ bị đăng xuất nếu đang sử dụng hệ thống và không thể đăng nhập lại cho đến khi tài khoản được mở khóa."
              : "Bạn có chắc muốn mở lại tài khoản dân cư này không?"
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
          setToggleCurrentStatus("");
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
                Trung tâm quản lý dân cư
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                QUẢN LÝ TÀI KHOẢN DÂN CƯ
              </h1>

              <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                Theo dõi thông tin người dân, trạng thái tài khoản và lịch sử gửi SOS.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Activity size={13} />
                  Cập nhật 5 giây/lần
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Users size={13} />
                  Quản lý tài khoản người dân
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => fetchData(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Làm mới
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Tổng tài khoản dân cư"
            value={String(stats.total ?? 0)}
            subText="Tất cả người dân"
            accent="blue"
            icon={<Users size={20} />}
          />
          <StatCard
            label="Tài khoản hoạt động"
            value={String(stats.active ?? 0)}
            subText="Được phép sử dụng"
            accent="emerald"
            icon={<ShieldCheck size={20} />}
          />
          <StatCard
            label="Tài khoản bị khóa"
            value={String(stats.locked ?? 0)}
            subText="Tạm khóa / khóa hẳn"
            accent="amber"
            icon={<Lock size={20} />}
          />
          <StatCard
            label="Tổng SOS đã gửi"
            value={String(stats.totalSos ?? 0)}
            subText="Theo lịch sử người dân"
            accent="rose"
            icon={<ClipboardList size={20} />}
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
                placeholder="Tìm kiếm tên, email, số điện thoại, địa chỉ, ID..."
                type="text"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[220px]" ref={accountStatusDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountStatusDropdown((prev) => !prev);
                    setShowProviderDropdown(false);
                  }}
                  className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                >
                  <span className="truncate">{getAccountFilterLabel(filterAccountStatus)}</span>
                  <ChevronRight
                    size={16}
                    className={cn(
                      "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                      showAccountStatusDropdown ? "rotate-[-90deg]" : "rotate-90"
                    )}
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
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                            active
                              ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative min-w-[220px]" ref={providerDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderDropdown((prev) => !prev);
                    setShowAccountStatusDropdown(false);
                  }}
                  className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-11 text-left text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                >
                  <span className="truncate">{getProviderFilterLabel(filterProvider)}</span>
                  <ChevronRight
                    size={16}
                    className={cn(
                      "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                      showProviderDropdown ? "rotate-[-90deg]" : "rotate-90"
                    )}
                  />
                </button>

                {showProviderDropdown && (
                  <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                    {[
                      { value: "all", label: "Tất cả phương thức" },
                      { value: "manual", label: "Tài khoản thường" },
                      { value: "facebook", label: "Facebook" },
                    ].map((option) => {
                      const active = filterProvider === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFilterProvider(option.value);
                            setShowProviderDropdown(false);
                          }}
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                            active
                              ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                title="Reset bộ lọc"
                onClick={() => {
                  setSearchText("");
                  setFilterAccountStatus("all");
                  setFilterProvider("all");
                  setShowAccountStatusDropdown(false);
                  setShowProviderDropdown(false);
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
                Danh sách tài khoản dân cư
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Không tạo tài khoản tại đây, chỉ quản lý tài khoản người dân đã đăng ký.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <Loader2 size={30} className="animate-spin mb-3" />
              <p className="font-medium">Đang tải danh sách tài khoản dân cư...</p>
            </div>
          ) : filteredCitizens.length === 0 ? (
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
              <div className="hidden lg:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[31%]" />
                    <col className="w-[22%]" />
                    <col className="w-[27%]" />
                    <col className="w-[17%]" />
                    <col className="w-[12%]" />
                  </colgroup>

                  <thead className="bg-slate-50 dark:bg-slate-950/60">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Người dân
                      </th>

                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Tài khoản
                      </th>

                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Khu vực
                      </th>

                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Ngày đăng ký
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Thao tác
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentCitizens.map((citizen) => (
                      <CitizenTableRow
                        key={citizen.user_id}
                        citizen={citizen}
                        onView={(data) => setSelectedCitizen(data)}
                        onResetPassword={(data) => setResetPasswordCitizen(data)}
                        onDelete={(id) => setDeleteId(id)}
                        onToggle={(id, currentStatus, nextStatus) => {
                          setToggleId(id);
                          setToggleCurrentStatus(currentStatus);
                          setToggleNextStatus(nextStatus);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
                {currentCitizens.map((citizen) => (
                  <CitizenMobileCard
                    key={citizen.user_id}
                    citizen={citizen}
                    onView={(data) => setSelectedCitizen(data)}
                    onResetPassword={(data) => setResetPasswordCitizen(data)}
                    onDelete={(id) => setDeleteId(id)}
                    onToggle={(id, currentStatus, nextStatus) => {
                      setToggleId(id);
                      setToggleCurrentStatus(currentStatus);
                      setToggleNextStatus(nextStatus);
                    }}
                  />
                ))}
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị <span className="font-semibold">{fromRecord}</span> -{" "}
                  <span className="font-semibold">{toRecord}</span> trong tổng số{" "}
                  <span className="font-semibold">{filteredCitizens.length}</span> bản ghi
                </p>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <PaginationButton
                    icon={<ChevronLeft size={16} />}
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  />

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, safeCurrentPage - 3), Math.max(0, safeCurrentPage - 3) + 5)
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
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
                Hệ thống hỗ trợ cứu hộ thiên tai, tiếp nhận SOS khẩn cấp và điều phối đội cứu hộ nhanh chóng, chính xác và an toàn.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Liên kết nhanh
              </h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a href="/homeadmin" className="flex items-center gap-2 transition hover:text-blue-600">
                    <Home className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a href="/map_admin" className="flex items-center gap-2 transition hover:text-blue-600">
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a href="/rescueteamadmin" className="flex items-center gap-2 transition hover:text-blue-600">
                    <Users2 className="h-4 w-4" />
                    Quản lý Đội cứu hộ
                  </a>
                </li>
                <li>
                  <a href="/requestsosadmin" className="flex items-center gap-2 transition hover:text-blue-600">
                    <ClipboardList className="h-4 w-4" />
                    Quản lý Dân cư
                  </a>
                </li>
                <li>
                  <a href="/analytics" className="flex items-center gap-2 transition hover:text-blue-600">
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
                  <AtSign className="h-4 w-4 text-emerald-500" />
                  Người dân tự đăng ký hoặc đăng nhập mạng xã hội
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

export default RequestSOS_Admin;

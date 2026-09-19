import React, { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import {
  Phone,
  Navigation,
  BarChart3,
  ClipboardList,
  Home,
  Siren,
  MapPin,
  ListTodo,
  Waves,
  Camera,
  AlertTriangle,
  ShieldCheck,
  Activity,
  User,
  Clock3,
  Image as ImageIcon,
  FileText,
  Send,
  Search,
  ArrowUpDown,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TaskProps {
  id: string;
  title: string;
  phone?: string;
  location: string;
  people?: string;
  note?: string;
  lat?: number;
  lng?: number;
  source_url?: string;
  received_at?: string;
  created_at?: string;
  images?: string[];
  timeAgo: string;
  status?: string;
  icon: React.ReactNode;
  iconBg: string;
  sos_type?: string;
}

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
};

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

const getBorderColor = (type?: string) => {
  switch (type) {
    case "rescue":
      return "border-red-600";
    case "supplies":
      return "border-orange-500";
    case "vehicle":
      return "border-blue-500";
    case "other":
      return "border-gray-400";
    default:
      return "border-red-600";
  }
};

const getSosLabel = (type?: string) => {
  switch (type) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    case "other":
      return "Yêu cầu khác";
    default:
      return "Khẩn cấp";
  }
};

const getBadgeColor = (type?: string) => {
  switch (type) {
    case "rescue":
      return "bg-red-600";
    case "supplies":
      return "bg-orange-500";
    case "vehicle":
      return "bg-blue-500";
    case "other":
      return "bg-gray-500";
    default:
      return "bg-red-600";
  }
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "--";

  const d = new Date(dateStr);

  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = d.toLocaleDateString("vi-VN");

  return `${time} ${date}`;
};

const formatDateOnly = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN");
};

const formatRangeDisplay = (start?: string, end?: string) => {
  if (!start && !end) return "Chọn khoảng ngày";
  if (start && !end) return `${formatDateOnly(start)} → Chọn ngày cuối`;
  if (!start && end) return `Chọn ngày đầu → ${formatDateOnly(end)}`;
  return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
};

const getSosTypeFilterLabel = (value: string) => {
  switch (value) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    case "other":
      return "Yêu cầu khác";
    default:
      return "Tất cả loại yêu cầu";
  }
};

const openPhoneCall = (phone?: string) => {
  if (!phone) return;
  window.location.href = `tel:${phone}`;
};

const hasValidCoordinates = (lat?: number, lng?: number) => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
};

const hasDirectionInfo = (task?: TaskProps | null) => {
  if (!task) return false;

  return (
    hasValidCoordinates(task.lat, task.lng) ||
    Boolean(task.location?.trim())
  );
};

const PaginationButton = ({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "min-w-9 h-9 px-3 flex items-center justify-center rounded-xl border text-sm font-semibold transition",
      active
        ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
      disabled &&
      "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-slate-900"
    )}
  >
    {label || icon}
  </button>
);

const toastMeta = {
  success: {
    title: "Thành công",
    icon: CheckCircle2,
    border: "border-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-600",
    line: "bg-emerald-500",
  },
  error: {
    title: "Có lỗi xảy ra",
    icon: XCircle,
    border: "border-red-200",
    iconWrap: "bg-red-100 text-red-600",
    line: "bg-red-500",
  },
  warning: {
    title: "Cảnh báo",
    icon: AlertTriangle,
    border: "border-amber-200",
    iconWrap: "bg-amber-100 text-amber-600",
    line: "bg-amber-500",
  },
  info: {
    title: "Thông báo",
    icon: Info,
    border: "border-blue-200",
    iconWrap: "bg-blue-100 text-blue-600",
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

  if (!mounted) return null;

  const meta = toastMeta[toast.type];
  const Icon = meta.icon;

  return (
    <>
      <style>
        {`
          @keyframes toastIn {
            0% {
              opacity: 0;
              transform: translateY(-22px) scale(0.96);
            }
            60% {
              opacity: 1;
              transform: translateY(4px) scale(1.01);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes toastOut {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-18px) scale(0.98);
            }
          }

          @keyframes toastProgressShrink {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }
        `}
      </style>

      <div className="fixed top-5 inset-x-0 z-[9000] flex justify-center px-3 pointer-events-none">
        <div
          className={`pointer-events-auto inline-block w-fit max-w-[85vw] min-w-[300px] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur ${meta.border}`}
          style={{
            animation: `${showAnim ? "toastIn" : "toastOut"} 0.28s ease forwards`,
          }}
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <div
              className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.iconWrap}`}
            >
              <Icon size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800">{meta.title}</div>
              <p className="mt-0.5 text-sm text-slate-600 break-words">
                {toast.message}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                Tự đóng sau {Math.ceil(toast.duration / 1000)} giây
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="h-1 w-full bg-slate-100 overflow-hidden">
            <div
              className={meta.line}
              style={{
                width: "100%",
                height: "100%",
                transformOrigin: "left",
                animationName: "toastProgressShrink",
                animationDuration: `${toast.duration}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

type ConfirmActionTone = "blue" | "amber" | "emerald" | "red" | "slate";

const ConfirmActionModal = ({
  open,
  tone = "slate",
  title,
  description,
  message,
  confirmText,
  loadingText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
  children,
}: {
  open: boolean;
  tone?: ConfirmActionTone;
  title: string;
  description?: string;
  message: string;
  confirmText: string;
  loadingText?: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}) => {
  if (!open) return null;

  const toneMap: Record<
    ConfirmActionTone,
    {
      box: string;
      icon: string;
      button: string;
    }
  > = {
    blue: {
      box: "border-blue-200 bg-blue-50",
      icon: "text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    amber: {
      box: "border-amber-200 bg-amber-50",
      icon: "text-amber-600",
      button: "bg-amber-500 hover:bg-amber-600",
    },
    emerald: {
      box: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700",
    },
    red: {
      box: "border-red-200 bg-red-50",
      icon: "text-red-600",
      button: "bg-red-600 hover:bg-red-700",
    },
    slate: {
      box: "border-amber-200 bg-amber-50",
      icon: "text-amber-600",
      button: "bg-[#0F172A] hover:bg-slate-800",
    },
  };

  const activeTone = toneMap[tone];
  const MessageIcon =
    tone === "emerald" ? CheckCircle2 : tone === "blue" ? Send : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-6 text-slate-200">
              {description}
            </p>
          )}
        </div>

        <div className="px-6 py-5">
          {children && <div className="mb-4">{children}</div>}

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              activeTone.box
            )}
          >
            <MessageIcon
              size={18}
              className={cn("mt-0.5 shrink-0", activeTone.icon)}
            />
            <p className="text-sm leading-6 text-slate-700">{message}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-70",
                activeTone.button
              )}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? loadingText || confirmText : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RescueHome_Rescue: React.FC = () => {
  const [tasks, setTasks] = useState<TaskProps[]>([]);
  const [currentTask, setCurrentTask] = useState<TaskProps | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [confirmQuickReport, setConfirmQuickReport] = useState(false);
  const [submittingQuickReport, setSubmittingQuickReport] = useState(false);

  const [reportNote, setReportNote] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);

  const itemsPerPage = 6;
  const [currentPage, setCurrentPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sosTypeFilter, setSosTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [datePickerStep, setDatePickerStep] = useState<"start" | "end">("start");
  const [showSosTypeDropdown, setShowSosTypeDropdown] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

  const dateRangePickerRef = useRef<HTMLDivElement | null>(null);
  const sosTypeDropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration: number = 3000
  ) => {
    setToast({
      id: Date.now(),
      show: true,
      message,
      type,
      duration,
    });
  };

  const closeToast = () => {
    setToast((prev) => ({
      ...prev,
      show: false,
    }));
  };

  const openDirections = (task: TaskProps) => {
    const lat = Number(task.lat);
    const lng = Number(task.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        "_blank"
      );
      return;
    }

    const location = task.location?.trim();

    if (location) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          location
        )}`,
        "_blank"
      );
      return;
    }

    showToast("Không có thông tin vị trí để chỉ đường.", "error");
  };

  useEffect(() => {
    if (!toast.show) return;

    const timer = setTimeout(() => {
      closeToast();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration]);

  const getTrackedMarkerStyle = (type?: string, status?: string) => {
    const isRescuing = status === "rescuing";

    switch (type) {
      case "rescue":
        return {
          icon: "!",
          bgClass: isRescuing
            ? "bg-red-500 text-white ring-4 ring-blue-500/30"
            : "bg-red-500 text-white",
        };

      case "supplies":
        return {
          icon: "📦",
          bgClass: isRescuing
            ? "bg-amber-500 text-white ring-4 ring-blue-500/30"
            : "bg-amber-500 text-white",
        };

      case "vehicle":
        return {
          icon: "🚗",
          bgClass: isRescuing
            ? "bg-blue-500 text-white ring-4 ring-blue-500/30"
            : "bg-blue-500 text-white",
        };

      default:
        return {
          icon: "?",
          bgClass: isRescuing
            ? "bg-slate-500 text-white ring-4 ring-blue-500/30"
            : "bg-slate-500 text-white",
        };
    }
  };

  const updateRescueStatus = async (
    id: string,
    nextStatus: "new" | "rescuing" | "done"
  ) => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`http://localhost:3000/api/rescues/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Lỗi", "error");
        return;
      }

      setTasks((prev) =>
        prev
          .map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
          .filter((t) => t.status !== "done")
      );

      if (nextStatus === "done") {
        setCurrentTask(null);
        showToast("Đã hoàn thành yêu cầu cứu hộ.", "success");
      } else if (nextStatus === "new") {
        setCurrentTask((prev) =>
          prev?.id === id ? { ...prev, status: nextStatus } : prev
        );
        showToast("Đã hủy nhận yêu cầu.", "success");
      } else {
        setCurrentTask((prev) =>
          prev?.id === id ? { ...prev, status: nextStatus } : prev
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi server", "error");
    }
  };

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:3000/api/rescuer/tasks", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("API lỗi:", data);
        return;
      }

      if (!Array.isArray(data)) {
        console.error("Data không phải array:", data);
        return;
      }

      const mapped = data
        .filter((item: any) => item.status !== "done")
        .map((item: any) => {
          const marker = getTrackedMarkerStyle(item.sos_type, item.status);

          return {
            id: String(item.id),
            title: item.title,
            phone: item.phone,
            location: item.location,
            people: item.people,
            note: item.note,
            lat: item.lat,
            lng: item.lng,
            source_url: item.source_url,
            received_at: item.received_at,
            created_at: item.created_at || item.received_at,
            images: item.images || [],
            timeAgo: item.timeAgo || "Vừa xong",
            status: item.status,
            sos_type: item.sos_type,
            icon: marker.icon,
            iconBg: marker.bgClass,
          };
        });

      setTasks(mapped);

      setCurrentTask((prev) => {
        if (!prev) return mapped[0] || null;

        const updated = mapped.find((t) => t.id === prev.id);
        return updated || mapped[0] || null;
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();

    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleReportFilesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    setReportFiles(files);
  };

  const handleOpenQuickReportConfirm = () => {
    if (!currentTask) return;

    const trimmedNote = reportNote.trim();

    if (!trimmedNote && reportFiles.length === 0) {
      showToast(
        "Vui lòng nhập ghi chú hoặc chọn ít nhất 1 ảnh trước khi gửi báo cáo.",
        "warning"
      );
      return;
    }

    setConfirmQuickReport(true);
  };

  const handleSubmitQuickReport = async () => {
    if (!currentTask) return;

    const trimmedNote = reportNote.trim();

    if (!trimmedNote && reportFiles.length === 0) {
      showToast(
        "Vui lòng nhập ghi chú hoặc chọn ít nhất 1 ảnh trước khi gửi báo cáo.",
        "warning"
      );
      return;
    }

    try {
      setSubmittingQuickReport(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setConfirmQuickReport(false);
        showToast("Bạn chưa đăng nhập", "error");
        return;
      }

      const formData = new FormData();
      formData.append("note", trimmedNote);

      reportFiles.forEach((file) => {
        formData.append("images", file);
      });

      const res = await fetch(
        `http://localhost:3000/api/rescues/${currentTask.id}/quick-report`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setConfirmQuickReport(false);
        showToast(
          data.message || "Không gửi được báo cáo nhanh",
          "error"
        );
        return;
      }

      setConfirmQuickReport(false);
      setReportNote("");
      setReportFiles([]);

      showToast(
        data.message || `Đã gửi báo cáo nhanh cho yêu cầu #${currentTask.id}`,
        "success"
      );
    } catch (err) {
      console.error(err);
      setConfirmQuickReport(false);
      showToast("Lỗi server", "error");
    } finally {
      setSubmittingQuickReport(false);
    }
  };

  const otherTasks = useMemo(
    () => tasks.filter((task) => task.id !== currentTask?.id),
    [tasks, currentTask]
  );

  const openDateRangePicker = () => {
    setShowSosTypeDropdown(false);

    setShowDateRangePicker((prev) => {
      if (prev) return false;
      setDatePickerStep(dateRange.start ? "end" : "start");
      return true;
    });
  };

  const clearDateRange = () => {
    setDateRange({ start: "", end: "" });
    setDatePickerStep("start");
  };

  const handleSelectRangeDate = (value: string) => {
    if (!value) return;

    if (datePickerStep === "start") {
      setDateRange({ start: value, end: "" });
      setDatePickerStep("end");
      return;
    }

    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = new Date(value);

    if (startDate && endDate < startDate) {
      setDateRange({ start: value, end: dateRange.start });
    } else {
      setDateRange((prev) => ({ ...prev, end: value }));
    }

    setShowDateRangePicker(false);
    setDatePickerStep("start");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showDateRangePicker &&
        dateRangePickerRef.current &&
        !dateRangePickerRef.current.contains(target)
      ) {
        setShowDateRangePicker(false);
        setDatePickerStep("start");
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
  }, [showDateRangePicker, showSosTypeDropdown]);

  const baseFilteredOtherTasks = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return otherTasks.filter((item) => {
      if (sosTypeFilter !== "all" && item.sos_type !== sosTypeFilter) {
        return false;
      }

      if (dateRange.start || dateRange.end) {
        const rawDate = item.created_at || item.received_at;
        if (!rawDate) return false;

        const created = new Date(rawDate);
        if (Number.isNaN(created.getTime())) return false;

        if (dateRange.start) {
          const start = new Date(dateRange.start);
          start.setHours(0, 0, 0, 0);
          if (created < start) return false;
        }

        if (dateRange.end) {
          const end = new Date(dateRange.end);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      }

      if (keyword) {
        const searchBlob = [
          `#SOS-${item.id}`,
          String(item.id),
          item.title,
          item.phone,
          item.location,
          item.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchBlob.includes(keyword)) return false;
      }

      return true;
    });
  }, [otherTasks, searchTerm, sosTypeFilter, dateRange]);

  const filteredOtherTasks = useMemo(() => {
    const list = [...baseFilteredOtherTasks];

    list.sort((a, b) => {
      const aTime = a.created_at
        ? new Date(a.created_at).getTime()
        : a.received_at
          ? new Date(a.received_at).getTime()
          : Number(a.id);

      const bTime = b.created_at
        ? new Date(b.created_at).getTime()
        : b.received_at
          ? new Date(b.received_at).getTime()
          : Number(b.id);

      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [baseFilteredOtherTasks, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    sortOrder,
    sosTypeFilter,
    dateRange.start,
    dateRange.end,
    currentTask?.id,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOtherTasks.length / itemsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentOtherTasks = filteredOtherTasks.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const fromRecord = filteredOtherTasks.length === 0 ? 0 : startIndex + 1;
  const toRecord =
    filteredOtherTasks.length === 0
      ? 0
      : Math.min(startIndex + itemsPerPage, filteredOtherTasks.length);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 ||
      page === totalPages ||
      Math.abs(page - safeCurrentPage) <= 1
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <NotificationToast key={toast.id} toast={toast} onClose={closeToast} />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <div className="max-w-8xl mx-auto space-y-6">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_24%)]" />

            <div className="relative px-5 md:px-6 py-6 md:py-7 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                  <Activity size={14} />
                  Trung tâm điều phối cứu hộ
                </div>

                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  NHIỆM VỤ CỨU HỘ ĐANG TRIỂN KHAI
                </h1>

                <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                  Theo dõi nhiệm vụ hiện tại, cập nhật hiện trường và hoàn tất cứu hộ
                  theo từng yêu cầu.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                    <ClipboardList size={13} />
                    Tổng nhiệm vụ: {tasks.length}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                    <Siren size={13} />
                    Đang xử lý: {currentTask ? `#SOS-${currentTask.id}` : "Chưa có"}
                  </span>
                </div>
              </div>

              <div className="w-full lg:w-auto">
                <div className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-slate-100">
                  <Navigation size={16} />
                  Sẵn sàng điều phối
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Waves size={18} className="text-slate-500" />
                    NHIỆM VỤ HIỆN TẠI
                  </h3>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Thông tin chi tiết và cập nhật hiện trường của nhiệm vụ đang xử lý
                  </p>
                </div>

                {currentTask?.received_at && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock3 size={14} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatDateTime(currentTask.received_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-5">
              <AnimatePresence mode="wait">
                {currentTask ? (
                  <motion.section
                    key={currentTask.id}
                    layoutId={`task-${currentTask.id}`}
                    initial={{ opacity: 0, y: -12, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.985 }}
                    transition={{ duration: 0.25 }}
                    className={`rounded-[22px] border border-slate-200 dark:border-slate-800 border-l-[6px] ${getBorderColor(
                      currentTask?.sos_type
                    )} bg-white dark:bg-slate-900 shadow-sm overflow-hidden`}
                  >
                    <div className="p-4 md:p-5 space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className={`px-2.5 py-1 text-white text-[10px] font-black rounded-full uppercase ${getBadgeColor(
                                currentTask?.sos_type
                              )}`}
                            >
                              {getSosLabel(currentTask?.sos_type)}
                            </span>

                            <span className="text-[11px] font-bold text-slate-400 uppercase">
                              MÃ yêu cầu: #SOS-{currentTask?.id}
                            </span>
                          </div>

                          <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-snug">
                            “{currentTask?.note || "Không có mô tả"}”
                          </h2>

                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                            Số người cần hỗ trợ:{" "}
                            <span className="font-bold text-slate-900 dark:text-white">
                              {currentTask?.people || "--"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
                          <div className="flex items-start gap-3">
                            <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                Họ và tên
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                                {currentTask?.title || "--"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <Phone size={16} className="text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                  Số điện thoại
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                  {currentTask?.phone || "--"}
                                </p>
                              </div>
                            </div>

                            {currentTask?.phone && (
                              <button
                                onClick={() => openPhoneCall(currentTask.phone)}
                                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
                              >
                                <Phone size={12} />
                                Gọi
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                  Vị trí cứu hộ
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 leading-5 break-words">
                                  {currentTask?.location || "--"}
                                </p>
                                {currentTask?.lat ? (
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    {currentTask.lat}, {currentTask.lng}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {hasDirectionInfo(currentTask) && currentTask && (
                              <button
                                onClick={() => openDirections(currentTask)}
                                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
                              >
                                <Navigation size={12} />
                                Chỉ đường
                              </button>
                            )}
                          </div>
                        </div>

                        {currentTask?.source_url && (
                          <div className="lg:col-span-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
                            <div className="flex items-start gap-3">
                              <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                  Link nguồn
                                </p>
                                <a
                                  href={currentTask.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-sm text-blue-600 underline break-all hover:text-blue-800"
                                >
                                  {currentTask.source_url}
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                        {(currentTask?.images ?? []).length > 0 && (
                          <div className="xl:col-span-4 rounded-[20px] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 self-start">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon size={16} className="text-slate-400" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                Hình ảnh hiện trường ban đầu
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {(currentTask?.images ?? []).slice(0, 4).map((img, i) => (
                                <img
                                  key={i}
                                  src={`http://localhost:3000${img}`}
                                  onClick={() =>
                                    setPreviewImage(`http://localhost:3000${img}`)
                                  }
                                  className="w-full h-24 md:h-28 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-[1.02] transition"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div
                          className={`rounded-[20px] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 overflow-hidden self-start ${(currentTask?.images ?? []).length > 0
                            ? "xl:col-span-8"
                            : "xl:col-span-12"
                            }`}
                        >
                          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Camera size={16} className="text-slate-500" />
                                Báo cáo hiện trường
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Cập nhật cho yêu cầu #{currentTask.id}
                              </p>
                            </div>

                            <div className="hidden sm:block text-[11px] font-semibold text-slate-400">
                              Nhanh gọn
                            </div>
                          </div>

                          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                                Ảnh cập nhật
                              </label>

                              <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <Camera size={22} className="text-slate-300 mb-2" />
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                  Tải ảnh cập nhật
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  Chọn 1 hoặc nhiều ảnh
                                </p>

                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleReportFilesChange}
                                  className="hidden"
                                />
                              </label>

                              {reportFiles.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {reportFiles.map((file, idx) => (
                                    <div
                                      key={`${file.name}-${idx}`}
                                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300"
                                    >
                                      {file.name}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                                Ghi chú cập nhật
                              </label>

                              <textarea
                                value={reportNote}
                                onChange={(e) => setReportNote(e.target.value)}
                                className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 outline-none resize-none text-sm focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Ví dụ: Đã tiếp cận hiện trường, đã hỗ trợ 4 người, cần thêm nước uống..."
                              />
                            </div>
                          </div>

                          <div className="px-4 pb-4 flex justify-end">
                            <button
                              type="button"
                              onClick={handleOpenQuickReportConfirm}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition"
                            >
                              <Send size={15} />
                              Gửi báo cáo
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        {currentTask?.status === "rescuing" && (
                          <button
                            onClick={() => setConfirmCancel(true)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold shadow-sm transition"
                          >
                            Hủy nhận yêu cầu
                          </button>
                        )}

                        {currentTask?.status === "rescuing" && (
                          <button
                            onClick={() => setConfirmDone(true)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition"
                          >
                            Hoàn thành
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.section>
                ) : (
                  <section className="rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center">
                    <Waves size={36} className="text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                      Chưa có nhiệm vụ nào
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Hiện tại bạn chưa được phân công nhiệm vụ cứu hộ
                    </p>
                  </section>
                )}
              </AnimatePresence>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-visible">
            <div className="px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ListTodo size={18} className="text-slate-500" />
                      DANH SÁCH ĐANG NHẬN
                    </h3>

                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Các nhiệm vụ khác đã được phân công cho đội cứu hộ
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 self-start md:self-auto">
                    <span className="inline-flex items-center rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs font-bold uppercase text-white">
                      {filteredOtherTasks.length} nhiệm vụ
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 items-center">
                  <div className="relative">
                    <Search
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm theo mã SOS, tên người dân, số điện thoại, địa chỉ..."
                      className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_1fr_1fr_auto] gap-3 items-center">
                  <button
                    type="button"
                    onClick={() =>
                      setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
                    }
                    className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ArrowUpDown size={16} />
                    {sortOrder === "newest" ? "Mới nhất trước" : "Cũ nhất trước"}
                  </button>

                  <div className="relative" ref={sosTypeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSosTypeDropdown((prev) => !prev);
                        setShowDateRangePicker(false);
                      }}
                      className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-11 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                    >
                      <span className="truncate">
                        {getSosTypeFilterLabel(sosTypeFilter)}
                      </span>
                      <ChevronRight
                        size={16}
                        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showSosTypeDropdown ? "rotate-[-90deg]" : "rotate-90"
                          }`}
                      />
                    </button>

                    {showSosTypeDropdown && (
                      <div className="absolute z-40 mt-2 w-full min-w-[260px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
                        {[
                          { value: "all", label: "Tất cả loại yêu cầu" },
                          { value: "rescue", label: "Cần cứu hộ khẩn cấp" },
                          { value: "supplies", label: "Cần nhu yếu phẩm" },
                          { value: "vehicle", label: "Cần cứu hộ xe" },
                          { value: "other", label: "Yêu cầu khác" },
                        ].map((option) => {
                          const active = sosTypeFilter === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setSosTypeFilter(option.value);
                                setShowSosTypeDropdown(false);
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

                  <div className="relative" ref={dateRangePickerRef}>
                    <button
                      type="button"
                      onClick={openDateRangePicker}
                      className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-11 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center"
                    >
                      <span className="truncate">
                        {formatRangeDisplay(dateRange.start, dateRange.end)}
                      </span>
                      <ChevronRight
                        size={16}
                        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showDateRangePicker ? "rotate-[-90deg]" : "rotate-90"
                          }`}
                      />
                    </button>

                    {showDateRangePicker && (
                      <div className="absolute z-40 mt-2 w-full min-w-[290px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Lọc theo khoảng ngày
                          </p>
                          <h4 className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                            {datePickerStep === "start"
                              ? "Chọn ngày bắt đầu"
                              : "Chọn ngày kết thúc"}
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {datePickerStep === "start"
                              ? "Bước 1/2: Chọn ngày đầu"
                              : `Bước 2/2: Từ ${formatDateOnly(
                                dateRange.start
                              )}, chọn ngày cuối`}
                          </p>
                        </div>

                        <div className="mt-4">
                          <input
                            type="date"
                            value={
                              datePickerStep === "start"
                                ? dateRange.start
                                : dateRange.end
                            }
                            min={
                              datePickerStep === "end" && dateRange.start
                                ? dateRange.start
                                : undefined
                            }
                            onChange={(e) => handleSelectRangeDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-slate-400">
                              Ngày đầu:
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                              {dateRange.start
                                ? formatDateOnly(dateRange.start)
                                : "Chưa chọn"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-slate-400">
                              Ngày cuối:
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                              {dateRange.end
                                ? formatDateOnly(dateRange.end)
                                : "Chưa chọn"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                          {datePickerStep === "end" && (
                            <button
                              type="button"
                              onClick={clearDateRange}
                              className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              Chọn lại ngày
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSortOrder("newest");
                      setSosTypeFilter("all");
                      setDateRange({ start: "", end: "" });
                      setShowDateRangePicker(false);
                      setShowSosTypeDropdown(false);
                      setDatePickerStep("start");
                    }}
                    className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <RotateCcw size={16} />
                    Đặt lại
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5">
              <motion.div layout className="space-y-3">
                {currentOtherTasks.length > 0 ? (
                  currentOtherTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      {...task}
                      onClick={() => {
                        setCurrentTask(task);
                        setReportNote("");
                        setReportFiles([]);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center bg-slate-50/50 dark:bg-slate-800/20">
                    <ListTodo size={26} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Không có nhiệm vụ phù hợp
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc
                    </p>
                  </div>
                )}
              </motion.div>

              <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị <span className="font-semibold">{fromRecord}</span> -{" "}
                  <span className="font-semibold">{toRecord}</span> trên tổng số{" "}
                  <span className="font-semibold">{filteredOtherTasks.length}</span>{" "}
                  nhiệm vụ
                </div>

                {filteredOtherTasks.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <PaginationButton
                      icon={<ChevronLeft size={16} />}
                      disabled={safeCurrentPage === 1}
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                    />

                    {pageNumbers.map((page, index) => {
                      const prevPage = pageNumbers[index - 1];
                      const showDots = prevPage && page - prevPage > 1;

                      return (
                        <React.Fragment key={page}>
                          {showDots && (
                            <span className="px-1 text-slate-400 text-sm">...</span>
                          )}
                          <PaginationButton
                            label={String(page)}
                            active={page === safeCurrentPage}
                            onClick={() => setCurrentPage(page)}
                          />
                        </React.Fragment>
                      );
                    })}

                    <PaginationButton
                      icon={<ChevronRight size={16} />}
                      disabled={safeCurrentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <ConfirmActionModal
        open={confirmQuickReport && !!currentTask}
        tone="blue"
        title="Xác nhận gửi báo cáo"
        description="Báo cáo này sẽ được gửi lên hệ thống và lưu vào nhiệm vụ hiện tại."
        message="Bạn có chắc muốn gửi báo cáo hiện trường này không?"
        confirmText="Xác nhận gửi"
        loadingText="Đang gửi..."
        cancelText="Đóng"
        loading={submittingQuickReport}
        onCancel={() => {
          if (!submittingQuickReport) setConfirmQuickReport(false);
        }}
        onConfirm={handleSubmitQuickReport}
      >
        {currentTask && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-3">
            <div>
              <span className="text-slate-500">Mã SOS: </span>
              <span className="font-bold text-slate-900">#SOS-{currentTask.id}</span>
            </div>

            <div>
              <span className="text-slate-500">Ghi chú: </span>
              <span className="font-bold text-slate-900 break-words">
                {reportNote.trim() || "Không có ghi chú"}
              </span>
            </div>

            <div>
              <span className="text-slate-500">Số ảnh cập nhật: </span>
              <span className="font-bold text-slate-900">
                {reportFiles.length} ảnh
              </span>
            </div>
          </div>
        )}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={confirmCancel && !!currentTask}
        tone="amber"
        title="Xác nhận hủy nhận yêu cầu"
        description="Yêu cầu này sẽ được chuyển lại trạng thái chờ cứu hộ."
        message="Bạn có chắc muốn hủy nhận yêu cầu cứu hộ này không?"
        confirmText="Xác nhận hủy"
        cancelText="Đóng"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          if (!currentTask) return;
          updateRescueStatus(currentTask.id, "new");
          setConfirmCancel(false);
        }}
      >
        {currentTask && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
            <div>
              <span className="text-slate-500">Mã SOS: </span>
              <span className="font-bold text-slate-900">#SOS-{currentTask.id}</span>
            </div>

            <div>
              <span className="text-slate-500">Người cần hỗ trợ: </span>
              <span className="font-bold text-slate-900">
                {currentTask.title || "Không có"}
              </span>
            </div>

            <div>
              <span className="text-slate-500">Địa chỉ: </span>
              <span className="font-bold text-slate-900">
                {currentTask.location || "Không có"}
              </span>
            </div>
          </div>
        )}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={confirmDone && !!currentTask}
        tone="emerald"
        title="Xác nhận hoàn thành"
        description="Yêu cầu này sẽ được đánh dấu là đã hoàn thành."
        message="Bạn có chắc muốn hoàn thành yêu cầu cứu hộ này không?"
        confirmText="Xác nhận hoàn thành"
        cancelText="Đóng"
        onCancel={() => setConfirmDone(false)}
        onConfirm={() => {
          if (!currentTask) return;
          updateRescueStatus(currentTask.id, "done");
          setConfirmDone(false);
        }}
      >
        {currentTask && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
            <div>
              <span className="text-slate-500">Mã SOS: </span>
              <span className="font-bold text-slate-900">#SOS-{currentTask.id}</span>
            </div>

            <div>
              <span className="text-slate-500">Người cần hỗ trợ: </span>
              <span className="font-bold text-slate-900">
                {currentTask.title || "Không có"}
              </span>
            </div>

            <div>
              <span className="text-slate-500">Địa chỉ: </span>
              <span className="font-bold text-slate-900">
                {currentTask.location || "Không có"}
              </span>
            </div>
          </div>
        )}
      </ConfirmActionModal>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            className="max-w-[90%] max-h-[90%] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
                    href="/home"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Home className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map_rescue"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteamrescue"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Siren className="h-4 w-4" />
                    Đang cứu hộ
                  </a>
                </li>
                <li>
                  <a
                    href="/analyticsrescue"
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

const TaskItem: React.FC<TaskProps & { onClick: () => void }> = ({
  id,
  title,
  location,
  icon,
  iconBg,
  phone,
  status,
  timeAgo,
  sos_type,
  received_at,
  onClick,
}) => (
  <motion.div
    layoutId={`task-${id}`}
    onClick={onClick}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    className="rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden cursor-pointer transition"
  >
    <div className="px-4 md:px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`size-12 shrink-0 ${iconBg} rounded-2xl flex items-center justify-center shadow-sm`}
        >
          <span className="text-[18px] font-extrabold leading-none tracking-tight">
            {icon}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
              MÃ SOS: #{id} - {title} {phone ? `- ${phone}` : ""}
            </h4>

            {sos_type && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full text-white uppercase ${getBadgeColor(
                  sos_type
                )}`}
              >
                {getSosLabel(sos_type)}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
            {location}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            {status && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
                {status === "rescuing"
                  ? "Đang cứu hộ"
                  : status === "new"
                    ? "Đang chờ"
                    : status}
              </span>
            )}

            <span className="text-slate-400">{timeAgo}</span>

            {received_at && (
              <span className="text-slate-400">
                • {formatDateTime(received_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      <button className="shrink-0 px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all">
        Chi tiết
      </button>
    </div>
  </motion.div>
);

export default RescueHome_Rescue;
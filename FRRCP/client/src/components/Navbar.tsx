import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  Settings,
  Bell,
  CheckCheck,
  AlertCircle,
  Info,
  CheckCircle2,
  TriangleAlert,
  X,
  MapPin,
} from "lucide-react";
import { useAuthModal } from "../contexts/AuthModalContext";
import axios from "axios";
import { getNotificationsStreamUrl } from "../services/api";
import {
  clearAuthStorage,
  forceLogout,
  logoutIfTokenExpired,
} from "../utils/auth";

type NotificationItem = {
  id: number;
  event_type: string;
  severity: "info" | "warning" | "success" | "critical" | string;
  title: string;
  description: string;
  actor_user_id: number | null;
  actor_name: string;
  actor_role: string;
  rescue_id: number | null;
  recipient_role: string | null;
  recipient_user_id: number | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

type RescueSuggestionToastState = {
  id: number;
  show: boolean;
  title: string;
  message: string;
  rescueId?: number;
  distanceText?: string;
  etaText?: string;
  address?: string;
  sosType?: string;
  victims?: number;
  note?: string;
} | null;

type RescueSuggestionSnoozeMap = Record<
  number,
  {
    dismissedAt?: number;
    snoozeUntil?: number;
    lastShownAt?: number;
  }
>;

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
};
const TOAST_DURATION = 3000;

const SUGGESTION_SNOOZE_MINUTES = 5;
const SUGGESTION_STATE_TTL_MS = 24 * 60 * 60 * 1000;

const getSosTypeLabel = (value?: string) => {
  const type = String(value || "").toLowerCase();

  switch (type) {
    case "rescue":
      return "Cứu hộ khẩn cấp";
    case "supplies":
      return "Nhu yếu phẩm";
    case "vehicle":
      return "Cứu hộ xe";
    default:
      return "Yêu cầu khác";
  }
};

const getSuggestionStorageKey = (userId?: string | null) =>
  `rescuer_suggestion_state_${userId || "guest"}`;

const getSuggestionSnoozeMap = (): RescueSuggestionSnoozeMap => {
  try {
    const userId = localStorage.getItem("userId");
    const raw = localStorage.getItem(getSuggestionStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveSuggestionSnoozeMap = (data: RescueSuggestionSnoozeMap) => {
  const userId = localStorage.getItem("userId");
  localStorage.setItem(getSuggestionStorageKey(userId), JSON.stringify(data));
};

const getSuggestionState = (rescueId?: number) => {
  if (!rescueId) return null;
  const map = getSuggestionSnoozeMap();
  return map[rescueId] || null;
};

const markSuggestionShown = (rescueId: number) => {
  const now = Date.now();
  const map = getSuggestionSnoozeMap();

  map[rescueId] = {
    ...map[rescueId],
    lastShownAt: now,
  };

  saveSuggestionSnoozeMap(map);
};

const snoozeSuggestion = (rescueId: number, minutes = SUGGESTION_SNOOZE_MINUTES) => {
  const now = Date.now();
  const map = getSuggestionSnoozeMap();

  map[rescueId] = {
    ...map[rescueId],
    dismissedAt: now,
    snoozeUntil: now + minutes * 60 * 1000,
  };

  saveSuggestionSnoozeMap(map);
};

const clearSuggestionState = (rescueId: number) => {
  const map = getSuggestionSnoozeMap();
  delete map[rescueId];
  saveSuggestionSnoozeMap(map);
};

const canShowSuggestion = (rescueId?: number) => {
  if (!rescueId) return false;

  const state = getSuggestionState(rescueId);
  if (!state) return true;

  const now = Date.now();
  if (state.snoozeUntil && now < state.snoozeUntil) {
    return false;
  }

  return true;
};

const isSuggestionRescueStillActive = async (rescueId?: number) => {
  if (!rescueId) return false;

  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    const res = await axios.get(`http://localhost:3000/api/rescues/${rescueId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const rescue = res.data;
    const status = String(rescue?.status || "").toLowerCase();
    const handledBy =
      rescue?.handled_by === null || rescue?.handled_by === undefined
        ? null
        : Number(rescue.handled_by);

    return status === "new" && handledBy === null;
  } catch (error) {
    console.log("Check rescue suggestion active failed:", error);
    return false;
  }
};

const cleanupSuggestionState = (activeRescueIds?: number[]) => {
  const map = getSuggestionSnoozeMap();
  const now = Date.now();
  const activeSet = Array.isArray(activeRescueIds)
    ? new Set(activeRescueIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))
    : null;

  const next: RescueSuggestionSnoozeMap = {};

  Object.entries(map).forEach(([rescueIdText, value]) => {
    const rescueId = Number(rescueIdText);
    if (!Number.isFinite(rescueId) || rescueId <= 0) return;

    const lastTouched =
      value?.snoozeUntil || value?.dismissedAt || value?.lastShownAt || 0;

    if (activeSet && !activeSet.has(rescueId)) {
      return;
    }

    if (lastTouched && now - lastTouched > SUGGESTION_STATE_TTL_MS) {
      return;
    }

    next[rescueId] = value;
  });

  saveSuggestionSnoozeMap(next);
};

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
    icon: X,
    border: "border-red-200",
    iconWrap: "bg-red-100 text-red-600",
    line: "bg-red-500",
  },
  warning: {
    title: "Cảnh báo",
    icon: TriangleAlert,
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

  return createPortal(
    <>
      <style>{`
        @keyframes navbarToastIn {
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

        @keyframes navbarToastOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(0.98);
          }
        }

        @keyframes navbarToastProgressShrink {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>

      <div className="fixed top-5 inset-x-0 z-[40000] flex justify-center px-3 pointer-events-none">
        <div
          className={`pointer-events-auto inline-block w-fit max-w-[85vw] min-w-[320px] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur ${meta.border}`}
          style={{
            animation: `${showAnim ? "navbarToastIn" : "navbarToastOut"} 0.28s ease forwards`,
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
                animationName: "navbarToastProgressShrink",
                animationDuration: `${toast.duration}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

const RescueSuggestionToast = ({
  toast,
  onDismiss,
  onView,
  onAcceptNow,
  accepting,
}: {
  toast: RescueSuggestionToastState;
  onDismiss: () => void;
  onView: () => void;
  onAcceptNow: () => void;
  accepting: boolean;
}) => {
  const [mounted, setMounted] = useState(false);
  const [showAnim, setShowAnim] = useState(false);

  useEffect(() => {
    if (toast?.show) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShowAnim(true));
      return () => cancelAnimationFrame(raf);
    }

    setShowAnim(false);
    const timer = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(timer);
  }, [toast?.show, toast?.id]);

  if (!toast || !mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes rescueToastIn {
          0% {
            opacity: 0;
            transform: translateY(-20px) scale(0.96);
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

        @keyframes rescueToastOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(0.98);
          }
        }

        @keyframes rescueToastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>

      <div className="fixed top-5 inset-x-0 z-[30000] flex justify-center px-3 pointer-events-none">
        <div
          className="pointer-events-auto inline-block w-full max-w-[640px] overflow-hidden rounded-3xl border border-blue-200 bg-white/95 shadow-2xl backdrop-blur"
          style={{
            animation: `${showAnim ? "rescueToastIn" : "rescueToastOut"} 0.28s ease forwards`,
          }}
        >
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 opacity-95" />
            <div className="relative px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                    <Bell size={18} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                        SOS mới
                      </span>

                      {toast.rescueId ? (
                        <span className="rounded-full bg-white text-blue-700 px-2.5 py-1 text-[11px] font-extrabold">
                          #{toast.rescueId}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 text-base md:text-lg font-extrabold leading-tight">
                      {toast.title || "Có yêu cầu SOS mới phù hợp gần đội bạn"}
                    </h3>

                    <p className="mt-1 text-sm text-blue-50 leading-6">
                      {toast.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onDismiss}
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Thông tin yêu cầu SOS
              </div>

              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 text-blue-600 shrink-0" />
                  <span>
                    <strong>Vị trí:</strong> {toast.address || "Chưa có địa chỉ"}
                  </span>
                </div>

                <div>
                  <strong>Loại yêu cầu:</strong> {getSosTypeLabel(toast.sosType)}
                </div>

                <div>
                  <strong>Số nạn nhân:</strong> {toast.victims ?? "Chưa rõ"}
                </div>

                <div>
                  <strong>Khoảng cách:</strong> {toast.distanceText || "Chưa rõ"}
                </div>

                <div>
                  <strong>Dự kiến đến:</strong> {toast.etaText || "Chưa rõ"}
                </div>

                {toast.note && (
                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-600">
                    <strong>Ghi chú:</strong> {toast.note}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium text-slate-400">
                  Tự đóng sau 5 giây
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={onDismiss}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Bỏ qua gợi ý
                </button>

                <button
                  onClick={onView}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-900"
                >
                  <MapPin size={14} />
                  Xem trên bản đồ
                </button>

                <button
                  onClick={onAcceptNow}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-70"
                >
                  <Bell size={14} />
                  {accepting ? "Đang nhận..." : "Nhận ngay"}
                </button>
              </div>
            </div>
          </div>

          <div className="h-1 w-full bg-slate-100 overflow-hidden">
            <div
              key={toast.id}
              className="h-full bg-blue-500"
              style={{
                width: "100%",
                transformOrigin: "left",
                animation: "rescueToastProgress 5000ms linear forwards",
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

const Navbar: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false);
  const [isOpenNotifications, setIsOpenNotifications] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [rescueSuggestionToast, setRescueSuggestionToast] =
    useState<RescueSuggestionToastState>(null);

  const [isAcceptingSuggestion, setIsAcceptingSuggestion] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const streamRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const isOpenNotificationsRef = useRef<boolean>(false);

  const shownSuggestionIdsRef = useRef<Set<number>>(new Set());
  const suggestionToastTimeoutRef = useRef<number | null>(null);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: TOAST_DURATION,
  });


  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenLogin, setAuthMode } = useAuthModal();

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = TOAST_DURATION) => {
      setToast({
        id: Date.now(),
        show: true,
        message,
        type,
        duration,
      });
    },
    []
  );

  const closeToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      show: false,
    }));
  }, []);

  useEffect(() => {
    if (!toast.show) return;

    const timer = window.setTimeout(() => {
      closeToast();
    }, toast.duration);

    return () => window.clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration, closeToast]);

  const isMovingToSOSNotification = useCallback((item: NotificationItem) => {
    if (item.event_type !== "rescuer_moving_eta_updated") return false;

    const meta = item.metadata || {};
    const statusText = String(meta.rescue_status_text || "").toLowerCase();
    const rescueStatus = String(meta.rescue_status || "").toLowerCase();
    const currentStep = Number(meta.current_step || 0);

    return (
      currentStep >= 3 ||
      rescueStatus === "moving" ||
      rescueStatus === "on_the_way" ||
      rescueStatus === "arriving" ||
      statusText.includes("đang đến") ||
      statusText.includes("đang di chuyển")
    );
  }, []);

  const isRescueSuggestionNotification = useCallback(
    (item?: NotificationItem | null) => {
      return item?.event_type === "rescuer_sos_recommendation";
    },
    []
  );

  const getReadNotificationsKey = useCallback(() => {
    return `notifications_read_${localStorage.getItem("userId") || "guest"}`;
  }, []);

  const getReadNotifications = useCallback((): number[] => {
    try {
      const raw = localStorage.getItem(getReadNotificationsKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.map(Number).filter((value) => Number.isFinite(value))
        : [];
    } catch {
      return [];
    }
  }, [getReadNotificationsKey]);

  const saveReadNotifications = useCallback(
    (ids: number[]) => {
      const uniqueIds = Array.from(
        new Set(ids.map(Number).filter((value) => Number.isFinite(value)))
      );
      localStorage.setItem(getReadNotificationsKey(), JSON.stringify(uniqueIds));
    },
    [getReadNotificationsKey]
  );

  const isNotificationRead = useCallback(
    (id: number) => {
      return getReadNotifications().includes(Number(id));
    },
    [getReadNotifications]
  );

  const dedupeNotifications = useCallback(
    (items: NotificationItem[]) => {
      const seenMovement = new Set<string>();

      return items.filter((item) => {
        if (item.event_type !== "rescuer_moving_eta_updated") return true;

        if (!isMovingToSOSNotification(item)) return false;

        const key = `${item.event_type}_${item.rescue_id || 0}`;
        if (seenMovement.has(key)) return false;
        seenMovement.add(key);
        return true;
      });
    },
    [isMovingToSOSNotification]
  );

  const upsertIncomingNotification = useCallback(
    (prev: NotificationItem[], payload: NotificationItem) => {
      const existsById = prev.some((item) => item.id === payload.id);
      if (existsById) return prev;

      if (payload.event_type === "rescuer_moving_eta_updated") {
        const filtered = prev.filter(
          (item) =>
            !(
              item.event_type === "rescuer_moving_eta_updated" &&
              Number(item.rescue_id || 0) === Number(payload.rescue_id || 0)
            )
        );

        return [payload, ...filtered].slice(0, 20);
      }

      return [payload, ...prev].slice(0, 20);
    },
    []
  );

  const closeSuggestionToast = useCallback((withSnooze = true) => {
    setRescueSuggestionToast((prev) => {
      if (withSnooze && prev?.rescueId) {
        snoozeSuggestion(prev.rescueId, SUGGESTION_SNOOZE_MINUTES);
      }
      return prev ? { ...prev, show: false } : prev;
    });

    if (suggestionToastTimeoutRef.current) {
      window.clearTimeout(suggestionToastTimeoutRef.current);
      suggestionToastTimeoutRef.current = null;
    }
  }, []);

  const openSuggestionOnMap = useCallback(
    (rescueId?: number) => {
      if (!rescueId) return;

      sessionStorage.setItem("map_rescue_open_sos", String(rescueId));
      navigate("/map_rescue", {
        state: {
          openRescueId: rescueId,
          openFromSuggestion: true,
        },
      });
    },
    [navigate]
  );

  const acceptSuggestionNow = useCallback(async () => {
    const rescueId = Number(rescueSuggestionToast?.rescueId || 0);
    if (!rescueId || isAcceptingSuggestion) return;

    try {
      setIsAcceptingSuggestion(true);

      const token = localStorage.getItem("token");
      if (!token) {
        forceLogout({
          message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
          openLogin: true,
        });
        return;
      }

      const res = await axios.patch(
        `http://localhost:3000/api/rescues/${rescueId}/status`,
        { status: "rescuing" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedRescue = res.data;

      clearSuggestionState(rescueId);
      setRescueSuggestionToast((prev) =>
        prev ? { ...prev, show: false } : prev
      );

      sessionStorage.setItem("map_rescue_open_sos", String(rescueId));
      sessionStorage.setItem(
        "map_rescue_open_sos_payload",
        JSON.stringify(updatedRescue || {})
      );

      navigate("/map_rescue", {
        state: {
          openRescueId: rescueId,
          openFromSuggestion: true,
          justAccepted: true,
        },
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Không thể nhận yêu cầu này.";

      if (error?.response?.data?.code === "SOS_ALREADY_ACCEPTED") {
        clearSuggestionState(rescueId);
        setRescueSuggestionToast((prev) =>
          prev ? { ...prev, show: false } : prev
        );
        showToast(message, "warning");
        return;
      }

      if (
        error?.response?.data?.code === "ACCOUNT_TEMPORARY_LOCKED" ||
        error?.response?.data?.code === "ACCOUNT_INACTIVE"
      ) {
        showToast(message, "warning");
        return;
      }

      showToast(message, "warning");
    } finally {
      setIsAcceptingSuggestion(false);
    }
  }, [
    forceLogout,
    isAcceptingSuggestion,
    navigate,
    rescueSuggestionToast,
    showToast,
  ]);

  const clearAuth = useCallback(() => {
    clearAuthStorage();
    setDisplayName(null);
    setRole(null);
    setAvatar(null);
    setNotifications([]);
    setUnreadCount(0);
    setRescueSuggestionToast(null);
    shownSuggestionIdsRef.current.clear();

    if (suggestionToastTimeoutRef.current) {
      window.clearTimeout(suggestionToastTimeoutRef.current);
      suggestionToastTimeoutRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }, []);

  const forceLogoutWithMessage = useCallback(
    (message: string) => {
      setDisplayName(null);
      setRole(null);
      setAvatar(null);
      setNotifications([]);
      setUnreadCount(0);
      setRescueSuggestionToast(null);
      shownSuggestionIdsRef.current.clear();

      if (suggestionToastTimeoutRef.current) {
        window.clearTimeout(suggestionToastTimeoutRef.current);
        suggestionToastTimeoutRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }

      forceLogout({
        message:
          message ||
          "Tài khoản đội cứu hộ đã bị khóa. Vui lòng liên hệ quản trị viên.",
        openLogin: true,
      });

      window.dispatchEvent(new Event("auth-changed"));
      navigate("/");
    },
    [navigate]
  );

  const fetchProfileAvatar = useCallback(
    async (token: string) => {
      const expired = logoutIfTokenExpired({
        message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
        openLogin: true,
      });

      if (expired) {
        clearAuth();
        return;
      }

      try {
        const res = await axios.get("http://localhost:3000/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const avatarValue = res.data?.avatar || "";
        const emailValue = res.data?.email || localStorage.getItem("email");
        const roleValue = res.data?.role || localStorage.getItem("role");
        const nextDisplayName =
          res.data?.full_name ||
          res.data?.email ||
          localStorage.getItem("displayName") ||
          localStorage.getItem("email");

        setAvatar(avatarValue || null);
        setDisplayName(nextDisplayName || null);
        setRole(roleValue || null);

        localStorage.setItem("avatar", avatarValue || "");
        if (emailValue) localStorage.setItem("email", emailValue);
        if (nextDisplayName) localStorage.setItem("displayName", nextDisplayName);
        if (roleValue) localStorage.setItem("role", roleValue);
      } catch (error: any) {
        if (error?.response?.data?.code === "ACCOUNT_INACTIVE") {
          forceLogoutWithMessage(
            error?.response?.data?.message ||
            "Tài khoản đội cứu hộ đã bị khóa. Bạn đã bị đăng xuất khỏi hệ thống."
          );
          return;
        }

        console.log("Fetch avatar failed:", error);
        setAvatar(localStorage.getItem("avatar"));
        setDisplayName(
          localStorage.getItem("displayName") || localStorage.getItem("email")
        );
        setRole(localStorage.getItem("role"));
      }
    },
    [clearAuth, forceLogoutWithMessage]
  );

  const showRescueSuggestionToast = useCallback(async (payload: NotificationItem) => {
    const meta = payload.metadata || {};
    const rescueId = Number(payload.rescue_id || 0);

    if (!rescueId || !canShowSuggestion(rescueId)) return;

    const stillActive = await isSuggestionRescueStillActive(rescueId);
    if (!stillActive) {
      clearSuggestionState(rescueId);
      return;
    }

    markSuggestionShown(rescueId);

    const address = String(meta.address || "");
    const distanceText = String(meta.distance_text || "");
    const etaText = String(meta.eta_text || "");
    const sosType = String(meta.sos_type || "");
    const note = String(meta.note || "");
    const victims =
      meta.victims === null || meta.victims === undefined || meta.victims === ""
        ? undefined
        : Number(meta.victims);

    setRescueSuggestionToast({
      id: Date.now(),
      show: true,
      title: payload.title || "Có yêu cầu SOS mới gần đội bạn",
      message:
        payload.description ||
        (address
          ? `SOS #${rescueId} tại ${address}`
          : `Có yêu cầu SOS mới phù hợp gần vị trí hiện tại của đội.`),
      rescueId,
      distanceText,
      etaText,
      address,
      sosType,
      victims,
      note,
    });

    if (suggestionToastTimeoutRef.current) {
      window.clearTimeout(suggestionToastTimeoutRef.current);
    }

    suggestionToastTimeoutRef.current = window.setTimeout(() => {
      setRescueSuggestionToast((prev) =>
        prev ? { ...prev, show: false } : prev
      );
      suggestionToastTimeoutRef.current = null;
    }, 5000);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const expired = logoutIfTokenExpired({
        message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
        openLogin: true,
      });

      if (expired) {
        clearAuth();
        return;
      }

      const res = await axios.get("http://localhost:3000/api/notifications?limit=20", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const rawItems = Array.isArray(res.data) ? res.data : [];

      const recommendationItems = rawItems.filter((item: NotificationItem) =>
        isRescueSuggestionNotification(item)
      );

      const activeSuggestionRescueIds = recommendationItems
        .map((item: NotificationItem) => Number(item.rescue_id || 0))
        .filter((id: number) => Number.isFinite(id) && id > 0);

      cleanupSuggestionState(activeSuggestionRescueIds);

      setRescueSuggestionToast((prev) => {
        if (!prev?.rescueId) return prev;

        const stillExistsInRecommendations = activeSuggestionRescueIds.includes(
          Number(prev.rescueId)
        );

        if (!stillExistsInRecommendations) {
          return prev ? { ...prev, show: false } : prev;
        }

        return prev;
      });

      if ((localStorage.getItem("role") || role) === "rescuer" && recommendationItems.length > 0) {
        const latestEligibleSuggestion = recommendationItems.find((item: NotificationItem) => {
          const suggestionId = Number(item.id);
          const rescueId = Number(item.rescue_id || 0);

          return (
            !shownSuggestionIdsRef.current.has(suggestionId) &&
            canShowSuggestion(rescueId)
          );
        });

        if (latestEligibleSuggestion) {
          shownSuggestionIdsRef.current.add(Number(latestEligibleSuggestion.id));
          void showRescueSuggestionToast(latestEligibleSuggestion);
        }
      }

      const items = dedupeNotifications(rawItems);

      setNotifications(items);

      const readIds = getReadNotifications();
      const unread = items.filter(
        (item) => !readIds.includes(Number(item.id))
      ).length;
      setUnreadCount(unread);
    } catch (error: any) {
      if (error?.response?.data?.code === "ACCOUNT_INACTIVE") {
        forceLogoutWithMessage(
          error?.response?.data?.message ||
          "Tài khoản đội cứu hộ đã bị khóa. Bạn đã bị đăng xuất khỏi hệ thống."
        );
        return;
      }

      console.log("Fetch notifications failed:", error);
    }
  }, [
    clearAuth,
    dedupeNotifications,
    forceLogoutWithMessage,
    getReadNotifications,
    isRescueSuggestionNotification,
    role,
    showRescueSuggestionToast,
  ]);

  const markAllNotificationsAsRead = useCallback(() => {
    const ids = notifications.map((item) => Number(item.id));
    saveReadNotifications(ids);
    setUnreadCount(0);
  }, [notifications, saveReadNotifications]);

  const connectNotificationsStream = useCallback(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId) return;

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    try {
      const stream = new EventSource(getNotificationsStreamUrl());
      streamRef.current = stream;

      stream.addEventListener("connected", () => {
        console.log("Notification stream connected");
        fetchNotifications();
      });

      stream.addEventListener("notification", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as NotificationItem;

          if (isRescueSuggestionNotification(payload)) {
            const suggestionId = Number(payload.id);
            const rescueId = Number(payload.rescue_id || 0);

            if (
              !shownSuggestionIdsRef.current.has(suggestionId) &&
              canShowSuggestion(rescueId)
            ) {
              shownSuggestionIdsRef.current.add(suggestionId);
              void showRescueSuggestionToast(payload);
            }

            setNotifications((prev) => upsertIncomingNotification(prev, payload));

            const readIds = getReadNotifications();
            if (
              !readIds.includes(Number(payload.id)) &&
              !isOpenNotificationsRef.current
            ) {
              setUnreadCount((prev) => prev + 1);
            }

            return;
          }

          if (payload.event_type === "rescuer_account_locked") {
            forceLogoutWithMessage(
              payload.description ||
              "Tài khoản đội cứu hộ đã bị khóa. Bạn đã bị đăng xuất khỏi hệ thống."
            );
            return;
          }

          if (payload.event_type === "rescuer_account_temporary_locked") {
            showToast(
              payload.description ||
              "Admin đã khóa tạm thời tài khoản của đội bạn. Bạn vẫn có thể hoàn thành các yêu cầu đã nhận nhưng không thể nhận thêm yêu cầu mới.",
              "warning"
            );
          }

          if (
            payload.event_type === "rescuer_moving_eta_updated" &&
            !isMovingToSOSNotification(payload)
          ) {
            return;
          }

          setNotifications((prev) => upsertIncomingNotification(prev, payload));

          const readIds = getReadNotifications();

          if (
            !readIds.includes(Number(payload.id)) &&
            !isOpenNotificationsRef.current
          ) {
            setUnreadCount((prev) => prev + 1);
          }

          if (isOpenNotificationsRef.current) {
            window.setTimeout(() => {
              fetchNotifications();
            }, 120);
          }
        } catch (err) {
          console.log("Parse notification failed:", err);
        }
      });

      stream.addEventListener("ping", () => { });

      stream.onerror = () => {
        console.log("Notification stream disconnected");

        if (streamRef.current) {
          streamRef.current.close();
          streamRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectNotificationsStream();
        }, 2000);
      };
    } catch (err) {
      console.log("Create EventSource failed:", err);
    }
  }, [
    fetchNotifications,
    forceLogoutWithMessage,
    getReadNotifications,
    isMovingToSOSNotification,
    isRescueSuggestionNotification,
    showRescueSuggestionToast,
    upsertIncomingNotification,
  ]);

  const syncAuth = useCallback(async () => {
    const token = localStorage.getItem("token");
    const storedDisplayName =
      localStorage.getItem("displayName") || localStorage.getItem("email");
    const userRole = localStorage.getItem("role");
    const userAvatar = localStorage.getItem("avatar");

    if (!token) {
      clearAuth();
      return;
    }

    const expired = logoutIfTokenExpired({
      message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
      openLogin: true,
    });

    if (expired) {
      clearAuth();
      return;
    }

    cleanupSuggestionState();

    setDisplayName(storedDisplayName);
    setRole(userRole);
    setAvatar(userAvatar);

    await fetchProfileAvatar(token);
    await fetchNotifications();
  }, [clearAuth, fetchNotifications, fetchProfileAvatar]);

  useEffect(() => {
    isOpenNotificationsRef.current = isOpenNotifications;
  }, [isOpenNotifications]);

  useEffect(() => {
    syncAuth();

    const handleAuthChanged = () => {
      syncAuth();
    };

    window.addEventListener("storage", handleAuthChanged);
    window.addEventListener("auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleAuthChanged);
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, [syncAuth]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!displayName || !token || !userId) return;

    connectNotificationsStream();

    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, [displayName, connectNotificationsStream]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!displayName || !token || !userId) return;

    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = window.setInterval(() => {
      fetchNotifications();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [displayName, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpenMenu(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (suggestionToastTimeoutRef.current) {
        window.clearTimeout(suggestionToastTimeoutRef.current);
      }
    };
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const logout = () => {
    clearAuth();
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/");
  };

  const homePath = "/home";

  const isActive = (path: string) => location.pathname === path;

  const avatarUrl = useMemo(() => {
    if (!avatar) return "";
    if (avatar.startsWith("http")) return avatar;
    return `http://localhost:3000${avatar}`;
  }, [avatar]);

  const displayInitial = (displayName || "U").charAt(0).toUpperCase();

  const formatTimeAgo = (value?: string) => {
    if (!value) return "Vừa xong";

    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const getNotificationIcon = (severity?: string) => {
    switch (severity) {
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case "warning":
      case "critical":
        return <TriangleAlert size={16} className="text-amber-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  const getNotificationTitle = (item: NotificationItem) => {
    const meta = item.metadata || {};

    if (item.event_type === "rescuer_moving_eta_updated") {
      if (isMovingToSOSNotification(item)) {
        return (
          meta.rescue_status_text ||
          `Đội cứu hộ đang di chuyển đến SOS #${item.rescue_id || ""}`
        );
      }

      return item.title || `Yêu cầu SOS #${item.rescue_id || ""} đã được tiếp nhận`;
    }

    return item.title;
  };

  const getNotificationDescription = (item: NotificationItem) => {
    const meta = item.metadata || {};

    if (item.event_type === "rescuer_moving_eta_updated") {
      if (isMovingToSOSNotification(item)) {
        const parts = [
          meta.address ? `Vị trí: ${meta.address}` : "",
          meta.distance_text ? `Khoảng cách: ${meta.distance_text}` : "",
          meta.eta_text ? `Dự kiến đến: ${meta.eta_text}` : "",
        ].filter(Boolean);

        return parts.join(" • ") || item.description;
      }

      return (
        item.description ||
        "Yêu cầu đã được tiếp nhận, đội cứu hộ đang chuẩn bị hỗ trợ."
      );
    }

    return item.description;
  };

  const NavLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className={`${isActive(to)
        ? "text-blue-400 border-b-2 border-blue-400"
        : "hover:text-blue-300 text-slate-300"
        } pb-1 transition-all text-sm font-medium`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <NotificationToast toast={toast} onClose={closeToast} />

      <RescueSuggestionToast
        toast={rescueSuggestionToast}
        onDismiss={() => closeSuggestionToast(true)}
        onView={() => {
          const rescueId = Number(rescueSuggestionToast?.rescueId || 0);
          closeSuggestionToast(true);

          if (rescueId) {
            openSuggestionOnMap(rescueId);
          }
        }}
        onAcceptNow={acceptSuggestionNow}
        accepting={isAcceptingSuggestion}
      />

      <nav className="fixed top-0 left-0 right-0 h-16 bg-[#0F172A] text-white flex items-center justify-between px-6 z-[2000] shadow-lg border-b border-slate-800">
        <div className="flex items-center space-x-8">
          <Link to={homePath} className="flex items-center space-x-2 group">
            <ShieldCheck className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-bold tracking-tight italic">FRRP</span>
          </Link>

          <div className="hidden md:flex space-x-6">
            <NavLink to={homePath} label="Trang chủ" />

            {!role && (
              <>
                <NavLink to="/map" label="Bản đồ" />
                <NavLink to="/about" label="Giới thiệu" />
                <NavLink to="/news" label="Tin tức" />
              </>
            )}

            {role === "user" && (
              <>
                <NavLink to="/map" label="Bản đồ" />
                <NavLink to="/rescueteam_user" label="Yêu cầu của tôi" />
                <NavLink to="/news" label="Tin tức" />
              </>
            )}

            {role === "rescuer" && (
              <>
                <NavLink to="/map_rescue" label="Bản đồ" />
                <NavLink to="/rescueteamrescue" label="Đang cứu hộ" />
                <NavLink to="/analyticsrescue" label="Phân tích dữ liệu" />
                <NavLink to="/news" label="Tin tức" />
              </>
            )}

            {role === "admin" && (
              <>
                <NavLink to="/map_admin" label="Bản đồ" />
                <NavLink to="/rescueteamadmin" label="Quản lý Đội cứu hộ" />
                <NavLink to="/requestsosadmin" label="Quản lý Dân cư" />
                <NavLink to="/analytics" label="Phân tích dữ liệu" />
                <NavLink to="/news" label="Tin tức" />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {displayName && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setIsOpenNotifications((prev) => !prev);
                }}
                className="relative p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300"
                title="Thông báo"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {isOpenNotifications && (
                <div className="absolute right-0 mt-4 w-[360px] max-h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
                      <p className="text-[11px] text-slate-500">
                        {role === "admin"
                          ? "Thông báo quản trị"
                          : role === "rescuer"
                            ? "Thông báo đội cứu hộ"
                            : "Thông báo yêu cầu của bạn"}
                      </p>
                    </div>

                    <button
                      onClick={markAllNotificationsAsRead}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <CheckCheck size={14} />
                      Đánh dấu đã đọc tất cả
                    </button>
                  </div>

                  <div className="max-h-[390px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-10 text-center text-slate-500">
                        <AlertCircle size={18} className="mx-auto mb-2" />
                        <p className="text-sm font-medium">Chưa có thông báo nào</p>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const read = isNotificationRead(item.id);

                        return (
                          <div
                            key={`${item.event_type}_${item.rescue_id || item.id}_${item.id}`}
                            className={`px-4 py-3 border-b border-slate-100 transition-colors ${read
                              ? "bg-white hover:bg-slate-50"
                              : "bg-blue-50/70 hover:bg-blue-50"
                              }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getNotificationIcon(item.severity)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-semibold text-slate-800 leading-5">
                                    {getNotificationTitle(item)}
                                  </p>
                                  <span className="shrink-0 text-[10px] text-slate-400">
                                    {formatTimeAgo(item.created_at)}
                                  </span>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  {getNotificationDescription(item)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!displayName && (
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              title="Đổi giao diện"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}

          {!displayName ? (
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-700 text-white">
              <button
                onClick={() => {
                  localStorage.setItem("login_redirect", location.pathname);
                  setAuthMode("login");
                  setOpenLogin(true);
                }}
                className="text-sm font-medium hover:text-blue-400 transition"
              >
                Đăng nhập
              </button>

              <button
                onClick={() => {
                  localStorage.setItem("login_redirect", location.pathname);
                  setAuthMode("register");
                  setOpenLogin(true);
                }}
                className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20"
              >
                Đăng ký
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-700 text-white">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold">{displayName}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                  {role === "admin"
                    ? "Quản trị viên"
                    : role === "rescuer"
                      ? "Đội cứu hộ"
                      : "Người dân"}
                </p>
              </div>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsOpenMenu(!isOpenMenu)}
                  className="w-10 h-10 rounded-full border-2 border-slate-700 hover:border-blue-400 transition-all shadow-md overflow-hidden flex items-center justify-center"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {displayInitial}
                    </div>
                  )}
                </button>

                {isOpenMenu && (
                  <div className="absolute right-0 mt-4 w-52 bg-white rounded-xl shadow-2xl py-2 border border-slate-200 animate-in fade-in zoom-in duration-150 text-slate-700">
                    <button
                      onClick={() => {
                        navigate("/profile");
                        setIsOpenMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex items-center gap-2"
                    >
                      <Settings size={16} className="text-slate-400" /> Cài đặt tài khoản
                    </button>

                    <button
                      onClick={toggleDarkMode}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex items-center gap-2"
                    >
                      {isDarkMode ? (
                        <>
                          <Sun size={16} className="text-slate-400" /> Giao diện sáng
                        </>
                      ) : (
                        <>
                          <Moon size={16} className="text-slate-400" /> Giao diện tối
                        </>
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-100"></div>

                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 text-sm font-bold flex items-center gap-2"
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
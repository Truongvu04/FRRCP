import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import SOSRequestModal from "../../components/SOSRequestModal";
import {
  CheckCircle2,
  Truck,
  Flag,
  MapPin,
  PhoneCall,
  Users,
  Edit3,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock3,
  User,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Info,
  Waves,
  Phone,
  ChevronLeft,
  ChevronRight,
  Activity,
  CalendarDays,
  TimerReset,
  ClipboardList,
  Sparkles,
  RotateCcw,
  Search,
  ArrowUpDown,
  HomeIcon,
  ShieldCheck,
} from "lucide-react";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-leaflet";

import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type RescueItem = {
  id: number;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  address: string;
  victims: number;
  note?: string;
  source_url?: string;
  images?: string | string[];
  status: "new" | "rescuing" | "done" | "cancel";
  user_id: number;
  sos_type: "rescue" | "supplies" | "vehicle" | "other";
  created_at?: string;
  received_at?: string;
  completed_at?: string;
  assigned_team?: string | null;
  handled_by?: number | null;
  rescuer_lat?: number | null;
  rescuer_lng?: number | null;
  rescuer_name?: string | null;
  rescuer_phone?: string | null;
};

type StepStatus = {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  badgeClass: string;
  eta?: string | null;
  distance?: string | null;
};

type Province = {
  code: number;
  name: string;
};

type Ward = {
  code: number;
  name: string;
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
};

const API_BASE = "http://localhost:3000";
const STORAGE_KEY = "rescue_tracking_snapshots";

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string | undefined;

(mapboxgl as any).setTelemetryEnabled?.(false);

if (GOONG_API_KEY) {
  mapboxgl.accessToken = GOONG_API_KEY;
}

const toRad = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estimateArrivalFromDistance = (distanceKm: number, sosType?: string) => {
  let avgSpeedKmH = 35;

  if (sosType === "vehicle") avgSpeedKmH = 40;
  else if (sosType === "supplies") avgSpeedKmH = 30;
  else if (sosType === "rescue") avgSpeedKmH = 35;
  else avgSpeedKmH = 30;

  const totalMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmH) * 60));

  if (totalMinutes < 60) return `Khoảng ${totalMinutes} phút`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `Khoảng ${hours} giờ`;
  return `Khoảng ${hours} giờ ${minutes} phút`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "Chưa có";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa có";

  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const timeAgo = (iso?: string) => {
  if (!iso) return "Chưa có";
  const now = new Date();
  const past = new Date(iso);
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

const parseImages = (images: RescueItem["images"]): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images;

  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getSosTypeLabel = (type?: string) => {
  switch (type) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    default:
      return "Yêu cầu khác";
  }
};

const getReadableStatus = (step: number) => {
  switch (step) {
    case 1:
      return "Đang chờ cứu hộ";
    case 2:
      return "Đã tiếp nhận";
    case 3:
      return "Đội cứu hộ đang đến";
    case 4:
      return "Đã hoàn tất";
    default:
      return "Không rõ";
  }
};

const normalizeProvinceLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.startsWith("tỉnh") || lower.startsWith("thành phố")) return name;
  return `Tỉnh ${name}`;
};

const normalizeWardLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (
    lower.startsWith("phường") ||
    lower.startsWith("xã") ||
    lower.startsWith("thị trấn") ||
    lower.startsWith("đặc khu")
  ) {
    return name;
  }
  return `Phường ${name}`;
};

const normalizeText = (value: string = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const findProvinceByName = (provinceName: string, list: Province[]) => {
  const target = normalizeText(provinceName);

  return list.find((p) => {
    const name = normalizeText(p.name);
    const nameNoPrefix = name
      .replace(/^tinh\s+/, "")
      .replace(/^thanh pho\s+/, "");

    const targetNoPrefix = target
      .replace(/^tinh\s+/, "")
      .replace(/^thanh pho\s+/, "");

    return (
      name === target ||
      nameNoPrefix === targetNoPrefix ||
      name.includes(target) ||
      target.includes(name) ||
      nameNoPrefix.includes(targetNoPrefix) ||
      targetNoPrefix.includes(nameNoPrefix)
    );
  });
};

const findWardByName = (wardName: string, list: Ward[]) => {
  const target = normalizeText(wardName);

  return list.find((w) => {
    const name = normalizeText(w.name);
    const nameNoPrefix = name
      .replace(/^phuong\s+/, "")
      .replace(/^xa\s+/, "")
      .replace(/^thi tran\s+/, "")
      .replace(/^dac khu\s+/, "");

    const targetNoPrefix = target
      .replace(/^phuong\s+/, "")
      .replace(/^xa\s+/, "")
      .replace(/^thi tran\s+/, "")
      .replace(/^dac khu\s+/, "");

    return (
      name === target ||
      nameNoPrefix === targetNoPrefix ||
      name.includes(target) ||
      target.includes(name) ||
      nameNoPrefix.includes(targetNoPrefix) ||
      targetNoPrefix.includes(nameNoPrefix)
    );
  });
};

const buildAddressDetailFromReverse = (addr: any) => {
  const parts = [
    addr.house_number,
    addr.road,
    addr.neighbourhood,
    addr.hamlet,
    addr.village,
    addr.suburb,
    addr.quarter,
  ]
    .filter(Boolean)
    .join(" ");

  return parts.trim();
};

const parseCoords = (text: string) => {
  const parts = text.trim().split(/[ ,]+/);

  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }

  return null;
};

const VIETNAM_PICK_BOUNDS = {
  minLat: 8.55,
  maxLat: 23.35,
  minLng: 102.35,
  maxLng: 109.48,
};

const isInVietnam = (lat: number, lng: number) => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= VIETNAM_PICK_BOUNDS.minLat &&
    lat <= VIETNAM_PICK_BOUNDS.maxLat &&
    lng >= VIETNAM_PICK_BOUNDS.minLng &&
    lng <= VIETNAM_PICK_BOUNDS.maxLng
  );
};

const getTrackingInfo = (item?: RescueItem | null) => {
  if (!item) return null;

  const rescueLat = Number(item.rescuer_lat);
  const rescueLng = Number(item.rescuer_lng);
  const sosLat = Number(item.lat);
  const sosLng = Number(item.lng);

  const hasValidCoords =
    Number.isFinite(rescueLat) &&
    Number.isFinite(rescueLng) &&
    Number.isFinite(sosLat) &&
    Number.isFinite(sosLng);

  if (!hasValidCoords) return null;

  const distanceKm = calculateDistanceKm(rescueLat, rescueLng, sosLat, sosLng);

  return {
    distanceKm,
    distanceText:
      distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`,
    etaText: estimateArrivalFromDistance(distanceKm, item.sos_type),
  };
};

const getSnapshotStore = (): Record<
  string,
  { lat: number | null; lng: number | null }
> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveSnapshotStore = (
  data: Record<string, { lat: number | null; lng: number | null }>
) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const hasRescuerMoved = (item: RescueItem) => {
  if (item.status !== "rescuing" || !item.handled_by) return false;

  const store = getSnapshotStore();
  const key = String(item.id);

  const currentLat = Number(item.rescuer_lat);
  const currentLng = Number(item.rescuer_lng);

  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    return false;
  }

  if (!store[key]) {
    store[key] = { lat: currentLat, lng: currentLng };
    saveSnapshotStore(store);
    return false;
  }

  const base = store[key];
  const moved =
    base.lat !== null &&
    base.lng !== null &&
    (Math.abs(currentLat - base.lat) > 0.00001 ||
      Math.abs(currentLng - base.lng) > 0.00001);

  return moved;
};

const getStepStatus = (item: RescueItem): StepStatus => {
  const tracking = getTrackingInfo(item);

  if (item.status === "cancel") {
    return {
      currentStep: 1,
      title: "Đã hủy",
      badgeClass:
        "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "done") {
    return {
      currentStep: 4,
      title: "Hoàn thành",
      badgeClass:
        "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "rescuing") {
    const moved = hasRescuerMoved(item);

    if (moved) {
      return {
        currentStep: 3,
        title: "Đang đến",
        badgeClass:
          "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
        eta: tracking?.etaText || null,
        distance: tracking?.distanceText || null,
      };
    }

    return {
      currentStep: 2,
      title: "Tiếp nhận",
      badgeClass:
        "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
      eta: tracking?.etaText || null,
      distance: tracking?.distanceText || null,
    };
  }

  return {
    currentStep: 1,
    title: "Chờ tiếp nhận",
    badgeClass:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30",
    eta: null,
    distance: null,
  };
};

const getStepDotClass = (status?: string) => {
  switch ((status || "").toLowerCase()) {
    case "new":
      return "bg-amber-500";
    case "rescuing":
      return "bg-blue-500";
    case "done":
      return "bg-emerald-500";
    case "cancel":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
};

const miniMapMarkerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

const FlyToMiniMapLocation = ({ position }: { position: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.2 });
    }
  }, [position, map]);

  return null;
};

const MiniMapFixSize = () => {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

const MiniMapSelectLocation = ({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: any) => {
      const { lat, lng } = e.latlng;
      onSelect(lat, lng);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, onSelect]);

  return null;
};

const GoongStyleLayer = ({ enabled }: { enabled: boolean }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!GOONG_API_KEY || !enabled) return;

    try {
      const styleUrl = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_API_KEY}`;
      const createLayer = (L as any).mapboxGL;

      if (typeof createLayer !== "function") {
        console.error("mapboxGL function không khả dụng");
        return;
      }

      if (!layerRef.current) {
        layerRef.current = createLayer({
          style: styleUrl,
          accessToken: GOONG_API_KEY,
          mapboxgl,
          attribution: "&copy; GOONG Map",
        });
      }

      if (!map.hasLayer(layerRef.current)) {
        layerRef.current.addTo(map);
      }
    } catch (error) {
      console.error("Error adding Goong layer:", error);
    }

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [enabled, map]);

  return null;
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

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

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

type ConfirmActionTone = "red" | "amber" | "emerald" | "slate";

const ConfirmActionModal = ({
  open,
  item,
  tone = "slate",
  title,
  description = "Vui lòng xác nhận thao tác này.",
  message,
  confirmText,
  loadingText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  item?: RescueItem | null;
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
}) => {
  if (!open) return null;

  const toneClass: Record<
    ConfirmActionTone,
    {
      iconWrap: string;
      button: string;
    }
  > = {
    red: {
      iconWrap: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700",
    },
    amber: {
      iconWrap: "bg-amber-100 text-amber-600",
      button: "bg-amber-500 hover:bg-amber-600",
    },
    emerald: {
      iconWrap: "bg-emerald-100 text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700",
    },
    slate: {
      iconWrap: "bg-slate-100 text-slate-700",
      button: "bg-[#0F172A] hover:bg-slate-800",
    },
  };

  const activeTone = toneClass[tone];
  const Icon = tone === "emerald" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                activeTone.iconWrap
              )}
            >
              <Icon size={22} />
            </div>

            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-200">{description}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {item && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
              <p>
                <span className="text-slate-500">Mã yêu cầu: </span>
                <span className="font-bold text-slate-900">
                  #SOS-{item.id || "---"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Người cần hỗ trợ: </span>
                <span className="font-bold text-slate-900">
                  {item.name || "Không có"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Địa chỉ: </span>
                <span className="font-bold text-slate-900">
                  {item.address || "Không có"}
                </span>
              </p>
            </div>
          )}

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3",
              item ? "mt-4" : ""
            )}
          >
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-amber-600"
            />
            <p className="text-sm leading-6 text-slate-700">{message}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
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

const RescueTeam_User: React.FC = () => {

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [rescues, setRescues] = useState<RescueItem[]>([]);
  const [selectedRescueId, setSelectedRescueId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sosTypeFilter, setSosTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const [returnToDetailAfterUpdate, setReturnToDetailAfterUpdate] = useState(false);

  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [datePickerStep, setDatePickerStep] = useState<"start" | "end">("start");
  const dateRangePickerRef = useRef<HTMLDivElement | null>(null);

  const [showSosTypeDropdown, setShowSosTypeDropdown] = useState(false);

  const sosTypeDropdownRef = useRef<HTMLDivElement | null>(null);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editImages, setEditImages] = useState<File[]>([]);

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [editSosType, setEditSosType] = useState<
    "rescue" | "supplies" | "vehicle" | "other" | ""
  >("");
  const [editLocationMode, setEditLocationMode] = useState<
    "address" | "coords"
  >("address");

  const [editProvinces, setEditProvinces] = useState<Province[]>([]);
  const [editWards, setEditWards] = useState<Ward[]>([]);
  const [editSelectedProvinceCode, setEditSelectedProvinceCode] =
    useState<string>("");
  const [editSelectedWardCode, setEditSelectedWardCode] = useState<string>("");
  const [editAddressDetail, setEditAddressDetail] = useState("");

  const [editLoadingProvinces, setEditLoadingProvinces] = useState(false);
  const [editLoadingWards, setEditLoadingWards] = useState(false);
  const [editIsGettingGPS, setEditIsGettingGPS] = useState(false);
  const [editIsFindingAddress, setEditIsFindingAddress] = useState(false);
  const [editIsFindingCoords, setEditIsFindingCoords] = useState(false);

  const [editMapPosition, setEditMapPosition] = useState<[number, number]>([
    16.047079, 108.20623,
  ]);
  const [editMapType] = useState<"default" | "satellite">("default");

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<string>("");
  const [showConfirmCloseUpdateModal, setShowConfirmCloseUpdateModal] =
    useState(false);
  const [editSnapshotReady, setEditSnapshotReady] = useState(false);

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [returnToDetailAfterCancel, setReturnToDetailAfterCancel] = useState(false);
  const didInitUpdateFormRef = useRef(false);
  const didInitReverseRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    coords: "",
    lat: 0,
    lng: 0,
    victims: 1,
    note: "",
    source_url: "",
  });

  const token = localStorage.getItem("token") || "";
  const currentUserId = Number(localStorage.getItem("userId") || 0);

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

  const getStatusFilterLabel = (value: string) => {
    switch (value) {
      case "new":
        return "Chờ tiếp nhận";
      case "rescuing":
        return "Đang được cứu hộ";
      case "done":
        return "Hoàn thành";
      case "cancel":
        return "Đã hủy";
      default:
        return "Tất cả trạng thái";
    }
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

  useEffect(() => {
    if (!toast.show) return;

    const timer = setTimeout(() => {
      closeToast();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration]);

  const selectedRescue = useMemo(
    () => rescues.find((r) => r.id === selectedRescueId) || null,
    [rescues, selectedRescueId]
  );

  const selectedStep = selectedRescue ? getStepStatus(selectedRescue) : null;
  const trackingInfo = getTrackingInfo(selectedRescue);

  const buildEditFullAddress = () => {
    const province = editProvinces.find(
      (p) => String(p.code) === editSelectedProvinceCode
    );
    const ward = editWards.find((w) => String(w.code) === editSelectedWardCode);

    const parts = [
      editAddressDetail.trim(),
      ward ? normalizeWardLabel(ward.name) : "",
      province ? normalizeProvinceLabel(province.name) : "",
    ].filter(Boolean);

    return parts.join(", ");
  };

  const buildEditSnapshot = () => {
    return JSON.stringify({
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      coords: editForm.coords.trim(),
      lat: Number(editForm.lat) || 0,
      lng: Number(editForm.lng) || 0,
      victims: Number(editForm.victims) || 1,
      note: editForm.note.trim(),
      source_url: editForm.source_url.trim(),
      sos_type: editSosType || "",
      locationMode: editLocationMode,
      provinceCode: editSelectedProvinceCode || "",
      wardCode: editSelectedWardCode || "",
      addressDetail: editAddressDetail.trim(),
      existingImages: [...existingImages].sort(),
      newImages: editImages
        .map((f) => `${f.name}_${f.size}_${f.lastModified}`)
        .sort(),
    });
  };

  const isEditFormDirty = () => {
    if (!initialEditSnapshot) return false;
    return buildEditSnapshot() !== initialEditSnapshot;
  };

  const handleCloseUpdateModal = () => {
    if (updating) return;

    if (isEditFormDirty()) {
      setShowConfirmCloseUpdateModal(true);
    } else {
      setShowUpdateModal(false);

      if (returnToDetailAfterUpdate) {
        setShowDetailModal(true);
        setReturnToDetailAfterUpdate(false);
      }
    }
  };

  const fetchMyRescues = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setReloading(true);

      const res = await fetch(`${API_BASE}/api/rescues`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        const message = data.message || "Không tải được danh sách yêu cầu.";
        setError(message);
        showToast(message, "error");
        return;
      }

      const mine = (Array.isArray(data) ? data : [])
        .filter((item: RescueItem) => Number(item.user_id) === currentUserId)
        .sort((a: RescueItem, b: RescueItem) => b.id - a.id);

      setRescues(mine);

      if (mine.length > 0) {
        setSelectedRescueId((prev) =>
          prev && mine.some((r: RescueItem) => r.id === prev) ? prev : mine[0].id
        );
      } else {
        setSelectedRescueId(null);
      }

      setError("");
    } catch {
      setError("Không thể kết nối tới server.");
      showToast("Không thể kết nối tới server.", "error");
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  const handleGetAddressFromCoords = async () => {
    const parsed = parseCoords(editForm.coords);

    if (!parsed) {
      showToast("Sai tọa độ. Vui lòng nhập đúng định dạng lat, lng.", "warning");
      return;
    }

    if (!isInVietnam(parsed.lat, parsed.lng)) {
      showToast("Vị trí nằm ngoài phạm vi hỗ trợ tại Việt Nam.", "warning");
      return;
    }

    if (!editProvinces.length) {
      showToast("Danh sách tỉnh/thành đang tải, vui lòng thử lại sau.", "warning");
      return;
    }

    setEditIsFindingCoords(true);

    try {
      await fillEditAddressFromLatLng(parsed.lat, parsed.lng);
      showToast("Đã xác định địa chỉ từ tọa độ.", "success");
    } catch (err) {
      console.error("Lỗi khi tìm địa chỉ từ tọa độ:", err);

      setEditForm((prev) => ({
        ...prev,
        lat: parsed.lat,
        lng: parsed.lng,
        coords: `${parsed.lat},${parsed.lng}`,
      }));
      setEditMapPosition([parsed.lat, parsed.lng]);

      showToast("Không thể lấy địa chỉ từ tọa độ.", "error");
    } finally {
      setEditIsFindingCoords(false);
    }
  };

  useEffect(() => {
    fetchMyRescues(false);

    const interval = setInterval(() => {
      if (!showUpdateModal) {
        fetchMyRescues(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        setEditLoadingProvinces(true);
        const res = await fetch("https://provinces.open-api.vn/api/v2/p/");
        const data = await res.json();

        setEditProvinces(
          (Array.isArray(data) ? data : []).map((item: any) => ({
            code: item.code,
            name: item.name,
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách tỉnh/thành", err);
        showToast("Không tải được danh sách tỉnh/thành.", "error");
      } finally {
        setEditLoadingProvinces(false);
      }
    };

    fetchProvinces();
  }, []);

  useEffect(() => {
    const fullAddress = buildEditFullAddress();

    setEditForm((prev) => ({
      ...prev,
      address: fullAddress,
    }));
  }, [
    editAddressDetail,
    editSelectedProvinceCode,
    editSelectedWardCode,
    editProvinces,
    editWards,
  ]);

  useEffect(() => {
    if (!showUpdateModal || !selectedRescueId || didInitUpdateFormRef.current) return;

    const rescue = rescues.find((r) => r.id === selectedRescueId);
    if (!rescue) return;

    const lat = Number(rescue.lat);
    const lng = Number(rescue.lng);
    const parsedExistingImages = parseImages(rescue.images);

    setEditSosType(rescue.sos_type || "");
    setEditLocationMode("address");

    setEditSelectedProvinceCode("");
    setEditSelectedWardCode("");
    setEditAddressDetail("");
    setEditWards([]);

    setEditForm({
      name: rescue.name || "",
      phone: rescue.phone || "",
      address: rescue.address || "",
      coords:
        Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : "",
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      victims: rescue.victims || 1,
      note: rescue.note || "",
      source_url: rescue.source_url || "",
    });

    setEditMapPosition(
      Number.isFinite(lat) && Number.isFinite(lng)
        ? [lat, lng]
        : [16.047079, 108.20623]
    );

    setEditImages([]);
    setExistingImages(parsedExistingImages);
    setShowConfirmCloseUpdateModal(false);
    setInitialEditSnapshot("");
    setEditSnapshotReady(false);

    didInitUpdateFormRef.current = true;
  }, [showUpdateModal, selectedRescueId]);

  useEffect(() => {
    if (
      !showUpdateModal ||
      !selectedRescueId ||
      !editProvinces.length ||
      didInitReverseRef.current
    ) {
      return;
    }

    const rescue = rescues.find((r) => r.id === selectedRescueId);
    if (!rescue) return;

    const lat = Number(rescue.lat);
    const lng = Number(rescue.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setEditSnapshotReady(true);
      didInitReverseRef.current = true;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await fillEditAddressFromLatLng(lat, lng);

        if (!cancelled) {
          setEditSnapshotReady(true);
          didInitReverseRef.current = true;
        }
      } catch (err) {
        console.error("Không tự fill được địa chỉ từ tọa độ:", err);

        if (!cancelled) {
          setEditSnapshotReady(true);
          didInitReverseRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showUpdateModal, selectedRescueId, editProvinces.length]);

  useEffect(() => {
    if (!showUpdateModal) {
      didInitUpdateFormRef.current = false;
      didInitReverseRef.current = false;
      return;
    }

    didInitUpdateFormRef.current = false;
    didInitReverseRef.current = false;
  }, [showUpdateModal, selectedRescueId]);

  useEffect(() => {
    if (!showUpdateModal || !editSnapshotReady || initialEditSnapshot) return;

    const timer = setTimeout(() => {
      setInitialEditSnapshot(buildEditSnapshot());
    }, 0);

    return () => clearTimeout(timer);
  }, [showUpdateModal, editSnapshotReady, initialEditSnapshot]);

  useEffect(() => {
    const fetchWards = async () => {
      if (!editSelectedProvinceCode) {
        setEditWards([]);
        setEditSelectedWardCode("");
        return;
      }

      try {
        setEditLoadingWards(true);
        const res = await fetch(
          `https://provinces.open-api.vn/api/v2/p/${editSelectedProvinceCode}?depth=2`
        );
        const data = await res.json();

        setEditWards(
          (data.wards || []).map((item: any) => ({
            code: item.code,
            name: item.name,
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách phường/xã", err);
        setEditWards([]);
        showToast("Không tải được danh sách phường/xã.", "error");
      } finally {
        setEditLoadingWards(false);
      }
    };

    fetchWards();
  }, [editSelectedProvinceCode]);

  const statusTabs = [
    { value: "all", label: "Tất cả" },
    { value: "new", label: "Đang chờ" },
    { value: "rescuing", label: "Đang được cứu hộ" },
    { value: "done", label: "Hoàn thành" },
    { value: "cancel", label: "Đã hủy" },
  ] as const;

  const baseFilteredRescues = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return rescues.filter((item) => {
      if (sosTypeFilter !== "all" && item.sos_type !== sosTypeFilter) {
        return false;
      }

      if ((dateRange.start || dateRange.end) && item.created_at) {
        const created = new Date(item.created_at);

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
          item.name,
          item.phone,
          item.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchBlob.includes(keyword)) return false;
      }

      return true;
    });
  }, [rescues, sosTypeFilter, dateRange, searchTerm]);

  const statusCounts = useMemo(() => {
    const activeItems = baseFilteredRescues.filter((item) => item.status !== "cancel");

    return {
      all: activeItems.length,
      new: activeItems.filter((item) => item.status === "new").length,
      rescuing: activeItems.filter((item) => item.status === "rescuing").length,
      done: activeItems.filter((item) => item.status === "done").length,
      cancel: baseFilteredRescues.filter((item) => item.status === "cancel").length,
    };
  }, [baseFilteredRescues]);

  const filteredRescues = useMemo(() => {
    let list = [...baseFilteredRescues];

    if (statusFilter === "all") {
      list = list.filter((item) => item.status !== "cancel");
    } else {
      list = list.filter((item) => item.status === statusFilter);
    }

    list.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : a.id;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : b.id;

      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [baseFilteredRescues, statusFilter, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sosTypeFilter, dateRange.start, dateRange.end, searchTerm, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRescues.length / itemsPerPage)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;

  const currentRescues = filteredRescues.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const fromRecord = filteredRescues.length === 0 ? 0 : startIndex + 1;
  const toRecord =
    filteredRescues.length === 0
      ? 0
      : Math.min(startIndex + itemsPerPage, filteredRescues.length);

  const activeRescues = rescues.filter((r) => r.status !== "cancel");
  const cancelCount = rescues.filter((r) => r.status === "cancel").length;
  const waitingCount = activeRescues.filter(
    (r) => getStepStatus(r).currentStep === 1
  ).length;

  const rescuingCount = activeRescues.filter((r) => {
    const step = getStepStatus(r).currentStep;
    return step === 2 || step === 3;
  }).length;

  const doneCount = activeRescues.filter(
    (r) => getStepStatus(r).currentStep === 4
  ).length;

  const handleEditInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let newValue = value.replace(/\D/g, "");

      if (newValue.length === 1 && newValue !== "0") return;
      if (newValue.length > 10) return;

      setEditForm((prev) => ({ ...prev, phone: newValue }));
      return;
    }

    if (name === "victims") {
      const num = Math.max(1, Number(value) || 1);
      setEditForm((prev) => ({ ...prev, victims: num }));
      return;
    }

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const fetchEditWardsByProvinceCode = async (provinceCode: string) => {
    const res = await fetch(
      `https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`
    );
    const data = await res.json();

    return (data.wards || []).map((item: any) => ({
      code: item.code,
      name: item.name,
    })) as Ward[];
  };

  const fillEditAddressFromLatLng = async (lat: number, lng: number) => {
    const reverseRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: { Accept: "application/json" },
      }
    );

    const reverseData = await reverseRes.json();
    const addr = reverseData.address || {};

    const provinceName =
      addr.state ||
      addr.city ||
      addr.province ||
      addr.region ||
      addr.county ||
      addr.municipality ||
      "";

    const wardName =
      addr.suburb ||
      addr.city_district ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      "";

    const detail = buildAddressDetailFromReverse(addr) || reverseData.name || "";

    let matchedProvinceCode = "";
    let matchedWardCode = "";
    let fetchedWards: Ward[] = [];

    const matchedProvince = findProvinceByName(provinceName, editProvinces);

    if (matchedProvince) {
      matchedProvinceCode = String(matchedProvince.code);
      setEditSelectedProvinceCode(matchedProvinceCode);

      fetchedWards = await fetchEditWardsByProvinceCode(matchedProvinceCode);
      setEditWards(fetchedWards);

      const matchedWard = findWardByName(wardName, fetchedWards);
      if (matchedWard) {
        matchedWardCode = String(matchedWard.code);
        setEditSelectedWardCode(matchedWardCode);
      } else {
        setEditSelectedWardCode("");
      }
    } else {
      setEditSelectedProvinceCode("");
      setEditSelectedWardCode("");
      setEditWards([]);
    }

    setEditAddressDetail(detail);

    const finalProvince =
      matchedProvinceCode && matchedProvince
        ? normalizeProvinceLabel(matchedProvince.name)
        : "";

    const finalWard =
      matchedWardCode && fetchedWards.length
        ? normalizeWardLabel(
          fetchedWards.find((w) => String(w.code) === matchedWardCode)?.name ||
          ""
        )
        : "";

    const finalAddress =
      [detail, finalWard, finalProvince].filter(Boolean).join(", ") ||
      reverseData.display_name ||
      "";

    setEditForm((prev) => ({
      ...prev,
      lat,
      lng,
      coords: `${lat},${lng}`,
      address: finalAddress,
    }));

    setEditMapPosition([lat, lng]);

    return finalAddress;
  };

  const getEditGPS = async () => {
    if (!editProvinces.length) {
      showToast("Danh sách tỉnh/thành đang tải, vui lòng thử lại sau.", "warning");
      return;
    }

    setEditIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          setEditMapPosition([lat, lng]);
          await fillEditAddressFromLatLng(lat, lng);
          showToast("Đã lấy vị trí GPS thành công.", "success");
        } catch (err) {
          console.error("Lỗi khi reverse GPS:", err);

          setEditAddressDetail("");
          setEditForm((prev) => ({
            ...prev,
            lat,
            lng,
            coords: `${lat},${lng}`,
            address: "",
          }));
          setEditMapPosition([lat, lng]);
          showToast("Không thể xác định địa chỉ từ GPS.", "error");
        } finally {
          setEditIsGettingGPS(false);
        }
      },
      () => {
        showToast("Không lấy được vị trí GPS.", "error");
        setEditIsGettingGPS(false);
      }
    );
  };

  const getEditCoordsFromAddress = async () => {
    const fullAddress = buildEditFullAddress();

    if (!editSelectedProvinceCode) {
      showToast("Vui lòng chọn tỉnh/thành.", "warning");
      return;
    }

    if (!editSelectedWardCode) {
      showToast("Vui lòng chọn phường/xã.", "warning");
      return;
    }

    if (!editAddressDetail.trim()) {
      showToast("Vui lòng nhập địa chỉ chi tiết.", "warning");
      return;
    }

    setEditIsFindingAddress(true);

    try {
      const queries = [
        fullAddress,
        `${fullAddress}, Việt Nam`,
        `${editAddressDetail}, ${fullAddress}, Việt Nam`,
      ];

      let found: any = null;

      for (const q of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q=${encodeURIComponent(
            q
          )}`,
          { headers: { Accept: "application/json" } }
        );

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          found = data[0];
          break;
        }
      }

      if (!found) {
        showToast("Không tìm thấy địa chỉ. Vui lòng kiểm tra lại.", "warning");
        return;
      }

      const lat = parseFloat(found.lat);
      const lng = parseFloat(found.lon);

      setEditMapPosition([lat, lng]);
      setEditForm((prev) => ({
        ...prev,
        address: fullAddress,
        lat,
        lng,
        coords: `${lat},${lng}`,
      }));
      showToast("Đã xác định tọa độ từ địa chỉ.", "success");
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi tìm địa chỉ.", "error");
    } finally {
      setEditIsFindingAddress(false);
    }
  };

  const handleUpdateRescue = async () => {
    if (!selectedRescue) return;

    const phoneRegex = /^(0|\+84)[0-9]{9}$/;

    if (!editForm.name.trim()) {
      showToast("Vui lòng nhập họ và tên.", "warning");
      return;
    }

    if (!editForm.phone.trim()) {
      showToast("Vui lòng nhập số điện thoại.", "warning");
      return;
    }

    if (!phoneRegex.test(editForm.phone)) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    if (editForm.victims < 1) {
      showToast("Số người cần hỗ trợ phải lớn hơn hoặc bằng 1.", "warning");
      return;
    }

    try {
      setUpdating(true);

      const formData = new FormData();
      let lat = editForm.lat;
      let lng = editForm.lng;
      let finalAddress = editForm.address;

      if (editLocationMode === "coords") {
        const parsed = parseCoords(editForm.coords);

        if (!parsed) {
          showToast("Tọa độ không hợp lệ.", "warning");
          return;
        }

        lat = parsed.lat;
        lng = parsed.lng;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast("Vị trí không hợp lệ.", "warning");
        return;
      }

      if (!isInVietnam(lat, lng)) {
        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
        return;
      }

      if (!editSosType) {
        showToast("Vui lòng chọn loại yêu cầu.", "warning");
        return;
      }

      if (!finalAddress?.trim()) {
        finalAddress = buildEditFullAddress() || selectedRescue.address || "";
      }

      formData.append("name", editForm.name);
      formData.append("phone", editForm.phone);
      formData.append("address", finalAddress);
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));
      formData.append("victims", String(editForm.victims));
      formData.append("note", editForm.note);
      formData.append("source_url", editForm.source_url);
      formData.append("sos_type", editSosType);

      formData.append("existingImages", JSON.stringify(existingImages));

      editImages.forEach((img) => {
        formData.append("images", img);
      });

      const res = await fetch(`${API_BASE}/api/rescues/${selectedRescue.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "Cập nhật yêu cầu thất bại.", "error");
        return;
      }

      setShowUpdateModal(false);
      setInitialEditSnapshot("");

      if (returnToDetailAfterUpdate) {
        setShowDetailModal(true);
        setReturnToDetailAfterUpdate(false);
      }

      showToast("Cập nhật yêu cầu thành công.", "success");
      await fetchMyRescues(true);
    } catch {
      showToast("Lỗi server khi cập nhật yêu cầu.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedRescue || selectedRescue.status !== "new") return;

    try {
      setCancelling(true);

      const res = await fetch(
        `${API_BASE}/api/rescues/${selectedRescue.id}/cancel`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "Hủy yêu cầu thất bại.", "error");
        return;
      }

      setShowCancelConfirmModal(false);
      setShowDetailModal(false);
      setReturnToDetailAfterCancel(false);

      showToast("Đã hủy yêu cầu cứu hộ.", "success");
      await fetchMyRescues(true);
    } catch {
      showToast("Lỗi server khi hủy yêu cầu.", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#14171e] transition-colors">
        <NotificationToast toast={toast} onClose={closeToast} />
        <Navbar />
        <div className="pt-28 flex items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-5 py-4 text-slate-600 dark:text-slate-300 font-semibold shadow-sm">
            <Loader2 className="animate-spin" size={20} />
            Đang tải yêu cầu SOS của bạn...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#14171e] font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <NotificationToast toast={toast} onClose={closeToast} />
      <Navbar />

      <main className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <section className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_24%)]" />

          <div className="relative px-5 md:px-6 py-5 md:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                <Sparkles size={14} />
                Theo dõi cứu hộ thời gian thực
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                YÊU CẦU CỦA TÔI
              </h1>

              <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                Quản lý các yêu cầu bạn đã gửi, xem trạng thái tiếp nhận, quá trình di chuyển của đội cứu hộ và cập nhật thêm thông tin khi cần.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Activity size={13} />
                  Cập nhật 5 giây/lần
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Users size={13} />
                  Hiển thị tiến trình cứu hộ
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowSOSModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 border border-red-600 text-white text-sm transition font-semibold"
              >
                <Waves size={16} />
                Tạo yêu cầu SOS
              </button>
              <button
                onClick={() => fetchMyRescues(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
              >
                <RefreshCw size={16} className={reloading ? "animate-spin" : ""} />
                Làm mới
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-5 py-4 text-red-700 dark:text-red-300 font-semibold">
            {error}
          </div>
        ) : rescues.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-700 dark:text-slate-100">
              Bạn chưa gửi yêu cầu SOS nào.
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Bấm nút "Tạo yêu cầu SOS" ở trên để gửi yêu cầu cứu hộ mới ngay từ trang này.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                title="Đang chờ"
                value={waitingCount}
                tone="amber"
                icon={<TimerReset size={18} />}
                note="Chưa có đội tiếp nhận"
              />
              <SummaryCard
                title="Đang được cứu hộ"
                value={rescuingCount}
                tone="blue"
                icon={<Truck size={18} />}
                note="Đã tiếp nhận và đang hỗ trợ"
              />
              <SummaryCard
                title="Hoàn thành"
                value={doneCount}
                tone="emerald"
                icon={<CheckCircle2 size={18} />}
                note="Đã được hỗ trợ xong"
              />
              <SummaryCard
                title="Đã hủy"
                value={cancelCount}
                tone="red"
                icon={<XCircle size={18} />}
                note="Không tiếp tục xử lý"
              />
            </div>

            <div className="rounded-[30px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 dark:border-white/5 px-4 md:px-6 py-4 bg-white dark:bg-slate-900">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div>
                      <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                        Yêu cầu đã gửi
                      </h2>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Xem trạng thái và cập nhật các yêu cầu SOS do bạn đã gửi.
                      </p>
                    </div>
                  </div>

                  {/* Hàng 1: tìm kiếm + sắp xếp */}
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
                        placeholder="Tìm theo ID, tên người gửi, địa chỉ, số điện thoại..."
                        className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* Hàng 2: mới nhất + loại yêu cầu + khoảng ngày + đặt lại */}
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
                        <span className="truncate">{getSosTypeFilterLabel(sosTypeFilter)}</span>
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
                                : `Bước 2/2: Từ ${formatDateOnly(dateRange.start)}, chọn ngày cuối`}
                            </p>
                          </div>

                          <div className="mt-4">
                            <input
                              type="date"
                              value={datePickerStep === "start" ? dateRange.start : dateRange.end}
                              min={datePickerStep === "end" && dateRange.start ? dateRange.start : undefined}
                              onChange={(e) => handleSelectRangeDate(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500 dark:text-slate-400">Ngày đầu:</span>
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {dateRange.start ? formatDateOnly(dateRange.start) : "Chưa chọn"}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <span className="text-slate-500 dark:text-slate-400">Ngày cuối:</span>
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {dateRange.end ? formatDateOnly(dateRange.end) : "Chưa chọn"}
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
                        setStatusFilter("all");
                        setSosTypeFilter("all");
                        setDateRange({ start: "", end: "" });
                        setSortOrder("newest");
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

                  {/* Hàng 3: tab trạng thái */}
                  <div className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-2">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                      {statusTabs.map((tab) => {
                        const active = statusFilter === tab.value;
                        const count = statusCounts[tab.value as keyof typeof statusCounts] ?? 0;

                        return (
                          <button
                            key={tab.value}
                            type="button"
                            onClick={() => setStatusFilter(tab.value)}
                            className={cn(
                              "w-full inline-flex min-h-[40px] items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-bold text-center transition",
                              active
                                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm"
                                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900"
                            )}
                          >
                            {tab.label} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-5 bg-slate-50/70 dark:bg-[#14171e]">
                {filteredRescues.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                      <ClipboardList size={24} />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">
                      Không có yêu cầu phù hợp
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Hãy thử thay đổi bộ lọc để xem thêm dữ liệu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentRescues.map((item) => {
                      const step = getStepStatus(item);
                      const tracking = getTrackingInfo(item);
                      const canEdit = item.status !== "done" && item.status !== "cancel";
                      const canCancel = item.status === "new";

                      const toneMap = {
                        1: {
                          line: "bg-amber-500",
                          soft: "bg-amber-50 dark:bg-amber-900/10",
                        },
                        2: {
                          line: "bg-blue-500",
                          soft: "bg-blue-50 dark:bg-blue-900/10",
                        },
                        3: {
                          line: "bg-blue-500",
                          soft: "bg-blue-50 dark:bg-blue-900/10",
                        },
                        4: {
                          line: "bg-emerald-500",
                          soft: "bg-emerald-50 dark:bg-emerald-900/10",
                        },
                      } as const;

                      const currentTone =
                        item.status === "cancel"
                          ? {
                            line: "bg-red-500",
                            soft: "bg-red-50 dark:bg-red-900/10",
                          }
                          : toneMap[step.currentStep];

                      return (
                        <div
                          key={item.id}
                          className="group relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className={`absolute left-0 top-0 h-full w-1 ${currentTone.line}`} />

                          <div className="p-4 md:p-4.5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1 text-[10px] font-black tracking-[0.18em]">
                                    #SOS-{item.id}
                                  </span>

                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${step.badgeClass}`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${getStepDotClass(item.status)}`} />
                                    {step.title}
                                  </span>

                                  <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                                    {getSosTypeLabel(item.sos_type)}
                                  </span>
                                </div>

                                <div className="mt-3 rounded-[18px] px-3 py-3 bg-gray-100 dark:bg-gray-950/50">
                                  <h3 className="text-sm md:text-[15px] font-black text-slate-900 dark:text-white line-clamp-2">
                                    {item.address || "Không có địa chỉ"}
                                  </h3>

                                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1.5">
                                      <User size={13} />
                                      {item.name || "Chưa có tên"}
                                    </span>

                                    <span className="inline-flex items-center gap-1.5">
                                      <Phone size={13} />
                                      {item.phone || "Chưa có số điện thoại"}
                                    </span>

                                    <span className="inline-flex items-center gap-1.5">
                                      <Users size={13} />
                                      {item.victims || 1} người
                                    </span>

                                    <span className="inline-flex items-center gap-1.5">
                                      <CalendarDays size={13} />
                                      {formatDateTime(item.created_at)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">

                                  {item.assigned_team && (
                                    <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                      Đội phụ trách: {item.assigned_team}
                                    </span>
                                  )}

                                  {tracking && step.currentStep === 3 && (
                                    <>
                                      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                        Cách: {tracking.distanceText}
                                      </span>

                                      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                        Dự kiến: {tracking.etaText}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="xl:w-auto shrink-0">
                                <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-1.5 xl:min-w-[132px]">
                                  <button
                                    onClick={() => {
                                      setSelectedRescueId(item.id);
                                      setShowDetailModal(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                                  >
                                    Chi tiết
                                    <ChevronRight size={12} />
                                  </button>

                                  {canEdit && (
                                    <button
                                      onClick={() => {
                                        setSelectedRescueId(item.id);
                                        setShowUpdateModal(true);
                                      }}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                      <Edit3 size={12} />
                                      Cập nhật
                                    </button>
                                  )}

                                  {canCancel && (
                                    <button
                                      onClick={() => {
                                        setSelectedRescueId(item.id);
                                        setReturnToDetailAfterCancel(false);

                                        if (!cancelling) {
                                          setShowCancelConfirmModal(true);
                                        }
                                      }}
                                      disabled={cancelling}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-700 disabled:opacity-70"
                                    >
                                      <XCircle size={12} />
                                      Hủy yêu cầu
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị <span className="font-semibold">{fromRecord}</span> -{" "}
                  <span className="font-semibold">{toRecord}</span> trong tổng số{" "}
                  <span className="font-semibold">{filteredRescues.length}</span> bản ghi
                </p>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <PaginationButton
                    icon={<ChevronLeft size={16} />}
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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

            </div>
          </>
        )}
      </main>

      <footer className="mt-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
                    <HomeIcon className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteam_user"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Yêu cầu của tôi
                  </a>
                </li>
                <li>
                  <a
                    href="/about"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Info className="h-4 w-4" />
                    Hướng dẫn an toàn
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

      {previewImg && (
        <div
          className="fixed inset-0 z-[8000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img
            src={previewImg}
            alt="Preview"
            className="max-w-[90%] max-h-[90%] rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {showDetailModal && selectedRescue && selectedStep && (
        <div
          className="fixed inset-0 z-[6900] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] min-h-0 overflow-hidden rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-[0_24px_70px_rgba(15,23,42,0.32)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-30 shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-4 md:px-5 py-4 md:py-4.5 border-b border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[10px] text-slate-200">
                    <Activity size={12} />
                    Trạng thái chi tiết
                  </div>

                  <h3 className="mt-2.5 text-base md:text-lg font-black uppercase tracking-tight">
                    Chi tiết yêu cầu SOS
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 font-mono">
                    Mã yêu cầu: #SOS-{selectedRescue.id}
                  </p>
                </div>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-full p-2 text-white transition hover:bg-white/10"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 xl:p-4.5 space-y-4 bg-slate-50 dark:bg-[#14171e]">
              <section className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Trình trạng cứu hộ
                    </h2>
                  </div>

                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
                      selectedStep.badgeClass
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", getStepDotClass(selectedRescue.status))} />
                    {selectedStep.title}
                  </span>
                </div>

                <div className="rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 p-4 md:p-5">
                  <div className="relative">
                    <div className="absolute left-0 right-0 top-6 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />

                    <div
                      className="absolute left-0 top-6 h-1 rounded-full bg-blue-600 transition-all duration-500"
                      style={{
                        width:
                          selectedStep.currentStep === 1
                            ? "12.5%"
                            : selectedStep.currentStep === 2
                              ? "39%"
                              : selectedStep.currentStep === 3
                                ? "68%"
                                : "100%",
                      }}
                    />

                    <div className="relative grid grid-cols-4 gap-3">
                      <Step
                        icon={<CheckCircle2 size={14} />}
                        label="Gửi yêu cầu"
                        active
                        done={selectedStep.currentStep > 1}
                        current={selectedStep.currentStep === 1}
                        time={formatDateTime(selectedRescue.created_at)}
                        compact
                      />

                      <Step
                        icon={<ClipboardList size={14} />}
                        label="Tiếp nhận"
                        active={selectedStep.currentStep >= 2}
                        done={selectedStep.currentStep > 2}
                        current={selectedStep.currentStep === 2}
                        time={formatDateTime(selectedRescue.received_at)}
                        compact
                      />

                      <Step
                        icon={<Truck size={14} />}
                        label="Đang đến"
                        active={selectedStep.currentStep >= 3}
                        done={selectedStep.currentStep > 3}
                        current={selectedStep.currentStep === 3}
                        time={
                          selectedRescue.status === "done" || selectedRescue.status === "cancel"
                            ? ""
                            : selectedRescue.status === "rescuing" &&
                              selectedStep.currentStep === 3
                              ? trackingInfo?.etaText
                                ? `Dự kiến: ${trackingInfo.etaText}`
                                : "Đang di chuyển"
                              : ""
                        }
                        compact
                      />

                      <Step
                        icon={<Flag size={14} />}
                        label="Hoàn thành"
                        active={selectedStep.currentStep >= 4}
                        done={selectedStep.currentStep >= 4}
                        current={selectedStep.currentStep === 4}
                        time={formatDateTime(selectedRescue.completed_at)}
                        compact
                      />
                    </div>
                  </div>

                  {selectedRescue.status === "cancel" ? (
                    <StatusBanner
                      tone="red"
                      icon={<XCircle size={20} />}
                      title="Yêu cầu đã bị hủy"
                      desc="Yêu cầu này đã được hủy nên sẽ không tiếp tục xử lý cứu hộ."
                      compact
                    />
                  ) : selectedRescue.status === "done" ? (
                    <StatusBanner
                      tone="emerald"
                      icon={<CheckCircle2 size={20} />}
                      title="Yêu cầu đã hoàn thành"
                      desc={`Yêu cầu của bạn đã được xử lý xong${selectedRescue.completed_at
                        ? ` vào lúc ${formatDateTime(selectedRescue.completed_at)}`
                        : ""
                        }.`}
                      compact
                    />
                  ) : selectedStep.currentStep === 1 ? (
                    <StatusBanner
                      tone="amber"
                      icon={<Clock3 size={20} />}
                      title="Đang chờ đội cứu hộ nhận yêu cầu"
                      desc="Yêu cầu của bạn đã được gửi thành công và đang chờ tiếp nhận."
                      compact
                    />
                  ) : (
                    <StatusBanner
                      tone="blue"
                      icon={<MapPin size={20} />}
                      title={
                        selectedStep.currentStep === 3
                          ? "Vị trí đội cứu hộ"
                          : "Yêu cầu đã được tiếp nhận"
                      }
                      desc={
                        selectedStep.currentStep === 3
                          ? trackingInfo
                            ? `Đội cứu hộ còn cách bạn ${trackingInfo.distanceText} - Dự kiến ${trackingInfo.etaText}.`
                            : "Đội cứu hộ đang di chuyển đến vị trí của bạn."
                          : "Đội cứu hộ đã tiếp nhận yêu cầu và đang chuẩn bị hỗ trợ."
                      }
                      compact
                    />
                  )}
                </div>
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-4">
                <section className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm"><div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                    <Info size={16} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Chi tiết yêu cầu
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Thông tin đầy đủ của yêu cầu SOS
                    </p>
                  </div>
                </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DetailCard
                      label="Mã yêu cầu"
                      value={`#SOS-${selectedRescue.id}`}
                      compact
                    />
                    <DetailCard
                      label="Loại yêu cầu"
                      value={getSosTypeLabel(selectedRescue.sos_type)}
                      compact
                    />
                    <DetailCard
                      label="Vị trí cứu trợ"
                      value={selectedRescue.address || "Chưa có"}
                      full
                      compact
                    />
                    <DetailCard
                      label="Tọa độ"
                      value={`${selectedRescue.lat}, ${selectedRescue.lng}`}
                      full
                      compact
                    />
                    <DetailCard
                      label="Mô tả tình trạng"
                      value={selectedRescue.note || "Chưa có mô tả"}
                      full
                      italic
                      compact
                    />
                  </div>

                  {parseImages(selectedRescue.images).length > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <ImageIcon size={16} />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          Hình ảnh hiện trường
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {parseImages(selectedRescue.images).map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreviewImg(`${API_BASE}${img}`)}
                            className="group relative overflow-hidden rounded-[16px] border border-slate-200 dark:border-white/10"
                          >
                            <img
                              src={`${API_BASE}${img}`}
                              alt={`Ảnh hiện trường ${idx + 1}`}
                              className="h-28 md:h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRescue.source_url && (
                    <div className="mt-5 rounded-[18px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <LinkIcon size={16} />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          Link nguồn
                        </h3>
                      </div>

                      <a
                        href={selectedRescue.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs md:text-sm font-semibold text-blue-600 underline dark:text-blue-400"
                      >
                        {selectedRescue.source_url}
                      </a>
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <div className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <User size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                          Người gửi yêu cầu
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Thông tin người cần hỗ trợ
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <DetailRow
                        icon={<User size={14} />}
                        label="Họ tên"
                        value={selectedRescue.name || "Chưa có"}
                        compact
                      />
                      <DetailRow
                        icon={<PhoneCall size={14} />}
                        label="Số điện thoại"
                        value={selectedRescue.phone || "Chưa có"}
                        compact
                      />
                      <DetailRow
                        icon={<Users size={14} />}
                        label="Số người cần hỗ trợ"
                        value={`${selectedRescue.victims || 1} người`}
                        compact
                      />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                        <Users size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                          Đội cứu hộ phụ trách
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Thông tin hỗ trợ trực tiếp
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-3.5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedRescue.assigned_team || "Chưa có đội nhận"}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        SĐT: {selectedRescue.rescuer_phone || "Chưa có"}
                      </p>
                    </div>
                    {selectedRescue.rescuer_phone ? (
                      <a
                        href={`tel:${selectedRescue.rescuer_phone}`}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                      >
                        <PhoneCall size={14} />
                        Liên hệ đội cứu hộ
                      </a>
                    ) : (
                      <button
                        disabled
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      >
                        <PhoneCall size={14} />
                        Chưa có số liên hệ
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 dark:border-white/5 p-3 md:p-4 bg-white dark:bg-slate-900">
              <div className="flex flex-col md:flex-row gap-2 md:justify-end">
                {selectedRescue.status !== "done" &&
                  selectedRescue.status !== "cancel" && (
                    <button
                      onClick={() => {
                        setReturnToDetailAfterUpdate(true);
                        setShowDetailModal(false);
                        setShowUpdateModal(true);
                      }}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cập nhật
                    </button>
                  )}

                {selectedRescue.status === "new" && (
                  <button
                    onClick={() => {
                      if (!cancelling) {
                        setReturnToDetailAfterCancel(true);
                        setShowDetailModal(false);
                        setShowCancelConfirmModal(true);
                      }
                    }}
                    disabled={cancelling}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                  >
                    Hủy yêu cầu
                  </button>
                )}

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && selectedRescue && (
        <div
          className="fixed inset-0 z-[6900] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
          onClick={handleCloseUpdateModal}
        >
          <div
            className="bg-white text-slate-900 w-[560px] rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 text-white text-center py-6 relative">
              <h3 className="font-bold text-xl">CẬP NHẬT THÔNG TIN YÊU CẦU</h3>
              <p className="text-xs opacity-90 mt-1">
                Vui lòng cập nhật đầy đủ thông tin để đội cứu hộ hỗ trợ chính xác hơn
              </p>
              <button
                onClick={handleCloseUpdateModal}
                disabled={updating}
                className="absolute top-4 right-4 hover:bg-slate-100 hover:text-slate-700 rounded-full p-1 transition"
              >
                <X />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-900">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2 text-sm">
                  1. Phân loại yêu cầu: <span className="text-red-500">*</span>
                </h3>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditSosType("rescue")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "rescue"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-black border-gray-300 hover:bg-red-50"
                      }`}
                  >
                    Cần cứu hộ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("supplies")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "supplies"
                      ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-white text-black border-gray-300 hover:bg-yellow-50"
                      }`}
                  >
                    Cần nhu yếu phẩm
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("vehicle")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "vehicle"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-black border-gray-300 hover:bg-blue-50"
                      }`}
                  >
                    Cần cứu hộ xe
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("other")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "other"
                      ? "bg-gray-600 text-white border-gray-600"
                      : "bg-white text-black border-gray-300 hover:bg-gray-100"
                      }`}
                  >
                    Yêu cầu khác
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 mb-3">
                  2. Thông tin cá nhân: <span className="text-red-500">*</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Họ và tên
                    </label>
                    <input
                      name="name"
                      value={editForm.name}
                      onChange={handleEditInput}
                      placeholder="Nhập họ và tên"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Số điện thoại
                    </label>
                    <input
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditInput}
                      placeholder="Ví dụ: 0912345678"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">
                  3. Vị trí hiện tại: <span className="text-red-500">*</span>
                </h3>

                <div
                  className="flex bg-slate-100 rounded-lg p-1 text-xs mb-3"
                  style={{ width: "129px" }}
                >
                  <button
                    type="button"
                    onClick={() => setEditLocationMode("address")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "address" ? "bg-white shadow" : ""
                      }`}
                  >
                    Địa chỉ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditLocationMode("coords")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "coords" ? "bg-white shadow" : ""
                      }`}
                  >
                    Tọa độ
                  </button>
                </div>

                {editLocationMode === "address" && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Tỉnh / Thành phố
                        </label>
                        <select
                          value={editSelectedProvinceCode}
                          onChange={(e) => {
                            setEditSelectedProvinceCode(e.target.value);
                            setEditSelectedWardCode("");
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white"
                        >
                          <option value="">
                            {editLoadingProvinces
                              ? "Đang tải tỉnh/thành..."
                              : "Chọn tỉnh / thành phố"}
                          </option>
                          {editProvinces.map((province) => (
                            <option key={province.code} value={province.code}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Phường / Xã
                        </label>
                        <select
                          value={editSelectedWardCode}
                          onChange={(e) => {
                            setEditSelectedWardCode(e.target.value);
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          disabled={!editSelectedProvinceCode || editLoadingWards}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white disabled:bg-slate-100"
                        >
                          <option value="">
                            {!editSelectedProvinceCode
                              ? "Chọn tỉnh/thành trước"
                              : editLoadingWards
                                ? "Đang tải phường/xã..."
                                : "Chọn phường / xã"}
                          </option>
                          {editWards.map((ward) => (
                            <option key={ward.code} value={ward.code}>
                              {ward.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Địa chỉ chi tiết
                        </label>
                        <input
                          value={editAddressDetail}
                          onChange={(e) => {
                            setEditAddressDetail(e.target.value);
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          disabled={!editSelectedWardCode}
                          placeholder="Ví dụ: 8/8 Phan Văn Trị"
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100"
                        />
                      </div>

                      <div className="bg-slate-50 border rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">
                          Địa chỉ hoàn chỉnh:
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          {buildEditFullAddress() ||
                            editForm.address ||
                            "Chưa có địa chỉ"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={getEditCoordsFromAddress}
                      disabled={editIsFindingAddress || editIsGettingGPS}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsFindingAddress
                        ? "Đang xác định địa chỉ..."
                        : "Xác định từ địa chỉ"}
                    </button>

                    <button
                      type="button"
                      onClick={getEditGPS}
                      disabled={editIsGettingGPS || editIsFindingAddress}
                      className="mt-2 w-full border border-dashed bg-slate-100 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsGettingGPS ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                          <span>Đang lấy GPS...</span>
                        </>
                      ) : (
                        <>
                          <MapPin size={16} />
                          <span>Lấy GPS tự động</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {editLocationMode === "coords" && (
                  <>
                    <input
                      name="coords"
                      value={editForm.coords}
                      onChange={handleEditInput}
                      placeholder="VD: 21.0285, 105.8542"
                      className="border border-slate-300 rounded-lg p-2 w-full"
                    />

                    <button
                      type="button"
                      onClick={handleGetAddressFromCoords}
                      disabled={editIsFindingCoords}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsFindingCoords
                        ? "Đang xác định từ tọa độ..."
                        : "Xác định từ tọa độ"}
                    </button>
                  </>
                )}

                <div className="mt-4">
                  <label className="text-xs font-medium text-slate-600 block mb-2">
                    Chọn nhanh trên bản đồ
                  </label>

                  <div className="rounded-xl overflow-hidden border border-slate-300">
                    <div className="h-[260px] w-full">
                      <MapContainer
                        center={editMapPosition}
                        zoom={15}
                        scrollWheelZoom={true}
                        zoomControl={false}
                        attributionControl={false}
                        className="h-full w-full"
                        minZoom={4}
                        maxZoom={18}
                        maxBounds={[
                          [7.0, 101.0],
                          [24.5, 110.5],
                        ]}
                        maxBoundsViscosity={1.0}
                      >
                        {editMapType === "default" ? (
                          <GoongStyleLayer enabled />
                        ) : (
                          <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution="&copy; Esri"
                          />
                        )}

                        <MiniMapFixSize />
                        <FlyToMiniMapLocation position={editMapPosition} />

                        <MiniMapSelectLocation
                          onSelect={async (lat, lng) => {
                            if (!isInVietnam(lat, lng)) {
                              showToast(
                                "Vị trí phải nằm trong khu vực Việt Nam.",
                                "warning"
                              );
                              return;
                            }

                            setEditMapPosition([lat, lng]);

                            try {
                              await fillEditAddressFromLatLng(lat, lng);
                              showToast("Đã chọn vị trí trên bản đồ.", "success");
                            } catch (err) {
                              console.error("Lỗi chọn vị trí trên map:", err);
                              setEditForm((prev) => ({
                                ...prev,
                                lat,
                                lng,
                                coords: `${lat},${lng}`,
                              }));
                              setEditMapPosition([lat, lng]);
                              showToast(
                                "Đã chọn vị trí nhưng chưa lấy được địa chỉ.",
                                "warning"
                              );
                            }
                          }}
                        />

                        <Marker position={editMapPosition} icon={miniMapMarkerIcon} />
                      </MapContainer>
                    </div>

                    <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Chỉ hiển thị khu vực Việt Nam. Nhấn trực tiếp lên bản đồ để
                      chọn vị trí mới.
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Tọa độ đang chọn: {editMapPosition[0]}, {editMapPosition[1]}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">4. Chi tiết tình hình:</h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Số lượng người cần cứu
                  </label>
                  <input
                    name="victims"
                    value={editForm.victims}
                    onChange={handleEditInput}
                    type="number"
                    min="1"
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Hình ảnh (tối đa 2 ảnh)
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (!e.target.files) return;
                    const filesArray = Array.from(e.target.files).slice(0, 2);
                    setEditImages(filesArray);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />

                <div className="flex gap-2 mt-2 flex-wrap">
                  {existingImages.map((img, idx) => (
                    <div
                      key={`old-${idx}`}
                      className="relative w-20 h-20 border rounded-lg overflow-hidden"
                    >
                      <img
                        src={`${API_BASE}${img}`}
                        alt="existing"
                        className="w-full h-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setExistingImages(existingImages.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 bg-white rounded-full text-red-500 p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {editImages.map((file, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative w-20 h-20 border rounded-lg overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setEditImages(editImages.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 bg-white rounded-full text-red-500 p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. Tình trạng hiện tại:</h3>
                <textarea
                  name="note"
                  value={editForm.note}
                  onChange={handleEditInput}
                  placeholder="Cung cấp thêm chi tiết..."
                  className="border border-slate-300 rounded-lg p-2 w-full h-24"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  6. Link nguồn:{" "}
                  <span className="text-slate-400">(Tùy chọn)</span>
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Link bài đăng / nguồn thông tin
                  </label>

                  <input
                    name="source_url"
                    value={editForm.source_url}
                    onChange={handleEditInput}
                    type="url"
                    placeholder="Ví dụ: https://facebook.com/..."
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCloseUpdateModal}
                  disabled={updating}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-lg font-bold transition"
                >
                  Hủy
                </button>

                <button
                  onClick={handleUpdateRescue}
                  disabled={updating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow transition disabled:opacity-70"
                >
                  {updating ? "Đang lưu..." : "Lưu cập nhật"}
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex gap-2">
                <AlertTriangle size={16} />
                Cảnh báo: Hãy cập nhật thông tin chính xác để đội cứu hộ hỗ trợ
                nhanh nhất.
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmCloseUpdateModal && (
        <div
          className="fixed inset-0 z-[8500] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
          onClick={() => setShowConfirmCloseUpdateModal(false)}
        >
          <div
            className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] px-6 py-5 text-white">
              <h3 className="text-lg font-bold">Xác nhận đóng form</h3>
              <p className="mt-1 text-sm text-slate-200">
                Bạn đã thay đổi thông tin. Nếu đóng bây giờ, dữ liệu chưa lưu sẽ bị mất.
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-sm leading-6 text-slate-700">
                  Bạn có chắc muốn đóng form cập nhật không?
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmCloseUpdateModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmCloseUpdateModal(false);
                    setShowUpdateModal(false);

                    if (returnToDetailAfterUpdate) {
                      setShowDetailModal(true);
                      setReturnToDetailAfterUpdate(false);
                    }

                    showToast("Đã đóng form cập nhật.", "info");
                  }}
                  className="rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Đóng form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={showCancelConfirmModal && !!selectedRescue}
        item={selectedRescue}
        tone="red"
        title="Xác nhận hủy yêu cầu"
        description="Yêu cầu SOS sẽ bị hủy và không tiếp tục xử lý cứu hộ."
        message="Bạn có chắc muốn hủy yêu cầu cứu hộ này không?"
        confirmText="Xác nhận hủy"
        loadingText="Đang hủy..."
        cancelText="Quay lại"
        onConfirm={handleCancel}
        onCancel={() => {
          if (cancelling) return;

          setShowCancelConfirmModal(false);

          if (returnToDetailAfterCancel) {
            setShowDetailModal(true);
            setReturnToDetailAfterCancel(false);
          }
        }}
        loading={cancelling}
      />

      <SOSRequestModal
        isOpen={showSOSModal}
        onClose={() => setShowSOSModal(false)}
        onSuccess={() => {
          showToast("Yêu cầu SOS được tạo thành công!", "success");
          fetchMyRescues(true);
        }}
      />

      <style>{`
        .form-input-modern {
          width: 100%;
          margin-top: 0.375rem;
          border: 1px solid rgb(203 213 225);
          border-radius: 1rem;
          padding: 0.85rem 1rem;
          background: white;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.2s ease;
        }

        .form-input-modern:focus {
          border-color: rgb(37 99 235);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .dark .form-input-modern {
          background: rgb(15 23 42);
          color: white;
          border-color: rgba(255,255,255,0.1);
        }

        .dark .form-input-modern::placeholder {
          color: rgb(148 163 184);
        }
      `}</style>
    </div>
  );
};
const CompactInfo = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 px-3 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
      {label}
    </p>
    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
      {value}
    </p>
  </div>
);

const SummaryCard = ({
  title,
  value,
  tone,
  icon,
  note,
}: {
  title: string;
  value: number;
  tone: "amber" | "blue" | "cyan" | "emerald" | "red";
  icon: React.ReactNode;
  note: string;
}) => {
  const toneMap = {
    amber: {
      wrap: "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/30 dark:from-amber-900/10 dark:to-slate-900",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
      value: "text-amber-700 dark:text-amber-300",
      line: "bg-amber-500",
    },
    blue: {
      wrap: "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900/30 dark:from-blue-900/10 dark:to-slate-900",
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
      value: "text-blue-700 dark:text-blue-300",
      line: "bg-blue-500",
    },
    cyan: {
      wrap: "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white dark:border-cyan-900/30 dark:from-cyan-900/10 dark:to-slate-900",
      icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
      value: "text-cyan-700 dark:text-cyan-300",
      line: "bg-cyan-500",
    },
    emerald: {
      wrap: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/30 dark:from-emerald-900/10 dark:to-slate-900",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
      value: "text-emerald-700 dark:text-emerald-300",
      line: "bg-emerald-500",
    },
    red: {
      wrap: "border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-900/30 dark:from-red-900/10 dark:to-slate-900",
      icon: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
      value: "text-red-700 dark:text-red-300",
      line: "bg-red-500",
    },
  };

  const currentTone = toneMap[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border p-5 shadow-sm ${currentTone.wrap}`}
    >
      <div className={`absolute left-0 top-0 h-full w-1.5 ${currentTone.line}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-2 text-3xl font-black ${currentTone.value}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${currentTone.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

const MiniInfoCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-[22px] border border-slate-200 dark:border-white/5 bg-white/90 dark:bg-slate-900 px-4 py-3">
    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
      {icon}
      <p className="text-[11px] font-black uppercase tracking-wider">{label}</p>
    </div>
    <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
      {value}
    </p>
  </div>
);

const QuickTag = ({ label }: { label: string }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
    {label}
  </span>
);

const StatusBanner = ({
  tone,
  icon,
  title,
  desc,
  compact = false,
}: {
  tone: "red" | "emerald" | "amber" | "blue";
  icon: React.ReactNode;
  title: string;
  desc: string;
  compact?: boolean;
}) => {
  const toneMap = {
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300",
  };

  return (
    <div
      className={`mt-5 rounded-[18px] border ${compact ? "p-3.5 md:p-4 gap-3" : "p-4 md:p-5 gap-4"
        } flex items-start ${toneMap[tone]}`}
    >
      <div
        className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"
          } shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm`}
      >
        {icon}
      </div>
      <div>
        <p className={`${compact ? "text-xs" : "text-sm"} font-black uppercase tracking-tight`}>
          {title}
        </p>
        <p className={`mt-1 ${compact ? "text-xs leading-5" : "text-sm leading-6"} font-semibold`}>
          {desc}
        </p>
      </div>
    </div>
  );
};

const SmallStatBox = ({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) => (
  <div
    className={`rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 ${compact ? "p-3" : "p-4"
      }`}
  >
    <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-black uppercase tracking-wider text-slate-400 dark:text-slate-500`}>
      {label}
    </p>
    <p className={`mt-1.5 ${compact ? "text-xs" : "text-sm"} font-black text-slate-800 dark:text-slate-100`}>
      {value}
    </p>
  </div>
);

const DetailCard = ({
  label,
  value,
  italic,
  full,
  compact = false,
}: {
  label: string;
  value: string;
  italic?: boolean;
  full?: boolean;
  compact?: boolean;
}) => (
  <div
    className={`rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 ${compact ? "p-3.5" : "p-4"
      } ${full ? "md:col-span-2" : ""}`}
  >
    <p className={`${compact ? "text-[11px]" : "text-[11px]"} font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500`}>
      {label}
    </p>
    <p
      className={`mt-1.5 ${compact ? "text-[13px] leading-5" : "text-sm leading-6"} font-bold ${italic
        ? "italic text-slate-600 dark:text-slate-300"
        : "text-slate-800 dark:text-slate-100"
        }`}
    >
      {value}
    </p>
  </div>
);

const TypeButton = ({
  active,
  activeClass,
  inactiveClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  inactiveClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border px-4 py-2.5 text-xs font-bold transition ${active ? activeClass : inactiveClass
      }`}
  >
    {children}
  </button>
);

const FormField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
    </label>
    {children}
  </div>
);

const Step = ({
  icon,
  label,
  active,
  done,
  current,
  time,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  done?: boolean;
  current?: boolean;
  time?: string;
  compact?: boolean;
}) => {
  const iconWrapClass = current
    ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] ring-4 ring-blue-100 dark:ring-blue-900/30"
    : done || active
      ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40"
      : "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700";

  const labelClass =
    current || active || done
      ? "text-slate-900 dark:text-white"
      : "text-slate-400 dark:text-slate-500";

  const timeClass =
    current || active || done
      ? "text-slate-500 dark:text-slate-400"
      : "text-slate-400 dark:text-slate-600";

  return (
    <>
      <style>
        {`
          @keyframes rescueStepFloat {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-3px);
            }
          }

          @keyframes rescueStepWave {
            0% {
              transform: scale(1);
              opacity: 0.75;
            }
            70% {
              transform: scale(1.55);
              opacity: 0;
            }
            100% {
              transform: scale(1.55);
              opacity: 0;
            }
          }

          @keyframes rescueStepIconPulse {
            0%, 100% {
              box-shadow: 0 12px 30px rgba(37, 99, 235, 0.35);
            }
            50% {
              box-shadow: 0 16px 38px rgba(37, 99, 235, 0.5);
            }
          }
        `}
      </style>

      <div className="relative z-10 flex flex-col items-center text-center min-w-0 flex-1">
        <div className="relative">
          {current && (
            <>
              <span
                className={cn(
                  "absolute inset-0 rounded-2xl bg-blue-400/30",
                  compact ? "scale-[1.18]" : "scale-[1.22]"
                )}
                style={{
                  animation: "rescueStepWave 1.7s ease-out infinite",
                }}
              />

              <span
                className={cn(
                  "absolute inset-0 rounded-2xl border border-blue-300/70 dark:border-blue-400/50",
                  compact ? "scale-[1.28]" : "scale-[1.34]"
                )}
                style={{
                  animation: "rescueStepWave 1.7s ease-out infinite 0.35s",
                }}
              />
            </>
          )}

          <div
            className={cn(
              "relative z-10 flex items-center justify-center rounded-2xl transition-all",
              compact ? "h-12 w-12" : "h-14 w-14",
              iconWrapClass
            )}
            style={
              current
                ? {
                  animation:
                    "rescueStepFloat 1.8s ease-in-out infinite, rescueStepIconPulse 1.8s ease-in-out infinite",
                }
                : undefined
            }
          >
            {icon}
          </div>
        </div>

        <p
          className={cn(
            "mt-3 font-black uppercase tracking-tight leading-tight",
            compact ? "text-[11px]" : "text-xs md:text-sm",
            labelClass
          )}
        >
          {label}
        </p>

        <p
          className={cn(
            "mt-1 font-semibold leading-tight",
            compact ? "text-[11px]" : "text-[11px] md:text-xs",
            timeClass
          )}
        >
          {time || "Chưa có"}
        </p>
      </div>
    </>
  );
};

const DetailRow = ({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 text-blue-600 dark:text-blue-400">{icon}</div>
    <div>
      <p className={`${compact ? "text-[10px]" : "text-[10px]"} font-black uppercase tracking-wider text-slate-400 dark:text-slate-500`}>
        {label}
      </p>
      <p className={`${compact ? "text-[13px]" : "text-[13px]"} font-bold text-slate-800 dark:text-slate-100 break-all`}>
        {value}
      </p>
    </div>
  </div>
);

export default RescueTeam_User;
import React, { useState, useEffect, useRef } from 'react';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'mapbox-gl-leaflet';

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string | undefined;

(mapboxgl as any).setTelemetryEnabled?.(false);

if (GOONG_API_KEY) {
  mapboxgl.accessToken = GOONG_API_KEY;
}

import Navbar from '../../components/Navbar';

import {
  Phone,
  Route,
  Search,
  Navigation,
  Plus,
  Minus,
  Menu,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Activity,
  Clock3,
  ClipboardList,
  Truck,
  Flag,
  User,
  Users,
  Image as ImageIcon,
  Link as LinknguonIcon,
  Loader2,
} from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import mapIcon from '../../assets/layers.png';
import addressIcon from '../../assets/location.png';
import peopleIcon from '../../assets/people.png';
import timeIcon from '../../assets/time.png';

import sosIcon from '../../assets/sos.png';
import sos2Icon from '../../assets/sos2.png';

/* =========================
   LEAFLET ICONS
========================= */
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const createPinIcon = (color: string, symbol: string) =>
  L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        border: 2px solid white;
      ">
        <div style="
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(45deg);
          color: white;
          font-size: 20px;
          font-weight: 800;
        ">
          ${symbol}
        </div>
      </div>
    `,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });

const createRescuingIcon = (color: string, symbol: string) =>
  L.divIcon({
    html: `
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: white;
          border: 3px solid #2563eb;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 999px;
            background: ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: 800;
          ">
            ${symbol}
          </div>
        </div>
      `,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });

const userBlueDot = L.divIcon({
  html: `
    <div style="
      width:16px;
      height:16px;
      background:#3b82f6;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 0 0 6px rgba(59,130,246,0.3);
    "></div>
  `,
  className: ''
});

const rescueTeamIcon = createRescuingIcon("#2563eb", "⛑");

const createLineInfoLabel = (
  text: string,
  tone: "blue" | "green" = "blue"
) =>
  L.divIcon({
    html: `
      <div style="
        display: inline-block;
        white-space: nowrap;
        padding: 6px 10px;
        border-radius: 999px;
        background: ${tone === "blue" ? "#eff6ff" : "#ecfdf5"};
        color: ${tone === "blue" ? "#1d4ed8" : "#047857"};
        border: 1px solid ${tone === "blue" ? "#bfdbfe" : "#a7f3d0"};
        box-shadow: 0 4px 10px rgba(0,0,0,0.12);
        font-size: 12px;
        font-weight: 700;
      ">
        ${text}
      </div>
    `,
    className: "",
    iconSize: [150, 36],
    iconAnchor: [75, 18]
  });

const sosLabels: Record<string, React.ReactNode> = {
  rescue: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần cứu hộ khẩn cấp</span>
    </div>
  ),
  supplies: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần nhu yếu phẩm</span>
    </div>
  ),
  vehicle: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần cứu hộ xe</span>
    </div>
  ),
  other: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Yêu cầu khác</span>
    </div>
  )
};

L.Marker.prototype.options.icon = DefaultIcon;

/* =========================
   TYPES
========================= */
type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastState = {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
};

type StepStatus = {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  badgeClass: string;
  eta?: string | null;
  distance?: string | null;
};

/* =========================
   UTILS
========================= */
const timeAgo = (iso: string) => {
  const now = new Date();
  const past = new Date(iso);
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa có';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Chưa có';

  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getStatusLabel = (status: string) => {
  if (status === 'new') return 'Đang chờ cứu hộ';
  if (status === 'rescuing') return 'Đang được cứu hộ';
  if (status === 'cancel') return 'Đã hủy';
  if (status === 'done') return 'Đã hoàn thành';
  return 'Không rõ';
};

const getStatusClass = (status: string) => {
  if (status === 'new') return 'bg-amber-50 text-amber-600 border-amber-200';
  if (status === 'rescuing') return 'bg-blue-50 text-blue-600 border-blue-200';
  if (status === 'cancel') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (status === 'done') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const getTypeLabel = (type: string) => {
  if (type === 'rescue') return 'Cần cứu hộ';
  if (type === 'supplies') return 'Cần nhu yếu phẩm';
  if (type === 'vehicle') return 'Cần cứu hộ xe';
  if (type === 'other') return 'Yêu cầu khác';
  return 'Yêu cầu khác';
};

const truncateText = (text: string = '', max = 50) => {
  if (!text) return 'Không có địa chỉ';
  return text.length > max ? text.slice(0, max) + '...' : text;
};

const toRad = (v: number) => (v * Math.PI) / 180;

const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const estimateArrivalFromDistance = (distanceKm: number, sosType?: string) => {
  let avgSpeedKmH = 35;

  if (sosType === "vehicle") avgSpeedKmH = 40;
  else if (sosType === "supplies") avgSpeedKmH = 30;
  else if (sosType === "rescue") avgSpeedKmH = 35;
  else avgSpeedKmH = 30;

  const totalMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmH) * 60));

  if (totalMinutes < 60) {
    return `Khoảng ${totalMinutes} phút`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `Khoảng ${hours} giờ`;
  }

  return `Khoảng ${hours} giờ ${minutes} phút`;
};

const getRescueTrackingInfo = (item: any) => {
  const rescueLat = Number(item?.rescuer_lat);
  const rescueLng = Number(item?.rescuer_lng);
  const sosLat = Number(item?.lat);
  const sosLng = Number(item?.lng);

  const hasValidCoords =
    Number.isFinite(rescueLat) &&
    Number.isFinite(rescueLng) &&
    Number.isFinite(sosLat) &&
    Number.isFinite(sosLng);

  if (!hasValidCoords) return null;

  const distanceKm = getDistanceKm(rescueLat, rescueLng, sosLat, sosLng);

  return {
    distanceKm,
    distanceText:
      distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`,
    etaText: estimateArrivalFromDistance(distanceKm, item?.sos_type)
  };
};

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

const parseImages = (images: any): string[] => {
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

const getStepStatus = (item: any): StepStatus => {
  const tracking = getRescueTrackingInfo(item);

  if (item.status === "cancel") {
    return {
      currentStep: 1,
      title: "Đã hủy",
      badgeClass: "bg-red-100 text-red-700 border border-red-200",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "done") {
    return {
      currentStep: 4,
      title: "Hoàn thành",
      badgeClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "rescuing") {
    const hasRescuerCoords =
      Number.isFinite(Number(item?.rescuer_lat)) &&
      Number.isFinite(Number(item?.rescuer_lng));

    if (hasRescuerCoords) {
      return {
        currentStep: 3,
        title: "Đang đến",
        badgeClass: "bg-blue-100 text-blue-700 border border-blue-200",
        eta: tracking?.etaText || null,
        distance: tracking?.distanceText || null,
      };
    }

    return {
      currentStep: 2,
      title: "Tiếp nhận",
      badgeClass: "bg-blue-100 text-blue-700 border border-blue-200",
      eta: tracking?.etaText || null,
      distance: tracking?.distanceText || null,
    };
  }

  return {
    currentStep: 1,
    title: "Chờ tiếp nhận",
    badgeClass: "bg-amber-100 text-amber-700 border border-amber-200",
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

/* =========================
   UI COMPONENTS
========================= */
const toastMeta = {
  success: {
    title: 'Thành công',
    icon: CheckCircle2,
    border: 'border-emerald-200',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    line: 'bg-emerald-500'
  },
  error: {
    title: 'Có lỗi xảy ra',
    icon: XCircle,
    border: 'border-red-200',
    iconWrap: 'bg-red-100 text-red-600',
    line: 'bg-red-500'
  },
  warning: {
    title: 'Cảnh báo',
    icon: AlertTriangle,
    border: 'border-amber-200',
    iconWrap: 'bg-amber-100 text-amber-600',
    line: 'bg-amber-500'
  },
  info: {
    title: 'Thông báo',
    icon: Info,
    border: 'border-blue-200',
    iconWrap: 'bg-blue-100 text-blue-600',
    line: 'bg-blue-500'
  }
} as const;

const NotificationToast = ({
  toast,
  onClose
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
            animation: `${showAnim ? 'toastIn' : 'toastOut'} 0.28s ease forwards`
          }}
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.iconWrap}`}>
              <Icon size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800">{meta.title}</div>
              <p className="mt-0.5 text-sm text-slate-600 break-words">{toast.message}</p>
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
                width: '100%',
                height: '100%',
                transformOrigin: 'left',
                animationName: 'toastProgressShrink',
                animationDuration: `${toast.duration}ms`,
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards'
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

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
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div
      className={`mt-5 rounded-[18px] border ${compact ? "p-3.5 md:p-4 gap-3" : "p-4 md:p-5 gap-4"} flex items-start ${toneMap[tone]}`}
    >
      <div
        className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm`}
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
    ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] ring-4 ring-blue-100"
    : done || active
      ? "bg-blue-50 text-blue-600 border border-blue-200"
      : "bg-slate-100 text-slate-400 border border-slate-200";

  const labelClass = current || active || done ? "text-slate-900" : "text-slate-400";
  const timeClass = current || active || done ? "text-slate-500" : "text-slate-400";

  return (
    <>
      <style>
        {`
          @keyframes squareFloat {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-3px);
            }
          }

          @keyframes squareWave {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            70% {
              transform: scale(1.6);
              opacity: 0;
            }
            100% {
              transform: scale(1.6);
              opacity: 0;
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
                style={{ animation: "squareWave 1.7s ease-out infinite" }}
              />
              <span
                className={cn(
                  "absolute inset-0 rounded-2xl border border-blue-300/60",
                  compact ? "scale-[1.28]" : "scale-[1.34]"
                )}
                style={{ animation: "squareWave 1.7s ease-out infinite 0.35s" }}
              />
            </>
          )}

          <div
            className={cn(
              "relative overflow-hidden flex items-center justify-center rounded-2xl transition-all",
              compact ? "h-12 w-12" : "h-14 w-14",
              iconWrapClass
            )}
            style={current ? { animation: "squareFloat 1.8s ease-in-out infinite" } : undefined}
          >
            <span className="relative z-10">{icon}</span>
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
    className={`rounded-[18px] border border-slate-200 bg-slate-50 ${compact ? "p-3.5" : "p-4"} ${full ? "md:col-span-2" : ""}`}
  >
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
      {label}
    </p>
    <p
      className={`mt-1.5 ${compact ? "text-[13px] leading-5" : "text-sm leading-6"} font-bold ${italic ? "italic text-slate-600" : "text-slate-800"}`}
    >
      {value}
    </p>
  </div>
);

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
    <div className="mt-0.5 text-blue-600">{icon}</div>
    <div>
      <p className={`${compact ? "text-[10px]" : "text-[10px]"} font-black uppercase tracking-wider text-slate-400`}>
        {label}
      </p>
      <p className={`${compact ? "text-[13px]" : "text-[13px]"} font-bold text-slate-800 break-all`}>
        {value}
      </p>
    </div>
  </div>
);

const ActionConfirmModal: React.FC<{
  item: any;
  tone: "red" | "amber" | "emerald";
  title: string;
  desc: string;
  question: string;
  confirmLabel: string;
  loadingLabel: string;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}> = ({
  item,
  tone,
  title,
  desc,
  question,
  confirmLabel,
  loadingLabel,
  submitting,
  onBack,
  onConfirm,
}) => {
    const toneClass = {
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
    }[tone];

    const Icon = tone === "emerald" ? CheckCircle2 : AlertTriangle;

    return (
      <div
        className="fixed inset-0 z-[5500] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
        onClick={() => {
          if (!submitting) onBack();
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
                  toneClass.iconWrap
                )}
              >
                <Icon size={22} />
              </div>

              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm text-slate-200">{desc}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
              <p>
                <span className="text-slate-500">Mã yêu cầu: </span>
                <span className="font-bold text-slate-900">
                  #SOS-{item?.id || "---"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Người cần hỗ trợ: </span>
                <span className="font-bold text-slate-900">
                  {item?.name || "Không có"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Địa chỉ: </span>
                <span className="font-bold text-slate-900">
                  {item?.address || "Không có"}
                </span>
              </p>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 text-amber-600 shrink-0"
              />
              <p className="text-sm leading-6 text-slate-700">{question}</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onBack}
                disabled={submitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-70",
                  toneClass.button
                )}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? loadingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

/* =========================
   MAP HELPERS
========================= */
const MapController = ({ zoomAction }: { zoomAction: 'in' | 'out' }) => {
  const map = useMap();

  const handleZoom = () => {
    if (zoomAction === 'in') map.zoomIn();
    else map.zoomOut();
  };

  return (
    <button
      onClick={handleZoom}
      className="p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition"
    >
      {zoomAction === 'in' ? <Plus size={20} /> : <Minus size={20} />}
    </button>
  );
};

const MapViewportTracker = ({
  onBoundsChange
}: {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const updateViewport = () => {
      onBoundsChange(map.getBounds());
    };

    updateViewport();

    map.on('moveend', updateViewport);
    map.on('zoomend', updateViewport);

    return () => {
      map.off('moveend', updateViewport);
      map.off('zoomend', updateViewport);
    };
  }, [map, onBoundsChange]);

  return null;
};

const getMarkerIcon = (type: string, status: string) => {
  const isRescuing = status === "rescuing";
  const isDone = status === "done";

  const getColor = () => {
    if (type === "rescue") return "#ef4444";
    if (type === "supplies") return "#f59e0b";
    if (type === "vehicle") return "#3b82f6";
    return "#6b7280";
  };

  const symbol =
    type === "rescue" ? "!" :
      type === "supplies" ? "📦" :
        type === "vehicle" ? "🚗" : "?";

  if (isDone) {
    return L.divIcon({
      html: `
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 999px;
              background: white;
              border: 3px solid #22c55e;
              box-shadow: 0 4px 10px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 24px;
                height: 24px;
                border-radius: 999px;
                background: ${getColor()};
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 14px;
                font-weight: 800;
              ">
                ${symbol}
              </div>
            </div>
          `,
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  if (isRescuing) {
    return createRescuingIcon(getColor(), symbol);
  }

  return createPinIcon(getColor(), symbol);
};

const FlyToLocation = ({ position }: { position: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.5 });
    }
  }, [position, map]);

  return null;
};

const AnimatedDots = () => {
  return (
    <>
      <style>
        {`
          @keyframes statusDotsPulse {
            0%, 80%, 100% {
              opacity: 0.25;
              transform: translateY(0);
            }
            40% {
              opacity: 1;
              transform: translateY(-1px);
            }
          }
        `}
      </style>

      <span className="inline-flex items-center gap-1 ml-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out 0.2s' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out 0.4s' }}
        />
      </span>
    </>
  );
};

const AnimatedRescueLineStyle = () => {
  return (
    <style>
      {`
        @keyframes rescueDashMove {
          to {
            stroke-dashoffset: -16;
          }
        }

        .rescue-route-base {
          stroke: #93c5fd;
          stroke-width: 8;
          stroke-linecap: round;
          opacity: 0.35;
        }

        .rescue-route-animated {
          stroke: #2563eb;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 10 10;
          animation: rescueDashMove 0.9s linear infinite;
        }
      `}
    </style>
  );
};

const GoongStyleLayer = ({ enabled }: { enabled: boolean }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!GOONG_API_KEY || !enabled) return;

    try {
      const styleUrl = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_API_KEY}`;
      const createLayer = (L as any).mapboxGL;

      if (typeof createLayer !== 'function') {
        console.error('mapboxGL function không khả dụng - kiểm tra mapbox-gl-leaflet');
        return;
      }

      if (!layerRef.current) {
        layerRef.current = createLayer({
          style: styleUrl,
          accessToken: GOONG_API_KEY,
          mapboxgl,
          attribution: '&copy; GOONG Map'
        });
      }

      if (!map.hasLayer(layerRef.current)) {
        layerRef.current.addTo(map);
      }
    } catch (error) {
      console.error('Error adding Goong layer:', error);
    }

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [enabled, map]);

  return null;
};

/* =========================
   MAIN COMPONENT
========================= */
const Map_Admin: React.FC = () => {
  const [mapType, setMapType] = useState<'default' | 'satellite'>('default');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const [rescuerList, setRescuerList] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const [selectedSOS, setSelectedSOS] = useState<any | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [flyToUser, setFlyToUser] = useState<[number, number] | null>(null);
  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const [confirmReceiveOpen, setConfirmReceiveOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [confirmRequestCancelOpen, setConfirmRequestCancelOpen] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'rescuing' | 'done'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'rescue' | 'supplies' | 'vehicle' | 'other'>('all');
  const [showSOS, setShowSOS] = useState(true);
  const [showRescuers, setShowRescuers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  const lastSentLocationRef = useRef<{
    lat: number;
    lng: number;
    time: number;
  } | null>(null);

  const updateRescuerLocation = async (lat: number, lng: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const last = lastSentLocationRef.current;
      const now = Date.now();

      const movedEnough =
        !last ||
        Math.abs(last.lat - lat) > 0.00005 ||
        Math.abs(last.lng - lng) > 0.00005;

      const waitedEnough = !last || now - last.time >= 5000;

      if (!movedEnough && !waitedEnough) return;

      await fetch("http://localhost:3000/api/rescuer/location", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lng }),
      });

      lastSentLocationRef.current = { lat, lng, time: now };
    } catch (err) {
      console.error("Cập nhật GPS đội cứu hộ thất bại:", err);
    }
  };

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: '',
    type: 'info',
    duration: 3000
  });

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ) => {
    setToast({
      id: Date.now(),
      show: true,
      message,
      type,
      duration
    });
  };

  const closeToast = () => {
    setToast((prev) => ({
      ...prev,
      show: false
    }));
  };

  useEffect(() => {
    const savedUserId = localStorage.getItem('userId');
    const savedRole = localStorage.getItem('role');

    setCurrentUserId(savedUserId ? Number(savedUserId) : null);
    setCurrentUserRole(savedRole || '');
  }, []);

  useEffect(() => {
    if (!toast.show) return;

    const timer = setTimeout(() => {
      closeToast();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration]);

  const baseFilteredMarkers = markers.filter((m) => {
    if (m.status === "cancel") return false;

    const keyword = searchKeyword.trim().toLowerCase();

    const matchKeyword =
      !keyword ||
      (m.name || '').toLowerCase().includes(keyword) ||
      (m.phone || '').toLowerCase().includes(keyword) ||
      (m.address || '').toLowerCase().includes(keyword);

    const matchStatus =
      statusFilter === 'all' ? true : m.status === statusFilter;

    const matchType =
      typeFilter === 'all' ? true : m.sos_type === typeFilter;

    return matchKeyword && matchStatus && matchType;
  });

  const filteredMarkers = !mapBounds
    ? baseFilteredMarkers
    : baseFilteredMarkers.filter((m) => {
      if (typeof m.lat !== 'number' || typeof m.lng !== 'number') {
        return false;
      }

      return mapBounds.contains(L.latLng(m.lat, m.lng));
    });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation([lat, lng]);
      },
      (err) => {
        console.log('Không lấy được GPS:', err);
      }
    );
  }, []);

  useEffect(() => {
    const fetchSOS = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/rescues');
        const data = await res.json();
        setMarkers(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast('Không tải được danh sách yêu cầu cứu hộ.', 'error');
      }
    };

    fetchSOS();
    const interval = setInterval(fetchSOS, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSOS) return;

    const latest = markers.find((item) => Number(item.id) === Number(selectedSOS.id));
    if (latest) {
      setSelectedSOS(latest);
    }
  }, [markers, selectedSOS?.id]);

  useEffect(() => {
    const fetchRescuers = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/rescuers");
        const data = await res.json();

        setRescuerList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Lỗi load rescuer:", err);
      }
    };

    fetchRescuers();

    const interval = setInterval(fetchRescuers, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSOS) {
      setConfirmRequestCancelOpen(false);
      setConfirmReceiveOpen(false);
      setConfirmCancelOpen(false);
      setConfirmDoneOpen(false);
    }
  }, [selectedSOS]);

  const flyToMyLocationOnly = () => {
    setIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUserLocation([lat, lng]);
        setFlyToUser([lat, lng]);

        setTimeout(() => {
          setFlyToUser(null);
        }, 2000);

        setIsGettingGPS(false);
      },
      (err) => {
        console.log('Không lấy được GPS:', err);
        showToast('Không lấy được vị trí GPS.', 'error');
        setIsGettingGPS(false);
      }
    );
  };

  const trackedMarkerTypes = ["rescue", "supplies", "vehicle", "other"] as const;
  const [trackedMarkerIndex, setTrackedMarkerIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrackedMarkerIndex((prev) => (prev + 1) % trackedMarkerTypes.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getTrackedMarkerStyle = (type?: string) => {
    switch (type) {
      case "rescue":
        return { icon: "!", bgClass: "bg-red-500" };
      case "supplies":
        return { icon: "📦", bgClass: "bg-amber-500" };
      case "vehicle":
        return { icon: "🚗", bgClass: "bg-blue-500" };
      default:
        return { icon: "?", bgClass: "bg-slate-500" };
    }
  };

  const currentTrackedType = trackedMarkerTypes[trackedMarkerIndex];
  const trackedMarker = getTrackedMarkerStyle(currentTrackedType);

  const trackedRescues = baseFilteredMarkers.filter((m) => {
    return (
      m.status === "rescuing" &&
      Number.isFinite(Number(m.lat)) &&
      Number.isFinite(Number(m.lng)) &&
      Number.isFinite(Number(m.rescuer_lat)) &&
      Number.isFinite(Number(m.rescuer_lng))
    );
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    if (currentUserRole !== "rescuer") return;

    const activeRescue = markers.find(
      (m) =>
        Number(m.handled_by) === currentUserId &&
        m.status === "rescuing"
    );

    if (!activeRescue) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUserLocation([lat, lng]);
        await updateRescuerLocation(lat, lng);
      },
      (err) => {
        console.error("Không lấy được GPS đội cứu hộ:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [markers, currentUserId, currentUserRole]);

  const handleBoundsChange = React.useCallback((bounds: L.LatLngBounds) => {
    setMapBounds((prev) => {
      if (
        prev &&
        prev.getSouth() === bounds.getSouth() &&
        prev.getWest() === bounds.getWest() &&
        prev.getNorth() === bounds.getNorth() &&
        prev.getEast() === bounds.getEast()
      ) {
        return prev;
      }

      return bounds;
    });
  }, []);

  const updateRescueStatus = async (
    id: number | string,
    nextStatus: 'new' | 'rescuing' | 'done' | 'cancel'
  ) => {
    try {
      setIsSubmittingAction(true);

      const token = localStorage.getItem('token');

      if (!token) {
        showToast('Bạn chưa đăng nhập.', 'warning');
        return;
      }

      const res = await fetch(`http://localhost:3000/api/rescues/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || 'Không thể cập nhật trạng thái yêu cầu.', 'error');
        return;
      }

      setSelectedSOS(data);
      setMarkers((prev) =>
        prev.map((item) => (item.id === id ? data : item))
      );

      if (nextStatus === 'rescuing') {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserLocation([lat, lng]);
            await updateRescuerLocation(lat, lng);
          },
          () => { }
        );

        showToast('Đã nhận yêu cầu cứu hộ.', 'success');
      } else if (nextStatus === 'new') {
        showToast('Đã hủy nhận yêu cầu.', 'success');
      } else if (nextStatus === 'done') {
        showToast('Đã hoàn thành yêu cầu cứu hộ.', 'success');
      } else if (nextStatus === 'cancel') {
        showToast('Đã hủy yêu cầu SOS.', 'success');
      }
    } catch (error) {
      showToast('Không thể kết nối server.', 'error');
    } finally {
      setIsSubmittingAction(false);
      setConfirmReceiveOpen(false);
      setConfirmCancelOpen(false);
      setConfirmDoneOpen(false);
      setConfirmRequestCancelOpen(false);
    }
  };

  const canManageSelectedSOS =
    !!selectedSOS &&
    selectedSOS.status === 'rescuing' &&
    currentUserRole === 'rescuer' &&
    currentUserId !== null &&
    Number(selectedSOS.handled_by) === currentUserId;

  const isAdmin = currentUserRole === 'admin';

  const isSOSUnassigned =
    !!selectedSOS &&
    (selectedSOS.status === 'new' ||
      (!selectedSOS.assigned_team && !selectedSOS.handled_by));

  const canAdminManageSOS = !!selectedSOS && isAdmin;

  const canShowCancelRequestAction =
    !!selectedSOS &&
    canAdminManageSOS &&
    selectedSOS.status !== 'done' &&
    selectedSOS.status !== 'cancel' &&
    isSOSUnassigned;

  const canShowRescueActions =
    !!selectedSOS &&
    canAdminManageSOS &&
    selectedSOS.status === 'rescuing';

  const canShowReceiveAction =
    !!selectedSOS &&
    currentUserRole === "rescuer" &&
    selectedSOS.status === "new";

  const openPhoneCall = (phone?: string) => {
    if (!phone) {
      showToast('Không có số điện thoại để gọi.', 'error');
      return;
    }
    window.open(`tel:${phone}`, '_self');
  };

  const openDirections = (item: any) => {
    if (item?.lat && item?.lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`,
        '_blank'
      );
      return;
    }

    if (item?.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`,
        '_blank'
      );
      return;
    }

    showToast('Không có thông tin vị trí để chỉ đường.', 'error');
  };

  const selectedStep = selectedSOS ? getStepStatus(selectedSOS) : null;
  const trackingInfo = selectedSOS ? getRescueTrackingInfo(selectedSOS) : null;
  const selectedImages = selectedSOS ? parseImages(selectedSOS.images) : [];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <NotificationToast key={toast.id} toast={toast} onClose={closeToast} />

      <Navbar />

      <main className="flex-1 relative mt-16 flex">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1100] p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50"
          >
            <Menu size={22} />
          </button>
        )}

        <aside
          className={`absolute top-4 left-4 z-[1000] w-[420px] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 flex flex-col max-h-[calc(100%-32px)] overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}
        >
          <div className="p-5 border-b border-slate-100 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Danh sách điểm SOS</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Theo dõi và điều phối cứu hộ thời gian thực
              </p>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/70">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên, SĐT, địa chỉ..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'new' | 'rescuing' | 'done')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="new">Đang chờ cứu hộ</option>
                <option value="rescuing">Đang được cứu hộ</option>
                <option value="done">Đã hoàn thành</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'rescue' | 'supplies' | 'vehicle' | 'other')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Tất cả loại SOS</option>
                <option value="rescue">Cần cứu hộ</option>
                <option value="supplies">Cần nhu yếu phẩm</option>
                <option value="vehicle">Cần cứu hộ xe</option>
                <option value="other">Yêu cầu khác</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSOS}
                  onChange={() => setShowSOS(!showSOS)}
                />
                Hiển thị SOS
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showRescuers}
                  onChange={() => setShowRescuers(!showRescuers)}
                />
                Hiển thị đội cứu hộ
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={() => setShowRoutes(!showRoutes)}
                />
                Hiển thị đường đi
              </label>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tổng hiển thị:</span>
              <span className="font-bold text-slate-700">{filteredMarkers.length} yêu cầu</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredMarkers.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                {!showSOS && !showRescuers && !showRoutes
                  ? 'Bạn đã tắt tất cả lớp hiển thị'
                  : 'Không có dữ liệu phù hợp với bộ lọc'}
              </div>
            ) : (
              filteredMarkers.map((m, idx) => {
                const isActive = selectedSOS?.id === m.id;

                return (
                  <button
                    key={m.id || idx}
                    onClick={() => {
                      setSelectedSOS(m);
                      setFlyToUser([m.lat, m.lng]);
                      setTimeout(() => setFlyToUser(null), 1500);
                    }}
                    className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all ${isActive
                      ? 'border-blue-400 bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-slate-800 truncate">
                            {m.name || 'Ẩn danh'}
                          </div>

                          <div className={`inline-flex items-center text-[10px] px-2 py-1 rounded-full border font-semibold ${getStatusClass(m.status)}`}>
                            <span>{getStatusLabel(m.status)}</span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">
                          {m.phone || 'Không có số điện thoại'}
                        </div>
                      </div>

                      <div className="shrink-0 text-[10px] font-medium text-slate-400">
                        {m.created_at ? timeAgo(m.created_at) : ''}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <img src={peopleIcon} alt="victims" className="w-4 h-4" />
                        <span className="font-medium text-slate-700">{m.victims || 1} người</span>
                      </div>

                      <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <img src={sos2Icon} alt="type" className="w-4 h-4" />
                        <span className="font-medium text-slate-700">{getTypeLabel(m.sos_type)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 leading-snug">
                      <img src={addressIcon} alt="address" className="w-4 h-4 mt-0.5" />
                      <span>{truncateText(m.address, 65)}</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Nhấn để xem chi tiết</span>
                      <span className="text-xs font-semibold text-blue-600">Mở</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex-1 relative z-10">
          <MapContainer
            center={userLocation || [16.047079, 108.20623]}
            zoom={userLocation ? 15 : 5}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
            minZoom={5}
            maxZoom={18}
            maxBounds={[
              [7.0, 101.0],
              [24.5, 110.5]
            ]}
            maxBoundsViscosity={1.0}
          >
            {!userLocation && (
              <div className="absolute inset-0 z-[2000] bg-black/40 flex items-center justify-center">
                <div className="bg-white px-6 py-3 rounded-lg shadow text-sm font-medium">
                  📍Đang lấy vị trí của bạn...
                </div>
              </div>
            )}

            {flyToUser && <FlyToLocation position={flyToUser} />}
            <MapViewportTracker onBoundsChange={handleBoundsChange} />

            <AnimatedRescueLineStyle />

            {mapType === 'default' ? (
              <GoongStyleLayer enabled />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri"
              />
            )}

            {mapType === 'satellite' && (
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri &mdash; World Boundaries and Places"
              />
            )}

            {userLocation && (
              <Marker position={userLocation} icon={userBlueDot}>
                <Popup>📍Vị trí hiện tại của bạn</Popup>
              </Marker>
            )}

            {showSOS && filteredMarkers.map((m, index) => (
              <Marker
                key={m.id || index}
                position={[m.lat, m.lng]}
                icon={getMarkerIcon(m.sos_type, m.status)}
              >
                <Popup closeButton={false}>
                  <div className="text-sm w-[240px] font-sans">
                    <div
                      className={`relative text-white text-xs font-bold px-3 py-2 rounded-t-lg text-center ${m.sos_type === 'rescue'
                        ? 'bg-red-600'
                        : m.sos_type === 'supplies'
                          ? 'bg-yellow-500'
                          : m.sos_type === 'vehicle'
                            ? 'bg-blue-600'
                            : 'bg-gray-600'
                        }`}
                    >
                      {sosLabels[m.sos_type] || (
                        <div className="flex items-center gap-1 justify-center">
                          <img src={sosIcon} alt="SOS" className="w-4 h-4" />
                          <span>SOS KHẨN</span>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          (e.target as HTMLElement).closest('.leaflet-popup')?.remove();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="border border-t-0 rounded-b-lg p-3 space-y-2 bg-white">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex gap-1 items-center">
                          <span className="font-medium text-slate-500">Tên:</span>
                          <span className="font-semibold text-base">{m.name}</span>
                        </div>

                        <div className="flex gap-1 items-center">
                          <span className="font-medium text-slate-500">Sđt:</span>
                          <span className="font-medium text-blue-600">{m.phone}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-red-50 text-red-600 rounded p-2 flex items-center justify-center gap-1 text-center">
                          <img src={peopleIcon} alt="Người" className="w-4 h-4" />
                          <span>{m.victims || 1} người</span>
                        </div>

                        <div className="bg-gray-100 rounded p-2 flex items-center justify-center gap-1 text-center">
                          <img src={timeIcon} alt="Thời gian" className="w-4 h-4" />
                          <span>{timeAgo(m.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center text-xs text-slate-600 leading-snug gap-1">
                        <img src={addressIcon} alt="Map Pin" className="w-4 h-4" />
                        <span>{m.address || 'Không có địa chỉ'}</span>
                      </div>

                      <div className="border-t border-slate-200 my-2"></div>
                      <div className={`inline-flex items-center text-xs font-bold ${m.status === 'done'
                        ? 'text-emerald-600'
                        : m.status === 'rescuing'
                          ? 'text-blue-600'
                          : m.status === 'new'
                            ? 'text-amber-500'
                            : 'text-slate-500'
                        }`}>
                        <span>{getStatusLabel(m.status)}</span>
                        {(m.status === 'new' || m.status === 'rescuing') && <AnimatedDots />}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSOS(m);
                          setFlyToUser([m.lat, m.lng]);
                          setTimeout(() => setFlyToUser(null), 1500);
                        }}
                        className="w-full mt-2 bg-gray-100 hover:bg-gray-200 py-2 rounded-md text-xs font-semibold shadow"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {showRescuers && rescuerList.map((r, index) => {
              const lat = Number(r.lat);
              const lng = Number(r.lng);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

              const activeSOS = markers.find(
                (m) =>
                  Number(m.handled_by) === Number(r.user_id) &&
                  m.status === "rescuing"
              );

              return (
                <Marker
                  key={`rescuer-${r.user_id}-${index}`}
                  position={[lat, lng]}
                  icon={rescueTeamIcon}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      {activeSOS ? (
                        <>
                          <div className="font-bold text-blue-600">
                            🚑 Đang di chuyển
                          </div>

                          <div className="font-semibold">
                            {r.full_name || "Đội cứu hộ"}
                          </div>

                          <div className="text-xs text-slate-600">
                            📍 Vị trí yêu cầu #{activeSOS.id}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-green-600">
                            🚑 Sẵn sàng
                          </div>

                          <div className="font-semibold">
                            {r.full_name || "Đội cứu hộ"}
                          </div>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {showRoutes && trackedRescues.map((m) => {
              const rescuePos: [number, number] = [
                Number(m.rescuer_lat),
                Number(m.rescuer_lng)
              ];

              const sosPos: [number, number] = [
                Number(m.lat),
                Number(m.lng)
              ];

              const trackingInfo = getRescueTrackingInfo(m);

              const midLat = (rescuePos[0] + sosPos[0]) / 2;
              const midLng = (rescuePos[1] + sosPos[1]) / 2;

              const upperLabelPos: [number, number] = [midLat + 0.001, midLng];
              const lowerLabelPos: [number, number] = [midLat - 0.001, midLng];

              return (
                <React.Fragment key={m.id}>
                  <>
                    <Polyline
                      positions={[rescuePos, sosPos]}
                      pathOptions={{ className: "rescue-route-base" }}
                    />

                    <Polyline
                      positions={[rescuePos, sosPos]}
                      pathOptions={{ className: "rescue-route-animated" }}
                    />
                  </>

                  {trackingInfo && (
                    <>
                      <Marker
                        position={upperLabelPos}
                        icon={createLineInfoLabel(
                          `Còn ${trackingInfo.distanceText}`,
                          "blue"
                        )}
                        interactive={false}
                      />

                      <Marker
                        position={lowerLabelPos}
                        icon={createLineInfoLabel(
                          `${trackingInfo.etaText}`,
                          "green"
                        )}
                        interactive={false}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            })}

            <div className="absolute bottom-6 left-6 z-[1000] bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl px-4 py-3 w-[360px]">
              <div className="text-sm font-bold text-slate-800 mb-3">
                CHÚ THÍCH:
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-red-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      !
                    </span>
                  </span>
                  <span className="leading-snug">Cần cứu hộ khẩn cấp</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-amber-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      📦
                    </span>
                  </span>
                  <span className="leading-snug">Cần nhu yếu phẩm</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-blue-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      🚗
                    </span>
                  </span>
                  <span className="leading-snug">Cần cứu hộ xe</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-slate-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      ?
                    </span>
                  </span>
                  <span className="leading-snug">Yêu cầu khác</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-[3px] border-blue-600 shadow-md shrink-0">
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[12px] font-bold leading-none tracked-marker-bounce ${trackedMarker.bgClass}`}
                    >
                      {trackedMarker.icon}
                    </span>
                  </span>
                  <span className="leading-snug">Đang được cứu hộ</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-[3px] border-blue-600 shadow-md shrink-0">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[12px] leading-none">
                      ⛑
                    </span>
                  </span>
                  <span className="leading-snug">Vị trí đội cứu hộ</span>
                </div>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <MapController zoomAction="in" />
              <MapController zoomAction="out" />

              <button
                onClick={() => setMapType(mapType === 'default' ? 'satellite' : 'default')}
                className="p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50"
              >
                <img src={mapIcon} alt="Layers" className="w-5 h-5" />
              </button>

              <button
                onClick={flyToMyLocationOnly}
                disabled={isGettingGPS}
                className="p-2 bg-white border border-slate-200 rounded-lg shadow-md text-blue-500 hover:bg-blue-50 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGettingGPS ? (
                  <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Navigation size={20} />
                )}
              </button>
            </div>
          </MapContainer>
        </div>
      </main>

      {selectedSOS && (
        <>
          <div
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
            onClick={() => {
              setSelectedSOS(null);
            }}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] min-h-0 overflow-hidden rounded-[24px] bg-white border border-slate-200 shadow-[0_24px_70px_rgba(15,23,42,0.32)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-30 shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-4 md:px-5 py-4 border-b border-white/10">
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
                      Mã yêu cầu: #SOS-{selectedSOS.id}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        setSelectedSOS(null);
                      }}
                      className="rounded-full p-2 text-white transition hover:bg-white/10"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-4 bg-slate-50">
                <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
                        Trình trạng cứu hộ
                      </h2>
                    </div>

                    {selectedStep && (
                      <span
                        className={cn(
                          "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
                          selectedStep.badgeClass
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full", getStepDotClass(selectedSOS.status))} />
                        {selectedStep.title}
                      </span>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 md:p-5">
                    <div className="relative">
                      <div className="absolute left-0 right-0 top-6 h-1 rounded-full bg-slate-200" />

                      <div
                        className="absolute left-0 top-6 h-1 rounded-full bg-blue-600 transition-all duration-500"
                        style={{
                          width:
                            selectedStep?.currentStep === 1
                              ? "12.5%"
                              : selectedStep?.currentStep === 2
                                ? "39%"
                                : selectedStep?.currentStep === 3
                                  ? "68%"
                                  : "100%",
                        }}
                      />

                      <div className="relative grid grid-cols-4 gap-3">
                        <Step
                          icon={<CheckCircle2 size={14} />}
                          label="Gửi yêu cầu"
                          active
                          done={(selectedStep?.currentStep || 1) > 1}
                          current={selectedStep?.currentStep === 1}
                          time={formatDateTime(selectedSOS.created_at)}
                          compact
                        />

                        <Step
                          icon={<ClipboardList size={14} />}
                          label="Tiếp nhận"
                          active={(selectedStep?.currentStep || 1) >= 2}
                          done={(selectedStep?.currentStep || 1) > 2}
                          current={selectedStep?.currentStep === 2}
                          time={formatDateTime(selectedSOS.received_at)}
                          compact
                        />

                        <Step
                          icon={<Truck size={14} />}
                          label="Đang đến"
                          active={(selectedStep?.currentStep || 1) >= 3}
                          done={(selectedStep?.currentStep || 1) > 3}
                          current={selectedStep?.currentStep === 3}
                          time={
                            selectedSOS.status === "done" || selectedSOS.status === "cancel"
                              ? ""
                              : selectedSOS.status === "rescuing" && selectedStep?.currentStep === 3
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
                          active={(selectedStep?.currentStep || 1) >= 4}
                          done={(selectedStep?.currentStep || 1) >= 4}
                          current={selectedStep?.currentStep === 4}
                          time={formatDateTime(selectedSOS.completed_at)}
                          compact
                        />
                      </div>
                    </div>

                    {selectedSOS.status === "cancel" ? (
                      <StatusBanner
                        tone="red"
                        icon={<XCircle size={20} />}
                        title="Yêu cầu đã bị hủy"
                        desc="Yêu cầu này đã được hủy nên sẽ không tiếp tục xử lý cứu hộ."
                        compact
                      />
                    ) : selectedSOS.status === "done" ? (
                      <StatusBanner
                        tone="emerald"
                        icon={<CheckCircle2 size={20} />}
                        title="Yêu cầu đã hoàn thành"
                        desc={`Yêu cầu đã được xử lý xong${selectedSOS.completed_at ? ` vào lúc ${formatDateTime(selectedSOS.completed_at)}` : ""}.`}
                        compact
                      />
                    ) : selectedStep?.currentStep === 1 ? (
                      <StatusBanner
                        tone="amber"
                        icon={<Clock3 size={20} />}
                        title="Đang chờ tiếp nhận"
                        desc="Yêu cầu đang chờ đội cứu hộ nhận xử lý."
                        compact
                      />
                    ) : (
                      <StatusBanner
                        tone="blue"
                        icon={<Navigation size={20} />}
                        title={selectedStep?.currentStep === 3 ? "Đội cứu hộ đang di chuyển" : "Yêu cầu đã được tiếp nhận"}
                        desc={
                          selectedStep?.currentStep === 3
                            ? trackingInfo
                              ? `Đội cứu hộ còn cách vị trí yêu cầu ${trackingInfo.distanceText} - Dự kiến ${trackingInfo.etaText}.`
                              : "Đội cứu hộ đang di chuyển đến vị trí yêu cầu."
                            : "Yêu cầu đã được tiếp nhận và đang chuẩn bị hỗ trợ."
                        }
                        compact
                      />
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-4">
                  <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                        <Info size={16} />
                      </div>
                      <div>
                        <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
                          Chi tiết yêu cầu
                        </h2>
                        <p className="text-xs text-slate-500">
                          Thông tin đầy đủ của yêu cầu SOS
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <DetailCard label="Mã yêu cầu" value={`#SOS-${selectedSOS.id}`} compact />
                      <DetailCard label="Loại yêu cầu" value={getSosTypeLabel(selectedSOS.sos_type)} compact />
                      <DetailCard label="Vị trí cứu trợ" value={selectedSOS.address || "Chưa có"} full compact />
                      <DetailCard
                        label="Tọa độ"
                        value={
                          selectedSOS.lat && selectedSOS.lng
                            ? `${selectedSOS.lat}, ${selectedSOS.lng}`
                            : "Chưa có"
                        }
                        full
                        compact
                      />
                      <DetailCard
                        label="Mô tả tình trạng"
                        value={selectedSOS.note || "Chưa có mô tả"}
                        full
                        italic
                        compact
                      />
                    </div>

                    {selectedImages.length > 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon size={16} />
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Hình ảnh hiện trường
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {selectedImages.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPreviewImg(`http://localhost:3000${img}`)}
                              className="group relative overflow-hidden rounded-[16px] border border-slate-200"
                            >
                              <img
                                src={`http://localhost:3000${img}`}
                                alt={`Ảnh hiện trường ${idx + 1}`}
                                className="h-28 md:h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSOS.source_url && (
                      <div className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <LinknguonIcon size={16} />
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Link nguồn
                          </h3>
                        </div>

                        <a
                          href={selectedSOS.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs md:text-sm font-semibold text-blue-600 underline"
                        >
                          {selectedSOS.source_url}
                        </a>
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                          <User size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm md:text-base font-black text-slate-900">
                            Người gửi yêu cầu
                          </h3>
                          <p className="text-xs text-slate-500">
                            Thông tin người cần hỗ trợ
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <DetailRow icon={<User size={14} />} label="Họ tên" value={selectedSOS.name || "Chưa có"} compact />
                        <DetailRow icon={<Phone size={14} />} label="Số điện thoại" value={selectedSOS.phone || "Chưa có"} compact />
                        <DetailRow icon={<Users size={14} />} label="Số người cần hỗ trợ" value={`${selectedSOS.victims || 1} người`} compact />
                      </div>

                      {selectedSOS.phone && (
                        <button
                          onClick={() => openPhoneCall(selectedSOS.phone)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
                        >
                          <Phone size={14} />
                          Gọi cho người dân
                        </button>
                      )}
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                          <Users size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm md:text-base font-black text-slate-900">
                            Đội cứu hộ phụ trách
                          </h3>
                          <p className="text-xs text-slate-500">
                            Thông tin hỗ trợ trực tiếp
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3.5">
                        <p className="text-sm font-black text-slate-900">
                          {selectedSOS.assigned_team || "Chưa có đội nhận"}
                        </p>

                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          SĐT đội: {selectedSOS.rescuer_phone || "Chưa có"}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2">
                        {selectedSOS.rescuer_phone ? (
                          <button
                            onClick={() => openPhoneCall(selectedSOS.rescuer_phone)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
                          >
                            <Phone size={14} />
                            Liên hệ đội cứu hộ
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500"
                          >
                            <Phone size={14} />
                            Chưa có số liên hệ
                          </button>
                        )}

                        {selectedSOS.address || (selectedSOS.lat && selectedSOS.lng) ? (
                          <button
                            onClick={() => openDirections(selectedSOS)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-blue-700"
                          >
                            <Route size={14} />
                            Chỉ đường tới hiện trường
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500"
                          >
                            <Route size={14} />
                            Chưa có vị trí
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 px-4 py-3 bg-white">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canShowReceiveAction && (
                    <button
                      onClick={() => {
                        setConfirmReceiveOpen(true);
                      }}
                      disabled={isSubmittingAction}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                    >
                      Nhận yêu cầu
                    </button>
                  )}

                  {canShowCancelRequestAction && (
                    <button
                      onClick={() => {
                        setConfirmRequestCancelOpen(true);
                      }}
                      disabled={isSubmittingAction}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                    >
                      Hủy yêu cầu
                    </button>
                  )}

                  {canShowRescueActions && (
                    <>
                      <button
                        onClick={() => {
                          setConfirmCancelOpen(true);
                        }}
                        disabled={isSubmittingAction}
                        className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                      >
                        Hủy nhận yêu cầu
                      </button>

                      <button
                        onClick={() => {
                          setConfirmDoneOpen(true);
                        }}
                        disabled={isSubmittingAction}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                      >
                        Hoàn thành
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setSelectedSOS(null);
                    }}
                    className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>

          {confirmReceiveOpen && canShowReceiveAction && (
            <ActionConfirmModal
              item={selectedSOS}
              tone="red"
              title="Xác nhận nhận yêu cầu"
              desc="Yêu cầu này sẽ được chuyển sang trạng thái đang cứu hộ."
              question="Bạn có chắc muốn nhận yêu cầu cứu hộ này không?"
              confirmLabel="Xác nhận nhận"
              loadingLabel="Đang nhận..."
              submitting={isSubmittingAction}
              onBack={() => setConfirmReceiveOpen(false)}
              onConfirm={() => updateRescueStatus(selectedSOS.id, "rescuing")}
            />
          )}

          {confirmRequestCancelOpen && canAdminManageSOS && (
            <ActionConfirmModal
              item={selectedSOS}
              tone="red"
              title="Xác nhận hủy yêu cầu"
              desc="Yêu cầu SOS sẽ bị hủy và không tiếp tục xử lý cứu hộ."
              question="Bạn có chắc muốn hủy yêu cầu cứu hộ này không?"
              confirmLabel="Xác nhận hủy"
              loadingLabel="Đang hủy..."
              submitting={isSubmittingAction}
              onBack={() => setConfirmRequestCancelOpen(false)}
              onConfirm={() => updateRescueStatus(selectedSOS.id, "cancel")}
            />
          )}

          {confirmCancelOpen && (canManageSelectedSOS || canAdminManageSOS) && (
            <ActionConfirmModal
              item={selectedSOS}
              tone="amber"
              title="Xác nhận hủy nhận yêu cầu"
              desc="Yêu cầu này sẽ được chuyển lại trạng thái chờ tiếp nhận."
              question="Bạn có chắc muốn hủy nhận yêu cầu này không?"
              confirmLabel="Xác nhận hủy"
              loadingLabel="Đang hủy..."
              submitting={isSubmittingAction}
              onBack={() => setConfirmCancelOpen(false)}
              onConfirm={() => updateRescueStatus(selectedSOS.id, "new")}
            />
          )}

          {confirmDoneOpen && (canManageSelectedSOS || canAdminManageSOS) && (
            <ActionConfirmModal
              item={selectedSOS}
              tone="emerald"
              title="Xác nhận hoàn thành"
              desc="Yêu cầu này sẽ được đánh dấu là đã hoàn thành."
              question="Bạn có chắc yêu cầu cứu hộ này đã hoàn thành không?"
              confirmLabel="Xác nhận hoàn thành"
              loadingLabel="Đang hoàn thành..."
              submitting={isSubmittingAction}
              onBack={() => setConfirmDoneOpen(false)}
              onConfirm={() => updateRescueStatus(selectedSOS.id, "done")}
            />
          )}
          {previewImg && (
            <div
              className="fixed inset-0 z-[6000] bg-slate-950/85 flex items-center justify-center"
              onClick={() => setPreviewImg(null)}
            >
              <img
                src={previewImg}
                className="max-w-[90%] max-h-[90%] rounded-xl shadow-2xl border border-slate-700"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Map_Admin; 